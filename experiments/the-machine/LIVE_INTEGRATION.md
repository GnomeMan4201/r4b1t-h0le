# THE MACHINE / Real mobile shell integration — opt-in v1

Status: DRAFT VISUAL STUDY ONLY. Use `?machine=1` on this branch. **Not deployed.**

## Purpose
Translate the approved standalone concept into an *additive presentation skin* on the actual R4B1T H0L3 mobile runtime and authoritative ROLL / REEL / rabbit animation. Unlike the standalone demo, this does not use demo destinations, fake provenance, scene timers or a duplicate selector.

## Locked contract
- Base: exact green #285 `b58950ad4697173bd163b0c72bab825bf0a79858`.
- Normal URL (without `?machine=1`) remains unchanged; theme selector is explicitly opt-in and scoped to widths <= 900px.
- The unchanged original `anime.min.js` loads the original `dual-shell.css` and `dual-shell.js`; overlay stylesheet is linked *last*. No modification of original CSS integrity hash, HTML markup, canonical production SVG, or JavaScript selection/commit/reveal/Trail code.
- No CSS targeting rabbit animation keyframes/transforms, ROLL state or animation classes. Original REEL window 192px, 6/2px margins, button dimensions, viewport and fixed-action positions are not changed.
- Theming changes textures, borders, color and shadows. Based on actual 390×844 screenshot evidence, the opt-in skin **restores the source-provided headline** (only when portrait is at least 375×780, while retaining above-fold ROLL) and reduces the oversized result-domain typography for readability. These refinements may change non-authoritative text flow, but do not move or resize the fixed action rails, main ROLL/reel dimensions, rabbit geometry, or alter motion authority. No fake result text, badges or provenance.

## Product scope
Invitation: visual hierarchy, logo and canonical production mark; ROLL/BLIND switch and ROLL/MENU intact.
ROLL: original reel and rabbit motions, new metal/red console finish.
RESULT: original verified route, metadata, OPEN/KEEP/INSPECT/ROLL AGAIN; new framing and color only.
MENU: existing live History, Terrain, Trail, replay and proof instrument actions intact.

## Acceptance
- Run full normal and exact-head E2E plus Mobile WebKit and Replay checks on the exact branch head.
- Run opt-in integration test for real authoritative selection and two successive ROLLs, no extra Trail commits, changed computed skins, no horizontal scroll.
- Compare plain `/` vs `/?machine=1`: normal path unchanged and identity of authoritative JS/SVG blobs preserved.
- Conduct physical iPhone inspection before any default theme rollout; prior WebKit rAF middle-phase 2/20 observation remains unresolved.
- No merge of this draft / production deployment without separate approval.

## Compact browser viewport review (iPhone screen recording, 2026-10-11)
A physical iPhone recording in an in-app browser revealed that the original >=780px-height headline rule did not fire in a shorter browser pane, and the 208px circular ROLL extended behind fixed bottom navigation. The Machine-only compact-portrait CSS now shows the source invitation headline, reduces only the displayed logo and ROLL control footprint, and leaves the REEL window (192px), authority, and rabbit motion unchanged. New 390x680 browser checks and screenshots cover this case. Real iPhone retest is still required; emulator geometry is not compositor smoothness proof.

## Compact mark continuity refinement (iPhone video review, 2026-10-11)
The physical 14.2-second iPhone ROLL recording shows a distinct mark enlargement when the result replaces the invitation. Exact-head 390×680 screenshot geometry established a frame-height transition from 71px at invitation to 112px at result (41px / 58%). Cause: opt-in invitation-specific max-height versus unmodified result-stage fixed mark height. This patch uses the same compact `clamp(64px,10.5dvh,82px)` for BOTH Machine stages, and checks both container and source SVG rendered heights via Playwright and the screenshot workflow. It does not modify source SVG, production rabbit keyframes, animation triggers, REEL dimensions, sampling, route selection, Trail or default site.

The 14.2-second 30fps phone recording visibly shows reel phase progression and an eventual reveal, but is not a direct WebKit frame-pacing trace. Continue to treat compositor smoothness and intermittent missing mid-phase rAF observations as unproven; do not tune animation timings or claim this is fixed.

## Long result scroll clearance verification (2026-10-11)
Current production mobile CSS includes a 180px post-route scroll reserve, but earlier coverage only asserted full-height non-Machine behavior at 390×844. New tests at 390×680 and 390×844 apply the opt-in Machine theme, perform a real authoritative ROLL, then stress **only post-reveal source metadata** with 30 context segments. At maximum normal document scroll they require the final description and source URL to clear the fixed action rail, while fixed OPEN/ROLL AGAIN positions and the original selection/Trail step remain unchanged. The visual evidence workflow also captures the 390×680 long-result scrolled state with numeric clearance metrics. This is browser-emulated layout evidence, not a claim about physical iOS compositor smoothness. No scroll CSS change unless this verification finds a defect.
