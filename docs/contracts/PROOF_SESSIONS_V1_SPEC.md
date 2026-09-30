# Proof Sessions v1 — Normative Specification

Status: FROZEN
Scope: proof/presentation workspace only
Contract clauses touched: 3, 4, 5, 6, 7, 9
Depends on: `CONTRACT.md` v1.0 (frozen), Trail Topology v2 (frozen), Trail Cards v1 (frozen), Trail Comparison / Divergence v1 (frozen)

> A Proof Session organizes independently verified artifacts and derived facts. The session itself never becomes evidence authority.

This sentence governs every other clause in this specification.

---

## 1. Purpose

Proof Sessions v1 provides a temporary local workspace for inspecting a small, explicitly supplied set of canonical r4b1t artifacts together.

A session may help a user answer questions such as:

- which supplied artifacts verify,
- which supplied artifacts are diagnostic-only,
- which verified artifacts have direct canonical lineage,
- which verified artifact pairs diverge,
- which positions remain concealed,
- what deterministic categorical facts exist across the supplied working set.

A Proof Session is an inspection surface.

It is not:

- a new canonical evidence format,
- a recommendation surface,
- a ranking surface,
- a similarity-search system,
- an automatic discovery system,
- a social graph,
- a persistent behavioral profile,
- a sampler input,
- a corpus input,
- a source of new lineage claims.

## 2. Product Contract mapping

Proof Sessions v1 touches the Product Contract only on the proof/presentation side.

### Clause 3 — Independent verification

Every canonical artifact admitted to verified session state MUST be independently verifiable using its existing standalone verifier.

A session export MAY preserve canonical source artifacts and deterministic derived session presentation, but the session itself MUST NOT become the authority for any underlying integrity claim.

### Clause 4 — No recommendation

A session may display categorical verified facts and deterministic counts only.

It MUST NOT score, rank, recommend, prioritize, or characterize an artifact, branch, relationship, divergence, or route as better, stronger, more relevant, more important, more interesting, more useful, or more likely to matter.

### Clause 5 — Local-first

Session creation, verification, inspection, comparison, and export MUST work without login, server identity, remote storage, or network access.

### Clause 6 — Proof surface only

Session state MUST NOT affect route selection, corpus eligibility, sampler behavior, route ordering, or future exploration.

### Clause 7 — Diagnostic history only

Session observations, counts, repeated imports, comparison results, and relationship views are diagnostic presentation only.

They MUST NOT become predictive or behavioral-selection inputs.

### Clause 9 — Cross-user compare, never steer

A session MAY contain independently supplied artifacts from different users, devices, or sessions.

Cross-user artifacts may be verified and compared, but session state MUST NOT create aggregate steering signals, profiles, recommendation groups, or future-selection inputs.

## 3. Session lifetime is ephemeral by default

A Proof Session exists only in active runtime memory unless the user explicitly exports it.

Default session state MUST NOT be persisted through:

- `localStorage`,
- `sessionStorage`,
- IndexedDB,
- Cache Storage,
- cookies,
- service-worker session state,
- server-side session state,
- telemetry-backed reconstruction,
- automatic file-system writes.

Closing the session, reloading the application, closing the tab, or restarting the application discards the working session unless the user explicitly created an export.

There is no automatic restore, recent-session list, autosave, background checkpoint, or session history in v1.

This ephemeral boundary is intentional. Disposable in-memory workspace state does not require its own evidentiary integrity claim because the session is not evidence authority.

## 4. Accepted canonical inputs

Proof Sessions v1 accepts only canonical artifacts already supported by frozen proof primitives.

Initial accepted evidence inputs are canonical trail artifacts supported by Trail Comparison v1:

- `r4b1t-trail/v0.1`
- `r4b1t-trail/v0.2`

Future canonical artifact families MAY be added only through an explicit specification revision defining:

- their verifier,
- their role in session derivation,
- their relationship semantics,
- their export authority rules.

The following are not evidence inputs:

- Trail Cards,
- screenshots,
- rendered images,
- topology screenshots,
- comparison screenshots,
- prior Proof Session summaries,
- prior Proof Session projections,
- prose notes,
- copied labels,
- external enrichment.

A presentation artifact may be displayed as an attachment in a future revision, but it MUST NOT become proof input unless separately defined as canonical evidence.

## 5. Independent verification on import

Each imported canonical artifact MUST be independently verified when admitted to the session.

A prior VERIFIED Trail Card, prior Comparison result, prior session result, file name, import source, or user assertion does not satisfy this requirement.

For each imported source, the session MUST bind the working record to the SHA-256 digest of the exact supplied source bytes.

Each source receives exactly one of the frozen proof states:

- `VERIFIED`
- `REJECTED`
- `UNVERIFIED`

A source may contribute relationship or divergence facts only when it is `VERIFIED`.

Rejected or unverified material remains visible as diagnostic material only.

## 6. Session-local artifact identity and duplicate handling

Every unique imported source occupies one session-local slot.

The authoritative identity of a source remains its canonical artifact identity and exact source digest.

The session-local slot identifier exists only to make the temporary workspace addressable.

### 6.1 Session-local slot IDs

Slot IDs are deterministic within the current session import set:

- `S1`
- `S2`
- `S3`
- and so on.

Slot IDs are assigned according to the session's deterministic import ordering defined in section 12.

A slot ID:

- is not globally unique,
- is not portable identity,
- is not evidence identity,
- MUST NOT be persisted as a canonical identifier,
- MAY change when a different session contains the same source set in a different explicit import order.

### 6.2 Duplicate exact-source imports

If the exact same source bytes are imported more than once, identified by identical exact-byte SHA-256 source digest, the session MUST represent them as one source slot.

Repeated import of identical source bytes MUST NOT create:

- duplicate graph nodes,
- duplicate pairwise comparisons,
- duplicate summary counts,
- duplicate relationship edges.

The UI MAY indicate that the same source was supplied more than once, but repetition is diagnostic metadata only.

### 6.3 Same canonical trail with different source bytes

If two source byte sequences verify to the same canonical trail ID but have different exact source digests, the session MUST keep them as separate imported sources.

The session MAY display that both verify to the same trail identity, but it MUST NOT silently collapse distinct byte sequences.

This preserves exact-source provenance while keeping session-local identity simple.

## 7. Artifact roles

An artifact does not acquire multiple semantic roles inside a session.

Each source slot has one role:

- verified canonical source, or
- diagnostic source.

A verified source may participate in multiple derived views at the same time, including:

- direct-lineage display,
- pairwise comparison endpoint,
- source-card presentation,
- relationship-graph node.

These are views over one source slot, not separate artifact roles or duplicate session identities.

A source MUST NOT be re-imported or cloned merely because it appears as:

- a comparison endpoint,
- a parent reference,
- a child reference,
- a graph node,
- a summary participant.

## 8. Diagnostic handling

A `REJECTED` or `UNVERIFIED` source MAY remain visible in the session in a structurally distinct diagnostic area.

Diagnostic sources:

- contribute zero relationship edges,
- contribute zero shared-prefix counts,
- contribute zero divergence-pair counts,
- contribute zero direct-lineage counts,
- contribute zero concealed-position comparison counts,
- contribute zero verified-artifact counts,
- MUST NOT be pairwise-compared for factual session derivation.

A diagnostic source contributes only to:

- total imported-source count,
- its exact proof-state tally,
- its own visible reason or verifier diagnostic where available.

No session-wide relationship fact may be inferred from rejected or unverified material.

## 9. Pairwise comparison delegation

Proof Sessions v1 MUST NOT define a second comparison algorithm.

For every pair of VERIFIED canonical trail artifacts that the session needs to compare, it MUST invoke the frozen Trail Comparison / Divergence v1 primitive.

The session consumes the validated Trail Comparison projection.

It MUST NOT independently reimplement:

- shared-prefix derivation,
- first-divergence derivation,
- concealed/revealed stop comparison,
- direct parent/fork verification,
- lineage classification,
- comparison verification-state semantics.

If Trail Comparison v1 changes in a future revision, Proof Sessions MUST explicitly adopt that new revision before consuming changed comparison semantics.

A session MUST NOT combine fields from multiple comparison versions into one derived fact model.

## 10. Relationship graph construction and prohibition on transitive inference

The session relationship graph is derived only from directly established facts produced by canonical verification and frozen Trail Comparison v1.

### 10.1 Nodes

Every VERIFIED unique source slot contributes one graph node.

Diagnostic sources contribute no graph nodes to the verified relationship graph.

They remain outside the graph in diagnostic presentation.

### 10.2 Direct edges

A graph edge may exist only when the supplied pair's frozen Trail Comparison v1 result directly establishes:

- `LEFT_PARENT_OF_RIGHT`, or
- `RIGHT_PARENT_OF_LEFT`.

The edge direction MUST correspond exactly to the verified direct parent relationship.

### 10.3 No transitive evidence claims

Proof Sessions v1 MUST NOT manufacture a new relationship edge or verified relationship claim through transitive reasoning.

If:

- A is directly verified as parent of B, and
- B is directly verified as parent of C,

the session MAY display both direct verified relationships.

It MUST NOT assert a new verified A → C relationship unless an existing canonical verifier explicitly establishes that exact relationship from supplied evidence.

The session MUST NOT label A and C as:

- verified ancestor/descendant,
- indirectly verified lineage,
- proven chain endpoint,
- equivalent lineage,
- inferred parent,
- transitive parent.

A visual path through multiple verified direct edges is presentation of those separate edges only.

It is not itself a new evidence claim.

### 10.4 Shared-prefix facts are not graph edges

`SHARED_ANCESTRY_NOT_PROVEN` MUST NOT create a lineage edge.

`SAME_TRAIL` MAY be shown as an equality fact between source slots but MUST NOT create a parent/child edge.

`NO_SHARED_PREFIX` creates no edge.

## 11. Session pair set

For N VERIFIED unique source slots, the session pair set consists of every unordered pair exactly once.

The number of eligible pairs is:

`N × (N - 1) / 2`.

Pair ordering is deterministic:

1. lower session-local slot index first,
2. higher session-local slot index second.

The session MUST NOT:

- compare the same unordered pair twice,
- weight some pairs more heavily,
- skip a pair because it appears less interesting,
- prioritize pairs using history, popularity, wear, domain, content, or user behavior.

A UI MAY lazily render pair details for performance, but the underlying eligible-pair model remains complete and deterministic.

## 12. Deterministic ordering

Session ordering MUST depend only on explicit imported source order and deterministic tie-breakers.

For v1:

1. the first unique source digest encountered receives the next session-local slot,
2. exact duplicate digests reuse the existing slot,
3. pair ordering follows slot order,
4. graph node ordering follows slot order unless an explicit deterministic display mode is selected.

Permitted deterministic display inputs include:

- session-local slot,
- canonical creation timestamp,
- canonical trail ID,
- verified direct parent/fork relationship,
- explicit user-selected display mode.

Forbidden ordering inputs include:

- engagement,
- click frequency,
- hesitation,
- revisit count,
- popularity,
- external traffic,
- recommendation score,
- inferred importance,
- inferred similarity,
- wear as a ranking signal,
- behavioral history.

## 13. Fixed summary vocabulary

Proof Sessions v1 summary output is categorical and deterministic.

The session summary MUST be assembled only from the fixed labels defined here.

Allowed top-level summary fields are exactly:

- `SOURCES`
- `VERIFIED`
- `REJECTED`
- `UNVERIFIED`
- `VERIFIED PAIRS`
- `DIRECT RELATIONSHIPS`
- `DIVERGENT PAIRS`
- `IDENTICAL TRAIL PAIRS`
- `SHARED PREFIX ONLY PAIRS`
- `NO SHARED PREFIX PAIRS`

Definitions:

- `SOURCES` — number of unique exact-source-digest slots, including diagnostic slots.
- `VERIFIED` — number of source slots whose exact bytes verified.
- `REJECTED` — number of source slots positively rejected.
- `UNVERIFIED` — number of source slots whose verification could not be completed.
- `VERIFIED PAIRS` — number of unordered pairs where both source slots are VERIFIED.
- `DIRECT RELATIONSHIPS` — number of verified pairs classified `LEFT_PARENT_OF_RIGHT` or `RIGHT_PARENT_OF_LEFT`.
- `DIVERGENT PAIRS` — number of verified pairs with non-null `first_divergence_index`.
- `IDENTICAL TRAIL PAIRS` — number of verified pairs classified `SAME_TRAIL`.
- `SHARED PREFIX ONLY PAIRS` — number of verified pairs classified `SHARED_ANCESTRY_NOT_PROVEN`.
- `NO SHARED PREFIX PAIRS` — number of verified pairs classified `NO_SHARED_PREFIX`.

No other summary labels exist in v1.

The summary MUST NOT contain generated prose or adjectives such as:

- strongest,
- weakest,
- closest,
- farthest,
- best,
- worst,
- important,
- interesting,
- suspicious,
- notable,
- likely,
- probable,
- high confidence,
- low confidence.

The summary MUST NOT contain percentages, quality scores, confidence scores, relevance scores, similarity scores, or rankings.

## 14. Concealment preservation

Proof Sessions MUST preserve the frozen concealment boundary from canonical verification and Trail Comparison v1.

A concealed route identity MUST NOT be:

- guessed,
- resolved,
- enriched,
- brute-forced,
- inferred from another session artifact,
- inferred from a revealed counterpart,
- exposed through summary text,
- exposed through graph labels,
- exposed through pair labels.

If a pairwise Comparison projection identifies a concealed side, the session may display only the categorical state and commitment information already permitted by the frozen comparison projection.

A session is not a reveal oracle.

## 15. Session state is not evidence authority

Session state is derived workspace presentation.

It MUST NOT define a new canonical evidence format.

There is no reverse path:

    canonical sources
         |
         | verify independently
         v
    verified source slots
         |
         | frozen pairwise comparison
         v
    derived session facts
         |
         | deterministic presentation
         v
    Proof Session UI

A session result MUST NOT be used to:

- reconstruct a canonical trail,
- modify a canonical trail,
- merge canonical trails,
- repair canonical trails,
- synthesize a new trail,
- create missing ancestors,
- upgrade diagnostic material,
- create new proof claims.

## 16. Local-first and privacy boundary

Proof Sessions v1 MUST work without:

- account,
- login,
- profile,
- network access,
- server-side identity,
- server-side session state,
- remote enrichment,
- telemetry,
- public upload.

The local runtime MUST NOT transmit imported artifact contents, source digests, comparison facts, session summaries, or relationship state unless a future explicit user-initiated transfer feature is separately specified.

v1 defines no such network transfer feature.

## 17. Explicit session export

The only persistence path in v1 is explicit user export.

An exported Proof Session MUST remain a file set.

It MUST NOT become a new canonical evidence artifact or evidence manifest.

### 17.1 Portable file layout

The v1 portable file set SHALL contain:

- `sources/` — one exact canonical source file for every unique exact source-byte digest,
- `comparisons/` — one stored frozen Trail Comparison v1 projection for every eligible VERIFIED unordered pair,
- `proof-session.json` — the stored derived `r4b1t-proof-session/v0.1` projection,
- `README.txt` — human-readable authority and inspection instructions.

Source filenames MUST be deterministic and collision-resistant.

A source filename MUST be derived from session-local slot plus exact source digest, for example:

`sources/S1--sha256-<64 lowercase hex>.json`

Comparison filenames MUST be deterministic from their two session-local endpoints and stored Comparison projection digest, for example:

`comparisons/S1--S2--sha256-<64 lowercase hex>.json`

Filenames are transport organization only.

They MUST NOT become canonical artifact identity.

### 17.2 Authority of bundled files

The exact files under `sources/` remain the only canonical evidence inputs in the portable file set.

Every file under `comparisons/` is derived presentation.

`proof-session.json` is derived presentation.

`README.txt` is non-normative human documentation.

The README:

- MAY describe the bundle format version and expected file layout for a human reader,
- MAY list authority boundaries and inspection instructions,
- MUST NOT be parsed to determine bundle validity,
- MUST NOT supply schema identity,
- MUST NOT supply source identity,
- MUST NOT supply comparison identity,
- MUST NOT alter recomputation behavior,
- MAY be missing or modified without changing evidentiary conclusions.

Machine inspection MUST derive all normative facts from exact source files and fixed implementation/spec constants, never from README content.

### 17.3 Export construction

An exporter MUST:

1. begin from the exact source byte sequences currently held by the ephemeral session,
2. independently verify those exact bytes,
3. deterministically deduplicate exact duplicate source bytes,
4. invoke frozen Trail Comparison v1 for every eligible VERIFIED unordered pair,
5. build the direct relationship graph only from those pair results,
6. compute the fixed session summary,
7. emit `proof-session.json`,
8. emit each exact source file unchanged,
9. emit each validated Comparison v1 projection,
10. emit the non-normative README.

The exporter MUST NOT accept a previously stored Proof Session projection as sufficient input for export.

Export creation therefore repeats the same proof derivation used by the live session instead of serializing arbitrary UI state.

### 17.4 Offline inspection sequence

A Proof Session inspector MUST treat the stored derived files as untrusted until fresh recomputation completes.

The inspection sequence is fixed:

1. discover the portable file set using the fixed v1 file layout,
2. load the exact files under `sources/`,
3. independently re-verify every exact source byte sequence,
4. deterministically reconstruct session-local slots from the portable source ordering defined by the exporter,
5. recompute the complete eligible VERIFIED unordered pair set,
6. invoke frozen Trail Comparison v1 for every eligible pair,
7. recompute every Comparison projection digest,
8. recompute the direct relationship graph,
9. recompute the fixed session summary,
10. build a fresh `r4b1t-proof-session/v0.1` projection,
11. only then parse and validate stored files under `comparisons/` and stored `proof-session.json` for comparison against the fresh result,
12. classify the portable file set.

Fresh recomputation is authoritative for inspection.

Stored comparison projections and stored `proof-session.json` are comparison targets only.

### 17.5 No pre-recomputation factual rendering

Before step 10 in section 17.4 completes, the inspector MUST NOT render:

- stored session summary counts,
- stored relationship edges,
- stored pair classifications,
- stored verification states,
- stored canonical trail identities,
- stored comparison facts,
- any VERIFIED session badge derived from stored presentation.

The inspector MAY render only a non-factual progress state such as:

`RECOMPUTING LOCAL PROOF SESSION…`

This requirement prevents attacker-modified derived files from being temporarily presented as verified facts.

There is no stored-summary fallback in v1.

### 17.6 Stored-versus-fresh equivalence

After fresh recomputation, the inspector MUST compare stored derived material with recomputed derived material.

Comparison MUST include at least:

- source-slot count and slot-to-source-digest binding,
- source proof states,
- canonical trail IDs for VERIFIED sources,
- complete eligible pair set,
- each pair's Comparison projection digest,
- each stored Comparison projection's full validated semantic content,
- complete direct relationship edge set,
- all ten fixed summary labels and counts,
- fixed notice text,
- projection format version.

Equivalence MUST ignore only fields explicitly defined as runtime-generated or non-authoritative diagnostic metadata.

For v1, ignored equivalence metadata is limited to:

- verifier execution timestamps such as `verified_at`,
- original duplicate-selection multiplicity `supplied_count`, because the portable file set contains one authoritative exact source file per unique digest and cannot independently reconstruct how many times that byte sequence was selected before export.

Ignoring `supplied_count` does not alter `SOURCES`, pair construction, proof state, canonical trail identity, relationship edges, or any fixed summary count.

No other field may be ignored merely because it is inconvenient to reproduce.

### 17.7 Portable inspection classifications

Inspection returns exactly one portable-file-set classification:

- `MATCH`
- `MISMATCH`
- `UNREADABLE`

`MATCH` means every required source was freshly processed and every required stored derived artifact is semantically equivalent to fresh recomputation.

`MISMATCH` means fresh recomputation completed, but at least one required stored derived artifact differs from the fresh result.

`UNREADABLE` means inspection could not complete because the required portable file structure or one or more required files could not be read or parsed sufficiently to perform fresh recomputation.

These are portable-file-set inspection classifications.

They MUST NOT replace or alter the source-level `VERIFIED`, `REJECTED`, and `UNVERIFIED` proof states.

### 17.8 Mismatch handling is diagnostic, not silent repair

When classification is `MISMATCH`:

- the inspector MUST render the freshly recomputed session facts,
- the inspector MUST visibly and structurally mark the portable file set as `MISMATCH`,
- the inspector MUST state that stored derived presentation did not match fresh recomputation,
- the inspector MAY identify which derived file or deterministic field disagreed,
- the inspector MUST NOT silently overwrite the mismatch in memory and present the file set as `MATCH`,
- the inspector MUST NOT upgrade, repair, rewrite, or regenerate the user's portable files automatically.

A mismatch is therefore visible diagnostic information about the portable file set.

It is not a reason to distrust freshly re-verified canonical source artifacts merely because stored derived presentation was altered.

If fresh source verification itself produces source-level diagnostic states, those states remain visible according to the ordinary Proof Sessions rules.

### 17.9 Missing or altered README

Because `README.txt` is non-normative, a missing or altered README:

- MUST NOT change source verification,
- MUST NOT change pairwise comparison,
- MUST NOT change session summary,
- MUST NOT create `MISMATCH`,
- MUST NOT create `UNREADABLE`,
- MAY produce a separate human-documentation warning.

### 17.10 Stored presentation is never authority

Stored session presentation MUST NOT be trusted merely because it was exported by r4b1t.

The trust direction remains one-way:

    exact bundled canonical source bytes
               |
               | independently verify
               v
      fresh VERIFIED/diagnostic slots
               |
               | frozen Comparison v1
               v
       fresh pairwise projections
               |
               | deterministic aggregation
               v
       fresh Proof Session projection
               |
               | compare only
               v
       stored derived presentation

There is no reverse path from stored session presentation into canonical proof state.

## 18. Renderer and interaction requirements

A Proof Session renderer MUST:

- show every unique source slot,
- show each proof state textually,
- distinguish diagnostic sources structurally,
- show exact source digest or deterministic short digest,
- expose direct verified relationships without relying on geometry alone,
- expose pairwise facts using frozen Trail Comparison semantics,
- preserve concealed states,
- show fixed-vocabulary summary counts,
- remain semantically equivalent on desktop and mobile,
- remain keyboard accessible,
- support reduced motion without loss of information.

Permitted interactions:

- import explicit local files,
- remove a source from the current ephemeral session,
- inspect a source,
- inspect a verified pair,
- inspect a direct relationship,
- switch deterministic presentation modes,
- explicitly export the session file set,
- close/discard the session.

Removing a source recomputes the temporary session from the remaining imported sources.

It does not mutate any canonical artifact.

## 19. Forbidden semantics and selection isolation

Proof Sessions v1 MUST NOT contain or produce:

- recommendation,
- ranking,
- relevance scoring,
- quality scoring,
- trust scoring,
- importance scoring,
- popularity,
- engagement scoring,
- fuzzy similarity,
- nearest-neighbor matching,
- clustering by inferred similarity,
- candidate discovery,
- automatic artifact acquisition,
- inferred user interests,
- social graph construction,
- follower/following relationships,
- public galleries,
- leaderboards,
- feed generation,
- behavior-derived filtering,
- sampler weighting,
- corpus weighting,
- route weighting,
- automatic exploration constraints,
- SPROUT/ROLL triggers.

Session code MUST NOT write to any state read by:

- route selection,
- sampler construction,
- corpus eligibility,
- future route ordering,
- recommendation logic,
- wear-driven selection,
- behavioral profiles.

## 20. Non-goals for v1

Proof Sessions v1 does not add:

- persistent workspaces,
- automatic session recovery,
- cloud sync,
- collaboration,
- shared live sessions,
- comments,
- annotations as evidence,
- arbitrary notes as evidence,
- more than one canonical proof authority per imported source,
- transitive lineage inference,
- automatic ancestor discovery,
- automatic artifact lookup,
- similarity search,
- public session URLs,
- public session collections,
- saved recent sessions,
- comparison caches across app opens,
- recommendation or personalization.

## 21. Golden vectors and conformance requirements

The initial conformance set MUST include at least:

1. two verified unrelated v0.1 trails,
2. a verified direct parent/child pair,
3. three verified trails forming two direct edges where the session MUST NOT invent a transitive edge,
4. two sources with shared prefix but no proven direct relationship,
5. two exact duplicate source-byte imports collapsing to one slot,
6. two different source-byte sequences verifying to the same canonical trail ID and remaining separate slots,
7. one REJECTED source alongside verified sources,
8. one UNVERIFIED source alongside verified sources,
9. concealed v0.2 sources whose route identities remain absent,
10. mixed revealed/concealed pairwise states,
11. deterministic summary count fixture,
12. deterministic source and pair ordering fixture,
13. export/reinspection fixture proving stored session presentation is recomputed rather than trusted,
14. source-level guards proving session code cannot access persistence, network, sampler, corpus, ranking, recommendation, or selection machinery.

A conformance implementation MUST fail closed when a stored derived session projection disagrees with freshly recomputed facts.

## 22. Initial implementation order

Proof Sessions v1 SHOULD be implemented in this order:

1. freeze this normative specification,
2. define the session projection schema and golden vectors,
3. implement the pure ephemeral session core,
4. implement the deterministic renderer,
5. implement explicit local multi-file import UX,
6. implement explicit portable session export and offline inspection,
7. perform the final Product Contract audit,
8. freeze Proof Sessions v1.

Each implementation slice MUST preserve the proof-only boundary before the next slice begins.

## 23. Freeze criteria

Proof Sessions v1 may be frozen only when:

- the normative schema is versioned,
- all golden vectors pass,
- all imported sources are independently verified,
- exact duplicate source bytes collapse deterministically,
- diagnostic sources contribute no relationship or divergence facts,
- every verified pair is delegated to frozen Trail Comparison v1,
- direct relationship graph edges come only from verified direct lineage classifications,
- no transitive relationship claim is generated,
- concealment cannot leak through session presentation,
- summary vocabulary is closed and deterministic,
- default session state is demonstrably ephemeral,
- export inspection freshly re-verifies sources and recomputes derived presentation,
- no network/account/persistence path is required for ordinary sessions,
- no sampler/corpus/wear/recommendation/ranking/selection dependency exists,
- desktop and mobile browser tests pass on the exact acceptance head,
- the final Proof Sessions contract audit passes on the exact acceptance head.

Any future change that weakens these boundaries requires an explicit Proof Sessions specification revision and, where applicable, a Product Contract amendment.
