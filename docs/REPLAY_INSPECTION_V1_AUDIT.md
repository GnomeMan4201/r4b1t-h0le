# Replay / Inspection v1 — Specification Audit and Freeze Record

Status: ACCEPTED / FROZEN  
Contract baseline: `CONTRACT.md` v1.0  
Normative specification: `docs/REPLAY_INSPECTION_V1_SPEC.md`  
Baseline dependency: `prove-show-v1.0.0`

## Audit purpose

This audit evaluates the Replay / Inspection v1 specification before implementation.

The review is specification-only. It does not accept any Replay runtime, renderer, UI, export, or integration implementation.

The governing invariant is:

> Replay reconstructs presentation only from freshly verified evidence. It never reconstructs evidence from presentation, cached state, or stored derived output.

The specification is accepted only if that direction of authority remains one-way throughout source verification, derived recomputation, lineage inspection, concealment, reveal, mobile presentation, and delegated inspection of frozen proof formats.

## Result

**ACCEPTED / FROZEN**

No unresolved specification-level blocker remains after the two audit findings below were corrected on the freeze branch.

Implementation may now begin against this frozen specification. Any semantic change discovered during implementation requires an explicit specification revision before the changed behavior can be accepted.

## Audit findings resolved before freeze

### RI-AUDIT-001 — delegated portable classification namespace collision

Initial Replay text defined a Replay-derived classification vocabulary containing:

- `MATCH`
- `MISMATCH`
- `UNREADABLE`
- `UNVERIFIED`

Proof Sessions v1 is already frozen with portable-file-set classifications exactly:

- `MATCH`
- `MISMATCH`
- `UNREADABLE`

Its source proof states are separately:

- `VERIFIED`
- `REJECTED`
- `UNVERIFIED`

Without an explicit namespace boundary, Replay could have accidentally widened the frozen Proof Sessions portable classification by promoting source-level `UNVERIFIED` into a fourth portable-file-set result.

Resolution:

- Replay-native derived material may use the four-state Replay vocabulary where no frozen delegated vocabulary already exists.
- A frozen delegated inspector retains its exact existing result vocabulary.
- Proof Sessions v1 portable inspection remains exactly `MATCH` / `MISMATCH` / `UNREADABLE`.
- Source-level `UNVERIFIED` remains separately visible and never becomes a fourth Proof Sessions portable classification.

This preserves the frozen Proof Sessions v1 contract rather than silently revising it through Replay.

### RI-AUDIT-002 — backward navigation after reveal could create a presentation leak

The proposed specification correctly required historical concealment state not to be rewritten by later reveal knowledge, but it did not initially state where later-known route identity may exist while the viewport is positioned on an earlier concealed step.

That ambiguity could permit the earlier step to look concealed visually while still carrying the later-known route identity in hidden DOM or accessibility state.

Resolution:

- a historically concealed step's primary DOM and accessibility representation remains concealed,
- later-known route identity may appear only in an explicitly separate post-reveal inspector after valid reveal authorization,
- concealed historical step DOM, attributes, accessible names, and off-screen presentation may not contain that identity.

This closes a presentation-before-authority leak path without pretending the JavaScript runtime can guarantee physical memory erasure.

## Product Contract review

### Clause 1 — Selection blind to history

Replay does not define a selection path.

The specification explicitly prohibits Replay state, navigation, dwell time, mismatch state, inspection state, or derived facts from influencing sampler state, corpus eligibility, route order, or future exploration.

No amendment to clause 1 is required.

### Clause 2 — Selection precedes exposure

Replay reveal is defined as presentation of route identity already authorized by verified canonical reveal evidence.

Replay cannot:

- create a route,
- substitute a route,
- rerank a route,
- infer a concealed route,
- brute-force a concealed route,
- treat replay navigation as selection.

The specification therefore preserves the commitment-before-exposure boundary.

### Clause 3 — Independent verification

Replay binds authority to exact supplied source bytes.

Normative order is:

1. read exact bytes,
2. compute exact-byte SHA-256,
3. identify supported format,
4. run the canonical verifier,
5. establish canonical artifact/event state,
6. verify required direct relationships,
7. freshly recompute derived facts,
8. compare stored derived presentation,
9. assign inspection classification,
10. render evidentiary state.

Prior badges, screenshots, cached views, stored projections, filenames, and server assertions do not satisfy verification.

### Clause 4 — Instrument, not recommendation

Replay may display only deterministic proof/presentation facts and diagnostics.

The specification prohibits:

- ranking,
- recommendation,
- scoring,
- prioritization,
- relevance ordering,
- interestingness claims,
- usefulness claims.

No Replay display state may become a recommendation surface.

### Clause 5 — Local-first

Replay import, verification, recomputation, inspection, navigation, and reset are required to work without:

- login,
- account identity,
- server identity,
- remote proof authority,
- remote storage dependency.

Replay working state is ephemeral by default.

### Clause 6 — Proof surface only

Replay is expressly constrained to verification and presentation.

It cannot mutate:

- canonical source bytes,
- canonical events,
- reveal material,
- sampler state,
- sampler seed,
- corpus eligibility,
- route order,
- inferred constraints,
- future selection.

Ambiguous implementation paths remain out until separately specified.

### Clause 7 — Diagnostic history only

Replay interaction history is non-authoritative presentation state.

Navigation, step count, dwell time, opened inspectors, mismatch counts, and diagnostics cannot become predictive or selection inputs.

### Clause 8 — Explicit constraints only

Replay v1 defines no exploration-constraint mechanism.

No inferred constraint is activated, tightened, relaxed, or reordered from Replay state.

Clause 8 therefore requires no Replay-specific extension.

### Clause 9 — Cross-user compare, never steer

Artifacts from different users, devices, or sessions may be explicitly supplied and inspected.

Cross-user inspection remains proof/presentation only and cannot create:

- recommendation groups,
- profiles,
- aggregate steering signals,
- future-selection inputs.

## Frozen dependency review

### Canonical trail verification

Replay does not define a second canonical trail verifier.

Supported v1 source authority remains the existing canonical trail verification path for:

- `r4b1t-trail/v0.1`
- `r4b1t-trail/v0.2`

### Trail Comparison v1

Replay delegates pairwise comparison semantics to frozen Trail Comparison v1.

Replay cannot redefine:

- shared-prefix equality,
- concealed comparison behavior,
- direct parent/fork verification,
- divergence semantics,
- source proof-state meaning.

### Proof Sessions v1

Replay preserves the frozen Proof Sessions authority direction:

`exact canonical source bytes → fresh verification → fresh comparisons → fresh session projection → compare stored presentation`

There is no reverse path from stored `proof-session.json`, stored comparison projections, or README text into canonical proof state.

Portable-file-set classification remains exactly `MATCH`, `MISMATCH`, or `UNREADABLE`.

### Trail Topology v2

Replay may inspect lineage facts but does not redefine topology authority.

Only directly verified relationships may be authoritative.

A visible path through multiple direct edges is not a new transitive evidence claim.

### Prove & Show v1

`prove-show-v1.0.0` remains frozen.

Replay / Inspection v1 is a new release surface and does not retroactively alter the accepted semantics or tag of Prove & Show v1.

## Verification-before-render audit

The specification fails closed against presentation-before-verification.

Before the applicable verification stage completes, the UI may display neutral process state only.

It may not display:

- remembered proof labels,
- prior route identities,
- prior lineage,
- prior comparison results,
- stale derived summaries,
- hidden unverified evidentiary content.

This restriction includes:

- visible DOM,
- hidden DOM,
- `data-*` attributes,
- accessible names/descriptions,
- off-screen presentation,
- debug presentation.

A loading skeleton cannot be used as a container for stale evidence.

## Concealment audit

Concealed route identity is explicitly prohibited from:

- inference,
- guessing,
- brute-force recovery,
- external enrichment,
- stored comparison reconstruction,
- hidden DOM,
- accessibility text,
- client logs,
- persisted Replay state,
- exported Replay presentation,
- diagnostic errors.

Valid commitments may remain visible where the frozen source format allows them.

A route identity appears only after canonical reveal evidence authorizes it.

## Reveal lifecycle audit

Replay reveal is presentation, not selection.

The specification distinguishes:

- what the active inspector may know after a later valid reveal, and
- what was historically revealed at the earlier replay position.

Backward navigation cannot rewrite history.

An earlier concealed position remains concealed in its primary historical representation even when later reveal evidence exists.

Closing, resetting, unloading, or reloading discards transient Replay presentation state.

## Derived-output audit

Stored derived output is never authoritative.

For Replay-native derived material:

- `MATCH` means supported deterministic equivalence with fresh recomputation,
- `MISMATCH` means fresh recomputation completed but stored normative content disagrees,
- `UNREADABLE` means required material cannot be read sufficiently to recompute,
- `UNVERIFIED` is available only where Replay itself lacks a supported derived verification path and no frozen delegated vocabulary controls the result.

Timestamp age alone never establishes freshness.

On mismatch, fresh recomputation remains the evidentiary presentation. Stored mismatched content is diagnostic only.

## Lineage audit

Replay accepts only direct verified lineage.

It cannot:

- manufacture transitive edges,
- repair missing parents,
- infer absent artifacts,
- convert shared-prefix facts into lineage.

This preserves the frozen comparison and topology boundaries.

## Mobile and accessibility audit

Phone-width Replay is a first-class acceptance target.

The primary mobile view must expose:

- current position / total,
- source proof state,
- abbreviated source digest,
- concealment/reveal state where applicable,
- previous/next controls,
- access to verification detail.

Full digest, lineage detail, comparison detail, diagnostics, and stored-vs-fresh diff may be drill-down.

Proof semantics remain identical across desktop and mobile.

Accessibility is part of the disclosure boundary; concealed or unverified evidence cannot leak through accessible names, descriptions, live regions, hidden labels, or off-screen focus targets.

## Failure-model audit

The specification is fail-closed.

The affected evidentiary view cannot render as verified when there is:

- source verification failure,
- unsupported canonical version,
- malformed required source,
- missing required portable source,
- invalid reveal,
- invalid direct lineage,
- recomputation failure,
- stored/fresh disagreement for the stored copy being evaluated.

Diagnostic output may remain visible but cannot replace verified evidence.

## Adversarial acceptance requirement

The frozen specification requires an implementation test matrix covering 29 cases, including:

- presentation-before-verification,
- source tampering,
- unsupported versions,
- stale derived output,
- missing portable sources,
- timestamp non-authority,
- invalid lineage,
- transitive-edge prohibition,
- visible/hidden/accessibility concealment,
- reveal authorization,
- backward-navigation historical concealment,
- close/reset/reload state disposal,
- persistence prohibition,
- sampler/corpus isolation,
- phone-width usability,
- desktop/mobile proof parity,
- keyboard reveal isolation,
- deterministic repeated inspection,
- preservation of frozen Proof Sessions portable classifications.

These tests are requirements for future implementation acceptance. This specification freeze does not claim they are implemented yet.

## Implementation boundary after freeze

The first implementation slice must consume, not reinterpret, this specification.

Implementation review must reject any design where:

- evidence renders before verification,
- cached/stored presentation seeds proof state,
- a concealed identity appears before valid reveal,
- later reveal knowledge rewrites an earlier concealed historical step,
- a delegated frozen inspector's vocabulary is widened,
- transitive lineage is manufactured,
- Replay writes into sampler/corpus selection state,
- Replay automatically persists working state,
- mobile uses weaker proof semantics than desktop.

## Freeze gate

This freeze change is documentation-only.

Before merge, the exact PR head must pass the repository's full Playwright E2E workflow.

After merge, the exact merge commit must pass:

- Playwright E2E,
- GitHub Pages deployment,
- Production Shadow.

No cancelled, superseded, or failed run counts as freeze evidence.

## Freeze conclusion

Replay / Inspection v1 is sufficiently specified to begin implementation without inventing authority, reveal, lineage, derived-output, persistence, mobile, or failure semantics during coding.

The specification is frozen.

Any semantic change requires an explicit specification revision.
