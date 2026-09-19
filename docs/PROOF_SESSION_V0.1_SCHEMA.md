# r4b1t-proof-session/v0.1 — Projection Schema

Status: FROZEN — governed by Proof Sessions v1
Governed by: `docs/PROOF_SESSIONS_V1_SPEC.md`
Spec baseline: `620f035e4ccf537dc4971e854e79a35ca972e3d0`
Machine schema: `docs/schema/proof-session-v0.1.schema.json`

This schema encodes deterministic Proof Session presentation. It is derived workspace state and is not evidence authority.

## Projection identifier

The projection identifier is:

`r4b1t-proof-session/v0.1`

Every projection contains:

- unique source slots,
- references to frozen Trail Comparison v1 projections for every eligible verified pair,
- direct verified parent edges,
- the fixed session summary,
- the fixed non-authority notice.

## Source slots

Each unique exact source byte sequence occupies one source slot.

`artifact_digest` is SHA-256 over the exact UTF-8 bytes supplied to the session.

`slot_id` is session-local addressability only. It is not evidence identity and is not globally portable identity.

Exact duplicate source bytes collapse to one slot and increment `supplied_count`.

Different source byte sequences remain separate slots even when they verify to the same canonical trail ID.

Each source carries exactly one verification state:

- `VERIFIED`
- `REJECTED`
- `UNVERIFIED`

Only VERIFIED slots are eligible for pair references or direct relationship edges.

JSON Schema cannot enforce all cross-record implications, so the Proof Sessions projection validator must enforce those invariants before emission.

## Pair references

The session schema deliberately does not copy Trail Comparison v1 stop, concealment, prefix, divergence, or lineage structures.

Each eligible unordered verified pair is represented by:

- `left_slot`
- `right_slot`
- fixed `comparison_format: r4b1t-trail-comparison/v0.1`
- `comparison_projection_digest`

The referenced comparison projection remains the sole pairwise semantic authority.

The session projection must never derive its own definition of divergence.

## Direct relationship graph

The only relationship edge in v0.1 is:

`DIRECT_PARENT`

Each edge names:

- `parent_slot`
- `child_slot`
- the exact comparison projection digest that directly established the relationship.

No indirect edge type exists.

A path made of multiple direct edges is only presentation of those separate verified edges. It does not create another edge.

## Fixed summary vocabulary

The summary is an ordered ten-item array whose labels are exactly:

1. `SOURCES`
2. `VERIFIED`
3. `REJECTED`
4. `UNVERIFIED`
5. `VERIFIED PAIRS`
6. `DIRECT RELATIONSHIPS`
7. `DIVERGENT PAIRS`
8. `IDENTICAL TRAIL PAIRS`
9. `SHARED PREFIX ONLY PAIRS`
10. `NO SHARED PREFIX PAIRS`

No additional summary label exists in v0.1.

Counts are deterministic derived presentation and must be recomputed from verified sources and frozen comparison projections.

## Golden vectors

`tests/fixtures/proof-sessions-v1/golden-vectors.json` covers the initial conformance scenarios required by the Proof Sessions v1 spec, including:

- verified unrelated sources,
- direct parent/child,
- a three-source direct chain with no manufactured third edge,
- shared prefix without direct lineage,
- exact duplicate-byte collapse,
- distinct bytes with identical canonical trail identity,
- REJECTED and UNVERIFIED diagnostic sources,
- v0.2 concealed-source scenarios represented only through comparison references,
- fixed summary counts and deterministic pair ordering,
- export/reinspection projection shape,
- diagnostic exclusion from pair and relationship facts.

Runtime conformance tests in later slices must recompute these facts from actual canonical source bytes and frozen Trail Comparison v1 rather than trusting stored projections.

## Fixed notice

Every projection carries:

> Proof Session organizes independently verified source artifacts and derived comparison projections. It does not replace any source artifact. Re-verify sources and recompute comparisons to confirm current validity.

## Authority boundary

Canonical source artifacts remain authoritative.

Frozen Trail Comparison v1 projections remain the pairwise derived presentation records.

The Proof Session projection only organizes those sources and references.

A later export inspector must independently re-verify source bytes, recompute pair projections, rebuild direct edges, and recompute summary counts before accepting stored session presentation.

The inspector must not render stored session facts before fresh recomputation completes.

Stored `proof-session.json` and stored Comparison projections are comparison targets only. A semantic difference between stored and freshly recomputed derived presentation is a visible portable-file-set `MISMATCH`, not a silent correction.

`README.txt` is non-normative human documentation and is never consulted for machine validity, schema identity, source identity, comparison identity, or recomputation behavior.
