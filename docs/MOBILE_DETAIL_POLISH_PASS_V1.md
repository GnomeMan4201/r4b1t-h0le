# Mobile Detail & Polish Pass v1

**Status:** AUDIT BASELINE v1 — FROZEN

**Governing sentence:** This pass improves mobile fit and finish on top of already-frozen behavior; it must not touch selection, authority, ROLL Motion Contract v1, Motion Pass 3, or the PR #146 return-continuity fix. Polish may change presentation geometry, hit areas, wrapping, overflow, and non-authoritative affordances, but it may not change when an authoritative event occurs or what causes one.

---

## 1. Purpose

Following the close of the return-continuity bug (PR #146) and the freeze of Motion Pass 3, work shifts from targeted bug fixing to general mobile fit-and-finish. This is a breadth pass across the phone-width experience, not a new feature or contract change.

## 2. Explicit non-goals

- No changes to selection, commit/reveal, or any state-machine authority.
- No changes to ROLL Motion Contract v1 or Motion Pass 3 timing/easing constants.
- No changes to the frozen return-continuity behavior from PR #146.
- No new proof/evidence format work (Topology, Trail Cards, Comparison, Proof Sessions untouched).

## 3. Audit sequence

**ROLL → Trail → Dossier → Topology → Trail Card → Comparison → Proof Session**

This is an audit *sequence*, not a priority ranking. It follows the actual experience outward from the primary interaction, so a viewport or touch problem discovered early (e.g. on ROLL) can be recognized as a shared-shell issue instead of being independently rediscovered and "fixed" several times on later surfaces. Comparison and Proof Sessions still get full coverage — they simply come after the foundational, higher-traffic surfaces.

## 4. Candidate areas

### 4.1 Layout & viewport
- Safe-area insets on notch / home-indicator devices (top and bottom)
- Orientation change behavior (portrait ↔ landscape) across shells (roll view, dossiers, topology, cards, comparison, proof sessions)
- Horizontal scroll leaks on wide content (dossiers, topology graphs, comparison views) — content should scroll in its own container, never the page body

### 4.2 Touch targets & gestures
- Hit-area sizing on dense UI (trail cards, comparison view, proof session artifact list)
- Accidental-trigger risk near the ROLL control and other primary actions
- Scroll-vs-gesture conflicts on any draggable/interactive elements

### 4.3 Typography & readability
- Small-viewport font scaling across terminal-style captions, dossier text, diagnostic labels
- Line-length and wrapping on narrow widths, especially for hashes/digests/IDs shown in cards and diagnostics
- Contrast/legibility of categorical state labels (VERIFIED / REJECTED / UNVERIFIED / CONCEALED / REVEALED) at phone size

### 4.4 Performance feel
- Scroll jank on longer trails / larger topology graphs
- First-paint / time-to-interactive on route entry
- Animation frame drops on older/lower-powered devices (observation only — must not feed back into Motion Pass 3 tuning, which is frozen)

### 4.5 Cross-surface parity
- Points where mobile and desktop shells visibly diverge beyond the intentional "SAME ENGINE // TWO SHELLS" split
- Any feature present on desktop but degraded or missing on mobile (e.g. topology inspection, comparison, proof session import)
- **Observation before normalization:** a desktop/mobile difference must not automatically be treated as a parity bug. First classify each one as (a) intentional shell adaptation, (b) genuine capability loss, or (c) presentation defect. "SAME ENGINE // TWO SHELLS" means semantic/capability parity, not pixel parity — only (b) and (c) are findings; (a) is documented and closed as-is.

## 5. Branch strategy

No long-running fix branch. Process:

1. **Audit-only branch/PR:** contains this scoping document plus the issue matrix (§6). Changes no production behavior. Reviewed and frozen as a record of findings before any implementation begins.
2. **Individual findings close via small independent branches from current main**, one per finding or tightly related cluster (e.g. one branch for safe-area insets, a separate one for a specific touch-target fix) — not grouped into one sweeping polish branch.
3. Each implementation PR states explicitly which frozen contracts it does *not* touch (Motion Pass 3, PR #146 return behavior, ROLL Motion Contract v1, selection/authority), following existing PR discipline.
4. Close each finding with a short device-recording pass where relevant, same acceptance style as PR #146.

This keeps regression attribution clean — a problem found later traces to one small branch, not an undifferentiated polish sweep.

## 6. Audit matrix schema

Every finding recorded in the audit gets one row with these columns:

| Column | Meaning |
|---|---|
| Surface | ROLL / Trail / Dossier / Topology / Trail Card / Comparison / Proof Session |
| Viewport / orientation | Exact device + portrait or landscape |
| Reproduction | Minimal steps to reproduce |
| Observed behavior | What actually happens |
| Expected behavior | What should happen |
| Category | Layout, touch target, typography, performance, or parity |
| Severity | **Blocker** / **Impaired** / **Friction** / **Cosmetic** — usability impact, not aesthetics |
| Shared/local ownership | Does this belong to a shared shell component (fix once, applies everywhere) or is it local to one surface? |
| Evidence | Screenshot, recording, or trace reference |
| Disposition | Fix now / needs design decision / defer / not a bug (intentional adaptation) |

## 7. Immediate next move

**Audit Pass 1 — ROLL only. No fixes.**

- iPhone portrait first, then landscape.
- Document every finding using the §6 matrix — only what can be proven/reproduced, not suspected issues.
- Motion Pass 3 and the PR #146 return-continuity fix remain closed baselines throughout; the audit observes around them, it does not re-open them.
- Once ROLL is fully audited, proceed to Trail, then continue down the §3 sequence.


## 8. Audit log

### Pass 1A — ROLL / iPhone portrait

**Evidence:** iPhone Safari device recording `77A7AC48-D4B9-4A67-8984-7B62F9A29076.mp4` (50 s).

The recording was reviewed as an observation pass only. No production changes were made.

| Surface | Viewport / orientation | Reproduction | Observed behavior | Expected behavior | Category | Severity | Shared/local ownership | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| ROLL | iPhone / portrait | Load instrument; perform repeated ROLL interactions; allow each result to settle | Primary ROLL control remains fully contained and visually dominant; no body-level horizontal overflow observed during settled instrument states | ROLL remains contained, reachable, and dominant without page-width leakage | Layout | — | Shared mobile shell | 50 s device recording | No finding |
| ROLL | iPhone / portrait | Perform repeated ROLL interactions and observe press through settled result | No reproducible accidental activation or scroll/gesture conflict observed around the primary control | ROLL activation remains deliberate and scrolling remains independent | Touch target | — | ROLL local presentation | 50 s device recording | No finding |
| ROLL | iPhone / portrait | Observe headline, ROLL label, BLIND DESCENT controls, and settled route cards | Core labels remain readable at recorded phone width; no proven clipping or wrapping defect on the ROLL surface | Core instrument labels remain legible without semantic loss | Typography | — | Shared mobile shell / ROLL | 50 s device recording | No finding |
| ROLL | iPhone / portrait | Repeat ROLL and observe transition/settling | No obvious frame-drop or stalled interaction is visible in the recording; Motion Pass 3 behavior is treated as frozen and was not retuned | Interaction remains responsive without reopening frozen motion constants | Performance | — | Observation only | 50 s device recording | No finding |

**Pass 1A result:** no reproducible ROLL/portrait polish defect is established by this recording. External destination rendering visible after VISIT is not attributed to the ROLL surface. Landscape ROLL remains unaudited until evidence captures the instrument itself in landscape.
