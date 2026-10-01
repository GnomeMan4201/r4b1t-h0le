# Trail v0.3 — Step Evidence Format

Status: DRAFT FOR IMPLEMENTATION  
Format ID: `r4b1t-trail/v0.3`  
Canonical profile: [CJ-1](./CANONICAL_JSON_CJ1.md)  
Selection transaction: [r4b1t-selection-transaction/v2](../SELECTION_TRANSACTION_V2.md)

Trail v0.3 is the ROLL/reproducible-trail successor format described by ADR 0004. It does not replace Blind Descent v0.2 and does not change the bytes or claims of historical v0.1 artifacts.

## 1. Boundary

v0.3 records **steps**, not a trail-wide terrain.

A step says how that route entered the recorded path:

- `ROLL` — sampler-derived route with the complete immutable selection transaction.
- `SELECT` — explicit non-sampler route selection. No sampler provenance is implied.
- `BRANCH` — navigation from an earlier recorded step. The recorded branch label is descriptive evidence only; v0.3 does not prove the semantics of the branch algorithm.
- `IMPORTED` — route copied from an older or parent artifact. Imported steps never inherit sampler provenance merely because the source artifact once contained a ROLL.

The top-level manifest contains no `terrain`, `sampler`, or `seed`. Those facts live only on the ROLL transaction that actually used them.

## 2. Manifest

```json
{
  "format": "r4b1t-trail/v0.3",
  "created_at": "2026-10-01T18:30:00.000Z",
  "corpus_revision": "sha256:...",
  "steps": [],
  "parent": null
}
```

Exact top-level keys are required.

- `created_at` is an exact ISO timestamp.
- `corpus_revision` is a `sha256:` identifier.
- `steps` are contiguous and 1-based.
- `parent` is `null` or `{ trail_id, fork_at }`.
- Manifest identity is `sha256(CJ-1(manifest))`.

The envelope is exactly:

```json
{
  "trail_id": "sha256:...",
  "manifest": {}
}
```

## 3. Route identity

Every step contains:

```json
{
  "route": {
    "route_id": "sha256:...",
    "url": "https://..."
  }
}
```

`route_id` remains the existing v0.1 route identifier:

```text
sha256("r4b1t-route/v0.1\n" || url)
```

v0.3 does not introduce a new route namespace.

## 4. ROLL

A ROLL step is exactly:

```json
{
  "index": 1,
  "kind": "ROLL",
  "route": { "route_id": "sha256:...", "url": "https://..." },
  "transaction": { "...": "r4b1t-selection-transaction/v2" }
}
```

The verifier requires:

1. transaction version `r4b1t-selection-transaction/v2`;
2. action `ROLL`;
3. transaction corpus revision equals the manifest corpus revision;
4. transaction route URL equals the step route URL;
5. exact v2 constraint, terrain-index, protocol-policy, eligible-count and sampler shapes;
6. local ROLL sequences are contiguous from 1;
7. local sampler `draw_start` begins at 0 and advances by the preceding `draw_count`;
8. one seed is used by all local ROLLs in the manifest;
9. the first local ROLL has `repeat_guard.reference = null`;
10. later local ROLLs reference the previous local ROLL URL, even if SELECT or BRANCH steps occur between them.

These rules establish internal recorded continuity. They do **not** independently prove that the selected URL could have been produced by the declared sampler. Independent sampler re-execution is a later verifier layer.

## 5. SELECT

```json
{
  "index": 2,
  "kind": "SELECT",
  "route": { "route_id": "sha256:...", "url": "https://..." }
}
```

SELECT records explicit non-random navigation. It has no sampler field and must not inherit ROLL provenance.

## 6. BRANCH

```json
{
  "index": 3,
  "kind": "BRANCH",
  "route": { "route_id": "sha256:...", "url": "https://..." },
  "navigation": {
    "from_step": 2,
    "branch_label": "SIDEWAYS"
  }
}
```

`from_step` must point to an earlier step in the same manifest.

`branch_label` preserves the label presented by the product. v0.3 does not claim that the label is an independently verified semantic classification. Branch determinism and authority are handled separately.

## 7. IMPORTED

```json
{
  "index": 1,
  "kind": "IMPORTED",
  "route": { "route_id": "sha256:...", "url": "https://..." },
  "source": {
    "format": "r4b1t-trail/v0.1",
    "trail_id": "sha256:...",
    "step_index": 1
  }
}
```

An imported route carries source identity only. It never receives a synthetic ROLL transaction.

The v0.1 importer verifies the original v0.1 artifact first, then emits IMPORTED steps. The resulting v0.3 artifact is a new artifact with its own ID; the original v0.1 bytes and ID remain unchanged.

## 8. Parent / fork lineage

A child declares:

```json
{
  "parent": {
    "trail_id": "sha256:...",
    "fork_at": 1
  }
}
```

The first `fork_at` child steps must be IMPORTED from the declared parent, with matching source trail ID and source step indexes.

For v0.3 → v0.3 lineage, `verifyLineage` additionally requires every inherited route to equal the corresponding verified parent route.

The child sampling scope starts fresh after the imported prefix:

- first child-local ROLL sequence = 1;
- first child-local ROLL `draw_start = 0`;
- first child-local repeat-guard reference = `null`.

This matches the trail-scoped continuity decision in Selection Transaction v2.

## 9. Verification states and limits

Base v0.3 verification establishes:

- strict shape;
- CJ-1 canonical admissibility;
- route ID consistency;
- envelope/trail ID integrity;
- exact ROLL transaction structure;
- local transaction/sampler interval continuity;
- explicit navigation/import typing;
- v0.3 parent-route lineage when the parent is supplied.

It does **not** by itself establish:

- that a declared seed was honestly generated;
- that a route was actually produced by Mulberry32;
- that terrain membership was authoritative for the declared release;
- BRANCH semantic correctness;
- wall-clock ordering;
- human viewing or interaction.

Those are separate, bounded verification layers.

## 10. Compatibility

- v0.1 remains byte-for-byte and ID-for-ID unchanged.
- v0.2 Blind Descent remains unchanged.
- v0.1 import creates a new v0.3 artifact made only of IMPORTED steps.
- Production export remains v0.1 until the separate runtime migration PR.
