# THE MACHINE / Real mobile shell integration — opt-in v1

Status: DRAFT VISUAL STUDY ONLY. Use `?machine=1` on this branch. **Not deployed.**

## Purpose
Translate the approved standalone concept into an *additive presentation skin* on the actual R4B1T H0L3 mobile runtime and authoritative ROLL / REEL / rabbit animation. Unlike the standalone demo, this does not use demo destinations, fake provenance, scene timers or a duplicate selector.

## Locked contract
- Base: exact green #285 `b58950ad4697173bd163b0c72bab825bf0a79858`.
- Normal URL (without `?machine=1`) remains unchanged; theme selector is explicitly opt-in and scoped to widths <= 900px.
- The unchanged original `anime.min.js` loads the original `dual-shell.css` and `dual-shell.js`; overlay stylesheet is linked *last*. No modification of original CSS integrity hash, HTML markup, canonical production SVG, or JavaScript selection/commit/reveal/Trail code.
- No CSS targeting rabbit animation keyframes/transforms, ROLL state or animation classes. Original REEL window 192px, 6/2px margins, button dimensions, viewport and fixed-action positions are not changed.
- Theming applies only to texture, borders, colors and shadows on existing controls and DOM. No fake result text, badges or provenance.

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
