# Changelog

All notable changes to `r4b1t_h0le` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

No changes queued.

---

## [1.1.0] — 2026-09-18

### Added

- dual desktop/mobile shells over the same discovery engine
- reproducible content-addressed trails with verifiable parent/fork lineage
- Blind Descent commit/reveal flow with concealed-step commitments and deterministic reveal verification
- local verified Trail Topology atlas and persistent trail-wear visualization
- mobile motion diagnostics and transition-specific trail states
- production Worker trust-boundary documentation, audit tooling, and release evidence
- production-shadow verification tooling
- automated public-claim verification
- corpus-quality and report-only pool-sweep workflows
- browser regression coverage across desktop and mobile Chromium
- security policy, issue templates, pull-request template, and repository quality controls

### Changed

- current verified corpus baseline is 50,109 structurally valid URLs across 12,396 unique hosts
- PWA shell now prefers current network bytes and uses cache as offline fallback
- repository and Pages paths were normalized to `r4b1t-h0le`
- Worker browser/client contract was aligned to the deployed versioned Worker hostname
- first-party GitHub Actions are pinned to immutable commit SHAs
- desktop controls, Help/Tor dialogs, Session History, Trail Ledger, Blind Descent, and Trail Topology now preserve native keyboard semantics and complete modal focus lifecycles
- obsolete one-off patch scripts, stale screenshots, dead bookmark UI, and redundant public glue were removed

### Security

- Worker rejects private/loopback and non-HTTP targets, revalidates redirects, bounds redirects/response sizes/outbound time, enforces the documented Origin policy, and uses fail-closed production rate limiting
- old Worker `/api` behavior is retired with HTTP 410
- public-claim, Worker-boundary, dependency, secret-scan, browser, and deployment checks are now part of the verification surface

### Release gate

- package version is `1.1.0`
- repository/browser/Pages baselines are green on current `main`
- **GitHub Release publication remains blocked until one real Production Shadow workflow run completes successfully against the release candidate**


---

## [1.0.0] — 2026-06-17

### Added

**Core discovery engine**
- RANDOM mode — roll a verified live URL from a pool of 53,869 URLs across 14,488 unique domains
- SKIP — roll again without visiting
- VISIT — open current URL in new tab
- Domain preview shown before any navigation

**BRANCH mode**
- SPROUT generates four directional suggestions: deeper, sideways, opposite, weird
- Powered by OG metadata + Wikipedia API keyword extraction — zero API cost
- Pure JS category adjacency graph, no LLM dependency

**FILTER**
- Lock rolls to a category: CODE, OSINT, BLOG, NEWS, RESEARCH, BOUNTY, VIDEO, SOCIAL, REF, ARCHIVE, PKG, COURSE, EVENT, HARDWARE, TOR

**Session tools**
- HISTORY — full scrollable session history, clickable to revisit
- SHARE CARD — download PNG card of current rabbit hole
- COPY TRAIL — export session as markdown with clickable links and timestamps
- SUBMIT URL — suggest additions via pre-filled GitHub issue

**Onion support**
- 148 verified `.onion` addresses in the pool
- Tor Browser detection gate on first onion surface — skip or exclude for session

**UX / shell**
- Keyboard shortcuts: Space (roll), Enter (visit), S (skip), P (sprout), C (share card), ? / H (help), ESC (close overlay)
- Dark/light mode with warm light palette, persisted across sessions
- PWA — installable as home screen app, offline shell cache via service worker (`sw.js`, cache key `r4b1t-v1`)
- SVG branch history visualization
- Microlink screenshot proxy replacing iframe previews
- Bookmarklet — drag **⬛ r4B1T_h0L3** to bookmarks bar after first roll

**Infrastructure**
- Cloudflare Worker backend (`r4b1t-proxy`) — OG metadata fetch (/api), site proxy with RFC1918 blocking (/proxy), OG image route (/og)
- Edge cache: 1hr TTL
- Rate limited: 60 req/min per IP, origin-locked
- `urls.txt` — flat pool file served via GitHub Pages, network-first in service worker
- `pool_sweep.py` — multithreaded HEAD sweep with SQLite result store, `--workers` and `--timeout` flags
- `tools/` — classifier, tagger, pipeline, category filter patcher, branch injection, liveness check, pool extractor/cleaner
- 173 commits from first upload (2026-06-07) through public release

---

## [0.1.0] — 2026-06-07

- Initial upload: single-file `index.html`, `demo.svg`, base README
