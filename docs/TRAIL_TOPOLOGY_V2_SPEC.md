# Trail Topology v2 — Prove & Show Specification

Status: Implemented; final acceptance requires the contract-audit gate in `docs/TRAIL_TOPOLOGY_V2_AUDIT.md`  
Contract baseline: `CONTRACT.md` Product Contract v1.0  
Scope: presentation and verification only

## Purpose

Trail Topology v2 turns a verified local trail set into a legible, inspectable map of what was recorded.

The topology view must describe structure that already exists in trail artifacts. It must not influence route selection, imply recommendation, or assign inferred importance to any route, branch, domain, or user action.

The view is an instrument panel, not a feed.

**record → verify → visualize → inspect → export → independently verify → replay/import**

## Existing baseline

The current topology implementation already:

- verifies trail snapshots before adding them to the local atlas
- deduplicates snapshots by `trail_id`
- sorts snapshots deterministically by creation time and trail ID
- verifies parent/child lineage when both artifacts are present
- distinguishes known and missing parents
- composes inherited and divergent wear states
- preserves concealed Blind Descent steps as concealed
- stores the local atlas in browser-local storage only
- exposes no account, recommendation, popularity, or behavioral-ranking path

Topology v2 extends this presentation surface without changing sampler behavior.

## Normative model

A topology graph is derived only from verified trail artifacts supplied to the topology layer.

### Nodes

Each node represents one verified trail snapshot.

A node may display:

- trail ID / short ID
- trail format
- creation timestamp
- terrain label already present in the artifact
- visible step count
- concealed step count
- parent trail ID when declared
- fork position when declared
- parent-presence state
- verification state
- deterministic wear summary derived from the artifact

A node must not display an inferred score such as relevance, quality, importance, novelty, engagement, popularity, or predicted interest.

### Edges

An edge represents a declared and verified structural relationship.

Allowed edge classes:

- parent → child lineage
- inherited segment continuation
- divergent segment after a fork

If the parent artifact is absent, the child may show a declared-parent stub, but the UI must clearly distinguish:

- verified lineage with parent present
- declared lineage with parent absent

The absence of a parent must never be silently upgraded to verified lineage.

### Route stops

Route stops are descriptive observations inside a trail artifact.

Allowed states:

- revealed
- concealed
- inherited
- divergent

Concealed Blind Descent stops remain concealed in topology until the artifact itself contains a valid reveal. Topology must never resolve, substitute, predict, or expose a concealed route.

## Layout

Layout must be deterministic for the same verified input set.

Permitted layout inputs:

- verified parent/child relationships
- trail creation timestamp
- trail ID as deterministic tie-breaker
- fork position
- recorded route order
- explicit user-selected display mode

Forbidden layout inputs:

- click frequency
- hesitation time
- revisit frequency
- popularity
- collective traffic
- inferred interest
- any behavioral profile
- wear as a weighting signal
- any ranking score

A different visual position must never imply "better," "recommended," or "more relevant."

Rendering and layout are not exempt from Contract clause 4. Readability transformations are allowed only when their inputs are objective graph structure or an explicit user-selected display setting. Geometry, node size, spacing, edge weight, opacity, ordering, and emphasis must not be driven by inferred importance, interestingness, engagement, popularity, or behavioral signals.

Topology v2 should prefer deterministic lineage geometry whose visual structure corresponds directly to recorded parent/fork relationships. More complex layouts, including force-directed layouts, require an explicit specification of what each visual signal means before adoption; determinism alone does not make a layout contract-compliant.

## Visual emphasis

Visual emphasis is permitted only when it encodes an objective, declared state.

Allowed examples:

- currently selected node
- verified vs. unverified/missing-parent relationship
- revealed vs. concealed stop
- inherited vs. divergent segment
- current trail vs. historical trail
- user-explicit filter match
- proof failure or rejected artifact

Forbidden examples:

- "most interesting path"
- "best branch"
- "recommended next trail"
- "popular route"
- "likely useful"
- engagement heat maps
- behavior-derived highlighting
- any emphasis whose source cannot be traced to artifact state or an explicit user display choice

If a highlight requires a score, it is out by default under Contract clause 6 unless the score is purely deterministic presentation metadata and cannot influence selection.

## Verification surface

Topology v2 must expose enough evidence for a user to distinguish:

- verified artifact
- rejected artifact
- verified parent present
- declared parent absent
- concealed commitment
- valid reveal
- inherited segment
- divergent segment

A topology export must preserve the proof-relevant data required by Contract clause 3.

Proof diagnostics are categorical, not probabilistic. Allowed diagnostic states include `VERIFIED`, `REJECTED`, `PARENT ABSENT`, `CONCEALED`, and `REVEALED` where applicable. Topology v2 must not assign percentages, confidence bands, quality scores, or language such as "high confidence" or "strong trail." The underlying verification operations establish discrete integrity facts; they do not produce a spectrum of trust.

Verification establishes integrity of the recorded artifact and claimed sequence. It does not prove that a human viewed, understood, or interacted with every destination.

## Export

Topology v2 should support a self-contained export format suitable for later independent verification.

The canonical export must include, directly or by embedded manifest payload:

- trail IDs
- manifest format/version
- complete proof-relevant manifest data
- parent declarations
- fork positions
- commitments
- reveals where present
- creation timestamps
- corpus revision identifiers when present
- deterministic graph relationships
- export-format version

A rendered PNG/SVG may accompany the export, but an image alone is not a verifiable trail artifact.

The machine-verifiable export is authoritative; rendered visuals are presentation.

### Projection trust model

Trail cards and other visual exports are deterministic projections of the canonical machine-verifiable artifact. They are not independent evidence formats and must not define a second source of truth.

Projection is one-way:

```text
canonical trail/topology artifact
            |
            | deterministic projection
            v
       visual trail card
```

Rendering must never upgrade trust. A projection may only display the verification result established for its source artifact during the render operation.

Allowed projection trust states:

- `VERIFIED` — the canonical source artifact successfully verified during rendering. A verified card must carry the exact digest of the artifact that was verified.
- `REJECTED` — verification was attempted and failed. The projection must render as a diagnostic artifact, include the failure reason where available, and must not use the normal verified-card visual treatment.
- `UNVERIFIED` — verification could not be completed because required proof material was unavailable or incomplete. This state must remain distinct from `REJECTED`.

A `VERIFIED` badge must not mean merely that r4b1t generated the image. It asserts that a specific canonical source artifact verified at render time. A detached image or screenshot is not itself a verifiable artifact and must not imply otherwise.

Rejected or unverifiable projections must use structurally distinct diagnostic presentation rather than merely swapping a badge label. Diagnostic rendering is observation only.

Rendering a `REJECTED` or `UNVERIFIED` artifact must never write that artifact into the verified local atlas, mutate trusted graph state, alter sampler state, affect corpus eligibility, or influence future route selection.

If a portable visual package is added, it should bundle the projection with the authoritative canonical artifact rather than introduce a second lightweight evidence schema.

## Local-first behavior

Topology remains usable without login or server identity.

The local atlas may persist in browser-local storage. A server may host static assets or relay user-requested downloads, but verification must not require a r4b1t account or trusted server response.

Cross-user comparison, if added later, must operate on independently supplied artifacts and must not feed into route selection.

## Interaction

Permitted interactions:

- open/close topology
- inspect node
- inspect proof state
- expand/collapse branches
- switch deterministic display layouts
- explicitly filter the displayed graph
- export artifact
- import artifact
- select a revealed route already present in the artifact
- compare two supplied trails

Not permitted:

- "show me something like this"
- "continue from the most interesting branch"
- behavior-derived auto-focus
- auto-ranking
- recommendation carousels
- topology-driven sampler weighting

Selecting an existing revealed route may navigate to that recorded route; it must not alter how future routes are sampled.

## Display filters

Display filters affect only what is visible in the topology view.

Examples:

- show only Blind Descent artifacts
- show only forks
- show only trails with concealed steps
- show one lineage subtree
- show one explicit time range

Display filters must not mutate the trail artifact, corpus eligibility, sampler state, or future selection.

If a future feature uses the same control to constrain exploration, that exploration constraint must be explicitly user-declared under Contract clause 8 and implemented separately from topology display filtering.

## Wear

Wear remains diagnostic.

Topology may render wear from recorded depth, crease, inherited, divergent, concealed, and revealed states.

Wear must not:

- alter graph ordering
- change node prominence based on "importance"
- influence route selection
- alter corpus eligibility
- become a proxy ranking signal

## Accessibility

Topology v2 must preserve the existing dialog focus lifecycle and add accessible graph semantics.

Minimum requirements:

- focus moves into the topology dialog when opened
- Tab/Shift+Tab remain trapped while modal
- Escape closes
- opener focus is restored
- every interactive node is keyboard reachable
- proof state is available as text, not color alone
- concealed states have explicit accessible labels
- relationship labels do not depend on geometry alone
- reduced-motion users receive equivalent information without animation

## Determinism

Given the same ordered set of verified artifacts and the same explicit display configuration, topology derivation and machine-export structure must be deterministic.

Presentation may adapt responsively to viewport size, but proof semantics and graph relationships must remain unchanged.

## Failure behavior

Invalid artifacts must fail closed.

Topology must not partially trust an artifact that fails cryptographic or structural verification.

Rejected artifacts may be listed in a separate diagnostic area with a rejection reason, but their unverified claims must not be merged into the verified graph.

## Contract review

### Clause 1 — Selection blind to history

Compliant if topology only reads artifacts after selection has occurred and never writes behavioral state to the sampler.

Evidence:
- architectural separation
- tests proving topology/wear/history data are not sampler inputs

### Clause 2 — Selection precedes exposure

Compliant if concealed commitments remain concealed until a valid reveal already exists in the artifact.

Evidence:
- Blind Descent verification tests
- topology tests asserting concealed steps expose no route URL

### Clause 3 — Independent verification

Compliant if exported machine-readable topology contains enough proof material for third-party recomputation.

Evidence:
- round-trip export/import test
- independent verifier fixture
- golden vectors

### Clause 4 — No recommendation

Compliant if topology labels and emphasis encode only recorded state or explicit display choices.

Evidence:
- source guards for banned recommendation/ranking terminology where practical
- review of emphasis derivation inputs

### Clause 5 — Local-first

Compliant if graph construction, export, import, and verification work without authentication.

Evidence:
- offline/local tests

### Clause 6 — Proof surface only

Compliant if topology code cannot mutate sampler weighting, corpus eligibility, or next-route selection.

Evidence:
- module-boundary tests
- no sampler dependency from topology modules

### Clause 7 — Wear/history diagnostic only

Compliant if wear/history are render inputs only.

Evidence:
- tests asserting no sampler dependency
- source-level dependency guard

### Clause 8 — Explicit constraints only

Topology display filters are presentation-only. Any future exploration constraint must be implemented as an explicit user-declared sampler constraint, not inferred from topology state.

### Clause 9 — Cross-user compare, never steer

Future comparisons may ingest multiple user-supplied artifacts but cannot write aggregate state into selection.

## Non-goals for v2

Topology v2 does not add:

- recommendation
- personalization
- behavior-derived ranking
- popularity scoring
- inferred "interestingness"
- cross-user feed generation
- server-side profile state
- topology-driven route selection
- automatic corpus filtering
- proof claims about human attention or visitation

## Initial implementation slices

1. Define a stable topology export schema and golden vectors. The golden-vector set must include at least one fixture for every categorical proof state, including `VERIFIED`, `REJECTED`, `PARENT ABSENT`, `CONCEALED`, and `REVEALED`, so proof-state derivation receives complete baseline coverage from its first implementation.
2. Add explicit proof-state model to topology derivation.
3. Replace the current linear card stack with a deterministic lineage graph.
4. Add node inspection and proof diagnostics.
5. Add import/export round-trip verification.
6. Add initial contract-boundary regression skeleton proving topology/export cannot steer selection, mutate sampler weighting, or alter corpus eligibility.
7. Add independent verifier fixture against exported artifacts.
8. Add export UX for canonical machine-verifiable artifacts.
9. Add accessibility coverage for graph navigation and proof inspection.
10. Expand the contract regression suite and perform the final contract audit.

Each implementation slice should land independently and preserve the current sampler behavior.
