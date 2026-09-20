# Replay Portable Trail Comparison UI — Slice 3 Boundary

Status: IMPLEMENTATION BOUNDARY  
Normative parents: `docs/REPLAY_INSPECTION_V1_SPEC.md` (FROZEN), `docs/REPLAY_INSPECTION_V1_DELEGATION.md`, `docs/REPLAY_PROOF_SESSION_BUNDLE_UI_BOUNDARY.md`  
Release baseline: `replay-inspection-v1.0.0`

## Goal

Allow a user to select one portable Trail Comparison file set and inspect the fresh
projection returned by the frozen bundle inspector.

## Accepted input

An explicit local selection containing exact bytes addressed as:

- `left-source.json`
- `right-source.json`
- `trail-comparison.json`
- optional `README.txt`

One optional enclosing directory may be stripped. Unknown, missing, or duplicate
addresses fail closed. Left and right roles are fixed by these addresses; selection
order and filenames outside the frozen addresses carry no proof meaning.

## Mandatory flow

1. discard prior Replay presentation,
2. display neutral `READING TRAIL COMPARISON`,
3. copy selected files as exact bytes,
4. display neutral `VERIFYING TRAIL COMPARISON`,
5. call `R4b1tReplayInspectionDelegation.inspectTrailComparison()` once,
6. render only its public result and the fresh projection.

The UI does not parse projections, verify sources, compare trails, swap sides, or
derive a stored-versus-fresh classification.

## Presentation

The frozen portable inspector intentionally exposes no `MATCH` / `MISMATCH` label.
Replay must not invent one. It may show:

- `FRESHLY VERIFIED` as an operation status, not a portable classification,
- left and right exact-source digests and binding booleans,
- the freshly recomputed Trail Comparison projection.

The stored projection is a comparison target only and is never rendered as current
authority. Errors from missing files, unreadable projections, invalid projections,
or digest mismatches remain fail-closed diagnostics with no comparison facts.

## Lifecycle and exclusions

New selection, Reset, Escape, modal close, destruction, or reload invalidates work
and discards all bytes and results. No persistence or network transfer is allowed.
ZIP parsing, repair, export, side reassignment, and new comparison semantics are out
of scope.

## Acceptance gate

Tests must prove browser availability of the frozen inspector, exact address and byte
handoff, left/right preservation, neutral preverification, fresh-only rendering,
fail-closed errors, reset/close invalidation, no persistence/network hooks, and
phone-width containment.
