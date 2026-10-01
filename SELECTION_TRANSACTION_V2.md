# Selection Transaction v2

Status: DRAFT FOR IMPLEMENTATION
Schema ID: `r4b1t-selection-transaction/v2`
Implements ADR 0004 (immutable selection transaction authority) and ADR 0006.

The transaction is built in memory at the ROLL commit boundary. It is first exported by a later trail format. Until then it is persisted only inside local trail drafts.

> A ROLL transaction binds every input that decided its route before the route is exposed.

## 1. Changes from v1

| Added | Why |
|---|---|
| `constraint.terrainIndex` | binds the exact terrain index (schema + digest) that defined a typed terrain's membership |
| `eligible_count` | the eligible-set size at commit, so the odds can be stated without release bytes |
| `sampler.repeat_guard` | the immediate-repeat guard reference **actually used** by this draw, and its draw limit |

v1 is never exported. v1 objects already persisted in local drafts stay as they are.

## 2. Constraint

```json
{
  "terrain": "security_tool",
  "terrainIndex": { "schema": "r4b1t-terrain-index-v1", "digest": "sha256:8282156e330ef423acfba8304e4f7419e6d978d7441ef7e5f146a76b9f6b5a00" },
  "protocolPolicy": { "version": 1, "excludeOnion": false }
}
```

- `terrain` is `"ALL"` or a terrain ID from the bound index.
- `terrainIndex` is `null` if and only if `terrain == "ALL"`.
- `protocolPolicy` is unchanged from RA-2A. The new key follows the same in-object casing.
- A digest here records *use*. Whether that index was authoritative for the release is decided only by the eligibility profile registry (`TERRAIN_AUTHORITY_CONTRACT.md` §4).

## 3. Transaction

```json
{
  "transaction_version": "r4b1t-selection-transaction/v2",
  "sequence": 1,
  "action": "ROLL",
  "constraint": { "…": "§2" },
  "corpus_revision": "sha256:f85a1c710977814c920ff13eb95cf0b86805486668c99dba2d5024d6b1bda3a7",
  "eligible_count": 212,
  "sampler": {
    "algorithm": "uniform-with-repeat-guard-v1",
    "prng": "mulberry32-v1",
    "seed": "…",
    "draw_start": 0,
    "draw_count": 1,
    "repeat_guard": { "reference": null, "max_draws": 30 }
  },
  "route": { "url": "https://…" }
}
```

**Field rules**

| Field | Rule |
|---|---|
| `eligible_count` | ≥ 1. An empty pool produces no transaction (EMPTY state) |
| `repeat_guard.reference` | the URL of the previous committed ROLL in the current trail sampling scope, or `null` at a new trail, reset, or fork. The reference is supplied by trail authority; page/session presentation state is not an input |
| `repeat_guard.max_draws` | 30 |

All other fields are unchanged from v1.

## 4. Sampler semantics

```text
pool = eligiblePool(activeUrls, index, constraint)           (release order)
repeat: t = pool[floor(nextFloat() * |pool|)]; n += 1  until t ≠ reference or n == 30
route = t ; draw_count = n
```

**Small pools** (disclosed in the UI per `TERRAIN_AUTHORITY_CONTRACT.md` §6):
- With `|pool| == 1`, the route is fixed. A non-null reference consumes 30 draws.
- With `|pool| == 2`, outcomes alternate after the first ROLL.

Both are properties of `uniform-with-repeat-guard-v1` and stay that way until a new sampler version is adopted.

## 5. Trail-scoped continuity

The local draft is the continuity authority for the current sampling scope.

- On reload, the runtime finds the latest persisted v2 ROLL transaction for the current seed, advances `mulberry32-v1` through `draw_start + draw_count`, restores the transaction sequence, and uses that ROLL's URL as the next repeat-guard reference.
- A new trail, RESET, or FORK starts a new sampling scope with `draw_start = 0`, sequence 1, and `repeat_guard.reference = null`.
- Inherited fork-prefix routes do not become the repeat-guard reference for the child scope.
- Every committed ROLL is persisted, including a one-route or max-draw result that repeats the previous URL. Consecutive presentation-only selections may still be deduplicated.
- Historical draft routes without a v2 selection transaction are not assigned invented sampler provenance.

The page-level `s.last` value may remain presentation/bookkeeping state, but `uniform-with-repeat-guard-v1` does not read it.
