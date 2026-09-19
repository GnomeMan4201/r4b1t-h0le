# Trail Comparison / Divergence v1 — Final Acceptance Record

Status: ACCEPTED / FROZEN  
Contract baseline: `CONTRACT.md` v1.0  
Normative spec: `docs/TRAIL_COMPARISON_V1_SPEC.md`

## Accepted implementation baseline

Final contract-audit merge SHA:

`c8ac1bedabd2b8fa65414ad3360bba9e2394a95c`

The accepted Trail Comparison / Divergence v1 implementation consists of:

- `docs/schema/trail-comparison-v0.1.schema.json`
- `docs/TRAIL_COMPARISON_V0.1_SCHEMA.md`
- `trail-comparison.js`
- `trail-comparison-renderer.js`
- `trail-comparison-import.js`
- `trail-comparison-bundle.js`
- `trail-comparison.css`
- `trail-comparison-import.css`
- `tools/create-trail-comparison-bundle.js`
- `tools/inspect-trail-comparison-bundle.js`
- golden vectors under `tests/fixtures/trail-comparison-v1/`
- schema, projection/core, renderer, local-import, bundle, and final contract-audit tests
- dedicated `Trail Comparison v1 Audit` GitHub Actions gate

## Acceptance evidence

The exact final-audit PR head:

`b767ee8b30cbc4c607d2fa64320d46f5d2e17cb1`

passed all of the following before merge:

- Trail Comparison v1 Audit — run #15
- Trail Cards v1 Audit — run #13
- Playwright E2E — run #358

## Frozen invariants

Trail Comparison / Divergence v1 is frozen with these boundaries:

- exactly two independently supplied canonical trail artifacts are compared
- Trail Cards, screenshots, images, summaries, and prior comparison projections are not evidence inputs
- both exact source byte sequences are independently verified during the comparison operation
- each source is bound to the SHA-256 digest of those exact bytes
- input roles are symmetric; neither side is preferred, ranked, scored, or declared better
- source verification states are exactly VERIFIED, REJECTED, and UNVERIFIED
- comparison facts are emitted only when both inputs are VERIFIED
- REJECTED or UNVERIFIED input produces diagnostic-only output with no inferred divergence or lineage facts
- shared-prefix equality is exact: matching verified route IDs or identical concealed commitments only
- concealed route identity is never inferred or exposed
- direct parent/fork claims are accepted only through the existing canonical lineage verifiers
- a shared prefix alone does not prove ancestry
- comparison projections are derived presentation, never canonical evidence authority
- no comparison projection can reconstruct, modify, merge, repair, extend, or synthesize a canonical trail
- local two-file comparison requires explicit user-supplied files and creates no persistent comparison history
- portable handoff preserves both exact canonical source files plus a derived projection and README
- bundle inspection freshly re-verifies both source files and recomputes comparison
- no network, account, profile, telemetry, public gallery, social graph, popularity, recommendation, ranking, discovery, sampler, corpus, wear, or future-selection path is introduced
- Trail Topology v2 and Trail Cards v1 remain independent frozen feature families and are not consumed as comparison evidence

Any future change that weakens or expands these boundaries requires an explicit Trail Comparison specification revision and, where applicable, a Product Contract amendment.
