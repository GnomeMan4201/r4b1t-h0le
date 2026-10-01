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
  "terrainIndex": { "schema": "r4b1t-terrain-index-v1", "digest": "sha256:a9bbe4fc56020314a11195c9339fa3a04a14082d6b2f6c259c78be6ee38af5fd" },
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
  "corpus_revision": "sha256:ba52be7e2fc9120f3bd1ac2a6bacbc61fc937764e6d4637df8711ec2212bf75c",
  "eligible_count": 206,
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
| `repeat_guard.reference` | the URL the sampler compared against for this draw, or `null`. It reports the existing page-session guard (`s.last`) exactly; it does not change it |
| `repeat_guard.max_draws` | 30 |

All other fields are unchanged from v1.

## 4. Sampler semantics (unchanged)

```text
pool = eligiblePool(activeUrls, index, constraint)           (release order)
repeat: t = pool[floor(nextFloat() * |pool|)]; n += 1  until t ≠ reference or n == 30
route = t ; draw_count = n
```

**Small pools** (disclosed in the UI per `TERRAIN_AUTHORITY_CONTRACT.md` §6):
- With `|pool| == 1`, the route is fixed. A non-null reference consumes 30 draws.
- With `|pool| == 2`, outcomes alternate after the first ROLL.

Both are properties of `uniform-with-repeat-guard-v1` and stay that way until a new sampler version is adopted.

## 5. Out of scope

These sampler-continuity defects are reproduced and tracked for a dedicated change (PR 1b). They are not altered here:

| Defect | Description |
|---|---|
| S1 | the sampler cursor restarts at draw 0 after reload |
| S2 | the transaction sequence restarts after reload |
| S3 | a committed ROLL repeating the previous URL is not recorded in the draft |
| S4 | the guard reference is page state and survives reset and fork |
