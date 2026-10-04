# Changelog

All notable changes to `r4b1t_h0le` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- An independent Python re-executor for `r4b1t-trail/v0.3` ROLL steps. It verifies exact release/terrain evidence and independently reproduces the current FNV-1a → Mulberry32 sampler interval without importing runtime JavaScript; its claim is route derivation, not seed fairness or non-cherry-picking.
- The `strange-candidate-v0.3` corpus adds 116 unusual security resources and expands the promoted population to 6,975 resources across 345 hosts and 14 resource types, with exact admission declarations and reproducible candidate evidence.
- URL-only archive, RSS/Atom and sitemap collection plus a separate reviewed
  index compiler; collection alone cannot admit or promote a resource.
- secondary mark state conformance spec (state ownership, peer switch, COPY TRAIL, ROLL / BLIND / RESULT authority) and unit coverage for the wiring and the canonical-return contract

### Changed

- R4B1T H0L3 mark stays on stage: while any sheet or overlay is open (MENU, filter, branch, help, inspect, history, topology, replay, comparison, proof, trail, blind descent) the mobile shell docks the mark above it and the panel starts below, so every command's reaction is seen, BLIND DESCENT included; layout only, the mark's markup and state classes are untouched
- secondary mark motion scaled for phones (the mark is ~120px tall): same choreography and timing, with head, ear, paw and body travel large enough to read; MENU gains a head turn toward the control (approved MENU rules unchanged, amplitude via their custom properties); displaced paws are backed by red sockets that reuse the paw outlines, so the head's paw outlines never show; reduced-motion semantics and the 380ms canonical-return contract are unchanged
- R4B1T H0L3 secondary motion (BRANCH, TRAIL, TOPOLOGY, HISTORY, REPLAY / INSPECT, COPY TRAIL) reimplemented to the approved Motion Board, superseding #218: paw backing and a left-eye socket remove paw ghosts and the eye gap, ears and resting paws move with the head, RESULT keeps its own state while a sheet is open, and reduced motion restores the approved MENU/HISTORY/COPY semantics
- the mobile shell derives the mark's secondary state from each surface's own open state (one observer, overlay modules untouched); peer switches pass through the canonical pose (380ms canonical-return contract), COPY TRAIL is a short event class, and ROLL / BLIND DESCENT close shell sheets before taking the stage
- TRAIL now returns in the board's order (artifact, paw, head, eyes last) through its own eye-glance wrapper (`r4h-act-glance-*`); the other peers keep eyes-first, and every return still lands inside the 380ms contract
- BRANCH suggestions are now a deterministic function of the origin URL and active corpus only. Display metadata, Wikipedia enrichment, session topology, ambient randomness, and file-order tie breaking no longer influence offered routes (ADR 0007).
- BRANCH reason text now states the mechanical driver (scope/URL-token overlap or deterministic fallback) instead of implying stronger semantic classification.
- Trail export now defaults to `r4b1t-trail/v0.3`, preserving ROLL selection transactions and explicit SELECT/BRANCH navigation as step evidence; labeled legacy v0.1 export remains available for compatibility.
- `trail:verify` now verifies v0.3 integrity and v0.3 parent lineage in addition to existing v0.1/v0.2 formats. Topology continues through the explicit legacy v0.1 projection until a v0.3 adapter lands.
- Terrain eligibility now comes from a digest-bound `terrain-index-v1` compiled from the active release's `urls.txt` and `resources.json`. It is anchored by `corpus/runtime/eligibility-profiles-v1.json` (ADR 0006, `TERRAIN_AUTHORITY_CONTRACT.md`). The legacy hostname→terrain table no longer decides membership.
- The terrain vocabulary follows the active release's resource types. The `strange-candidate-v0.3` promotion adds `challenge` and binds all 14 types through its release-specific terrain index; every one of the 6,975 routes belongs to exactly one terrain.
- Every terrain control shows its eligible count before ROLL. A dry terrain cannot be armed. Single-route and two-route terrains are labelled `SINGLE ROUTE` and `ALTERNATES`.
- ROLL transactions advance to `r4b1t-selection-transaction/v2`. They now record the terrain index binding, the eligible count, and the repeat-guard reference actually used. Sampler behavior is unchanged.
- An empty eligible pool, or a missing selection authority, is reported explicitly (`#rollStatus`, mobile ROLL scope) instead of silently doing nothing. `ee()` no longer falls back to `Math.random`.
- The hostname table's result badge now reads `SITE HINT · <tag>` and is described as display-only.

### Fixed

- Local ROLL sampler continuity now survives page reloads: the draft restores the consumed draw cursor and transaction sequence from its latest v2 transaction.
- Every committed ROLL is persisted even when a one-route or max-draw result repeats the previous URL.
- The immediate-repeat guard is trail-scoped. RESET and FORK begin with a null guard reference instead of inheriting page-session state.

- The last row of mobile bottom sheets was covered by the fixed bottom navigation and could not be tapped. On `main`, this affected the TOR filter.

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
