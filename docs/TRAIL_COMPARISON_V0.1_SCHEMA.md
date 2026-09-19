# r4b1t-trail-comparison/v0.1 — Projection Schema

Status: FROZEN — accepted with Trail Comparison / Divergence v1  
Acceptance baseline: `c8ac1bedabd2b8fa65414ad3360bba9e2394a95c`  
Governed by: `docs/TRAIL_COMPARISON_V1_SPEC.md`  
Spec baseline: `32f57b0c3c1683f7a25678079f3b04048ae165a3`  
Machine schema: `docs/schema/trail-comparison-v0.1.schema.json`

This schema mechanically encodes Trail Comparison / Divergence v1. It is derived presentation over two canonical source artifacts and is not evidence authority.

## Source binding

The projection identifier is:

`r4b1t-trail-comparison/v0.1`

Both `sources.left.artifact_digest` and `sources.right.artifact_digest` are SHA-256 values over the exact UTF-8 source bytes independently supplied to the comparison operation.

Supported VERIFIED source formats are:

- `r4b1t-trail/v0.1`
- `r4b1t-trail/v0.2`

Unsupported or unreadable formats may appear only in diagnostic results.

## Verification

Each side is independently classified as exactly:

- `VERIFIED`
- `REJECTED`
- `UNVERIFIED`

A VERIFIED side must bind `verified_digest` to that side's exact source digest.

Derived `comparison` facts are valid only when both sides are VERIFIED. If either side is REJECTED or UNVERIFIED, the implementation must emit `comparison: null` and the fixed diagnostic notice.

JSON Schema cannot enforce arbitrary cross-field equality or the two-side verification implication, so the comparison projection validator must enforce those rules before emission.

## Comparison positions

The only position states are:

- `MATCH_REVEALED`
- `DIFFER_REVEALED`
- `LEFT_CONCEALED`
- `RIGHT_CONCEALED`
- `BOTH_CONCEALED_SAME_COMMITMENT`
- `BOTH_CONCEALED_DIFFERENT_COMMITMENT`
- `LEFT_ONLY`
- `RIGHT_ONLY`

Each side of a position is independently represented as `REVEALED`, `CONCEALED`, or `ABSENT`.

The projection never carries URLs.

For a REVEALED side, `route_id` may be present and `commitment` is null unless the canonical format itself carries a verified commitment for the revealed stop.

For a CONCEALED side, `route_id` must be null. The verified commitment may be carried.

For an ABSENT side, both `route_id` and `commitment` are null.

The projection validator must enforce those state-dependent invariants.

## Shared prefix

`shared_prefix_length` counts consecutive positions from zero that are either:

- `MATCH_REVEALED`
- `BOTH_CONCEALED_SAME_COMMITMENT`

`first_divergence_index` is the first position outside those states, or null if both verified trails are identical across their full equal length.

## Lineage

The allowed lineage states are:

- `SAME_TRAIL`
- `LEFT_PARENT_OF_RIGHT`
- `RIGHT_PARENT_OF_LEFT`
- `SHARED_ANCESTRY_NOT_PROVEN`
- `NO_SHARED_PREFIX`

`direct_fork_at` is non-null only for a verified direct parent relationship and is derived from canonical parent metadata after canonical lineage verification.

A shared prefix alone never proves ancestry.

## Notice

Every projection carries:

> Comparison describes two independently verified source artifacts identified by their digests. It does not replace either source artifact. Re-verify both sources to confirm current validity.

Diagnostic-only projections additionally carry:

> THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.

## Prohibited semantics

The schema intentionally contains no URL, winner, score, percentage, rank, relevance, recommendation, popularity, engagement, follower, discovery, sampler, wear, corpus-weight, or selection-weight field.
