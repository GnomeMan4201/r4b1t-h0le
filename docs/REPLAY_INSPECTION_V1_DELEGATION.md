# Replay / Inspection v1 — Delegation Contract

Status: IMPLEMENTATION BOUNDARY  
Normative parent: `docs/REPLAY_INSPECTION_V1_SPEC.md` (FROZEN)  
Audit parent: `docs/REPLAY_INSPECTION_V1_AUDIT.md` (ACCEPTED / FROZEN)

This note does not amend Replay / Inspection v1 semantics. It fixes the implementation boundary for the multi-source and stored-derived inspection slice so the implementation consumes frozen proof APIs rather than recreating them.

## Governing rule

> **Replay may collect direct facts; it may not reconcile them into a stronger fact.**

Replay delegates proof semantics to frozen public modules. It does not share or inspect delegate-private intermediate verifier state.

## 1. Black-box delegation

Replay MUST treat the following public APIs as authority boundaries:

- raw multi-source proof projection: `proof-session.js::build(inputs, options)`
- pairwise proof semantics: `trail-comparison.js::compare(left, right, options)`, reached directly only when a pair-level operation is explicitly required and otherwise through Proof Sessions
- portable Trail Comparison inspection: `trail-comparison-bundle.js::inspect(bundle, options)`
- portable Proof Session inspection and stored-derived classification: `proof-session-bundle.js::inspect(bundle, options)`

Replay MUST NOT copy or partially reimplement:

- source verification,
- pair position comparison,
- direct-parent verification,
- shared-prefix derivation,
- Proof Session pair construction,
- Proof Session relationship construction,
- portable Proof Session semantic-equivalence rules,
- portable Proof Session `MATCH / MISMATCH / UNREADABLE` classification.

Replay consumes the delegate's validated public result.

Delegate-private snapshots, temporary source records, comparison work state, and verifier internals are not Replay inputs.

## 2. Exact bytes cross the boundary

Canonical sources cross the delegation boundary as exact byte sequences.

Replay MUST NOT parse and reserialize canonical sources before delegation.

For portable file sets, Replay passes the explicit file set to the frozen portable inspector. Stored derived files remain comparison targets only; they never seed Replay proof state.

## 3. Multi-source ordering

For raw multi-source inspection, Replay delegates ordering and exact-byte duplicate handling to frozen Proof Sessions v1.

The resulting semantics are therefore:

1. process supplied sources in explicit caller/import order,
2. preserve the first occurrence of each unique exact-byte SHA-256 digest,
3. increment `supplied_count` for later exact-byte duplicates,
4. assign Proof Session slots in first-seen unique-source order,
5. derive verified pairs in deterministic slot order.

Replay MUST NOT sort sources by trail ID, URL, format, proof state, lineage state, timestamp, filename, or any relevance signal.

## 4. No precedence and no voting

Multiple supplied sources do not create a precedence rule.

Replay MUST NOT:

- vote across sources,
- select a preferred source,
- merge conflicting projections into a synthetic truth,
- choose a lineage claim because it appears more often,
- promote a shared-prefix observation into lineage,
- convert multiple direct relationships into a new transitive relationship.

Each source proof state and each delegate-produced direct relationship remains independently inspectable.

## 5. Direct lineage only

Replay consumes only direct relationships emitted by the frozen Proof Session / Trail Comparison projection.

If delegates establish:

- A → B
- B → C

Replay may display those two direct facts.

Replay MUST NOT emit A → C as an authoritative edge unless a frozen delegate directly establishes that relationship from the supplied artifacts.

## 6. Failure and UNREADABLE scope

Failure is dependency-scoped.

### Raw multi-source inspection

A `REJECTED` or `UNVERIFIED` source remains diagnostic. It does not erase independently VERIFIED sources.

Frozen Proof Sessions determines which verified pairs and direct relationships remain eligible.

Replay MUST NOT create pairs involving diagnostic sources.

### Portable Proof Session inspection

Replay preserves the frozen portable-file-set classification exactly:

- `MATCH`
- `MISMATCH`
- `UNREADABLE`

If the frozen Proof Session inspector returns `UNREADABLE`, that portable Proof Session is unreadable as a unit. Replay MUST NOT decompose the same file set and manufacture a stronger bundle-level classification.

### Multiple independent portable inspections

An `UNREADABLE` result for one explicitly supplied portable file set does not poison a separate portable file set.

Replay may show independently returned results side by side in explicit input order. It MUST NOT merge those classifications into a global verdict.

## 7. Stored derived output

Stored derived output is never a proof input.

For portable Proof Sessions:

1. exact bundled source files are read by the frozen inspector,
2. sources are freshly verified,
3. eligible pair comparisons are freshly recomputed,
4. the fresh Proof Session projection is recomputed,
5. stored derived files are compared against fresh results,
6. the frozen `MATCH / MISMATCH / UNREADABLE` result is returned,
7. Replay may present that result without reinterpretation.

On `MISMATCH`, fresh recomputation remains the evidentiary result. Stored mismatched content is diagnostic only.

On `UNREADABLE`, stored derived content MUST NOT be substituted for missing fresh proof.

## 8. Portable Trail Comparison inspection

Replay may delegate an explicitly supplied portable Trail Comparison file set to `trail-comparison-bundle.js::inspect`.

That inspector returns stored and freshly recomputed projections but does not define the Proof Sessions portable classification vocabulary.

Replay MUST NOT invent `MATCH / MISMATCH / UNREADABLE` for Trail Comparison bundles merely to make the APIs look uniform.

Any future uniform pair-bundle classification requires an explicit frozen-spec revision.

## 9. Replay wrapper responsibilities

The Replay delegation layer may:

- copy exact input bytes defensively,
- preserve explicit input order,
- call frozen public delegates,
- clone returned public results to protect Replay state from caller mutation,
- label which frozen delegate produced a result,
- keep independent inspection results separate.

It MUST NOT derive new proof facts from delegate outputs.

## 10. Test gate for this slice

Before this slice may merge, tests MUST prove:

1. raw multi-source inspection preserves first-seen exact-byte ordering,
2. exact-byte duplicates collapse only through frozen Proof Session semantics and retain `supplied_count`,
3. diagnostic sources do not poison independently verified sources,
4. direct lineage comes from the frozen delegate and no transitive edge is synthesized,
5. portable Proof Session `MATCH` passes through unchanged,
6. portable Proof Session `MISMATCH` passes through unchanged while fresh projection remains available,
7. portable Proof Session `UNREADABLE` passes through unchanged and no stored projection is substituted,
8. one unreadable independent portable file set does not poison another,
9. portable Trail Comparison inspection is delegated without inventing a portable classification,
10. returned public results are defensive copies,
11. no network, persistence, sampler, corpus, ranking, recommendation, or precedence mechanism is introduced.

## 11. UI boundary

This slice remains UI-free.

No DOM, accessibility, responsive layout, browser persistence, production entry point, or rendering behavior is introduced by this delegation contract.
