# r4b1t-trail-card/v0.1 — Projection Schema

Status: DRAFT  
Governed by: `docs/TRAIL_CARDS_V1_SPEC.md`  
Frozen spec baseline: `01f72e1114f814d95343ce2a84c3f1a75233f1bd`  
Machine schema: `docs/schema/trail-card-v0.1.schema.json`

This schema is a mechanical encoding of the Trail Cards v1 specification. It does not introduce evidence authority. Where this document, the JSON Schema, and the normative Trail Cards specification appear to conflict, the normative specification governs.

A trail-card object is presentation metadata describing a one-way projection of a source artifact. It is never submitted as evidence to a trail/topology verifier and cannot reconstruct, replace, or extend its source artifact.

## Source binding

The top-level projection identifier is:

`r4b1t-trail-card/v0.1`

`source.artifact_format` preserves the exact source-format identifier when it is readable, for example:

- `r4b1t-topology-export/v0.1`
- `r4b1t-trail/v0.1`
- `r4b1t-trail/v0.2`

A diagnostic projection may use an unsupported format identifier, or `null` when the source format could not be read. A `VERIFIED` projection is restricted to a source format supported by the applicable standalone verifier.

`source.artifact_digest` is SHA-256 over the exact UTF-8 source bytes supplied to the render/verification operation. This binds a card to the same byte sequence that was actually inspected and remains computable for malformed or rejected input.

## Verification

The only card verification states are:

- `VERIFIED`
- `REJECTED`
- `UNVERIFIED`

For `VERIFIED`:

- `verified_digest` is non-null and MUST equal `source.artifact_digest`
- `verified_at` is required
- `verifier` is required
- `reason` is null
- a deterministic display projection is required

For `REJECTED`:

- `verified_digest` is null
- `verified_at` records the failed verification attempt
- `reason` is required
- the fixed diagnostic disclaimer is required

For `UNVERIFIED`:

- `verified_digest` is null
- `verified_at` may be null only when verification could not run
- `reason` is required
- the fixed diagnostic disclaimer is required

JSON Schema cannot express equality between two arbitrary instance fields. The projection implementation MUST therefore enforce `verification.verified_digest === source.artifact_digest` for `VERIFIED` before emission.

## Source integrity and relationship state

Source integrity and relationship state remain separate.

A topology source can verify while a specific lineage relationship is `PARENT ABSENT`. In that case:

- card `verification.state` remains `VERIFIED`
- the affected node/edge carries `relationship_state: "PARENT ABSENT"`
- the card MUST NOT collapse the source to `UNVERIFIED`

The committed golden vector `verified-parent-absent-topology` freezes this behavior.

## Display discrimination

`display.kind` selects one of two deterministic projection shapes.

### `trail`

Represents one trail artifact. It carries trail identity, manifest format, optional format-appropriate genesis identity, parent declaration, stop counts, and stop states.

### `topology`

Represents a topology export. It carries aggregate counts and a structure-only `branch_diagram` of nodes and edges. Relationship state is carried independently on the applicable nodes/edges.

Neither display shape may encode ranking, popularity, inferred importance, engagement, recommendation, or selection weight.

For every populated display:

`stop_count = concealed_count + revealed_count`

The projection implementation MUST enforce this arithmetic invariant before emission. JSON Schema validates field types/ranges but does not perform arithmetic across fields.

## Diagnostic projections

`REJECTED` and `UNVERIFIED` projections require:

`THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.`

Their `display` may be `null` when safe structural extraction was not possible. If partial display data is emitted, it remains diagnostic presentation and does not upgrade source trust.

## Notice

Every projection carries the governed notice verbatim:

> Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.

## Golden vectors

`tests/fixtures/trail-cards-v1/golden-vectors.json` covers:

- VERIFIED
- REJECTED
- UNVERIFIED
- VERIFIED concealed source material
- VERIFIED source with PARENT ABSENT relationship
- rejected tampered source artifact

These vectors are the initial compatibility baseline for the pure projection implementation.
