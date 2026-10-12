# Issue #307 — rabbit ROLL reveal observation and test deadline

**Disposition:** Test-only bounded-observation correction, verified on the final test-code SHA `3701f6ed26c3cf65403db85340262140d77b3347`. No production JavaScript, SVG, CSS, REEL, selection, Trail or motion-timing changes.

**Important branch dependency:** This diagnostic PR #308 targets the validated mobile baseline from draft [PR #285](https://github.com/GnomeMan4201/r4b1t-h0le/pull/285), branch `fix/mobile-reel-stage-spacing-main-20261008` at `b58950ad4697173bd163b0c72bab825bf0a79858`. PR #285 is not merged into `main`. PR #306 (Machine theme) is separately draft and unaffected. A clean mergeability check against this base is **not** merge approval or proof of integration with current `main`.

## What failed (RED)

In `tests/production-mark-authority.spec.js`, `rollOnce()` used `page.waitForTimeout(2300)` after tapping ROLL and then asserted all sampled events had arrived. The underlying rAF/MutationObserver sampler sometimes saw `presentation:revealed` slightly after that arbitrary checkpoint, even though the authentic destination and Trail were already committed.

A diagnostic-only commit `dc544ee138546530b463fb7d7d78216d086bab29` retained the original failure behavior and added fixed-window/late snapshots. [10× no-retry diagnostic #38191318125](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/38191318125): **9 passed, 1 failed**. In the failure:
- Rabbit named `animationend` observed 1081ms after start; `reveal`, result-mounted and Trail recorded by 1741ms.
- 2362ms fixed snapshot: real DOM phase `reveal`, REEL phase `lock`, committed result mounted and one Trail step.
- 2363ms: sampled `presentation:revealed`; by 2373ms the DOM and REEL were both `revealed`.

This proves a fixed-test-deadline race for the observed failure; it does **not** establish a defective production reveal or frame-pacing/smoothness.

## Corrected test semantics (GREEN)

The normal-motion `rabbit finishes its own 1000ms ROLL` test opts into `rollOnce(page, selector, { requireNormalMarkTimeline:true })`.

1. Keep the original 2300ms observation point for a diagnostic **snapshot only**.
2. If the required events or actual revealed DOM/REEL state are incomplete, use a bounded additional 3500ms state-driven wait. Require **real** `data-r4m-presentation= revealed`, `#r4mRollReel[data-phase=revealed]`, a disclosed, mounted result, plus every required event: commit, reveal, presentation revealed, result-mounted, trail-recorded, rabbit animationstart/end, mark rolling-on/off and mark-result-on.
3. Capture the before/after event timelines, phase, reel, mounted-route status, session-history length, WAAPI animation state and rabbit watchdog trace whenever the fixed checkpoint is incomplete. Emit `ISSUE307_OBSERVATION` diagnostic JSON.
4. On bounded timeout, missing event or missing authentic result, **fail** with `ISSUE307_BOUNDED_REVEAL_FAILED`. Do not silently drop an assertion.
5. Preserve the original test's CSS animation duration and no-cancel checks, commit-before-rabbit-end order, mark-result-on-after-animationend checks, and repeat ROLL coverage.

The two other uses of the shared helper retain the **original** 2300ms event return and their original assertions: the comparison test intentionally blocks the rabbit SVG, while the reduced-motion test correctly lacks normal rabbit animationstart/end events.

An intermediate candidate `ab308565ae6993474ac13946739c11911f2d439d` incorrectly demanded those animation events in *all* helper users: its focused stress passed but ordinary full Playwright [#38191542310](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/38191542310) failed. That was a test-harness mistake, not a production defect. Final test-code commit `3701f6ed26c3cf65403db85340262140d77b3347` explicitly confines strict normal-motion requirements to the normal-motion test.

## Exact-head verification (test-code SHA `3701f6ed`)

- [Diagnostic #38192201211](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/38192201211): **10 passed without retries**.
- [Mobile WebKit REEL #38192201212](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/38192201212): **6 passed**.
- [Ordinary Playwright E2E #38192201238](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/38192201238): **248 passed, 148 skipped, no reported flakes**.
- [Release Exact Head E2E #38192201218](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/38192201218): **248 passed, 148 skipped, no reported flakes**.

Critically, the release run *also* caught a real late observation in full-suite contention: at 2378ms the phase was `reveal`, REEL `lock`, missing `presentation:revealed`; at 2389ms the genuine phase and REEL were `revealed` with no missing events, and the corrected test passed.

These are test-observation guarantees, **not** measured iPhone animation frames or assurances about browser paint smoothness. Keep issue #307 open for post-merge monitoring until separately authorized. This branch and its upstream dependency remain **DRAFT**. Do not merge or deploy without explicit approval.
