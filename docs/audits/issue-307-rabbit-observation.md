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
