#!/usr/bin/env python3
"""
wild1000.py — R4B1T H0L3 WILD intake, v0.6.1

Purpose: find genuinely new siteKeys for a WILD campaign and put them in
front of a human reviewer. It never writes to the corpus or the ledger;
`export` produces the campaign-accepted set for your ledger tooling.

Workflow (every command after init is bound to one campaign directory)
  campaign-init  Freeze baseline release, siteKey authority, classification
                 and policy into <campaign>/campaign-manifest.json.
  harvest        Fetch lead-generator pages, record lead provenance, emit
                 candidates.
  verify         Admit, dedupe vs baseline, probe safely, archive lookup ->
                 observations log + human review sheet.
  stats          Progress, per-source quotas, classification problems.
  export         Write campaign-accepted.jsonl (CAMPAIGN_ACCEPTED rows joined
                 with their probe evidence).
  selftest       Load the authority and report hashes / corpus count.

Campaign manifest (r4b1t-wild-campaign/v1)
  baseline        release_id, urls/resources/release-manifest sha256, URL and
                  siteKey counts — checked against the release's own
                  manifest.json and recomputed on every load
  sitekey         version, psl/overrides/impl/vectors sha256, commit, dirty
  classification  schema, version, sha256 of the frozen file (copied into
                  the campaign directory)
  policy          integers only: target, source_cap, pending_cap, retries...
                  (no floats anywhere in the manifest, so its hash is
                  language-independent)
  Every observation, lead record and candidate carries
  campaign_manifest_sha256. Loading a campaign re-verifies all of it and
  refuses on any drift.

Identity authority (--r4b1t-root)
  tools/site_key_v1.py + pinned PSL/overrides + normative v3 vectors from the
  R4B1T checkout. Refuses if hashes/vectors disagree, or if any authority
  file has uncommitted changes (unless --allow-dirty-authority, which is
  then recorded).

Admission order (initial candidates and every redirect hop)
  raw URL -> site-key/v1 on the RAW string -> strip fragment/tracking only
  -> assert same siteKey -> network-safety checks -> probe

Network safety
  http/https, ports 80/443, no userinfo; all DNS answers globally routable;
  connection pinned to the validated IP (SNI/cert use the hostname); manual
  redirects, each hop admitted + revalidated, max 5; per-host politeness on
  every hop; streamed body with byte cap; Accept-Encoding: identity;
  proxies ignored (trust_env=False). Run with direct egress.

Source quotas
  Quota identity is lead_source_key = siteKey(final URL of the lead page).
  Five pages of one directory share one quota. Manually supplied candidates
  (no lead page) share the quota "manual".

Review
  review.csv is human-owned, but every row carries the tool-written binding
  columns campaign_manifest_sha256, classification_sha256 and
  classification_version; verify/stats/export refuse rows that are missing or
  foreign. A row is
    REVIEW_ACCEPTED    verdict is an accept value
    CAMPAIGN_ACCEPTED  REVIEW_ACCEPTED + resource_type, primary_subject and
                       subjects valid under the frozen classification + a
                       human reason of at least the classification's minimum
  Quotas count REVIEW_ACCEPTED (conservative); progress counts only
  CAMPAIGN_ACCEPTED. Classification rules are fail-closed: a frozen file may
  only declare rules this tool implements, and must declare all of them.

Lead edges
  Quota is charged to one canonical lead per siteKey, but export carries
  every harvested link that pointed at the identity (lead_edges).
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import importlib.util
import ipaddress
import json
import re
import shutil
import socket
import ssl
import subprocess
import sys
import time
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from selectolax.lexbor import LexborHTMLParser as HTMLParser

TOOL_VERSION = "wild-intake/0.6.1"
UA = "R4B1T-WILD/0.6.1 (+https://r4b1t.badbananaresearch.com; corpus verification)"

LIVE, MANUAL, RETRY, REJECT = "LIVE_CANDIDATE", "MANUAL_CHECK", "RETRYABLE", "REJECTED"
ACCEPT_VERDICTS = {"y", "yes", "accept", "accepted", "1"}
REJECT_VERDICTS = {"n", "no", "reject", "rejected", "0"}
MANIFEST_SCHEMA = "r4b1t-wild-campaign/v1"
CLASSIFICATION_SCHEMA = "r4b1t-resource-classification/v2"
SOURCE_REGISTRY_SCHEMA = "r4b1t-wild-source-registry/v2"
MANUAL_SOURCE = "manual"


def sha256_tag(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def canonical_json(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def die(msg: str) -> None:
    sys.exit(msg)


def assert_no_floats(obj, path="$") -> None:
    """Campaign authority is integers/strings/bools only, so its hash does not
    depend on any language's float formatting."""
    if isinstance(obj, float):
        die(f"[campaign] float in authority document at {path}")
    if isinstance(obj, dict):
        for k, v in obj.items():
            assert_no_floats(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            assert_no_floats(v, f"{path}[{i}]")


# ---------------------------------------------------------------------------
# Discovery source registry — bounded, explicit, never an admission authority
# ---------------------------------------------------------------------------

class SourceRegistry:
    def __init__(self, path: str, leads_path: str, campaign_source_cap: int):
        self.path = Path(path)
        raw_bytes = self.path.read_bytes()
        self.sha256 = sha256_tag(raw_bytes)
        try:
            raw = json.loads(raw_bytes)
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            die(f"[source-registry] invalid JSON: {e}")
        # Registry formatting is not authority; the raw bytes are hashed so
        # formatting drift remains observable without making pretty JSON invalid.
        if raw.get("schema") != SOURCE_REGISTRY_SCHEMA:
            die(f"[source-registry] schema must be {SOURCE_REGISTRY_SCHEMA}")
        if raw.get("role") != "discovery_only":
            die("[source-registry] role must be discovery_only")
        if raw.get("authority_invariant") != "sources suggest; observations verify; review admits":
            die("[source-registry] authority_invariant is invalid")
        registry_cap = raw.get("source_cap")
        if type(registry_cap) is not int or registry_cap < 1:
            die("[source-registry] source_cap must be a positive integer")
        if registry_cap > campaign_source_cap:
            die(f"[source-registry] source_cap {registry_cap} exceeds campaign source_cap {campaign_source_cap}")

        sources = raw.get("sources")
        if not isinstance(sources, list) or not sources:
            die("[source-registry] sources must be a non-empty list")
        by_key, by_lead = {}, {}
        for i, src in enumerate(sources):
            if not isinstance(src, dict):
                die(f"[source-registry] source {i} is not an object")
            key, kind = src.get("source_key"), src.get("kind")
            canonical_url, lead_urls = src.get("canonical_url"), src.get("lead_urls")
            max_candidates = src.get("max_candidates")
            if not isinstance(key, str) or not key.strip():
                die(f"[source-registry] source {i}: source_key required")
            if key in by_key:
                die(f"[source-registry] duplicate source_key: {key}")
            if not isinstance(kind, str) or not kind.strip():
                die(f"[source-registry] {key}: kind required")
            if not isinstance(canonical_url, str) or not canonical_url.startswith(("http://", "https://")):
                die(f"[source-registry] {key}: canonical_url must be http(s)")
            if not isinstance(lead_urls, list) or not lead_urls:
                die(f"[source-registry] {key}: lead_urls must be non-empty")
            if type(max_candidates) is not int or max_candidates < 1 or max_candidates > registry_cap:
                die(f"[source-registry] {key}: max_candidates must be 1..{registry_cap}")
            by_key[key] = {"kind": kind, "canonical_url": canonical_url,
                           "lead_urls": tuple(lead_urls), "max_candidates": max_candidates}
            for lead in lead_urls:
                if not isinstance(lead, str) or not lead.strip():
                    die(f"[source-registry] {key}: invalid lead URL")
                lead = lead.strip()
                if lead in by_lead:
                    die(f"[source-registry] lead URL belongs to multiple sources: {lead}")
                by_lead[lead] = key

        try:
            lead_lines = [
                line.split("#", 1)[0].strip()
                for line in Path(leads_path).read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            ]
        except OSError as e:
            die(f"[source-registry] leads file unreadable: {e}")
        lead_lines = [x for x in lead_lines if x]
        duplicates = sorted(k for k, n in Counter(lead_lines).items() if n > 1)
        if duplicates:
            die(f"[source-registry] duplicate lead URL(s): {duplicates[:10]}")
        lead_set, registry_set = set(lead_lines), set(by_lead)
        missing, orphaned = sorted(lead_set - registry_set), sorted(registry_set - lead_set)
        if missing:
            die(f"[source-registry] lead(s) missing from registry: {missing[:10]}")
        if orphaned:
            die(f"[source-registry] registry lead(s) missing from leads file: {orphaned[:10]}")
        self.sources, self.lead_to_source = by_key, by_lead
        self.lead_count, self.source_count = len(lead_lines), len(by_key)
        self.registry_cap, self.canonical = registry_cap, raw

    def source_for(self, lead_url: str) -> tuple[str, int]:
        try:
            key = self.lead_to_source[lead_url]
            return key, self.sources[key]["max_candidates"]
        except KeyError:
            die(f"[source-registry] lead URL is not registered: {lead_url}")



# ---------------------------------------------------------------------------
# siteKey authority — R4B1T's own site-key/v1, loaded from the checkout
# ---------------------------------------------------------------------------

class SiteKeyAuthority:
    IMPL = "tools/site_key_v1.py"
    PSL = "selection/site-key-v1/public_suffix_list_ascii_v1.dat"
    OVERRIDES = "selection/site-key-v1/platform-overrides.json"
    VECTORS = "tests/fixtures/selection-v3-vectors.json"

    def __init__(self, root: str, vectors: str | None = None, allow_dirty: bool = False):
        self.root = Path(root).resolve()

        def need(rel: str | Path) -> bytes:
            p = Path(rel) if Path(rel).is_absolute() else self.root / rel
            try:
                return p.read_bytes()
            except OSError as e:
                die(f"[sitekey] SITE_KEY_AUTHORITY_UNAVAILABLE: {e}")

        impl_bytes = need(self.IMPL)
        psl_bytes = need(self.PSL)
        ovr_bytes = need(self.OVERRIDES)
        vec_bytes = need(vectors or self.VECTORS)

        self.commit, self.dirty_files = self._git_state([self.IMPL, self.PSL, self.OVERRIDES, self.VECTORS])
        if self.dirty_files and not allow_dirty:
            die(f"[sitekey] authority files have uncommitted changes: {', '.join(self.dirty_files)} "
                f"(commit or pass --allow-dirty-authority)")
        if vectors:
            self.dirty_files = sorted(set(self.dirty_files) | {f"external-vectors:{vectors}"})

        spec = importlib.util.spec_from_file_location("r4b1t_site_key_v1", self.root / self.IMPL)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for name in ("SITE_KEY_VERSION", "SiteKeyError", "site_key", "parse_psl", "parse_overrides"):
            if not hasattr(mod, name):
                die(f"[sitekey] authority module lacks {name}")
        self._mod = mod
        try:
            self._psl = mod.parse_psl(psl_bytes.decode("utf-8", "strict"))
            self._ovr = mod.parse_overrides(ovr_bytes.decode("utf-8", "strict"))
        except (UnicodeDecodeError, ValueError) as e:
            die(f"[sitekey] SITE_KEY_AUTHORITY_INVALID: {e}")

        self.version = mod.SITE_KEY_VERSION
        self.psl_sha256 = sha256_tag(psl_bytes)
        self.overrides_sha256 = sha256_tag(ovr_bytes)
        self.impl_sha256 = sha256_tag(impl_bytes)
        self.vectors_sha256 = sha256_tag(vec_bytes)

        fx = json.loads(vec_bytes)
        if fx.get("psl_sha256") != self.psl_sha256:
            die(f"[sitekey] PSL hash {self.psl_sha256} != fixture {fx.get('psl_sha256')}")
        if fx.get("overrides_sha256") != self.overrides_sha256:
            die(f"[sitekey] overrides hash {self.overrides_sha256} != fixture "
                f"{fx.get('overrides_sha256')}")
        norm, rej = fx.get("normalization") or [], fx.get("rejections") or []
        if not norm or not rej:
            die("[sitekey] fixture has no normalization/rejection vectors")
        bad = []
        for v in norm:
            k, err = self.key(v["url"])
            if k != v["site_key"]:
                bad.append(f"{v['url']!r}: expected {v['site_key']!r}, got {k!r} ({err})")
        for v in rej:
            k, err = self.key(v["url"])
            if k is not None or not err or not re.search(v["code"], err):
                bad.append(f"{v['url']!r}: expected rejection {v['code']}, got key={k!r} err={err!r}")
        if bad:
            for b in bad[:10]:
                print(f"[sitekey] VECTOR FAIL {b}", file=sys.stderr)
            die(f"[sitekey] {len(bad)} vector(s) failed — refusing to run")
        self.vectors_checked = len(norm) + len(rej)

    def _git_state(self, rels: list[str]) -> tuple[str, list[str]]:
        try:
            head = subprocess.run(["git", "-C", str(self.root), "rev-parse", "HEAD"],
                                  capture_output=True, text=True, timeout=10)
            st = subprocess.run(["git", "-C", str(self.root), "status", "--porcelain",
                                 "--untracked-files=all", "--", *rels],
                                capture_output=True, text=True, timeout=10)
        except Exception:  # noqa: BLE001
            return "", ["(git unavailable)"]
        if head.returncode != 0 or st.returncode != 0:
            return "", ["(not a git checkout)"]
        dirty = sorted(l[3:] for l in st.stdout.splitlines() if l.strip())
        return head.stdout.strip(), dirty

    def key(self, url: str) -> tuple[str | None, str | None]:
        """-> (site_key, None) or (None, SITE_KEY_* code)."""
        try:
            return self._mod.site_key(url, self._psl, self._ovr), None
        except self._mod.SiteKeyError as e:
            return None, str(e).split(":", 1)[0].strip() or "SITE_KEY_ERROR"
        except Exception as e:  # noqa: BLE001
            return None, f"SITE_KEY_ERROR_{type(e).__name__}"

    def manifest_block(self) -> dict:
        return {"version": self.version, "psl_sha256": self.psl_sha256,
                "overrides_sha256": self.overrides_sha256, "impl_sha256": self.impl_sha256,
                "vectors_sha256": self.vectors_sha256, "commit": self.commit,
                "dirty": bool(self.dirty_files), "dirty_files": self.dirty_files}


# ---------------------------------------------------------------------------
# Classification authority (frozen file, bound into the campaign)
# ---------------------------------------------------------------------------

class Classification:
    """Every rule in the file must be implemented here, and every implemented
    rule must be present in the file. Unknown or missing rules abort, so the
    frozen document can never claim a constraint the validator ignores."""

    RULES = {
        "max_subjects": int,                 # applies to the subjects list (primary included)
        "min_reason_chars": int,             # stripped human reason length
        "subjects_delimiter": str,           # single non-identifier character
        "primary_subject_in_subjects": bool,  # True: primary_subject must appear in subjects
    }
    ID = re.compile(r"^[a-z][a-z0-9_]*$")

    def __init__(self, path: Path):
        raw = path.read_bytes()
        self.sha256 = sha256_tag(raw)
        d = json.loads(raw)
        where = f"[classification] {path}"
        if d.get("schema") != CLASSIFICATION_SCHEMA:
            die(f"{where}: schema must be {CLASSIFICATION_SCHEMA}")
        self.version = d.get("version") or die(f"{where}: missing version")
        self.status = d.get("status")
        rules = d.get("rules")
        if not isinstance(rules, dict):
            die(f"{where}: missing rules")
        unknown = sorted(set(rules) - set(self.RULES))
        missing = sorted(set(self.RULES) - set(rules))
        if unknown:
            die(f"{where}: rules not implemented by {TOOL_VERSION}: {unknown}")
        if missing:
            die(f"{where}: rules missing (no defaults): {missing}")
        for k, typ in self.RULES.items():
            if type(rules[k]) is not typ:
                die(f"{where}: rule {k} must be {typ.__name__}")
        self.max_subjects = rules["max_subjects"]
        self.min_reason_chars = rules["min_reason_chars"]
        self.delim = rules["subjects_delimiter"]
        self.primary_in_subjects = rules["primary_subject_in_subjects"]
        if len(self.delim) != 1 or self.ID.match(self.delim) or self.delim in "_0123456789" or self.delim.isspace():
            die(f"{where}: subjects_delimiter must be one non-identifier, non-space character")
        if self.max_subjects < 1 or self.min_reason_chars < 1:
            die(f"{where}: max_subjects and min_reason_chars must be >= 1")

        def ids(section: str) -> set[str]:
            items = d.get(section) or die(f"{where}: empty {section}")
            got = [i.get("id", "") for i in items]
            bad = [i for i in got if not self.ID.match(i)]
            if bad:
                die(f"{where}: invalid {section} ids {bad[:5]}")
            if len(got) != len(set(got)):
                die(f"{where}: duplicate {section} ids")
            return set(got)
        self.resource_types = ids("resource_types")
        self.subjects = ids("subjects")

    def problems(self, row: dict) -> list[str]:
        p = []
        rt = (row.get("resource_type") or "").strip()
        ps = (row.get("primary_subject") or "").strip()
        subs = [x.strip() for x in (row.get("subjects") or "").split(self.delim) if x.strip()]
        if rt not in self.resource_types:
            p.append(f"resource_type={rt!r}")
        if ps not in self.subjects:
            p.append(f"primary_subject={ps!r}")
        for x in subs:
            if x not in self.subjects:
                p.append(f"subject={x!r}")
        if len(subs) != len(set(subs)):
            p.append("duplicate subjects")
        if len(subs) > self.max_subjects:
            p.append(f"{len(subs)} subjects > {self.max_subjects}")
        if self.primary_in_subjects and ps and ps not in subs:
            p.append(f"primary_subject {ps!r} not in subjects")
        if len((row.get("reason") or "").strip()) < self.min_reason_chars:
            p.append(f"reason shorter than {self.min_reason_chars} chars")
        return p

    def subject_list(self, row: dict) -> list[str]:
        return sorted({x.strip() for x in (row.get("subjects") or "").split(self.delim) if x.strip()})


# ---------------------------------------------------------------------------
# Campaign (manifest-bound state)
# ---------------------------------------------------------------------------

class Campaign:
    MANIFEST = "campaign-manifest.json"
    CLASSIFICATION = "classification.json"

    def __init__(self, directory: str, auth: SiteKeyAuthority):
        self.dir = Path(directory)
        mpath = self.dir / self.MANIFEST
        if not mpath.exists():
            die(f"[campaign] {mpath} not found — run campaign-init first")
        raw = mpath.read_bytes()
        self.manifest = json.loads(raw)
        if canonical_json(self.manifest) != raw:
            die("[campaign] manifest is not in canonical form (was it hand-edited?)")
        assert_no_floats(self.manifest)
        self.sha256 = sha256_tag(raw)
        m = self.manifest
        if m.get("schema") != MANIFEST_SCHEMA:
            die(f"[campaign] unsupported manifest schema {m.get('schema')}")
        if m["tool_version"] != TOOL_VERSION:
            die(f"[campaign] manifest bound to {m['tool_version']}, this is {TOOL_VERSION}")

        sk = m["sitekey"]
        for f in ("version", "psl_sha256", "overrides_sha256", "impl_sha256", "vectors_sha256"):
            mine = {"version": auth.version, "psl_sha256": auth.psl_sha256,
                    "overrides_sha256": auth.overrides_sha256, "impl_sha256": auth.impl_sha256,
                    "vectors_sha256": auth.vectors_sha256}[f]
            if sk[f] != mine:
                die(f"[campaign] siteKey authority drift: {f} manifest={sk[f]} now={mine}")
        if auth.dirty_files and not sk.get("dirty"):
            die("[campaign] campaign was frozen from a clean authority; checkout is now dirty")
        if auth.commit != sk.get("commit"):
            print(f"[campaign] note: authority commit {auth.commit[:10]} != manifest "
                  f"{str(sk.get('commit'))[:10]} (file hashes identical)", file=sys.stderr)

        self.classification = Classification(self.dir / self.CLASSIFICATION)
        if self.classification.sha256 != m["classification"]["sha256"]:
            die("[campaign] classification.json drifted from manifest")

        b = m["baseline"]
        self.corpus_keys, n_urls, unkeyed = load_release(auth, b["release_id"], b)
        if unkeyed or n_urls != b["url_count"] or len(self.corpus_keys) != b["sitekey_count"]:
            die(f"[campaign] baseline recount mismatch: urls={n_urls}/{b['url_count']} "
                f"siteKeys={len(self.corpus_keys)}/{b['sitekey_count']} unkeyed={len(unkeyed)}")

        p = m["policy"]
        self.target, self.cap = p["campaign_target"], p["source_cap"]
        self.pending_cap, self.max_attempts = p["pending_cap"], p["max_attempts"]
        print(f"[campaign] {m['campaign_id']} manifest={self.sha256[:19]}… baseline="
              f"{b['release_id']} ({b['sitekey_count']} siteKeys) classification="
              f"{self.classification.version} cap={self.cap}/source", file=sys.stderr)

    def path(self, name: str) -> Path:
        return self.dir / name

    def binding(self) -> dict:
        return {"campaign_manifest_sha256": self.sha256,
                "classification_sha256": self.classification.sha256,
                "classification_version": self.classification.version}

    def load_review(self) -> list[dict]:
        """review.csv rows, refusing any row not bound to this campaign and
        this classification."""
        rows = load_review(self.path("review.csv"))
        keys = [r.get("site_key", "").strip() for r in rows]
        empty = [i + 2 for i, k in enumerate(keys) if not k]
        if empty:
            die(f"[review] empty site_key rows are forbidden, CSV lines {empty[:10]}")
        dupes = sorted(k for k, n in Counter(keys).items() if n > 1)
        if dupes:
            die(f"[review] duplicate site_key rows are forbidden: {dupes[:10]}")
        want = self.binding()
        bad = [(r.get("site_key"), k) for r in rows for k, v in want.items() if r.get(k) != v]
        if bad:
            die(f"[review] {len(bad)} binding mismatches in review.csv, e.g. {bad[:3]} "
                f"(rows must carry this campaign's manifest + classification)")
        return rows


def load_release(auth: SiteKeyAuthority, release_id: str,
                 expect: dict | None = None) -> tuple[set[str], int, list[str]]:
    rdir = auth.root / "corpus/releases" / release_id
    try:
        rman_raw = (rdir / "manifest.json").read_bytes()
        urls_raw = (rdir / "urls.txt").read_bytes()
        res_raw = (rdir / "resources.json").read_bytes()
    except OSError as e:
        die(f"[baseline] release {release_id} unreadable: {e}")
    rman = json.loads(rman_raw)
    if rman.get("release_id") != release_id:
        die(f"[baseline] manifest release_id {rman.get('release_id')} != {release_id}")
    if sha256_tag(urls_raw) != rman.get("urls_digest"):
        die(f"[baseline] urls.txt does not match release urls_digest")
    if sha256_tag(res_raw) != rman.get("resources_digest"):
        die(f"[baseline] resources.json does not match release resources_digest")
    if expect:
        for k, v in (("urls_sha256", sha256_tag(urls_raw)), ("resources_sha256", sha256_tag(res_raw)),
                     ("release_manifest_sha256", sha256_tag(rman_raw))):
            if expect.get(k) != v:
                die(f"[baseline] {k} drift: manifest={expect.get(k)} now={v}")
    urls = [l.strip() for l in urls_raw.decode("utf-8").splitlines() if l.strip()]
    keys, unkeyed = set(), []
    for u in urls:
        k, _ = auth.key(u)
        (keys.add(k) if k else unkeyed.append(u))
    return keys, len(urls), unkeyed


# ---------------------------------------------------------------------------
# Admission: authority first, conveniences second, identity re-asserted
# ---------------------------------------------------------------------------

_TRACKING = re.compile(r"^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref_src)=", re.I)
_HAS_SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")


def strip_conveniences(raw: str) -> str:
    """Remove the fragment and tracking query params. Scheme, authority and
    path are passed through byte-for-byte."""
    head = raw.split("#", 1)[0]
    if "?" in head:
        base, query = head.split("?", 1)
        kept = [kv for kv in query.split("&") if kv and not _TRACKING.match(kv)]
        head = base + ("?" + "&".join(kept) if kept else "")
    return head


class Rejected(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def admit(auth: SiteKeyAuthority, raw: str) -> tuple[str, str]:
    """-> (url to probe, site_key). Raises Rejected."""
    raw = raw.strip(" \t\n\f\r")          # HTML attribute whitespace only
    k, err = auth.key(raw)
    if err:
        raise Rejected(f"sitekey:{err}")
    url = strip_conveniences(raw)
    k2, err2 = auth.key(url)
    if err2 or k2 != k:
        raise Rejected("normalization_changed_sitekey")
    return url, k


def resolve_reference(base: str, ref: str) -> str:
    """Absolute references are returned untouched; only relative ones are
    resolved (RFC 3986), because that is the URL a client would request."""
    ref = ref.strip(" \t\n\f\r")
    if _HAS_SCHEME.match(ref):
        return ref
    return urljoin(base, ref)


# ---------------------------------------------------------------------------
# Guarded fetch
# ---------------------------------------------------------------------------

ALLOWED_PORTS = {80, 443}
MAX_HOPS = 5


class Unsafe(Exception):
    """Target is outside the public-internet boundary. Permanent."""


class RedirectLoop(Exception):
    pass


class Politeness:
    """One in-flight request per host, and a minimum gap between requests to
    the same host. Applied to every hop, including redirect targets."""

    def __init__(self, delay: float):
        self.delay = delay
        self.locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self.last: dict[str, float] = defaultdict(lambda: -1e9)

    @asynccontextmanager
    async def slot(self, host: str):
        h = host.lower().rstrip(".")
        async with self.locks[h]:
            wait = self.last[h] + self.delay - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            try:
                yield
            finally:
                self.last[h] = time.monotonic()


async def _getaddrinfo(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return sorted({i[4][0] for i in infos})


async def resolve_public(host: str, port: int) -> list[str]:
    host = host.rstrip(".")
    try:
        addrs = [str(ipaddress.ip_address(host.strip("[]")))]
    except ValueError:
        addrs = await _getaddrinfo(host, port)
    if not addrs:
        raise socket.gaierror("no addresses")
    for a in addrs:
        ip = ipaddress.ip_address(a.split("%")[0])
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        # any non-global answer poisons the whole name (split-horizon tricks)
        if not ip.is_global or ip.is_multicast:
            raise Unsafe(f"non_public_ip:{ip}")
    return addrs


def _check_url_shape(url: str) -> tuple[str, int]:
    p = urlsplit(url)
    if p.scheme.lower() not in ("http", "https"):
        raise Unsafe(f"scheme:{p.scheme}")
    if p.username or p.password:
        raise Unsafe("userinfo_in_url")
    if not p.hostname:
        raise Unsafe("no_host")
    port = p.port or (443 if p.scheme.lower() == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise Unsafe(f"port:{port}")
    return p.hostname, port


def _pinned(client: httpx.AsyncClient, url: str, ip: str) -> httpx.Request:
    p = urlsplit(url)
    scheme = p.scheme.lower()
    ip_host = f"[{ip}]" if ":" in ip else ip
    target = urlunsplit((scheme, ip_host + (f":{p.port}" if p.port else ""),
                         p.path or "/", p.query, ""))
    # SNI must not carry a trailing dot (RFC 6066)
    ext = {"sni_hostname": p.hostname.rstrip(".")} if scheme == "https" else {}
    return client.build_request("GET", target, headers={"Host": p.netloc}, extensions=ext)


@dataclass
class Probe:
    status: int
    final_url: str
    final_key: str
    content_type: str
    content_encoding: str
    body: bytes
    truncated: bool
    hops: list = field(default_factory=list)

    def evidence(self) -> dict:
        return {"sha256": sha256_tag(self.body),
                "hash_scope": "PREFIX" if self.truncated else "FULL",
                "hashed_bytes": len(self.body)}


async def _read_capped(resp: httpx.Response, cap: int) -> tuple[bytes, bool]:
    buf = bytearray()
    async for chunk in resp.aiter_raw():
        buf += chunk
        if len(buf) > cap:          # strictly more than cap => we are missing bytes
            del buf[cap:]
            return bytes(buf), True
    return bytes(buf), False


async def guarded_get(client: httpx.AsyncClient, polite: Politeness, auth: SiteKeyAuthority,
                      url: str, key: str, max_bytes: int) -> Probe:
    """url must already be admitted. Every redirect target is admitted again."""
    hops: list[dict] = []
    cur, cur_key = url, key
    for _ in range(MAX_HOPS + 1):
        host, port = _check_url_shape(cur)
        addrs = await resolve_public(host, port)
        async with polite.slot(host):
            resp = await client.send(_pinned(client, cur, addrs[0]), stream=True)
            try:
                loc = resp.headers.get("location")
                if resp.status_code in (301, 302, 303, 307, 308) and loc:
                    hops.append({"url": cur, "site_key": cur_key, "status": resp.status_code})
                    try:
                        cur, cur_key = admit(auth, resolve_reference(cur, loc))
                    except Rejected as r:
                        raise Rejected(f"redirect_target:{r.code}") from None
                    continue
                ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                enc = resp.headers.get("content-encoding", "identity").strip().lower() or "identity"
                textual = not ctype or "html" in ctype or ctype.startswith("text/")
                cap = max_bytes if textual else min(max_bytes, 65536)
                body, truncated = await _read_capped(resp, cap)
                return Probe(resp.status_code, cur, cur_key, ctype, enc, body, truncated, hops)
            finally:
                await resp.aclose()
    raise RedirectLoop()


def make_client(timeout: float, concurrency: int) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.8",
                 "Accept-Encoding": "identity"},
        follow_redirects=False, trust_env=False, timeout=timeout,
        limits=httpx.Limits(max_connections=concurrency, max_keepalive_connections=0),
    )


# ---------------------------------------------------------------------------
# Content screens
# ---------------------------------------------------------------------------

PARKING_HOSTS = (
    "sedo.com", "sedoparking.com", "dan.com", "afternic.com", "hugedomains.com",
    "bodis.com", "parkingcrew.net", "above.com", "undeveloped.com", "godaddy.com",
    "namecheap.com", "domainmarket.com", "atom.com", "parklogic.com",
    "uniregistry.com", "squadhelp.com",
)
PARKED = re.compile(
    r"(this domain (is|may be) for sale|buy this domain|domain (is )?parked|"
    r"parked free|parkingcrew|sedoparking|related searches|"
    r"the domain .{0,40} is for sale|inquire about this domain|"
    r"account (has been )?suspended|default web site page|welcome to nginx!|"
    r"apache2 .{0,20}default page|future home of something quite cool)", re.I)
SOFT_404 = re.compile(r"(page not found|404 not found|doesn.t exist|no longer available)", re.I)


def _on_host_list(host: str, hosts: tuple[str, ...]) -> str | None:
    host = host.lower().rstrip(".")
    for h in hosts:
        if host == h or host.endswith("." + h):
            return h
    return None


def _decoded_for_screening(probe: Probe) -> bytes:
    if probe.content_encoding in ("identity", "") or probe.truncated:
        return probe.body
    try:  # screening only; the hash stays over wire bytes
        return httpx.Response(200, headers={"content-encoding": probe.content_encoding},
                              content=probe.body).content
    except Exception:  # noqa: BLE001
        return probe.body


def screen(probe: Probe) -> tuple[str | None, str, str]:
    """-> (reject_reason | None, title, description)"""
    host = urlsplit(probe.final_url).hostname or ""
    if (ph := _on_host_list(host, PARKING_HOSTS)):
        return f"redirect_to_parking:{ph}", "", ""
    if probe.content_type and "html" not in probe.content_type:
        return None, "", ""
    tree = HTMLParser(_decoded_for_screening(probe).decode("utf-8", "replace"))
    t = tree.css_first("title")
    title = t.text(strip=True)[:200] if t else ""
    d = tree.css_first('meta[name="description"]') or tree.css_first('meta[property="og:description"]')
    desc = (d.attributes.get("content") or "")[:300] if d else ""
    visible = tree.body.text(separator=" ", strip=True)[:20000] if tree.body else ""
    if PARKED.search(visible[:5000]) or PARKED.search(title):
        return "parked_or_placeholder", title, desc
    if SOFT_404.search(title):
        return "soft_404", title, desc
    if len(visible) < 40 and tree.css_first("script") is None and tree.css_first("canvas") is None:
        return "empty_page", title, desc
    return None, title, desc


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------

LEAD_FIELDS = ("lead_source_url", "lead_final_url", "lead_source_key", "lead_observed_at",
               "lead_page_sha256", "lead_hash_scope", "lead_hashed_bytes")


@dataclass
class Obs:
    origin_key: str
    url: str
    raw_url: str = ""
    site_key: str = ""
    anchor: str = ""
    # lead provenance (copied from the harvest record)
    lead_source_url: str = ""
    lead_final_url: str = ""
    lead_source_key: str = MANUAL_SOURCE
    lead_observed_at: int = 0
    lead_page_sha256: str = ""
    lead_hash_scope: str = ""
    lead_hashed_bytes: int = 0
    # outcome
    status: str = ""
    reason_code: str = ""
    attempt: int = 1
    http_status: int | None = None
    final_url: str = ""
    hops: list = field(default_factory=list)
    content_type: str = ""
    title: str = ""
    description: str = ""
    probe_sha256: str = ""
    probe_hash_scope: str = ""        # FULL | PREFIX
    probe_hashed_bytes: int = 0
    probe_content_encoding: str = ""
    archive_status: str = ""          # FOUND | NONE_FOUND | BLOCKED | ERROR | NOT_CHECKED
    archive_url: str = ""
    archive_timestamp: str = ""
    observed_at: int = 0
    tool_version: str = TOOL_VERSION
    campaign_manifest_sha256: str = ""


def classify_http(code: int) -> tuple[str, str]:
    if code == 200:
        return LIVE, ""
    if code in (404, 410):
        return REJECT, f"http_{code}"
    if code == 429 or code in (408, 425) or 500 <= code <= 599:
        return RETRY, f"http_{code}"
    return MANUAL, f"http_{code}"     # 401/403/451, 204/206, 3xx without Location...


async def archive_lookup(client: httpx.AsyncClient, sem: asyncio.Semaphore,
                         url: str) -> tuple[str, str, str]:
    async with sem:
        try:
            r = await client.get("https://archive.org/wayback/available", params={"url": url})
        except Exception:  # noqa: BLE001
            return "ERROR", "", ""
        if r.status_code in (403, 429):
            return "BLOCKED", "", ""
        if r.status_code != 200:
            return "ERROR", "", ""
        try:
            snap = r.json().get("archived_snapshots", {}).get("closest") or {}
        except ValueError:
            return "ERROR", "", ""
        if snap.get("available") and snap.get("url"):
            return "FOUND", snap["url"], snap.get("timestamp", "")
        return "NONE_FOUND", "", ""


async def observe(client, polite, archive_client, archive_sem, auth: SiteKeyAuthority,
                  o: Obs, max_bytes: int) -> Obs:
    o.observed_at = int(time.time())
    o.site_key = o.origin_key
    try:
        probe = await guarded_get(client, polite, auth, o.url, o.origin_key, max_bytes)
    except Rejected as e:
        o.status, o.reason_code = REJECT, e.code
        return o
    except Unsafe as e:
        o.status, o.reason_code = REJECT, f"unsafe:{e}"
        return o
    except RedirectLoop:
        o.status, o.reason_code = REJECT, "redirect_loop"
        return o
    except socket.gaierror:
        o.status, o.reason_code = RETRY, "dns_error"
        return o
    except (httpx.ConnectError, ssl.SSLError) as e:
        if isinstance(e, ssl.SSLError) or "CERTIFICATE" in str(e).upper() or "SSL" in str(e).upper():
            o.status, o.reason_code = MANUAL, "tls_error"
        else:
            o.status, o.reason_code = RETRY, "connect_error"
        return o
    except httpx.TimeoutException:
        o.status, o.reason_code = RETRY, "timeout"
        return o
    except httpx.HTTPError as e:
        o.status, o.reason_code = RETRY, f"transport:{type(e).__name__}"
        return o

    o.http_status, o.final_url, o.hops = probe.status, probe.final_url, probe.hops
    o.site_key = probe.final_key
    o.content_type, o.probe_content_encoding = probe.content_type, probe.content_encoding
    ev = probe.evidence()
    o.probe_sha256, o.probe_hash_scope, o.probe_hashed_bytes = ev["sha256"], ev["hash_scope"], ev["hashed_bytes"]
    o.status, o.reason_code = classify_http(probe.status)
    if o.status == LIVE:
        rej, o.title, o.description = screen(probe)
        if rej:
            o.status, o.reason_code = REJECT, rej
    if o.status in (LIVE, MANUAL):
        o.archive_status, o.archive_url, o.archive_timestamp = \
            await archive_lookup(archive_client, archive_sem, o.final_url or o.url)
    else:
        o.archive_status = "NOT_CHECKED"
    return o


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def latest_by_origin(obs: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in obs:
        prev = out.get(r["origin_key"])
        if not prev or (r["observed_at"], r["attempt"]) >= (prev["observed_at"], prev["attempt"]):
            out[r["origin_key"]] = r
    return out


def append_sorted(path: Path, rows: list[dict], key) -> None:
    with open(path, "a") as fh:
        for r in sorted(rows, key=key):
            fh.write(canonical_json(r).decode("utf-8") + "\n")


def _obs_sort(r: dict):
    return (r.get("site_key") or r["origin_key"], r["url"], r["origin_key"])


def check_binding(rows: list[dict], camp: Campaign, what: str) -> None:
    foreign = {r.get("campaign_manifest_sha256") for r in rows} - {camp.sha256}
    if foreign:
        die(f"[campaign] {what} contains records bound to another manifest: {sorted(map(str, foreign))[:3]}")


# ---------------------------------------------------------------------------
# Review sheet (human-owned)
# ---------------------------------------------------------------------------

REVIEW_COLS = ["verdict", "resource_type", "primary_subject", "subjects", "reason",
               "intake_status", "site_key", "final_url", "title", "description",
               "lead_source_key", "lead_source_url", "anchor", "archive_status", "archive_url",
               "probe_sha256", "probe_hash_scope", "probe_hashed_bytes", "observed_at",
               "campaign_manifest_sha256", "classification_sha256", "classification_version"]


def load_review(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh))


def append_review(path: Path, rows: list[dict], binding: dict) -> int:
    existing = {r["site_key"] for r in load_review(path)}
    new = sorted((r for r in rows if r["site_key"] not in existing),
                 key=lambda r: (r["site_key"], r["url"]))
    fresh = not path.exists()
    with open(path, "a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=REVIEW_COLS, extrasaction="ignore")
        if fresh:
            w.writeheader()
        for r in new:
            w.writerow({**r, **binding, "intake_status": r["status"],
                        "final_url": r["final_url"] or r["url"]})
    return len(new)


def review_state(row: dict, cls: Classification) -> tuple[str, list[str]]:
    v = (row.get("verdict") or "").strip().lower()
    if not v:
        return "UNREVIEWED", []
    if v in REJECT_VERDICTS:
        return "REVIEW_REJECTED", []
    if v not in ACCEPT_VERDICTS:
        return "REVIEW_INVALID", []
    probs = cls.problems(row)
    return ("REVIEW_ACCEPTED", probs) if probs else ("CAMPAIGN_ACCEPTED", [])


def source_ledger(obs_latest: dict[str, dict], review: list[dict],
                  cls: Classification) -> dict[str, Counter]:
    """Per lead_source_key: campaign_accepted / review_accepted (invalid
    classification) / human_rejected / pending (live or manual, unreviewed)."""
    state = {r["site_key"]: review_state(r, cls)[0] for r in review}
    src_by_key: dict[str, str] = {}
    for o in obs_latest.values():
        if o["status"] in (LIVE, MANUAL):
            src_by_key.setdefault(o["site_key"], o.get("lead_source_key") or MANUAL_SOURCE)
    out: dict[str, Counter] = defaultdict(Counter)
    for k, src in src_by_key.items():
        s = state.get(k, "UNREVIEWED")
        out[src][{"CAMPAIGN_ACCEPTED": "campaign_accepted", "REVIEW_ACCEPTED": "review_accepted",
                  "REVIEW_REJECTED": "human_rejected", "REVIEW_INVALID": "review_invalid",
                  "UNREVIEWED": "pending"}[s]] += 1
    return out


def quota_used(c: Counter) -> int:
    return c["campaign_accepted"] + c["review_accepted"]


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def _auth(args) -> SiteKeyAuthority:
    a = SiteKeyAuthority(args.r4b1t_root, getattr(args, "vectors", None),
                         getattr(args, "allow_dirty_authority", False))
    print(f"[sitekey] {a.version} psl={a.psl_sha256[:19]}… overrides={a.overrides_sha256[:19]}… "
          f"vectors_ok={a.vectors_checked} commit={a.commit[:10] or '?'}"
          f"{' DIRTY' if a.dirty_files else ''}", file=sys.stderr)
    return a


def cmd_selftest(args) -> None:
    a = _auth(args)
    out = {**a.manifest_block(), "vectors_checked": a.vectors_checked}
    if args.release:
        keys, n, unkeyed = load_release(a, args.release)
        out.update(release_id=args.release, release_urls=n, release_site_keys=len(keys),
                   release_unkeyed=len(unkeyed))
    print(json.dumps(out, indent=1, sort_keys=True))


def cmd_campaign_init(args) -> None:
    auth = _auth(args)
    d = Path(args.campaign)
    mpath = d / Campaign.MANIFEST
    if mpath.exists():
        die(f"[campaign] {mpath} already exists; a campaign manifest is immutable")
    cls = Classification(Path(args.classification))
    if cls.status != "frozen":
        die(f"[campaign] classification {cls.version} has status {cls.status!r}; "
            f"only a 'frozen' classification can bind a campaign")
    rdir = auth.root / "corpus/releases" / args.release
    keys, n_urls, unkeyed = load_release(auth, args.release)
    if unkeyed:
        die(f"[baseline] {len(unkeyed)} release URLs rejected by site-key/v1, e.g. {unkeyed[0]}")
    if args.expect_sitekeys is not None and len(keys) != args.expect_sitekeys:
        die(f"[baseline] {len(keys)} siteKeys, expected {args.expect_sitekeys}")
    rman_raw = (rdir / "manifest.json").read_bytes()
    rman = json.loads(rman_raw)
    source_cap = args.source_cap if args.source_cap is not None else max(1, args.campaign_target * 5 // 100)
    pending_cap = args.pending_cap if args.pending_cap is not None else 2 * source_cap
    if not (1 <= source_cap <= args.campaign_target and source_cap <= pending_cap):
        die(f"[campaign] need 1 <= source_cap ({source_cap}) <= target and <= pending_cap ({pending_cap})")
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "campaign_id": args.campaign_id,
        "created_at": int(time.time()),
        "tool_version": TOOL_VERSION,
        "baseline": {
            "release_id": args.release,
            "release_manifest_sha256": sha256_tag(rman_raw),
            "urls_sha256": rman["urls_digest"],
            "resources_sha256": rman["resources_digest"],
            "url_count": n_urls,
            "sitekey_count": len(keys),
        },
        "sitekey": auth.manifest_block(),
        "classification": {"schema": CLASSIFICATION_SCHEMA, "version": cls.version,
                           "sha256": cls.sha256},
        "policy": {
            "campaign_target": args.campaign_target,
            "source_cap": source_cap,
            "pending_cap": pending_cap,
            "quota_identity": "lead_source_key",
            "quota_counts": "REVIEW_ACCEPTED+CAMPAIGN_ACCEPTED",
            "progress_counts": "CAMPAIGN_ACCEPTED",
            "max_attempts": args.max_attempts,
            "entry_points_per_sitekey": 1,
        },
    }
    assert_no_floats(manifest)
    d.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.classification, d / Campaign.CLASSIFICATION)
    mpath.write_bytes(canonical_json(manifest))
    print(json.dumps({"campaign": str(d), "manifest_sha256": sha256_tag(canonical_json(manifest)),
                      **{k: manifest[k] for k in ("baseline", "classification", "policy")}},
                     indent=1, sort_keys=True))


async def cmd_harvest(args) -> None:
    auth = _auth(args)
    camp = Campaign(args.campaign, auth)
    registry = SourceRegistry(args.source_registry, args.leads, camp.cap) if args.source_registry else None
    polite = Politeness(args.delay)
    out_path, lead_path = camp.path("candidates.jsonl"), camp.path("leads.jsonl")
    seen = {r["url"] for r in load_jsonl(out_path)}
    harvested_by_source: Counter = Counter()
    lead_records, cand_records = [], []
    raw_leads = [l.split("#", 1)[0].strip() for l in Path(args.leads).read_text().splitlines()]
    async with make_client(args.timeout, 4) as client:
        for raw in filter(None, raw_leads):
            registry_source_key = registry.source_for(raw)[0] if registry else None
            source_limit = registry.sources[registry_source_key]["max_candidates"] if registry else 0
            rec = {"lead_source_url": raw,
                   "source_registry_key": registry_source_key,
                   "source_registry_sha256": registry.sha256 if registry else "",
                   "lead_observed_at": int(time.time()),
                   "tool_version": TOOL_VERSION, "campaign_manifest_sha256": camp.sha256}
            try:
                lead, lead_key = admit(auth, raw)
                probe = await guarded_get(client, polite, auth, lead, lead_key, args.max_bytes)
            except (Rejected, Unsafe) as e:
                lead_records.append({**rec, "status": "REJECTED", "reason_code": str(e)})
                print(f"[harvest] REJECT {raw}: {e}", file=sys.stderr)
                continue
            except Exception as e:  # noqa: BLE001
                lead_records.append({**rec, "status": "FAILED", "reason_code": type(e).__name__})
                print(f"[harvest] FAIL {raw}: {type(e).__name__}:{e}", file=sys.stderr)
                continue
            ev = probe.evidence()
            rec.update(lead_final_url=probe.final_url, lead_source_key=probe.final_key,
                       lead_page_sha256=ev["sha256"], lead_hash_scope=ev["hash_scope"],
                       lead_hashed_bytes=ev["hashed_bytes"], http_status=probe.status,
                       hops=probe.hops)
            if probe.status != 200:
                lead_records.append({**rec, "status": "FAILED", "reason_code": f"http_{probe.status}"})
                print(f"[harvest] FAIL {raw}: http_{probe.status}", file=sys.stderr)
                continue
            tree = HTMLParser(_decoded_for_screening(probe).decode("utf-8", "replace"))
            n = bad = 0
            for a in tree.css("a[href]"):
                href = a.attributes.get("href") or ""
                if not href or href.startswith(("#", "mailto:", "javascript:", "tel:", "data:")):
                    continue
                target = resolve_reference(probe.final_url, href)
                if target in seen:
                    continue
                seen.add(target)
                k, err = auth.key(target)
                if err:
                    bad += 1           # verify re-admits and records the reason
                elif k == probe.final_key:
                    continue           # internal navigation, not a lead
                if registry and harvested_by_source[registry_source_key] >= source_limit:
                    continue
                cand_records.append({"url": target, "anchor": (a.text(strip=True) or "")[:200],
                                     **({"source_registry_key": registry_source_key,
                                         "source_registry_sha256": registry.sha256} if registry else {}),
                                     **{f: rec[f] for f in LEAD_FIELDS},
                                     "campaign_manifest_sha256": camp.sha256})
                if registry:
                    harvested_by_source[registry_source_key] += 1
                n += 1
            lead_records.append({**rec, "status": "HARVESTED", "candidates": n, "unkeyable": bad})
            print(f"[harvest] {probe.final_key:40s} +{n} ({bad} not keyable)"
                  f"{'  (page truncated)' if probe.truncated else ''}", file=sys.stderr)
    append_sorted(lead_path, lead_records, key=lambda r: (r["lead_source_url"], r["lead_observed_at"]))
    append_sorted(out_path, cand_records, key=lambda r: (r["lead_source_key"], r["url"]))
    print(f"[harvest] wrote {len(cand_records)} candidates -> {out_path}", file=sys.stderr)


async def cmd_verify(args) -> None:
    auth = _auth(args)
    camp = Campaign(args.campaign, auth)
    obs_path, review_path = camp.path("observations.jsonl"), camp.path("review.csv")
    cand_path = Path(args.candidates) if args.candidates else camp.path("candidates.jsonl")

    history = load_jsonl(obs_path)
    check_binding(history, camp, "observations.jsonl")
    latest = latest_by_origin(history)
    claimed = {o["site_key"] for o in latest.values() if o["status"] in (LIVE, MANUAL)}
    review = camp.load_review()
    ledger = source_ledger(latest, review, camp.classification)
    now = time.time()

    skipped: Counter = Counter()
    skipped_detail: list[dict] = []
    chosen: dict[str, Obs] = {}
    planned_per_src: Counter = Counter()

    cands = []
    for line in cand_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            cands.append(json.loads(line) if line.startswith("{") else {"url": line})
    harvested = [c for c in cands if "lead_source_key" in c]
    check_binding(harvested, camp, str(cand_path))
    cands.sort(key=lambda c: (c.get("lead_source_key", MANUAL_SOURCE), c.get("url", "")))

    for c in cands:
        raw = c.get("url", "")
        src = c.get("lead_source_key") or MANUAL_SOURCE

        def skip(reason: str, k: str = "", url: str = raw) -> None:
            skipped[reason] += 1
            skipped_detail.append({"url": url, "site_key": k, "lead_source_key": src, "why": reason})

        try:
            url, k = admit(auth, raw)
        except Rejected as r:
            skip(r.code); continue

        if k in camp.corpus_keys:
            skip("sitekey_in_baseline", k, url); continue
        prev = latest.get(k)
        attempt = 1
        if prev:
            if prev["status"] != RETRY:
                skip(f"already_observed:{prev['status']}", k, url); continue
            if prev["attempt"] >= camp.max_attempts:
                skip("retry_exhausted_pending_finalize", k, url); continue
            if now - prev["observed_at"] < args.retry_min_age * 3600:
                skip("retry_backoff", k, url); continue
            attempt, url, raw = prev["attempt"] + 1, prev["url"], prev.get("raw_url", prev["url"])
            c = {**c, **{f: prev.get(f, c.get(f)) for f in LEAD_FIELDS}, "anchor": prev.get("anchor", "")}
            src = c.get("lead_source_key") or MANUAL_SOURCE
        if k in claimed:
            skip("sitekey_claimed_via_redirect", k, url); continue
        if k in chosen:
            # one entry point per new siteKey: keep the one closest to the front door
            cur = chosen[k]
            if attempt == 1 and cur.attempt == 1 and cur.lead_source_key == src and \
                    (len(urlsplit(url).path), url) < (len(urlsplit(cur.url).path), cur.url):
                cur.url, cur.raw_url, cur.anchor = url, raw, c.get("anchor", "")
            skipped["extra_page_same_sitekey"] += 1
            continue
        s = ledger.get(src, Counter())
        if quota_used(s) >= camp.cap:
            skip("source_cap_reached", k, url); continue
        if quota_used(s) + s["pending"] + planned_per_src[src] >= camp.pending_cap:
            skip("source_pipeline_full", k, url); continue
        planned_per_src[src] += 1
        lead = {f: c[f] for f in LEAD_FIELDS if f in c}
        lead.setdefault("lead_source_key", MANUAL_SOURCE)
        chosen[k] = Obs(origin_key=k, url=url, raw_url=raw, anchor=c.get("anchor", ""),
                        attempt=attempt, campaign_manifest_sha256=camp.sha256, **lead)

    finals = []
    for o in latest.values():
        if o["status"] == RETRY and o["attempt"] >= camp.max_attempts:
            finals.append({**o, "status": REJECT,
                           "reason_code": f"retry_exhausted:{o['reason_code']}",
                           "observed_at": int(now)})

    todo = sorted(chosen.values(), key=lambda o: o.origin_key)
    if args.limit:
        todo = todo[: args.limit]
    print(f"[verify] candidates={len(cands)} probing={len(todo)} "
          f"skipped={dict(sorted(skipped.items()))}", file=sys.stderr)

    sem = asyncio.Semaphore(args.concurrency)
    archive_sem = asyncio.Semaphore(2)
    polite = Politeness(args.delay)
    results: list[Obs] = []

    async with make_client(args.timeout, args.concurrency) as client, \
            httpx.AsyncClient(headers={"User-Agent": UA}, timeout=args.timeout,
                              trust_env=True) as archive_client:
        async def worker(o: Obs) -> None:
            async with sem:
                await observe(client, polite, archive_client, archive_sem, auth, o, args.max_bytes)
            results.append(o)
            mark = {LIVE: "+", MANUAL: "?", RETRY: "~", REJECT: "-"}[o.status]
            print(f"  {mark} {o.site_key:45s} {o.reason_code or o.title[:50]}", file=sys.stderr)

        await asyncio.gather(*(worker(o) for o in todo))

    seen_final = set(claimed)
    for o in sorted(results, key=lambda o: (len(urlsplit(o.url).path), o.url)):
        if o.status not in (LIVE, MANUAL):
            continue
        if o.site_key in camp.corpus_keys:
            o.status, o.reason_code = REJECT, "redirects_into_baseline"
        elif o.site_key in seen_final:
            o.status, o.reason_code = REJECT, "duplicate_after_redirect"
        else:
            seen_final.add(o.site_key)

    batch = [asdict(o) for o in results] + finals
    append_sorted(obs_path, batch, key=_obs_sort)
    added = append_review(review_path, [r for r in batch if r["status"] in (LIVE, MANUAL)],
                          camp.binding())
    camp.path("skipped.json").write_text(json.dumps(
        {"campaign_manifest_sha256": camp.sha256, "counts": dict(sorted(skipped.items())),
         "items": sorted(skipped_detail, key=lambda d: (d["why"], d["site_key"], d["url"]))},
        indent=1, sort_keys=True))
    st = Counter(r["status"] for r in batch)
    print(f"[verify] {dict(sorted(st.items()))}  review rows added={added}", file=sys.stderr)


def cmd_stats(args) -> None:
    auth = _auth(args)
    camp = Campaign(args.campaign, auth)
    cls = camp.classification
    latest = latest_by_origin(load_jsonl(camp.path("observations.jsonl")))
    review = camp.load_review()
    states = Counter()
    invalid = []
    for r in review:
        s, probs = review_state(r, cls)
        states[s] += 1
        if s == "REVIEW_ACCEPTED":
            invalid.append((r["site_key"], probs))
    st = Counter(o["status"] for o in latest.values())
    reasons = Counter(o["reason_code"].split(":")[0] for o in latest.values() if o["reason_code"])
    arch = Counter(o["archive_status"] for o in latest.values() if o["status"] in (LIVE, MANUAL))
    scope = Counter(o["probe_hash_scope"] for o in latest.values() if o["status"] in (LIVE, MANUAL))

    print(f"campaign            {camp.manifest['campaign_id']}  manifest {camp.sha256}")
    print(f"baseline            {camp.manifest['baseline']['release_id']} "
          f"({camp.manifest['baseline']['sitekey_count']} siteKeys)")
    print(f"classification      {cls.version}  {cls.sha256}")
    print(f"observed siteKeys   {len(latest)}   {dict(sorted(st.items()))}")
    print(f"CAMPAIGN_ACCEPTED   {states['CAMPAIGN_ACCEPTED']} / {camp.target}")
    print(f"REVIEW_ACCEPTED     {states['REVIEW_ACCEPTED']}  (accepted, classification incomplete)")
    print(f"rejected by human   {states['REVIEW_REJECTED']}")
    print(f"invalid verdict     {states['REVIEW_INVALID']}")
    print(f"awaiting review     {states['UNREVIEWED']}")
    print(f"archive (live+manual) {dict(sorted(arch.items()))}")
    print(f"probe hash scope      {dict(sorted(scope.items()))}")
    print("\nreason codes:")
    for k, v in reasons.most_common():
        print(f"  {v:6d}  {k}")
    print(f"\nper lead_source_key (quota {camp.cap}):")
    for src, c in sorted(source_ledger(latest, review, cls).items(),
                         key=lambda kv: (-quota_used(kv[1]), kv[0])):
        flag = "  QUOTA FULL" if quota_used(c) >= camp.cap else ""
        print(f"  camp={c['campaign_accepted']:4d} rev={c['review_accepted']:4d} "
              f"pend={c['pending']:4d} rej={c['human_rejected']:4d}  {src}{flag}")
    if invalid:
        print(f"\nREVIEW_ACCEPTED rows needing classification fixes ({len(invalid)}):")
        for k, p in invalid[:30]:
            print(f"  {k}: {', '.join(p)}")
    acc = [r for r in review if review_state(r, cls)[0] == "CAMPAIGN_ACCEPTED"]
    if acc:
        print("\nCAMPAIGN_ACCEPTED by resource_type:")
        for k, v in Counter(r["resource_type"] for r in acc).most_common():
            print(f"  {v:6d}  {k}")
        print("CAMPAIGN_ACCEPTED by primary_subject:")
        for k, v in Counter(r["primary_subject"] for r in acc).most_common():
            print(f"  {v:6d}  {k}")


def cmd_export(args) -> None:
    auth = _auth(args)
    camp = Campaign(args.campaign, auth)
    cls = camp.classification
    obs = load_jsonl(camp.path("observations.jsonl"))
    check_binding(obs, camp, "observations.jsonl")
    by_key: dict[str, dict] = {}
    for o in latest_by_origin(obs).values():
        if o["status"] in (LIVE, MANUAL):
            by_key[o["site_key"]] = o
    edges: dict[str, set] = defaultdict(set)
    cand = load_jsonl(camp.path("candidates.jsonl"))
    check_binding(cand, camp, "candidates.jsonl")
    for c in cand:
        k, _ = auth.key(c["url"])
        if k:
            edges[k].add(tuple(c.get(f) for f in ("lead_source_key", "lead_source_url", "lead_final_url",
                                                  "lead_page_sha256", "lead_observed_at")) + (c["url"], c.get("anchor", "")))
    out, missing = [], []
    for r in camp.load_review():
        if review_state(r, cls)[0] != "CAMPAIGN_ACCEPTED":
            continue
        o = by_key.get(r["site_key"])
        if not o:
            missing.append(r["site_key"])
            continue
        out.append({
            "schema": "r4b1t-wild-accepted/v1",
            "campaign_manifest_sha256": camp.sha256,
            "classification_sha256": cls.sha256,
            "site_key": r["site_key"],
            "url": o["final_url"] or o["url"],
            "resource_type": r["resource_type"].strip(),
            "primary_subject": r["primary_subject"].strip(),
            "subjects": cls.subject_list(r),
            "reason": r["reason"].strip(),
            "observation": {k: o[k] for k in (
                "origin_key", "url", "raw_url", "final_url", "hops", "status", "http_status",
                "observed_at", "attempt", "probe_sha256", "probe_hash_scope", "probe_hashed_bytes",
                "archive_status", "archive_url", "archive_timestamp", "title")},
            "quota_lead": {f: o.get(f) for f in LEAD_FIELDS} | {"anchor": o.get("anchor", "")},
            # every harvested link that pointed at this identity (origin and final siteKey)
            "lead_edges": [dict(zip(("lead_source_key", "lead_source_url", "lead_final_url",
                                     "lead_page_sha256", "lead_observed_at", "url", "anchor"), e))
                           for e in sorted(edges[o["origin_key"]] | edges[o["site_key"]],
                                           key=lambda e: tuple(str(x) for x in e))],
        })
    if missing:
        die(f"[export] review rows with no matching live observation: {missing[:10]}")
    path = camp.path("campaign-accepted.jsonl")
    path.write_text("".join(canonical_json(r).decode("utf-8") + "\n"
                            for r in sorted(out, key=lambda r: r["site_key"])))
    print(f"[export] {len(out)} CAMPAIGN_ACCEPTED -> {path}  "
          f"(sha256 {sha256_tag(path.read_bytes())})", file=sys.stderr)


# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def authority(p):
        p.add_argument("--r4b1t-root", required=True,
                       help="path to the R4B1T checkout providing site-key/v1")
        p.add_argument("--allow-dirty-authority", action="store_true",
                       help="proceed with uncommitted authority files (recorded)")

    def campaign(p):
        authority(p)
        p.add_argument("--campaign", required=True, help="campaign directory")

    s = sub.add_parser("selftest"); authority(s)
    s.add_argument("--vectors", help="external fixture (marks the authority dirty)")
    s.add_argument("--release", help="release id under corpus/releases to count")

    c = sub.add_parser("campaign-init"); campaign(c)
    c.add_argument("--campaign-id", required=True)
    c.add_argument("--release", required=True, help="baseline release id, e.g. experience-candidate-v0.4")
    c.add_argument("--expect-sitekeys", type=int, help="refuse unless the baseline has this many")
    c.add_argument("--classification", required=True, help="frozen resource-classification-v2 JSON")
    c.add_argument("--campaign-target", type=int, default=1000)
    c.add_argument("--source-cap", type=int, help="max accepted siteKeys per lead_source_key "
                   "(default: 5%% of target, integer division)")
    c.add_argument("--pending-cap", type=int, help="max accepted+unreviewed per lead_source_key "
                   "(default: 2 x source cap)")
    c.add_argument("--max-attempts", type=int, default=3)

    h = sub.add_parser("harvest"); campaign(h)
    h.add_argument("--leads", required=True)
    h.add_argument("--source-registry",
                    help="frozen discovery registry matching every lead URL exactly")
    h.add_argument("--timeout", type=float, default=20)
    h.add_argument("--delay", type=float, default=1.0)
    h.add_argument("--max-bytes", type=int, default=4 * 1024 * 1024)

    v = sub.add_parser("verify"); campaign(v)
    v.add_argument("--candidates", help="default: <campaign>/candidates.jsonl")
    v.add_argument("--limit", type=int, default=0, help="probe at most N siteKeys (pilot)")
    v.add_argument("--concurrency", type=int, default=16)
    v.add_argument("--timeout", type=float, default=15)
    v.add_argument("--delay", type=float, default=2.0,
                   help="min seconds between requests to one host (every hop)")
    v.add_argument("--max-bytes", type=int, default=1024 * 1024)
    v.add_argument("--retry-min-age", type=float, default=6.0, help="hours before a retry")

    st = sub.add_parser("stats"); campaign(st)
    ex = sub.add_parser("export"); campaign(ex)

    args = ap.parse_args()
    {"selftest": cmd_selftest, "campaign-init": cmd_campaign_init, "stats": cmd_stats,
     "export": cmd_export}.get(args.cmd, lambda a: None)(args)
    if args.cmd == "harvest":
        asyncio.run(cmd_harvest(args))
    elif args.cmd == "verify":
        asyncio.run(cmd_verify(args))


if __name__ == "__main__":
    main()
