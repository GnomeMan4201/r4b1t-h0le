# Trail Cards v1 — Final Acceptance Record

Status: ACCEPTED / FROZEN
Contract baseline: `CONTRACT.md` v1.0
Normative spec: `docs/TRAIL_CARDS_V1_SPEC.md`

## Accepted implementation baseline

Final contract-audit merge SHA:

`226f99ffcbccd08733e20652979c2139cd321037`

The accepted Trail Cards v1 implementation consists of:

- `docs/schema/trail-card-v0.1.schema.json`
- `trail-card.js`
- `trail-card-renderer.js`
- `trail-card-bundle.js`
- `trail-card-share.js`
- `trail-card.css`
- `trail-card-share.css`
- golden vectors under `tests/fixtures/trail-cards-v1/`
- projection, renderer, bundle, share, and final contract-audit tests

## Acceptance evidence

The exact final-audit PR head
`866dd60a0fbd05577e9106c4486d5e29f879e9b1`
passed both:

- Trail Cards v1 Audit — run #1
- Playwright E2E — run #333

before merge.

## Frozen invariants

Trail Cards v1 is frozen with these boundaries:

- canonical artifact JSON -> deterministic Trail Card is one-way only
- the card is presentation, never evidence authority
- exact verification states are VERIFIED, REJECTED, and UNVERIFIED
- VERIFIED is bound to the exact SHA-256 digest of source bytes verified during that render
- PARENT ABSENT is a relationship state and does not downgrade an otherwise verified topology artifact
- REJECTED and UNVERIFIED remain structurally diagnostic and cannot be upgraded by render, bundle, or handoff
- detached cards establish no current integrity
- portable bundles preserve exact canonical source bytes alongside presentation
- sharing is point-to-point only
- no share history, gallery, feed, popularity, engagement, follower, trending, discovery, recommendation, sampler, wear, corpus, or route-selection path is introduced
- proof/export/share remain local-first and require no account or server-side identity

Any future change that weakens these boundaries requires an explicit Trail Cards spec revision and, where applicable, a Product Contract amendment. Trail Comparison / Divergence is a separate feature family and must consume independently supplied artifacts without feeding results back into selection.
