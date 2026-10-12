# Issue 307 — rabbit reveal observation diagnostics (RED phase)

Status: evidence-gathering branch only; no production behavior, SVG, REEL, or UI changes.

## Repro hypothesis
The existing `rollOnce()` waits a fixed 2300ms after tapping a real production ROLL, then inspects observations collected from an rAF/MutationObserver sampler. In a contested full test suite, the recorded `presentation:revealed` event is occasionally absent, even though the test passes on retry. This does not prove a production reveal failure.

## Test-only method
- Preserve the original 2300ms snapshot **as the ONLY assertion input**.
- Only when one of `commit`, `reveal`, `presentation:revealed`, `result-mounted`, `trail-recorded` is absent at the fixed deadline, collect an immediate snapshot of actual DOM presentation, reel phase, route, recorded history length, rabbit WAAPI state, mark fallback trace and complete instrument event timeline.
- Perform a bounded (up to 3500ms) diagnostic observation for actual DOM reveal or sampled reveal event, then capture a second snapshot with times. This **does not change the test verdict** or weaken assertions.
- Run 10 independent mobile-Chromium repetitions with Playwright retries disabled. Also run full normal and exact-head suites; previous evidence has seen this only under load.
- Classification after data exists: (a) DOM actually reveals late, (b) DOM is revealed but sampler missed event, (c) neither reveals, requiring runtime investigation. Do not infer (a) or (b) from passing retry.

## Safety / scope
Branch is based on exact validated mobile baseline `b58950ad4697173bd163b0c72bab825bf0a79858`. The Machine PR #306 remains separately in draft. No main, deployment, production mark animation, selection, proof or Trail changes. This lane should not be merged while the first-attempt flake diagnosis remains incomplete.

## RED result and bounded wait contract (2026-10-11)
The exact-head diagnostic workflow [#38191318125](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/38191318125) reproduced one first-attempt failure in 10 no-retry repetitions (nine passed, one failed). Captured event timeline: `commit` 75ms, rabbit named `animationend` 1081ms, `reveal`/result-mounted/Trail recorded 1741ms, original fixed snapshot at 2362ms showing phase `reveal` and reel `lock`, then authoritative `presentation:revealed` at 2363ms, followed by observed fully-revealed DOM at 2373ms. This **demonstrates a race with the fixed observation window**; it is neither a missing selection nor proof of frame-pacing smoothness.

GREEN candidate: retain the 2300ms checkpoint **only for diagnostics**; if incomplete, wait up to 3500 additional ms on a **bounded conjunction of actual DOM phase revealed, REEL phase revealed, disclosed mounted result, and all original event observations plus rabbit animation start/end, rolling state and result-on**. If any condition stays missing, fail and emit before/after snapshots. The test continues to enforce unchanged CSS-duration, animation cancellation, commit-before-rabbit-end, result-on-after-rabbit-end assertions. No production/runtime animation, sampler, Trail or release change. Re-run 10 mobile no-retry stress repetitions and the full CI. Do not close #307 from one passing run: follow-up flake monitoring remains useful.
