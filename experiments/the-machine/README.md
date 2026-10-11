# R4B1T H0L3 — THE MACHINE · mobile interaction concept v1

**Status: design prototype, isolated.** This standalone HTML deliberately does **not** load the real production app, issue commits, select corpus entries, modify Trails, or implement the real rabbit ROLL SVG animation. All destinations and technical steps are visibly labeled as demonstrations. In particular, CSS animation is only an artistic mechanism proxy; do not use it as WebKit performance evidence.

Source authority: #285 tested head `b58950ad4697173bd163b0c72bab825bf0a79858`, existing `MOBILE_LANDING_CONTRACT.md` and `RESULT_EXPERIENCE_CONTRACT.md`. Uses the original `rabbit-aperture.svg` *geometry* inline, copied without modifying its strokes or fill shapes.

## Demo map

- Fresh ROLL: wordmark, mode switch ROLL / BLIND DESCENT, "A HOLE, NOT A FEED", existing rabbit-aperture artwork, ROLL CTA, bottom ROLL / MENU.
- Click ROLL: shows a mechanical 1.45s demonstration animation clearly reporting selector/provenance not connected; no fake seed, manifest, route authority, or Trail history.
- Example RESULT: sample design placeholder at reserved `https://example.org`, actions OPEN DESTINATION, KEEP CARD (locally downloads a **demo PNG**), INSPECT (honest about missing authority), ROLL AGAIN.
- MENU: all source mobile utilities remain discoverable in categories and acknowledge they are not connected to production.
- BLIND DESCENT: separate stage with no automatic selection or commitment. CTA acknowledges mode is not connected in concept.

## Integration handoff: do NOT drop constraints

Real integration, if approved, should be *presentation only* atop the existing `dual-shell.js` and `roll-reel.js` projection. Never install the demo timer as a commit/reveal authority or selection driver, nor replace the original SVG / WebKit rabbit controller. Hide result-identifying DOM until `state.revealed` exists. Keep ROLL and BLIND DESCENT mutually exclusive; no selection on mode change. KEEP CARD must continue to call original `shareCard()`, OPEN must reference verified selected URL, INSPECT must show original metadata, and MENU tools must be delegated to existing actions. Preserve viewport, overlay, nav and keyboard accessibility in one-authority DOM.

## Basic QA

1. At 390×844, ROLL CTA visible without scrolling; bottom ROLL and MENU visible and keyboard operable.
2. Mode switch never starts rolling or changes any selection; BLIND DESCENT shows only its own entry.
3. Double ROLL input cannot trigger concurrent demo reveals. Reduced-motion completes safely.
4. Result actions present and responsive with 44px+ targets; no horizontal overflow at 390 and 320 widths.
5. MENU contains HISTORY, TERRAIN FILTER, BRANCH, ROUTE INFO, MAP TRAILS, COPY TRAIL, TRAIL FILE / REPLAY, COMPARE TRAILS, PROOF SESSION, VERIFY + REPLAY, TOUCH GUIDE, THEME, and .ZIP.
6. At no point claim live route commitment, proof, real metadata, selection fairness, or real animation timing in this demo.

## Preview

Open `the-machine-mobile-v1.html` in a modern browser or serve it as a static file. No build, APIs, external fonts, credentials, or network are needed for the interface; OPEN DESTINATION intentionally uses the reserved example.org link.