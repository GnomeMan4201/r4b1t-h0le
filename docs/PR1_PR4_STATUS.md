# PR1–PR4 current-state audit

Baseline: main `2fab77df4883141ac66e6ee340696c03c39c7df5` (2026-10-04 UTC).
Repair: PR #245, refreshed with main; no separate numbered replacement PRs.
Status: **NOT CLOSED — original sequence source and shipment gate outstanding**.

The original PR1 review/evidence archive was inspected. It describes terrain
acceptance T1-01–T1-16 and continuity S1–S4, but does not contain the complete
original PR2–PR4 acceptance plan. PR #226 has no discussion comments carrying
that plan. The repository contracts and successor PRs establish the requirements
below; they cannot establish that no original requirement is missing. Do not
rename this partial reconstruction as completion of the original sequence.

| Requirement / source | Current implementation | Tests / evidence | Commit / PR | Status |
|---|---|---|---|---|
| Release-bound, registry-anchored terrain authority; ADR 0006 and PR1 T1-01–T1-16 | Promotion → immutable registry binding → digest-bound terrain index → release-order eligible pool | `terrain-authority.test.js`, `selection-core.test.js`, `terrain-eligibility.spec.js`, `test_terrain_index.py`, claims verifier; all 3 registry profiles regenerate | #226; current corpus promotion descendants | SATISFIED on main; preserved |
| Actual committed selection inputs; Selection Transaction v2 | Immutable transaction records corpus revision, constraint/index digest, eligible count, sampler interval and actual repeat guard before exposure | `cf1-mobile-roll-provenance.spec.js`, `trail-v03-runtime.spec.js`, transaction tests | #226, #234 | SATISFIED on main; preserved |
| Versioned step evidence without inherited sampler claims; Trail v0.3 | ROLL/v2, SELECT, BRANCH, IMPORTED; CJ-1 identity; explicit parent prefixes | `trail-v03.test.js`, `trail-cli.test.js`, runtime tests; unsupported-version rejection | #233 `be838a5`, #234 `8bdc6b9` | SATISFIED on main; preserved |
| Independent sampler derivation, distinct from base integrity | Existing Python re-executor reconstructs release bytes, registry authority, pool, FNV-1a/Mulberry32 interval and selected route; no JS/DOM dependency | `test_reexecute_trail.py`, `reexecutor-parity.test.js`; rehashed route/count/seed/digest tamper and corrupt release/registry tests | #238 `c36fa4d`; added negative coverage in #245 | SATISFIED implementation; experimental verifier designation retained |
| S1/S2 cursor/sequence restore; S3 repeated committed ROLL; S4 fresh guard on reset/fork | Trail-scoped sampler authority | `sampler-continuity.spec.js`, runtime v0.3 tests | #231 `9fc735c`; #239/#240/#242/#243 closed duplicates | Original repairs SATISFIED; duplicate branches SUPERSEDED |
| No dropped committed ROLL during replay; no invalid chain extension | Record before returning/revealing; rewind on recording failure; whole-chain bounded restore; shared pure transaction shape validator | `trail-record-integrity.test.js`, TR-1…TR-5 on both shell projects | Existing #245 repair integrated, then storage/restore fixes in same PR | REPAIRED IN #245; pending merge/shipment |
| No silent destruction on malformed/stale draft restoration | Exact rejected bytes quarantined, prior quarantine retained; preservation failure keeps original and blocks ROLL/export/reset/fork | Node regressions for stale revision, invalid JSON/URL, unknown declaration, storage failure and prior evidence retention | #245 refresh | REPAIRED IN #245; pending merge/shipment |
| Desktop/mobile share authority and maintain continuity | Both shells retain the same commit API and trail state across viewport transitions | TR-6 records, exports and independently re-executes the cross-shell chain | #245 refresh; default Playwright desktop/mobile projects | IMPLEMENTED; browser gate must execute |
| Deterministic presentation-blind BRANCH; ADR 0007 | Existing pure `branch-core.js`; no metadata/history/enrichment/random input or file-order tie authority | `branch-core.test.js`, `branch-determinism.spec.js` | #237 `ac20904` | SATISFIED on main; no wider branch-semantic proof claim |
| Historical verification / bounded claims | v0.1/v0.2 verification and IDs unchanged; labeled legacy projection; no transitive evidence claims | 32 focused historical/v0.3/provenance tests; CLI lineage; frozen proof/replay audits; README claims inspection | Existing verifiers; #245 does not change historical formats | PRESERVED |
| Receipt / public chance promotion | Isolated versioned experiment, CJ-1 identities, offline vector, independent JS/Python derivation and Python BLS; no production integration or pre-round witness | `verifiable-chance.test.js`, `test_verifiable_chance.py`; tamper and bounded-claim checks | #241 `3eb8562` | EXPERIMENTAL; original PR4 promotion requirement UNRESOLVED |

Local verification after repairs: Node **450 passed, 0 failed, 0 skipped**;
Python **140 passed** (with `requests`, `tqdm`, and experiment-only `py_ecc`
installed); static public claims **passed**; all three registered terrain indexes
**VERIFIED**. Independent negative cases recompute valid envelope identities,
so they test derivation/authority rather than merely a stale artifact hash.

Pinned Chromium could not download locally (truncated archive). GitHub Actions
is used for actual browser execution; record final run results in PR #245.
Do not count a scheduled job as verification. Tests deliberately gated to the
opposite shell project remain skips, not passes.

No corpus releases, promotion/registry, health/maintenance state, product/motion
contracts, SVG/UI layout, Blind Descent, or corpus ledger implementation changed.
Draft PR #254 remains untouched. Public chance remains outside production.

Ledger readiness: **NO**. Recover the original PR2–PR4 requirements, reconcile
any remaining acceptance conditions, finish the relevant browser/negative gates,
and ship the repair before starting the frozen ledger's shadow implementation.
