# Replay Portable Proof Session UI — Slice 2 Boundary

Status: IMPLEMENTATION BOUNDARY  
Normative parents: `docs/REPLAY_INSPECTION_V1_SPEC.md` (FROZEN), `docs/REPLAY_INSPECTION_V1_DELEGATION.md`, `docs/REPLAY_MULTISOURCE_UI_BOUNDARY.md`  
Release baseline: `replay-inspection-v1.0.0`

## Goal

Allow a user to select one portable Proof Session file set and inspect the frozen
bundle inspector's fresh result locally.

## Accepted input

- an explicit local selection containing the portable session projection, canonical
  source files, derived comparison files, and optional README
- exact bytes for every selected file
- either preserved relative paths or unambiguous flattened portable filenames

The UI may reconstruct only these frozen file-set addresses:

- `proof-session.json`
- `README.txt`
- `sources/S<n>--sha256-<digest>.json`
- `comparisons/S<n>--S<n>--sha256-<digest>.json`

Unknown or ambiguous names fail closed. File names are transport addresses, never
evidence facts.

## Mandatory flow

1. discard every prior Replay presentation,
2. display neutral `READING PROOF SESSION`,
3. copy every selected file as exact bytes,
4. display neutral `VERIFYING PROOF SESSION`,
5. call `R4b1tReplayInspectionDelegation.inspectProofSession()` exactly once,
6. render only its public result.

The browser UI does not parse stored projections, verify trails, compare trails, or
decide `MATCH`, `MISMATCH`, or `UNREADABLE`.

## Presentation

- `MATCH`: classification, warnings, and the freshly recomputed projection
- `MISMATCH`: classification, mismatch file addresses, warnings, and the freshly
  recomputed projection
- `UNREADABLE`: classification, reason, and warnings only

Stored projections are never rendered as authority. `UNREADABLE` never substitutes
stored facts. Source route facts remain absent from the multi-source projection.

## Lifecycle and exclusions

Selection order has no semantic role after address reconstruction. A new selection,
Reset, Escape, modal close, destruction, or reload invalidates in-flight work and
discards selected bytes and results. No persistence or network transfer is allowed.

ZIP/directory parsing, repair, export, Trail Comparison bundle import, and any new
proof or comparison semantics remain out of scope.

## Acceptance gate

Tests must prove browser availability of the frozen inspector, exact-byte file-set
handoff, neutral preverification, all three classifications, fresh-only rendering,
reset/close invalidation, no persistence/network hooks, and phone-width containment.
