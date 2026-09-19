# Proof Sessions v1 — Final Acceptance Record

Status: ACCEPTED / READY TO FREEZE  
Contract baseline: `CONTRACT.md` v1.0  
Normative spec: `docs/PROOF_SESSIONS_V1_SPEC.md`

## Acceptance target

This record becomes the accepted Proof Sessions v1 implementation baseline when the final contract-audit PR merges after all required exact-head gates pass.

The accepted feature family consists of:

- `docs/PROOF_SESSIONS_V1_SPEC.md`
- `docs/schema/proof-session-v0.1.schema.json`
- `docs/PROOF_SESSION_V0.1_SCHEMA.md`
- `proof-session.js`
- `proof-session-renderer.js`
- `proof-session-import.js`
- `proof-session-bundle.js`
- `proof-session.css`
- `proof-session-import.css`
- `tools/create-proof-session-bundle.js`
- `tools/inspect-proof-session-bundle.js`
- golden vectors under `tests/fixtures/proof-sessions-v1/`
- schema, core, renderer, local-import, portable-file-set, and final contract-audit tests
- dedicated `Proof Sessions v1 Audit` GitHub Actions gate

## Acceptance criteria

The final audit requires all of the following on the exact PR head:

- Proof Sessions v1 Audit
- Trail Comparison v1 Audit when the shared comparison boundary is touched
- Trail Cards v1 Audit when the shared proof surface is touched
- full Playwright E2E

No cancelled or superseded run counts as acceptance evidence.

## Invariants under final audit

Proof Sessions v1 is accepted only if all of these remain true:

- the session is an ephemeral proof/presentation workspace, not evidence authority
- canonical source files are independently verified from exact supplied bytes
- exact duplicate source bytes collapse deterministically
- different byte sequences remain distinct even if canonical trail identity matches
- source proof states are exactly VERIFIED, REJECTED, and UNVERIFIED
- diagnostic sources contribute no pair, divergence, or relationship facts
- every unordered VERIFIED pair is delegated exactly once to frozen Trail Comparison v1
- session code does not define a second comparison algorithm
- direct graph edges are emitted only for directly verified parent relationships
- no transitive lineage claim or edge is manufactured
- concealed route identity never leaks into session projection or renderer
- summary vocabulary is closed to the ten frozen labels
- renderer consumes validated session projection only
- ordinary sessions persist nowhere automatically
- closing the session clears the in-memory file set and rendered state
- portable export is a file set, not a new canonical evidence manifest
- exact bundled source files remain the only canonical evidence inputs
- offline inspection freshly verifies sources, recomputes all eligible pair projections, direct edges, and summary before comparing stored derived presentation
- stored derived presentation never seeds fresh proof state
- portable inspection classifications are exactly MATCH, MISMATCH, and UNREADABLE
- stored/fresh mismatch remains visible diagnostic information and is not silently repaired
- README.txt is non-normative and cannot affect machine proof conclusions
- verifier timestamps and unreconstructable duplicate-selection multiplicity are the only v1 portable-equivalence metadata exclusions
- no account, network, telemetry, recommendation, ranking, popularity, similarity scoring, social graph, sampler, corpus, wear, route-weighting, or future-selection path is introduced
- frozen Trail Topology v2, Trail Cards v1, and Trail Comparison v1 remain independent feature families

Any future change that weakens or expands these boundaries requires an explicit Proof Sessions specification revision and, where applicable, a Product Contract amendment.

## Freeze gate

After this audit is accepted and merged, a separate freeze PR must:

1. change the Proof Sessions v1 spec status from DRAFT to FROZEN,
2. update this record with the accepted final-audit merge SHA and exact acceptance evidence,
3. make no functional product changes,
4. pass Proof Sessions v1 Audit and full Playwright E2E on the exact freeze head before merge.
