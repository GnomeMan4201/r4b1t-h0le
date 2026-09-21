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

**ROLL → Trail → Topology → Comparison → Proof Session**

**Sequence corrections:** `Dossier` was removed as a standalone audit surface after repository verification showed it remains a contract-level/display concept but is not independently exposed in the current production UI. `Trail Card` was likewise removed after repository verification showed the renderer/handoff implementation is shipped as supporting capability but is not mounted as an independently reachable production surface. Dossier-like metadata and Trail Card-related presentation are audited only where a concrete production surface actually renders them.

This is an audit *sequence*, not a priority ranking. It follows the actual experience outward from the primary interaction, so a viewport or touch problem discovered early (e.g. on ROLL) can be recognized as a shared-shell issue instead of being independently rediscovered and "fixed" several times on later surfaces. Comparison and Proof Sessions still get full coverage — they simply come after the foundational, higher-traffic surfaces.

## 4. Candidate areas

### 4.1 Layout & viewport
- Safe-area insets on notch / home-indicator devices (top and bottom)
- Orientation change behavior (portrait ↔ landscape) across shells (roll view, trail, topology, cards, comparison, proof sessions)
- Horizontal scroll leaks on wide content (trail metadata, topology graphs, comparison views) — content should scroll in its own container, never the page body

### 4.2 Touch targets & gestures
- Hit-area sizing on dense UI (trail cards, comparison view, proof session artifact list)
- Accidental-trigger risk near the ROLL control and other primary actions
- Scroll-vs-gesture conflicts on any draggable/interactive elements

### 4.3 Typography & readability
- Small-viewport font scaling across terminal-style captions, trail/topology text, diagnostic labels
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
| Surface | ROLL / Trail / Topology / Comparison / Proof Session |
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


### Pass 1B — ROLL / iPhone landscape

**Evidence:** iPhone Safari device recording `5E667C1C-288D-48B1-9A4E-DFFF2F7F6C79.mp4` (41.7 s, 30 fps).

The recording was reviewed as an observation pass only. No production changes were made.

| Surface | Viewport / orientation | Reproduction | Observed behavior | Expected behavior | Category | Severity | Shared/local ownership | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| ROLL | iPhone / landscape | Rotate from portrait to landscape with instrument visible and inspect the ROLL surface | Instrument reflows into landscape and remains operable, but the composition is strongly portrait-derived: the primary content occupies a relatively narrow central column while substantial horizontal viewport area remains unused | Landscape should preserve the instrument hierarchy while making intentional use of the wider viewport without changing ROLL authority or motion | Layout | Friction | Shared mobile shell / ROLL presentation | 41.7 s device recording | Needs design decision |
| ROLL | iPhone / landscape | Perform ROLL and let the result settle | ROLL and result content remain contained; no reproducible body-level horizontal scroll leak is visible | Page body remains horizontally contained; wide content scrolls only in owned containers | Layout | — | Shared mobile shell | 41.7 s device recording | No finding |
| ROLL | iPhone / landscape | Rotate portrait ↔ landscape during the recorded session | Orientation changes preserve the instrument and settled route state; no new ROLL/reveal is visibly initiated by rotation | Orientation change reflows presentation without creating an authoritative event | Parity / layout | — | Shared mobile shell | 41.7 s device recording | No finding |
| ROLL | iPhone / landscape | Observe labels, route metadata, and controls after rotation and ROLL | Text remains present and readable, though the narrow portrait-derived content column limits the readability benefit normally available from landscape width | Landscape typography should remain legible and use available width where doing so does not alter semantics | Typography | Friction | Shared mobile shell / ROLL presentation | 41.7 s device recording | Track with landscape layout decision |
| ROLL | iPhone / landscape | Interact with ROLL and scroll through settled content | No reproducible accidental activation or scroll-vs-ROLL gesture conflict observed | ROLL activation remains deliberate and independent of scrolling | Touch target | — | ROLL local presentation | 41.7 s device recording | No finding |
| ROLL | iPhone / landscape | Observe ROLL transition and orientation reflow | No obvious sustained frame-drop or stalled interaction is visible; frozen Motion Pass 3 constants were not evaluated for retuning | Presentation remains responsive without reopening frozen motion | Performance | — | Observation only | 41.7 s device recording | No finding |

**Pass 1B result:** one concrete landscape issue is established: the ROLL surface remains functionally correct but uses a portrait-derived narrow composition that leaves much of the landscape viewport unused. This is recorded as a **Friction** finding requiring a short design decision, not an implementation change during the audit. No evidence in this pass reopens Motion Pass 3, authority, or PR #146 return continuity.

**ROLL audit status:** portrait and landscape observation passes complete. Proceed next to **Trail**, beginning with iPhone portrait.


### Pass 2A — Trail / iPhone portrait

**Evidence:** iPhone Safari device recording `AD8CAE90-5347-4B52-86B4-47FDA471E155.mp4` (78.6 s, 30 fps, 512×1108).

Observation only; no production changes.

| Surface | Viewport / orientation | Reproduction | Observed behavior | Expected behavior | Category | Severity | Shared/local ownership | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| Trail | iPhone / portrait | Build several routes, open trail/topology presentation, inspect accumulated entries | Trail state remains available and the presentation stays inside the phone viewport; no reproducible body-level horizontal overflow is visible | Trail presentation remains contained at phone width | Layout | — | Shared mobile shell / Trail | 78.6 s recording | No finding |
| Trail | iPhone / portrait | Inspect dense trail/topology metadata and controls | Secondary metadata and compact controls are visibly very small relative to the primary ROLL/result typography, increasing reading and targeting effort at phone size | Trail metadata and actionable controls should remain comfortably readable/targetable without changing semantics | Typography / touch target | Friction | Trail/topology presentation | 78.6 s recording | Needs design decision |
| Trail | iPhone / portrait | Move between accumulated route presentation and Trail Topology | Dense evidence/topology presentation preserves content but compresses substantial information into a small phone-width region | Mobile Trail should preserve capability while presenting dense evidence at a usable inspection scale | Parity / layout | Friction | Trail/topology presentation | 78.6 s recording | Needs design decision |
| Trail | iPhone / portrait | Scroll and navigate through the recorded accumulated trail | No obvious sustained scroll stall or frame-drop is visible in the recording | Trail interaction remains responsive as entries accumulate | Performance | — | Observation only | 78.6 s recording | No finding |

**Pass 2A result:** Trail portrait is functionally contained, but the recording establishes a **density/readability friction** finding: secondary trail/topology metadata and controls are compressed to a scale that increases reading and touch effort on phone. This is a presentation/design issue only; no authority or evidence semantics are implicated. Landscape Trail remains unaudited.


### Pass 2B — Trail / iPhone landscape

**Evidence:** iPhone Safari device recording `ScreenRecording_09-21-2026 12-17-12_1.mp4` (45.2 s, 30 fps, 1108×512).

Observation only; no production changes.

| Surface | Viewport / orientation | Reproduction | Observed behavior | Expected behavior | Category | Severity | Shared/local ownership | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| Trail | iPhone / landscape | Keep r4b1t visible in landscape and inspect accumulated route/trail presentation | r4b1t remains functional and contained, but the active route/trail content uses only a narrow portion of the available landscape width, leaving large unused regions | Landscape should preserve hierarchy while making intentional use of available width | Layout | Friction | Shared mobile shell / Trail presentation | 45.2 s recording | Needs design decision |
| Trail | iPhone / landscape | Inspect compact route/trail metadata and controls | Extra viewport width does not materially resolve the portrait density/readability problem; metadata and compact controls remain visually small | Landscape should improve inspection scale where width permits without altering evidence semantics | Typography / touch target | Friction | Trail presentation | 45.2 s recording | Track with landscape layout/density decision |
| Trail | iPhone / landscape | Observe page containment while navigating accumulated results | No reproducible body-level horizontal overflow is visible | Page body remains horizontally contained | Layout | — | Shared mobile shell | 45.2 s recording | No finding |
| Trail | iPhone / landscape | Observe continued interaction and later orientation change | Instrument state remains present through the recorded landscape session; no authoritative event is visibly caused by orientation itself | Orientation changes presentation only | Parity / layout | — | Shared mobile shell | 45.2 s recording | No finding |
| Trail | iPhone / landscape | Observe interaction responsiveness | No obvious sustained frame-drop or stalled interaction is visible | Trail remains responsive without changing frozen motion behavior | Performance | — | Observation only | 45.2 s recording | No finding |

**Pass 2B result:** landscape does not solve the Trail portrait density issue. It establishes a related **landscape width-utilization friction** finding: substantial width is available but dense route/trail information remains constrained to a comparatively narrow presentation. This should be considered together with the ROLL landscape finding as a likely shared-shell design decision, not fixed during the audit.

**Trail audit status:** portrait and landscape observation passes complete. Proceed next to **Topology**, beginning with iPhone portrait.


### Pass 3A — Topology / iPhone portrait

**Evidence:** iPhone Safari device recording `A4CD96B9-3D2A-45AE-A644-C850530984B3.mp4` (63.6 s, 30 fps, 512×1108).

Observation only; no production changes.

| Surface | Viewport / orientation | Reproduction | Observed behavior | Expected behavior | Category | Severity | Shared/local ownership | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| Topology | iPhone / portrait | Open Trail Topology after accumulating multiple routes and inspect the topology entries | Topology remains contained within the phone viewport, but route cards, evidence diagrams, labels, and controls are densely compressed at portrait width | Topology should preserve evidence detail while remaining comfortably inspectable on a phone | Layout / typography | Friction | Topology presentation | 63.6 s recording | Needs design decision |
| Topology | iPhone / portrait | Inspect multiple trail topology entries and the Proof Inspector presentation | Long identifiers and evidence metadata remain present, but their small scale materially increases inspection effort | Evidence identifiers and categorical/diagnostic text should remain legible without semantic loss | Typography | Friction | Topology presentation | 63.6 s recording | Needs design decision |
| Topology | iPhone / portrait | Scroll through the accumulated topology entries | No reproducible body-level horizontal overflow is visible; the page remains horizontally contained | Wide topology content must remain owned by its presentation rather than leaking page-body width | Layout | — | Shared mobile shell / Topology | 63.6 s recording | No finding |
| Topology | iPhone / portrait | Navigate through the topology/proof presentation and return to the primary instrument | No obvious sustained scroll stall or interaction freeze is visible | Topology inspection remains responsive as trail entries accumulate | Performance | — | Observation only | 63.6 s recording | No finding |

**Pass 3A result:** Topology portrait confirms that the density/readability concern seen during the Trail pass is a concrete issue on Topology's own inspection surface. Capability and evidence remain present, but route diagrams, metadata, identifiers, and controls are compressed enough to increase inspection effort. This remains a presentation-only **Friction** finding; no topology semantics, evidence authority, selection behavior, or frozen ROLL motion are implicated.

**Topology audit status:** portrait complete; landscape remains to be observed.


### Pass 3B — Topology / iPhone landscape

**Evidence:** iPhone Safari device recording `ScreenRecording_09-21-2026 12-28-42_1.mp4` (71.3 s, 30 fps; recording canvas 512×1108 with the rendered instrument visibly rotated to landscape).

Observation only; no production changes.

| Surface | Viewport / orientation | Reproduction | Observed behavior | Expected behavior | Category | Severity | Shared/local ownership | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| Topology | iPhone / landscape | Keep Trail Topology visible, rotate to landscape, and inspect the graph and surrounding evidence UI | Topology remains functional and contained, but the graph/evidence composition continues to occupy a comparatively narrow region while substantial landscape width remains unused | Landscape should use available width to improve inspection scale without altering topology semantics | Layout | Friction | Shared mobile shell / Topology presentation | 71.3 s recording | Needs design decision |
| Topology | iPhone / landscape | Inspect node labels, route metadata, header, and compact controls | Additional landscape width does not materially increase the scale of small labels/metadata; inspection still requires effort | Landscape should improve legibility where width permits while preserving categorical/evidence meaning | Typography | Friction | Topology presentation | 71.3 s recording | Track with landscape layout/density decision |
| Topology | iPhone / landscape | Observe graph and controls during the landscape session | No reproducible body-level horizontal overflow is visible; topology remains inside the presentation | Wide topology content remains contained by its owned surface | Layout | — | Shared mobile shell / Topology | 71.3 s recording | No finding |
| Topology | iPhone / landscape | Continue inspecting topology after rotation | No authoritative event is visibly caused by orientation and no obvious sustained interaction stall is visible | Orientation changes presentation only and inspection remains responsive | Parity / performance | — | Shared mobile shell / observation only | 71.3 s recording | No finding |

**Pass 3B result:** landscape confirms the Topology portrait density issue and the broader landscape width-utilization pattern already observed on ROLL and Trail. The graph remains usable and contained, but the wider viewport is not used to materially improve inspection scale. This is a presentation-only **Friction** finding and should be considered with the shared-shell landscape design decision rather than independently normalized during the audit.

**Topology audit status:** portrait and landscape observation passes complete. Repository verification found no independently reachable production Trail Card surface, so no synthetic Trail Card device pass will be created. Proceed next to **Comparison**, beginning with iPhone portrait.


## Cross-shell capability inventory — mobile reachability

Repository inspection compared the desktop production trail-bar entry points with the dedicated mobile shell in `dual-shell.js`. This is a static reachability audit only; no production behavior was changed.

| Capability | Desktop production entry | Mobile production entry | Classification | Severity | Disposition |
| --- | --- | --- | --- | --- | --- |
| Trail Comparison | `compare trails` → `toggleTrailComparison()` | **No mobile action/entry found** | Genuine capability-access loss | **Impaired** | Record for post-audit mobile parity fix. Do not alter frozen comparison semantics. |
| Proof Session | `proof session` → `toggleProofSession()` | **No mobile action/entry found** | Genuine capability-access loss | **Impaired** | Record for post-audit mobile parity fix. Do not alter frozen Proof Sessions semantics. |
| Submit URL | `submit url` → `submitUrl()` | **No mobile action/entry found** | Capability-access difference; product intent must be confirmed before calling it a parity defect | **Friction** | Preserve as audit finding; determine whether omission is intentional shell adaptation. |
| Copy Trail | `copy trail` → `shareTrail()` | No direct mobile copy-trail entry found; mobile exposes route/card share instead | Capability-access difference | **Friction** | Verify intended mobile affordance before implementation. |
| Trail Card sharing | `share card` → `shareCard()` | `SHARE` / `CUT CARD` → `shareCard()` | Intentional shell adaptation | — | Present; no missing-capability finding. |
| History | `history` | `HISTORY` / `OPEN FULL LEDGER` | Intentional shell adaptation | — | Present. |
| Trail file / import-export | `trail file` → `openTrailLedger()` | `TRAIL FILE / REPLAY` → `openTrailLedger()` | Intentional shell adaptation | — | Present. |
| Replay / Inspection | `replay` | `REPLAY` / `VERIFY + REPLAY TRAIL` | Intentional shell adaptation | — | Present. |
| Blind Descent | production capability | `DESCEND BLIND` | Mobile capability present | — | Present. |
| Trail Wear | production capability | `VIEW WEAR SAMPLE` plus route wear rendering | Mobile capability present | — | Present. |

### Audit consequence

Comparison and Proof Session cannot receive ordinary mobile portrait/landscape interaction passes from the production shell because their entry points are absent there. That absence is itself the primary mobile finding. Do not manufacture device evidence by invoking globals from developer tools or synthetic test hooks; doing so would hide the actual reachability defect.
