# Continuous Sprout flow

This is an integrated production-path implementation, staged behind a release
gate. Preview the real application at `index.html?flow=sprout`.
The default interface remains available while the course correction is reviewed.
No deployment, corpus promotion, or proof-format migration is part of this change.

## Files and responsibility

- `sprout-flow.js`: transient presentation tree, one destination card, SVG roots, accessible
  controls, motion gating and reset synchronization.
- `sprout-flow.css`: terminal-theme styles, mobile clearance, reduced motion, and
  scoped replacement of the current card/branch/map presentation.
- `index.html`: loads the component and exposes two narrow adapters from the
  existing application closure. Emits ROLL presentation only at the existing
  reveal callback.
- `trail-runtime.js`: returns recorded step identity with the immutable ROLL
  result; validates and persists BRANCH navigation using an exact `from_step`;
  acknowledges reset only after persistence succeeds.
- `dual-shell.js`: routes existing mobile branch actions inline when enabled.
- `sw.js`: cache version bump and offline coverage for the new assets.
- `tests/sprout-flow.spec.js`: integrated desktop/mobile regression coverage.

No new runtime or development dependency is required.

## Activate and roll back

Use `?flow=sprout` on an isolated review build. Alternatively, set
`window.R4B1T_SPROUT_FLOW_ENABLED = true` before the deferred component loads.
Remove that flag and query parameter to return to the current default view.
The gate does not clear storage or rewrite recorded artifacts.

A future default-on rollout should be a separate, small change after exact-head
CI and mobile review. This branch does not merge itself or deploy.

## Authority contract

1. ROLL invokes the existing desktop authority or the existing mobile reel and
   motion machine. It does not supply a new random source or sampler.
2. The live ledger records the immutable ROLL transaction as before. Its returned
   receipt includes the recorded step number and epoch; those fields are outside
   the transaction and do not change v0.3 artifact bytes.
3. The destination card updates on `r4b1t:route-revealed` at the existing reveal boundary. It waits
   until motion settles before accepting the next action. A cancelled roll adds
   no junction or card update, even if the existing authority already recorded a commit.
4. SPROUT calls `getSproutTargets(originUrl)`, which uses `branch-core/v1` and the
   active corpus bytes. It creates no navigation step.
5. A clicked target is revalidated against that same branch authority before
   `selectSproutBranch` asks the ledger to persist it.
6. The ledger checks the exact recorded parent step, origin URL and epoch. Failed
   or blocked writes return no receipt and create no junction or card update.
7. Successful branch navigation records one BRANCH step with `sampler: null`
   semantics (no ROLL transaction), then reveals the selected URL. No intermediate
   SELECT is created.
8. Titles and descriptions are presentation-only, copied with `textContent` and
   guarded by the exact active URL. They never choose a route or amend provenance.

The displayed `/02_ALTERNATIVE` maps to the existing `sideways` branch type.
Exported branch labels stay `deeper`, `sideways`, and `opposite` for compatibility.
Reasons retain the honest URL-structure heuristics of ADR 0007. These labels do
not claim semantic orthogonality or independent proof of relevance.

## UI state

One full-width destination card updates in place. Branch selections append compact
receipt-bound route links instead of repeating full cards. Each selected root grows
another three-way fork automatically, starting at the selected left, center or right
endpoint. No extra sampler draw or navigation step is required to display those
roots. Children grow below their parent's root group; siblings retain click order.
ROLL updates the same card and creates a fresh junction from the active node.
Occupied roots focus their existing child without adding another ledger step.
In the continuous mobile view, the bottom-left navigation action is SPROUT.
It expands or focuses roots from the active card; it does not reset the stage or
consume a sampler draw. It is disabled until a card lands and while motion is
active. Blind Descent keeps its existing ROLL navigation.
The destination card shares the mobile machine's black, white, red and rule
tokens, domain-first typography, red destination slab and joined action rails.
Root controls use compact ordinal tags above readable directional names; neutral
roots become red after a successful branch landing. The bottom SPROUT action is
a labeled slab without the old ROLL aperture glyph. These are presentation
changes only; receipt, sampler, navigation and proof semantics remain unchanged.
The existing slot machine remains responsible for its animation and disclosure.

The visual tree is intentionally transient: reload starts a new visible descent,
while the authoritative ledger stays intact. The component never reconstructs a
reveal boundary from storage. Existing Trail File, replay, proof, comparison and
Blind Descent interfaces remain available. This component owns the core discovery
loop; it does not replace the separate evidence-review tools.

## Run and verify

Node 24 and the locked Playwright dependency are already used by this repository.

```sh
npm ci
npx playwright install chromium
npm run test:unit
npx playwright test --config=playwright.sprout.config.js
npm run test:e2e
node tests/test-server.js
# Desktop: http://127.0.0.1:8080/?flow=sprout
```

For a phone, use a review deployment URL. `127.0.0.1` on a phone refers to the
phone itself, not a computer running the preview server.

Regression scenarios include recursive descent, exact parent identity when a
URL appears twice, duplicate clicks, failed persistence, invalid targets, reset
rollback, reduced motion, 320px width, keyboard actions, mobile branch handoff,
cancellation, and gate-off compatibility.

Before default-on promotion, require normal pinned-browser CI at the reviewed
commit and an iOS Safari check of the reel, settling, long trail scrolling and
navigation back. Local alternative-browser checks do not establish iOS behavior.
