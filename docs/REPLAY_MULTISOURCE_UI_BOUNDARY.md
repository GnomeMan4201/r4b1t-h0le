# Replay Multi-Source UI — Slice 1 Boundary

Status: IMPLEMENTATION BOUNDARY  
Normative parents: `docs/REPLAY_INSPECTION_V1_SPEC.md` (FROZEN), `docs/REPLAY_INSPECTION_V1_DELEGATION.md`  
Release baseline: `replay-inspection-v1.0.0`

This note fixes the browser boundary for the first post-v1 Replay increment. It does
not amend Replay proof semantics or create a second proof algorithm.

## Goal

Allow a user to select multiple local canonical trail JSON files and inspect the
fresh Proof Session projection produced by the existing Replay delegation layer.

This slice makes raw multi-source inspection usable. Portable Proof Session and
Trail Comparison file-set import remain later slices.

## Accepted input

- one or more explicitly selected local `.json` files
- exact file bytes, in browser `FileList` order
- formats already supported by frozen Proof Sessions (`r4b1t-trail/v0.1` and
  `r4b1t-trail/v0.2`)

Filenames, modification times, MIME labels, drag order inferred from the DOM, and
prior browser state are not evidence inputs.

Selecting one file preserves the frozen single-source Replay behavior. Selecting
two or more files enters multi-source inspection.

## Mandatory flow

1. discard the prior single- or multi-source presentation,
2. display neutral `READING SOURCES`,
3. read every selected file as exact bytes,
4. display neutral `VERIFYING SOURCES`,
5. call `R4b1tReplayInspectionDelegation.inspectSources()` once with those byte
   arrays in explicit selection order,
6. render only the returned public projection.

No source-derived content may enter visible DOM, hidden DOM, attributes,
accessibility text, or diagnostics before step 5 completes.

## Presentation

The first slice may present only facts already returned by the frozen Proof Session
projection:

- unique source count and supplied count,
- source slot, verification state, exact-byte digest, format, and duplicate count,
- eligible verified pair count and delegate-produced pair classifications,
- delegate-produced direct relationships,
- frozen summary counts.

Diagnostic sources remain visible as diagnostic slots. They do not poison
independent verified sources, and they never expose rejected canonical route facts.

The UI does not vote, rank, merge, prefer, repair, or synthesize sources. It does
not manufacture transitive lineage.

## Lifecycle

- a new selection invalidates in-flight work from every older selection,
- Reset, Escape, modal close, controller destruction, and page reload discard all
  selected bytes and multi-source presentation,
- no automatic restoration is allowed,
- no selected file bytes or projection may be written to localStorage,
  sessionStorage, IndexedDB, Cache Storage, cookies, or a remote endpoint.

## Browser delegation boundary

`replay-inspection-delegation.js` remains the only Replay entry to multi-source proof
semantics. Its browser build may require frozen `R4b1tProofSession` for raw source
inspection. Portable inspection methods must fail closed when their Node-only bundle
delegates are unavailable; the UI must not reimplement them.

## Explicitly out of scope

- directory or ZIP parsing
- portable Proof Session bundle import
- portable Trail Comparison bundle import
- stored-versus-fresh diff rendering
- export, editing, repair, persistence, upload, telemetry, ranking, recommendation,
  sampler influence, or corpus influence

## Acceptance gate

Tests for this slice must prove:

1. browser delegation preserves exact bytes and selection order,
2. duplicate sources retain frozen `supplied_count` semantics,
3. the UI is neutral before delegated verification completes,
4. verified and diagnostic slots remain independently visible,
5. direct relationships are displayed without a synthesized transitive edge,
6. one-file Replay behavior remains unchanged,
7. reset/close destroys multi-source state,
8. no storage write or off-origin request is caused by multi-source inspection,
9. phone-width presentation has no horizontal overflow.
