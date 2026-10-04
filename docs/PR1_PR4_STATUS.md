# PR1–PR4 current-state audit

Baseline: main `2fab77df4883141ac66e6ee340696c03c39c7df5` (2026-10-04 UTC).
Repair: PR #245, refreshed with main; no separate numbered replacement PRs.
Status: original requirements reconstructed; runtime repairs in #245 have passed the
relevant gates; shipment remains the PR merge boundary. This document records the requirements and
verification boundary; the PR's merged state is the shipment record.

The original sequence was recovered from the prior design conversation
(2026-10-01, assistant message 12:05:43 UTC): **PR1 terrain authority → PR2 Trail
step evidence (v0.3) → PR3 BRANCH input authority → PR4 local sampler
re-execution**. Verifiable Chance was explicitly subsequent work. The PR1
review/evidence archive supplies T1-01–T1-16 and S1–S4; the source-aligned
Verifiable Chance design report identifies the repair prerequisites and
historical/claim boundaries. Current normative contracts and actual current
behavior, rather than the draft public-chance design, govern implementation.

| Original slice | Current implementation / successors | Acceptance evidence | Status |
|---|---|---|---|
| PR1: release-bound terrain authority | #226; registry/promotion descendants retain the digest-bound chain | T1-01–T1-16; terrain/pool/registry tests and index regeneration | SATISFIED on main |
| PR2: committed per-step Trail evidence | #233 format, #234 runtime; #231 continuity; #245 repairs remaining recording/restore failures | v0.3 schema/runtime, continuity, exact-once recording and rejected-draft regressions below | SATISFIED with #245 shipped |
| PR3: BRANCH input authority | #237 pure deterministic BRANCH, fixed tie ordering, recorded BRANCH/SELECT | branch-core and browser determinism tests | SATISFIED on main |
| PR4: independent local sampler re-execution | #238 existing Python verifier; #245 strengthens authority/tamper and cross-shell coverage | versioned seed/constraint/interval/guard/route derivation, repository evidence reconstruction | SATISFIED with #245 shipped; bounded local reproducibility claim |

| Requirement / source | Current implementation | Tests / evidence | Commit / PR | Status |
|---|---|---|---|---|
| Release-bound, registry-anchored terrain authority; ADR 0006 and PR1 T1-01–T1-16 | Promotion → immutable registry binding → digest-bound terrain index → release-order eligible pool | `terrain-authority.test.js`, `selection-core.test.js`, `terrain-eligibility.spec.js`, `test_terrain_index.py`, claims verifier; all 3 registry profiles regenerate | #226; current corpus promotion descendants | SATISFIED on main; preserved |
| Actual committed selection inputs; Selection Transaction v2 | Immutable transaction records corpus revision, constraint/index digest, eligible count, sampler interval and actual repeat guard before exposure | `cf1-mobile-roll-provenance.spec.js`, `trail-v03-runtime.spec.js`, transaction tests | #226, #234 | SATISFIED on main; preserved |
| Versioned step evidence without inherited sampler claims; Trail v0.3 | ROLL/v2, SELECT, BRANCH, IMPORTED; CJ-1 identity; explicit parent prefixes | `trail-v03.test.js`, `trail-cli.test.js`, runtime tests; unsupported-version rejection | #233 `be838a5`, #234 `8bdc6b9` | SATISFIED on main; preserved |
| Independent sampler derivation, distinct from base integrity | Existing Python re-executor reconstructs release bytes, registry authority, pool, FNV-1a/Mulberry32 interval and selected route; no JS/DOM dependency | `test_reexecute_trail.py`, `reexecutor-parity.test.js`; rehashed route/count/seed/digest tamper and corrupt release/registry tests | #238 `c36fa4d`; added negative coverage in #245 | SATISFIED implementation; experimental verifier designation retained |
| S1/S2 cursor/sequence restore; S3 repeated committed ROLL; S4 fresh guard on reset/fork | Trail-scoped sampler authority | `sampler-continuity.spec.js`, runtime v0.3 tests | #231 `9fc735c`; #239/#240/#242/#243 closed duplicates | Original repairs SATISFIED; duplicate branches SUPERSEDED |
| No dropped committed ROLL during replay; no invalid chain extension | Record before returning/revealing; rewind on recording failure; whole-chain bounded restore; shared pure transaction shape validator | `trail-record-integrity.test.js`, TR-1…TR-5 on both shell projects | Existing #245 repair integrated, then storage/restore fixes in same PR | REPAIRED IN #245; pending merge/shipment |
| No silent destruction on malformed/stale draft restoration | Exact rejected bytes quarantined, prior quarantine retained; preservation failure keeps original and blocks ROLL/export/reset/fork | Node regressions for stale revision, invalid JSON/URL, unknown declaration, storage failure, reset/fork rollback and prior evidence retention | #245 refresh | REPAIRED IN #245; pending merge/shipment |
| Desktop/mobile share authority and maintain continuity | Both shells retain the same commit API and trail state across viewport transitions | TR-6 records, exports and independently re-executes the cross-shell chain | #245 refresh; default Playwright desktop/mobile projects | IMPLEMENTED; final browser gate recorded below |
| Deterministic presentation-blind BRANCH; ADR 0007 | Existing pure `branch-core.js`; no metadata/history/enrichment/random input or file-order tie authority | `branch-core.test.js`, `branch-determinism.spec.js` | #237 `ac20904` | SATISFIED on main; no wider branch-semantic proof claim |
| Historical verification / bounded claims | v0.1/v0.2 verification and IDs unchanged; labeled legacy projection; no transitive evidence claims | 32 focused historical/v0.3/provenance tests; CLI lineage; frozen proof/replay audits; README claims inspection | Existing verifiers; #245 does not change historical formats | PRESERVED |
| Receipt / public chance promotion | Isolated versioned experiment, CJ-1 identities, offline vector, independent JS/Python derivation and Python BLS; no production integration or pre-round witness | `verifiable-chance.test.js`, `test_verifiable_chance.py`; tamper and bounded-claim checks | #241 `3eb8562` | EXPERIMENTAL; subsequent work, outside PR1–PR4 |

Local verification after repairs: Node **451 passed, 0 failed, 0 skipped**;
Python **140 passed** (with `requests`, `tqdm`, and experiment-only `py_ecc`
installed); static public claims **passed**; all three registered terrain indexes
**VERIFIED**. Independent negative cases recompute valid envelope identities,
so they test derivation/authority rather than merely a stale artifact hash.

Pinned Chromium could not download locally (truncated archive). Actual browser
execution used GitHub Actions on runtime head `08f234ea1f259ab879b1c7bf8a07960e7f184210`:

- [Full desktop/mobile run 37178361760](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/37178361760): **217 passed, 119 skipped, 0 failed**; CI also ran the Node suite successfully. Skips are reported as skips, not passes.
- [Replay run 37178361749](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/37178361749): **44 passed, 0 failed**.
- Proof Sessions, Trail Cards, Trail Comparison and Verifiable Chance workflows: **success** on that same head.
- Historical CLI parent/child fixture: **LINEAGE VERIFIED**.

The closeout documentation commit changes no executable or test inputs relative
to that tested runtime head. No scheduled job is counted as verification.

No corpus releases, promotion/registry, health/maintenance state, product/motion
contracts, SVG/UI layout, Blind Descent, or corpus ledger implementation changed.
Draft PR #254 remains untouched. Public chance remains outside production.

Ledger boundary: once #245 is merged with the required verification gates
passing, PR1–PR4 no longer blocks **shadow-mode** implementation of the frozen
ledger contract. This does not authorize runtime ledger cutover or promote
maintenance health evidence to selection authority. Until shipment, current
main retains the demonstrated recording/preservation defects.
