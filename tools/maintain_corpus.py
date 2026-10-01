#!/usr/bin/env python3
"""Daily discovery and health evidence. Never edits admissions or runtime authority."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urljoin, urlsplit
from xml.etree.ElementTree import ParseError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import requests
from pool_sweep import PublicTargetGuard, RateLimiter, TargetGuardError, get_worker_session
from tools.compile_eligibility import canonicalize_url, EligibilityError
from tools.reviewed_source_index import collect_index, index_bytes

SCHEMA = 'r4b1t-maintenance-state-v1'
HEAD_FALLBACK = {400, 403, 404, 405, 406, 410, 501}
MAX_SOURCE_BYTES = 5_000_000
MAX_PENDING = 10000
UA = 'R4B1T-corpus-maintenance/1.0 (+https://github.com/GnomeMan4201/r4b1t-h0le)'


def digest(raw):
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


def stamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def request(method, url, headers, guard, limiter, timeout=8):
    """Public-target check and host pacing at every redirect; no automatic redirects."""
    session = get_worker_session()
    for _ in range(11):
        guard.ensure_allowed(url)
        limiter.wait((urlsplit(url).hostname or '').lower())
        response = session.request(method, url, headers={'User-Agent': UA, **headers},
                                   timeout=timeout, allow_redirects=False, stream=True)
        if response.status_code in {301, 302, 303, 307, 308} and response.headers.get('Location'):
            next_url = urljoin(url, response.headers['Location'])
            response.close()
            url = next_url
            # Conditional validators are scoped to the original endpoint.
            headers = {}
            continue
        return response, url
    raise requests.exceptions.TooManyRedirects('redirect limit')


def probe(url, guard, limiter):
    result = {'url': url, 'status': None, 'outcome': 'indeterminate'}
    try:
        response, final = request('HEAD', url, {}, guard, limiter)
        status = response.status_code
        response.close()
        method = 'HEAD'
        if status in HEAD_FALLBACK:
            # Start at the original URL, including when HEAD redirected to a missing page.
            response, final = request('GET', url, {}, guard, limiter)
            status = response.status_code
            response.close()
            method = 'GET'
        result.update(status=status, final_url=final, method=method)
        result['outcome'] = 'missing' if status in {404, 410} and method == 'GET' else 'reachable' if 200 <= status < 400 else 'indeterminate'
    except (requests.exceptions.RequestException, TargetGuardError, ValueError, OSError) as exc:
        result['error'] = type(exc).__name__
    return result


def record(history, observation, now):
    day = now.date().isoformat()
    # One observation per UTC day; reruns cannot manufacture consecutive days.
    previous = [row for row in history if row['at'][:10] != day]
    return (previous + [{**observation, 'at': now.isoformat()}])[-5:]


def retirement_ready(history, now):
    missing = []
    for row in reversed(history):
        if row['outcome'] != 'missing' or row.get('method') != 'GET' or row.get('status') not in {404, 410}:
            break
        missing.append(row)
    if len({row['at'][:10] for row in missing}) < 3:
        return False
    dates = [stamp(row['at']) for row in missing]
    return timedelta(hours=48) <= max(dates) - min(dates) and timedelta(0) <= now - max(dates) <= timedelta(hours=36)


def due_urls(urls, health, now, limit):
    due = []
    for url in urls:
        history = health.get(url, [])
        last = history[-1] if history else None
        interval = 7 if last and last['outcome'] == 'reachable' else 2 if last and last['outcome'] == 'indeterminate' else 1
        if not last or now - stamp(last['at']) >= timedelta(days=interval):
            due.append((last['at'] if last else '', url))
    return [url for _, url in sorted(due)[:limit]]


def proposals(health, today, now):
    by_host = {}
    # Retain burst evidence across reruns with no due work. Only the latest
    # observation for each URL within the readiness freshness window counts.
    recent = [history[-1] for history in health.values() if history
              and timedelta(0) <= now - stamp(history[-1]['at']) <= timedelta(hours=36)]
    for row in recent:
        host = (urlsplit(row['url']).hostname or '').lower()
        by_host.setdefault(host, []).append(row)
    blocked = {host for host, rows in by_host.items()
               if len(rows) >= 3 and sum(r['outcome'] == 'missing' for r in rows) / len(rows) >= .5}
    ready = [url for url, history in health.items() if retirement_ready(history, now)]
    retire = sorted(url for url in ready if (urlsplit(url).hostname or '').lower() not in blocked)
    quarantine = sorted(url for url in ready if url not in retire)
    return retire, quarantine, sorted(blocked)


def sources(root, registry):
    """Discovery supports reviewed HTML/feed/sitemap indexes; legacy Markdown is excluded."""
    output = {}
    for path in registry['reviews']:
        review = json.loads((root / path).read_text())
        raw = (root / review['snapshot_path']).read_bytes()
        if digest(raw) != review['snapshot_digest']:
            raise ValueError('reviewed index digest mismatch')
        index = json.loads(raw)
        output[review['source_id']] = {'index': index, 'identity': digest(index_bytes({
            'source_url': index['source_url'], 'extractor': index['extractor']}))}
    return output


def discover(source, previous, active, pending, now, guard, limiter):
    index = source['index']
    old = previous if previous and previous.get('identity') == source['identity'] else {
        'identity': source['identity'], 'urls': index['urls']}
    headers = {key: old[value] for key, value in [('If-None-Match', 'etag'), ('If-Modified-Since', 'modified')]
               if old.get(value)}
    response = None
    try:
        response, final = request('GET', index['source_url'], headers, guard, limiter, timeout=15)
        if response.status_code == 304:
            return old, [], {'outcome': 'unchanged', 'status': 304}
        if response.status_code != 200:
            return old, [], {'outcome': 'indeterminate', 'status': response.status_code}
        raw = bytearray()
        for chunk in response.iter_content(65536):
            raw.extend(chunk)
            if len(raw) > MAX_SOURCE_BYTES:
                raise ValueError('source byte limit')
        fresh = collect_index(bytes(raw), source_url=index['source_url'], final_url=final, extractor=index['extractor'])
        if not fresh['urls']:
            raise ValueError('empty source index')
        additions = []
        rejected = []
        seen = set(old['urls'])
        for url in fresh['urls']:
            if url in seen:
                continue
            try:
                canonical = canonicalize_url(url)
            except EligibilityError as exc:
                rejected.append({'url': url, 'reason': exc.reason})
                continue
            if canonical not in active and canonical not in pending:
                additions.append({'url': canonical, 'collected_url': url, 'discovered_at': now.isoformat(),
                                  'source_url': index['source_url'], 'response_digest': fresh['response_digest'],
                                  'outcome': 'unreviewed', 'selection_authority': False})
        # Reject a sudden explosion instead of silently losing a review backlog.
        if len(pending) + len(additions) > MAX_PENDING:
            raise ValueError('pending backlog capacity; review before advancing source cache')
        cache = {'identity': source['identity'], 'urls': fresh['urls'], 'etag': response.headers.get('ETag'),
                 'modified': response.headers.get('Last-Modified')}
        return cache, additions, {'outcome': 'collected', 'status': 200, 'links': len(fresh['urls']), 'rejected': rejected}
    except (requests.exceptions.RequestException, TargetGuardError, ValueError, OSError, ParseError) as exc:
        return old, [], {'outcome': 'indeterminate', 'error': type(exc).__name__}
    finally:
        if response is not None:
            response.close()


def run(root, registry_path, state_path, out_dir, limit=1000, workers=12, now=None):
    now = now or datetime.now(timezone.utc)
    state = json.loads(state_path.read_text()) if state_path.exists() else {'schema': SCHEMA, 'health': {}, 'sources': {}, 'pending': {}}
    if state.get('schema') != SCHEMA:
        raise ValueError('unsupported maintenance history; refusing to reset it')
    active = json.loads((root / 'corpus/runtime/active-v1.json').read_text())['active']
    raw = (root / active['url']).read_bytes()
    if digest(raw) != active['expected_digest']:
        raise ValueError('active URL digest mismatch')
    urls = raw.decode().splitlines()
    health = {url: state['health'].get(url, []) for url in urls}
    pending = {url: row for url, row in state['pending'].items() if url not in health}
    registry_raw = registry_path.read_bytes()
    approved = sources(root, json.loads(registry_raw))
    guard, limiter = PublicTargetGuard(), RateLimiter(min_gap=.5)
    source_status, caches = {}, {}
    for sid, source in approved.items():
        cache, additions, status = discover(source, state['sources'].get(sid), set(urls), pending, now, guard, limiter)
        caches[sid] = cache
        source_status[sid] = status
        for row in additions:
            row['source_id'] = sid
            pending.setdefault(row['url'], row)
    selected = due_urls(urls, health, now, limit)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        today = list(executor.map(lambda url: probe(url, guard, limiter), selected))
    for row in today:
        health[row['url']] = record(health[row['url']], row, now)
    retire, quarantine, blocked = proposals(health, today, now)
    report = {'schema': 'r4b1t-maintenance-proposals-v1', 'selection_authority': False,
              'generated_at': now.isoformat(), 'active_urls_digest': digest(raw),
              'registry_digest': digest(registry_raw), 'checked': len(today), 'active_urls': len(urls),
              'new_unreviewed': list(pending.values()), 'retirement_candidates': retire,
              'quarantined_candidates': quarantine, 'missing_burst_hosts': blocked,
              'source_observations': source_status, 'health_observations': today}
    state = {'schema': SCHEMA, 'health': health, 'sources': caches, 'pending': pending}
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / 'state.json').write_bytes(index_bytes(state))
    (out_dir / 'proposals.json').write_bytes(index_bytes(report))
    counts = {kind: sum(r['outcome'] == kind for r in today) for kind in ['reachable', 'missing', 'indeterminate']}
    summary = f'''# Daily corpus maintenance

Generated: {now.isoformat()}

Checked {len(today)} of {len(urls)} active URLs: {counts['reachable']} reachable, {counts['missing']} missing, {counts['indeterminate']} indeterminate.

{len(pending)} unreviewed discoveries; {len(retire)} retirement candidates; {len(quarantine)} quarantined candidates.

Review `corpus/maintenance/proposals.json` and its bound history in `state.json`. This PR changes evidence only. New admissions, retirement, rebuild and runtime promotion require a separate reviewed corpus change. HTTP 200 does not establish relevance or safety. Publication age is not a removal reason.

Retirement needs GET-confirmed 404/410 on at least three distinct UTC days spanning 48 hours, with the newest observation within 36 hours. Authentication, throttling, network errors and server errors break the missing streak. Missing bursts quarantine affected host proposals.
'''
    (out_dir / 'report.md').write_text(summary)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--registry', type=Path, default=ROOT / 'corpus/expansion/registry-v2.json')
    parser.add_argument('--state', type=Path, default=ROOT / 'corpus/maintenance/state.json')
    parser.add_argument('--out-dir', type=Path, default=ROOT / 'corpus/maintenance')
    parser.add_argument('--limit', type=int, default=1000)
    parser.add_argument('--workers', type=int, default=12)
    args = parser.parse_args()
    if not 0 <= args.limit <= 1000 or not 1 <= args.workers <= 24:
        parser.error('limit must be 0..1000 and workers 1..24')
    report = run(ROOT, args.registry, args.state, args.out_dir, args.limit, args.workers)
    print(json.dumps({'checked': report['checked'], 'unreviewed': len(report['new_unreviewed']), 'retire': len(report['retirement_candidates'])}))


if __name__ == '__main__':
    main()
