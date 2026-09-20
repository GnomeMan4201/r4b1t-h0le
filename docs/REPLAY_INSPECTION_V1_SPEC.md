# Replay / Inspection v1 — Normative Specification

Status: FROZEN  
Scope: local proof/presentation replay and inspection only  
Contract clauses touched: 2, 3, 4, 5, 6, 7, 9  
Depends on: `CONTRACT.md` v1.0 (frozen), canonical Trail v0.1/v0.2 verification, Trail Comparison v1 (frozen), Proof Sessions v1 (frozen), Trail Topology v2 (frozen), Prove & Show v1 production baseline `prove-show-v1.0.0`

> **Replay reconstructs presentation only from freshly verified evidence. It never reconstructs evidence from presentation, cached state, or stored derived output.**

This invariant governs every other clause in this specification.

---

## 1. Purpose

Replay / Inspection v1 provides a local, deterministic way to inspect the recorded history and proof state of explicitly supplied r4b1t artifacts.

Replay exists to answer questions about evidence that already exists:

- what exact source bytes were supplied,
- whether those bytes verify,
- which canonical events or stops are established,
- which positions are concealed or revealed,
- which direct lineage facts are established,
- which derived comparisons freshly recompute,
- whether stored derived presentation still matches fresh recomputation,
- where verification or inspection fails.

Replay is a proof/presentation surface.

Replay is not:

- a source of canonical evidence,
- a repair tool,
- an evidence editor,
- a source reconstruction mechanism,
- a recommendation system,
- a ranking system,
- an automatic discovery system,
- a corpus input,
- a sampler input,
- a behavioral profile,
- a server-side session,
- a background verifier whose result arrives after evidentiary content is already rendered.

## 2. Product Contract mapping

### Clause 2 — Selection precedes exposure

Replay MAY disclose a route only when canonical evidence already permits that route to be revealed.

Replay MUST NOT create, substitute, infer, brute-force, rank, or select a route as part of reveal.

A Replay reveal is presentation of already-established evidence state. It is never a new selection event.

### Clause 3 — Independent verification

Every source used to establish Replay facts MUST be freshly verified from the exact supplied source bytes.

Replay MUST NOT rely on:

- a prior VERIFIED badge,
- a prior Trail Card,
- a prior Trail Comparison result,
- a prior Proof Session projection,
- a screenshot,
- a cached Replay view,
- a file name,
- a previous browser session,
- a server assertion.

### Clause 4 — No recommendation

Replay may present deterministic facts, states, direct relationships, differences, and verification diagnostics.

Replay MUST NOT rank, recommend, prioritize, score, or characterize any route, source, branch, event, relationship, or divergence as better, stronger, more important, more relevant, more interesting, or more useful.

### Clause 5 — Local-first

Import, verification, recomputation, replay, inspection, stepping, and reset MUST work without login, account identity, server identity, remote storage, or network-dependent proof authority.

### Clause 6 — Proof surface only

Replay state MUST NOT influence:

- route selection,
- sampler state,
- sampler seed,
- corpus eligibility,
- route ordering,
- inferred constraints,
- future exploration,
- recommendation logic.

### Clause 7 — Diagnostic history only

Replay navigation, step count, dwell time, backwards movement, opened inspectors, mismatch counts, and verification diagnostics are presentation state only.

They MUST NOT become predictive or selection inputs.

### Clause 9 — Cross-user compare, never steer

Replay MAY inspect artifacts supplied by different users, devices, or sessions.

Cross-user inspection MUST remain verification/presentation only and MUST NOT create steering signals, recommendation groups, profiles, or future-selection inputs.

## 3. Accepted inputs and authority

Replay accepts explicit local artifacts only.

For v1, authoritative source inputs are canonical trail artifacts supported by the frozen verifiers:

- `r4b1t-trail/v0.1`
- `r4b1t-trail/v0.2`

Replay MAY also accept portable file sets that contain canonical source artifacts plus stored derived presentation, but only the canonical source bytes are evidence inputs.

The following are never evidence inputs:

- Trail Cards,
- topology renderings,
- screenshots,
- exported images,
- stored comparison projections,
- stored Proof Session projections,
- prior Replay projections,
- cached DOM state,
- accessibility text,
- prose notes,
- filenames,
- UI labels,
- telemetry,
- external enrichment.

Presentation artifacts MAY be inspected for consistency with freshly recomputed results, but they MUST NOT establish evidence facts.

## 4. Mandatory verification and rendering order

Replay MUST execute the following sequence for every source or state before evidentiary presentation:

1. accept exact source bytes,
2. compute the exact-byte SHA-256 digest,
3. identify the declared artifact format,
4. run the canonical verifier for that format,
5. establish canonical artifact identity and canonical event/stop state,
6. verify any direct lineage or relationship claims required for the current inspection,
7. freshly recompute all derived facts required for the current view,
8. compare freshly recomputed derived facts with any supplied stored derived output,
9. assign the inspection classification,
10. render evidentiary state.

This ordering is normative.

Replay MUST NOT:

- render a remembered prior result while verification runs,
- render stored derived presentation first and replace it later,
- optimistically show VERIFIED before verification completes,
- render prior lineage or comparison state from cache,
- expose a route identity before the applicable reveal check completes,
- populate hidden DOM, accessibility text, data attributes, or off-screen UI with unverified evidence while displaying a neutral loading state.

## 5. Pre-verification UI

Before the applicable verification stage completes, the UI may present only neutral process state.

Allowed examples:

- `NO SOURCE LOADED`
- `READING SOURCE`
- `VERIFYING SOURCE`
- `VERIFYING LINEAGE`
- `RECOMPUTING DERIVED FACTS`

A pre-verification state MUST NOT imply that any evidentiary fact has already been accepted.

Before verification completes, the UI MUST NOT expose:

- prior proof-state labels,
- remembered route identities,
- remembered lineage labels,
- prior comparison results,
- prior counts that depend on evidence,
- stored derived summaries,
- stale source metadata presented as verified,
- concealed values.

Skeleton or placeholder UI is permitted only when it is semantically neutral and contains no evidentiary content.

## 6. Source verification states

Every imported canonical source receives exactly one source state:

- `VERIFIED`
- `REJECTED`
- `UNVERIFIED`

### 6.1 VERIFIED

The exact supplied source bytes passed the applicable canonical verifier.

Only VERIFIED sources may contribute canonical event facts, reveal state, direct lineage facts, or freshly derived comparison facts.

### 6.2 REJECTED

The supplied bytes claim a supported canonical format but fail the applicable verifier.

A REJECTED source is diagnostic-only.

Replay MUST NOT:

- repair it,
- normalize it into validity,
- infer intended content,
- salvage partial canonical facts from it,
- use it in verified lineage or comparison facts.

### 6.3 UNVERIFIED

The source cannot be verified under the supported v1 rules.

Examples include:

- unsupported artifact version,
- unknown artifact family,
- missing verifier,
- structurally unreadable material where no supported verifier can run.

UNVERIFIED material is diagnostic-only.

## 7. Replay state machine

The top-level Replay lifecycle is:

`UNLOADED → READING → VERIFYING → VERIFIED | REJECTED | UNVERIFIED`

Only a VERIFIED source may continue to:

`VERIFIED → INSPECTING`

Within `INSPECTING`, the current presentation position may move among verified canonical states without changing source authority.

A source-state transition MUST NOT be inferred from presentation state.

### 7.1 Failure terminality

For the currently supplied source bytes:

- `REJECTED` cannot become `VERIFIED` without supplying different bytes,
- `UNVERIFIED` cannot become `VERIFIED` without a specification/verifier revision or different supported bytes.

Replay MUST NOT silently rewrite bytes to cross either boundary.

## 8. Derived-output verification and classifications

Stored derived output is presentation, not authority.

Whenever supplied stored derived output exists, Replay MUST independently recompute the applicable derived result from freshly VERIFIED canonical source bytes before evaluating the stored copy.

For Replay-native derived material that is not already governed by a frozen portable-inspection vocabulary, the derived-output classification is exactly one of:

- `MATCH`
- `MISMATCH`
- `UNREADABLE`
- `UNVERIFIED`

When Replay delegates inspection of a frozen portable format, Replay MUST preserve that format's frozen classification vocabulary and MUST NOT widen, rename, or reinterpret it.

In particular, Proof Sessions v1 portable-file-set inspection remains exactly:

- `MATCH`
- `MISMATCH`
- `UNREADABLE`

A source-level `UNVERIFIED` state inside a Proof Session remains a source proof state. It MUST NOT be promoted into a fourth Proof Sessions portable-file-set classification.

### 8.1 MATCH

`MATCH` means the stored derived presentation agrees with the fresh deterministic recomputation under the same supported derivation contract.

Timestamp-only or runtime metadata explicitly excluded by the governing frozen derivation specification MUST NOT create a mismatch.

### 8.2 MISMATCH

`MISMATCH` means required stored derived content disagrees with the fresh recomputation.

Triggers include deterministic field or digest disagreement in normative derived content.

When a MISMATCH occurs:

- the freshly recomputed result remains the only result eligible for evidentiary presentation,
- the stale stored result MAY be shown only in a clearly separated diagnostic diff,
- the stale result MUST NOT be presented with a VERIFIED treatment,
- the stale result MUST NOT be used as a source for another derived claim.

Replay MUST NOT fall back to "stored result plus warning" as its primary evidentiary view.

### 8.3 UNREADABLE

`UNREADABLE` means required source material for fresh recomputation is missing or cannot be read.

When source material required to establish a derived fact is UNREADABLE, Replay MUST NOT display the stored derived fact as a substitute.

### 8.4 UNVERIFIED

For Replay-native derived material, `UNVERIFIED` means the material required for that derived check uses an unsupported format/version or otherwise lacks a supported verification path.

Replay MUST NOT treat unsupported stored derived output as factual merely because its source file is present.

This Replay-native classification MUST NOT override a delegated frozen inspector's result vocabulary. When inspecting a Proof Sessions v1 portable file set, Replay preserves the frozen portable classification and separately exposes any source-level `UNVERIFIED` states.

### 8.5 No freshness by timestamp alone

A timestamp by itself MUST NOT establish whether derived output is fresh or stale.

Staleness is determined by supported deterministic recomputation and normative comparison, not wall-clock age.

## 9. Concealment boundary

Concealment is a dedicated security and proof boundary in Replay.

A concealed route identity MUST NOT be:

- inferred,
- guessed,
- brute-forced,
- reconstructed from presentation,
- reconstructed from comparison output,
- resolved through external enrichment,
- written into DOM attributes,
- written into hidden elements,
- written into accessibility labels or descriptions,
- written into client-side logs,
- written into exported Replay presentation,
- persisted in browser storage,
- retained in a reusable cached projection,
- exposed through error messages.

Commitments and other proof material explicitly allowed by the frozen canonical format MAY be displayed according to that format's rules.

Route identity itself remains unavailable until canonical evidence authorizes reveal.

## 10. Reveal semantics

Reveal in Replay means:

> display of route identity or other previously concealed canonical content that has already been authorized by verified canonical evidence.

Reveal MUST NOT perform selection.

Reveal MUST NOT change the underlying source.

Reveal MUST NOT create a new canonical event.

### 10.1 Reveal authorization

A route may enter `REVEALED` presentation state only when the canonical verifier establishes that the applicable source contains valid reveal material for that committed position.

If valid reveal material is absent, the position remains `CONCEALED`.

Replay MUST NOT attempt to derive the missing secret.

### 10.2 One-way authority, reversible viewport

Once a source has been freshly verified, navigating backward in Replay may change which step is displayed, but it does not make already verified source bytes unverified.

Within the active Replay session, a fact already revealed by valid canonical evidence MAY remain known to that session while the viewport moves backward.

However, the earlier historical position MUST still be rendered according to its historical state. Replay MUST distinguish:

- "this route is known to the active inspector because later valid reveal evidence exists", from
- "this route was revealed at this historical position."

The UI MUST NOT rewrite history by showing a later reveal as if it had already been revealed earlier.

When Replay is positioned on a historically concealed step, that step's primary DOM and accessibility representation MUST remain concealed even if a later verified reveal exists in the same source. A later-known route identity MAY appear only in an explicitly separate post-reveal inspector after reveal authorization; it MUST NOT be embedded into the concealed step's hidden DOM, attributes, accessible name, or off-screen presentation.

### 10.3 Session close/reset

Closing Replay, resetting Replay, unloading the source, or reloading the application MUST discard transient Replay presentation state, including:

- current step,
- expanded inspectors,
- derived diff state,
- remembered reveal presentation,
- imported file handles or in-memory byte buffers when no longer required by the active session,
- temporary comparison projections.

No automatic Replay restore exists in v1.

## 11. Memory, DOM, and persistence boundary

Replay v1 is ephemeral by default.

Replay working state MUST NOT be automatically persisted through:

- `localStorage`,
- `sessionStorage`,
- IndexedDB,
- Cache Storage,
- cookies,
- service-worker replay state,
- server-side session state,
- telemetry-backed reconstruction,
- background file writes.

### 11.1 DOM minimization

The DOM MUST contain only the evidentiary content necessary for the current permitted view.

Concealed route identities MUST NOT be placed in:

- `data-*` attributes,
- hidden inputs,
- `aria-label`,
- `aria-description`,
- `title`,
- off-screen elements,
- comments,
- script-injected debug state.

### 11.2 In-memory minimization

Implementations SHOULD minimize retention of transient derived and reveal presentation objects.

On close/reset/unload, Replay MUST sever active references to transient inspection state so it is eligible for garbage collection.

This requirement does not claim deterministic physical memory erasure by the JavaScript runtime. It defines the application-level retention boundary.

## 12. Deterministic replay semantics

Given:

- identical exact source bytes,
- the same supported verifier versions,
- the same explicit inspection position,
- the same explicit presentation options,

Replay MUST derive the same canonical facts and classifications.

Replay MAY differ in non-normative runtime metadata such as:

- verification execution time,
- local rendering time,
- ephemeral object identifiers,
- non-evidentiary animation state.

Replay MUST NOT use randomness, popularity, prior user behavior, remote enrichment, or current corpus state to determine proof facts.

## 13. Step model

A Replay step corresponds only to a verified canonical position or event defined by the source artifact.

The step model MUST NOT synthesize intermediate evidentiary events merely to improve animation or storytelling.

Each displayed step MUST be attributable to:

- an exact source digest,
- canonical artifact identity,
- canonical position/event index,
- current proof state,
- applicable concealment/reveal state.

Presentation-only transitions MAY exist between steps, but they MUST be distinguishable from canonical events.

## 14. Lineage inspection

Replay may display lineage only from directly verified canonical relationships.

### 14.1 Direct relationships only

A direct parent/child edge may be presented only when established by the existing frozen canonical lineage verifier or frozen Trail Comparison v1 semantics.

### 14.2 No transitive manufacture

If A is directly verified as parent of B and B is directly verified as parent of C, Replay may present those two verified edges.

Replay MUST NOT create a third verified A → C edge unless an existing canonical verifier directly establishes it.

A visible path is presentation of multiple direct facts. It is not a new evidence claim.

### 14.3 Missing lineage

Replay MUST NOT repair a missing parent, guess a missing artifact, or resolve a parent from external data.

Missing required lineage remains visibly absent or diagnostic according to the governing frozen verifier.

## 15. Comparison inspection

Replay MUST delegate pairwise trail semantics to frozen Trail Comparison v1.

Replay MUST NOT implement a second comparison algorithm.

Replay may step through a freshly verified comparison projection, but:

- concealed sides remain concealed,
- concealed route identity remains unavailable,
- stored comparison presentation never overrides fresh recomputation,
- comparison does not create lineage beyond direct verified relationships,
- comparison does not influence future selection.

## 16. Proof Session inspection

When Replay inspects a portable Proof Session file set:

1. canonical source files are re-read from exact bytes,
2. every canonical source is freshly verified,
3. fresh pairwise comparisons are recomputed,
4. the fresh Proof Session projection is recomputed,
5. stored derived files are compared against the fresh result,
6. the frozen Proof Sessions portable-file-set classification (`MATCH`, `MISMATCH`, or `UNREADABLE`) is preserved,
7. source-level `VERIFIED`, `REJECTED`, and `UNVERIFIED` states remain separately visible,
8. only then may the accepted inspection view render.

Exact source files remain the evidence authority.

Stored `proof-session.json`, stored comparison projections, and README material remain derived or non-normative presentation according to the frozen Proof Sessions v1 specification.

## 17. Mobile semantics

Phone-width Replay is a first-class v1 requirement.

The mobile interface MUST NOT require horizontal scrolling to determine the current proof state or navigate the verified replay.

### 17.1 Always-visible mobile information

The primary phone-width Replay view MUST keep the following available without entering a secondary detail screen:

- current replay position / total verified positions,
- source proof state,
- abbreviated exact-source digest,
- current `CONCEALED` / `REVEALED` state where applicable,
- previous / next navigation where applicable,
- a clear control for opening verification details.

"Always-visible" permits ordinary vertical scrolling within the primary view but MUST NOT require opening a separate inspector to determine the current proof state.

### 17.2 Drill-down mobile information

The following MAY live behind explicit detail/inspection controls:

- full SHA-256 source digest,
- full canonical artifact identity,
- verifier diagnostics,
- full lineage detail,
- pairwise comparison detail,
- stored-vs-fresh derived diff,
- raw supported metadata,
- export diagnostics.

### 17.3 Mobile authority parity

Desktop and mobile MUST apply identical verification, concealment, lineage, and derived-output rules.

Responsive presentation MUST NOT create weaker verification or disclosure rules on mobile.

## 18. Desktop semantics

Desktop MAY expose more simultaneous verified detail than mobile, including:

- replay timeline,
- proof inspector,
- lineage panel,
- comparison panel,
- source metadata,
- diagnostic diff.

The increased information density MUST NOT alter authority or verification order.

## 19. Accessibility semantics

Accessibility output is part of the disclosure surface.

Replay MUST NOT expose concealed or unverified evidentiary content through:

- accessible names,
- descriptions,
- live regions,
- hidden labels,
- focusable off-screen elements.

Proof state MUST be conveyed in text and programmatic semantics rather than color alone.

Keyboard navigation MUST allow:

- previous/next verified step,
- opening and closing the proof inspector,
- reaching diagnostics,
- closing/resetting Replay.

Focus changes MUST NOT trigger reveal.

## 20. Failure behavior

Replay is fail-closed for evidentiary presentation.

The following MUST prevent the affected evidentiary state from rendering as verified:

- source digest/verification failure,
- unsupported canonical version,
- malformed required source,
- missing required portable source,
- invalid canonical reveal,
- invalid direct lineage proof,
- derived recomputation failure,
- stored/fresh deterministic disagreement where the stored copy is being evaluated.

A failure MAY leave diagnostic information visible.

A failure MUST NOT cause Replay to fall back to unverified stored presentation.

## 21. Non-authority rules

Replay may:

- read explicit local artifacts,
- hash exact source bytes,
- invoke frozen verifiers,
- invoke frozen comparison logic,
- recompute derived presentation,
- compare fresh and stored derived output,
- navigate verified historical states,
- render proof diagnostics,
- export a non-authoritative inspection report in a future explicitly specified revision.

Replay v1 MUST NOT:

- modify canonical source bytes,
- repair canonical evidence,
- synthesize missing evidence,
- merge canonical artifacts,
- create new canonical events,
- create new canonical lineage,
- mutate reveal material,
- promote REJECTED or UNVERIFIED input,
- infer concealed route identity,
- persist a new canonical truth,
- alter sampler/corpus state,
- influence future route selection.

## 22. Adversarial acceptance matrix

Replay / Inspection v1 MUST have explicit tests for at least the following before implementation may be frozen:

1. exact valid v0.1 source verifies before any evidentiary rendering,
2. exact valid v0.2 source verifies before any evidentiary rendering,
3. tampered source bytes remain REJECTED and never render cached verified state,
4. unsupported source version remains UNVERIFIED,
5. stored derived output cannot render before fresh recomputation,
6. matching stored derived output classifies MATCH,
7. edited stored derived output classifies MISMATCH while fresh recomputation remains available,
8. missing required portable source classifies UNREADABLE and stored presentation is not substituted,
9. timestamps alone cannot turn a result into MATCH or MISMATCH,
10. invalid direct lineage never becomes a verified edge,
11. transitive relationships are not manufactured,
12. concealed route identity is absent from visible DOM,
13. concealed route identity is absent from hidden DOM attributes,
14. concealed route identity is absent from accessibility text,
15. concealed route identity is absent from diagnostic/export presentation,
16. valid canonical reveal changes presentation only after reveal verification,
17. moving backward does not rewrite the historical concealment/reveal state,
18. close/reset discards transient Replay state,
19. reload does not restore a prior Replay session,
20. no Replay operation writes local/session storage or other persistent client state,
21. no Replay operation requires account/server identity,
22. Replay state cannot influence sampler, corpus eligibility, or route order,
23. mobile primary view exposes current proof state without horizontal scrolling,
24. desktop and mobile produce identical proof classifications from identical bytes,
25. keyboard/focus operations cannot trigger reveal,
26. diagnostic stored output never becomes evidence input,
27. repeated inspection of identical bytes is deterministic apart from explicitly non-normative runtime metadata,
28. Proof Sessions portable-file-set classification remains exactly `MATCH` / `MISMATCH` / `UNREADABLE` even when a contained source has source-level `UNVERIFIED` state,
29. backward navigation after a later valid reveal does not place the route identity into the historically concealed step's DOM or accessibility representation.

## 23. Implementation gate

No Replay runtime, renderer, UI, export, or integration code may be treated as contract-complete until:

1. this specification is frozen,
2. its exact accepted revision is identified,
3. implementation is mapped clause-by-clause to this specification,
4. an independent contract audit exists,
5. adversarial tests cover section 22,
6. desktop and phone-width acceptance both pass,
7. the implementation demonstrates no path from Replay state to sampler/corpus selection,
8. production serving-layer parity is verified for the accepted release candidate.

Implementation MAY begin before all tests exist, but no implementation may redefine this specification implicitly.

Any required semantic change discovered during implementation MUST amend the specification explicitly before the changed behavior is accepted.

## 24. Release boundary

Replay / Inspection v1 is a new release surface.

It MUST NOT retroactively modify the frozen meaning of:

- `prove-show-v1.0.0`,
- Trail Cards v1,
- Trail Comparison v1,
- Proof Sessions v1,
- Trail Topology v2,
- Product Contract v1.0.

The Prove & Show v1 release remains the baseline dependency.

Replay / Inspection v1 requires its own:

- contract audit,
- implementation acceptance,
- production parity gate,
- release record,
- release tag.

## 25. Frozen invariants for implementation review

An implementation review MUST reject any design that violates any of these statements:

1. Exact source bytes are verified before evidentiary rendering.
2. Presentation never becomes evidence authority.
3. Stored derived output is never trusted in place of fresh recomputation.
4. Concealed route identity is never inferred or leaked.
5. Reveal presents already-authorized canonical evidence; it does not select.
6. Historical replay state is not rewritten by later presentation knowledge.
7. Only directly verified lineage may be presented as authoritative.
8. Replay state never influences selection.
9. Replay is ephemeral by default.
10. Mobile and desktop share the same proof semantics.
11. Failures remain diagnostic and fail closed.
12. Replay reconstructs presentation from verified evidence and never evidence from presentation.
