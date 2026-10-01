# R4B1T H0L3 Terrain Authority Contract v1

Status: DRAFT FOR IMPLEMENTATION
Decision record: `docs/adr/0006-release-bound-terrain-authority.md`

| Item | Name |
|---|---|
| Index schema | `r4b1t-terrain-index-v1` |
| Registry schema | `r4b1t-eligibility-profiles-v1` |
| Runtime API | `R4b1tTerrainAuthority` (`terrain-authority.js`) |
| Eligibility core | `R4b1tSelectionCore` (`selection-core.js`) |

> Terrain membership is a digest-bound artifact compiled from release bytes. It is authoritative only through the eligibility profile registry. Nothing rendered, fetched after load, or observed during a session can change which routes a terrain contains.

## 1. Authority chain

```text
corpus/runtime/active-v1.json                                   (unchanged promotion: active release)
  └─ corpus/runtime/eligibility-profiles-v1.json                 (active profile for that release + expected digest)
       └─ corpus/terrains/typed-candidate-v0.1/terrain-index-v1.json   (bytes; SHA-256 must equal the expected digest)
            └─ R4b1tTerrainAuthority.loadIndex()  →  captureSelectionConstraint()  →  R4b1tSelectionCore.eligiblePool()  →  sampler
```

**Not in the chain:**
- the `index.html` hostname table
- `resources.json` loaded at runtime
- button text or style
- OG and Wikipedia metadata
- session history, wear, popularity
- any digest declared inside a trail

## 2. Terrain index (`corpus/terrains/<release_id>/terrain-index-v1.json`)

**Bytes.** Exactly `CJ-1(document) + "\n"`, UTF-8 (`docs/CANONICAL_JSON_CJ1.md`). The digest is the SHA-256 of the exact file bytes, written `sha256:<hex>`.

```json
{
  "schema": "r4b1t-terrain-index-v1",
  "release": { "release_id": "…", "urls_digest": "sha256:…", "resources_digest": "sha256:…" },
  "vocabulary": "resource-type-identity-v1",
  "terrains": [ { "id": "dataset", "label": "DATASET", "rule": { "resource_type": ["dataset"] }, "count": 22, "members": [43, 831] } ]
}
```

**Constraints**
- Key sets are exact.
- `terrains` is sorted by `id` ascending (code point). Order carries no meaning and is never by count.
- `id` matches `^[a-z][a-z0-9_]*$`, is unique, and `all` is reserved.
- `label` is `id` with `_` replaced by a space, uppercased.
- Under `resource-type-identity-v1`, `rule.resource_type` is exactly `[id]`.
- `members` are strictly ascending integers in `[0, N)`, where N is the number of `urls.txt` lines. They are exactly the positions whose `resource_type` is in the rule.
- `count == members.length ≥ 1`. The builder fails rather than emit a dry terrain.

## 3. Builder (`tools/terrain_index.py`)

**Inputs must pass, or the build fails:**
1. The manifest `urls_digest` and `resources_digest` equal the SHA-256 of the release bytes.
2. `urls.txt` is canonical:
   - strict UTF-8, LF only, a single trailing `\n`
   - no blank lines and no surrounding whitespace
   - every line starts with `http://` or `https://`
3. `resources.json` URL order equals `urls.txt` order.
4. Every `resource_type` matches the ID pattern and is not `all`.

**Modes**

| Mode | Purpose |
|---|---|
| `build --release <dir> --out <file>` | write the index |
| `check --release <dir> --index <file>` | byte-identical regeneration (CI) |
| `classify --registry <file> --urls-digest <d> --index-digest <d>` | §4 classification |

## 4. Eligibility profile registry (`corpus/runtime/eligibility-profiles-v1.json`)

```json
{
  "schema": "r4b1t-eligibility-profiles-v1",
  "profiles": [
    {
      "profile_id": "typed-candidate-v0.1/resource-type-identity-v1",
      "status": "active",
      "release": { "release_id": "typed-candidate-v0.1", "urls_digest": "sha256:…", "resources_digest": "sha256:…" },
      "promotion_id": "typed-candidate-v0.1-active-v1",
      "mapping": "resource-type-identity-v1",
      "terrain_index": { "path": "corpus/terrains/typed-candidate-v0.1/terrain-index-v1.json", "schema": "r4b1t-terrain-index-v1", "digest": "sha256:…" }
    }
  ]
}
```

**Rules**
- Append-only. Entries are never removed or rewritten; a replaced profile changes `status` to `superseded`.
- At most one `active` profile per `release.release_id`.
- The active profile for the active promotion's release must match the pinned constants in `terrain-authority.js` and the actual file bytes. `claims:verify` checks this.

**`classifyBinding(registry, urlsDigest, indexDigest)`**

| Result | Condition |
|---|---|
| `AUTHORITATIVE_ACTIVE` | the release and digest match a profile whose status is `active` |
| `AUTHORITATIVE_SUPERSEDED` | the release and digest match a profile whose status is `superseded` |
| `UNREGISTERED_MAP` | profiles exist for the release, but none has this digest |
| `UNREGISTERED_RELEASE` | no profile exists for the release |

A trail-declared digest is evidence of *use*. Only this classification establishes *authority*.

## 5. Runtime API (`R4b1tTerrainAuthority`)

**Members**
- `schema = 'r4b1t-runtime-terrain-authority-v1'`
- `profile()`: frozen pinned constants
- `status()`: `{ state: 'LOADING' | 'READY' | 'UNAVAILABLE', reason }`
- `loadIndex()`: one page-session load
- pure helpers: `validateIndexDocument`, `terrainControlState`, `classifyBinding`

**`loadIndex()` checks, in order** (the first failure becomes the reason code)
1. Fetch the pinned path with `cache: 'no-store'`. Failure gives `TERRAIN_INDEX_UNAVAILABLE`.
2. The SHA-256 of the exact bytes equals the pinned digest. Failure gives `TERRAIN_INDEX_DIGEST_MISMATCH`.
3. Strict UTF-8, JSON, and CJ-1 re-serialization plus `"\n"` reproduce the bytes. Failure gives `TERRAIN_INDEX_NOT_CANONICAL`.
4. `release.*` equals `R4b1tCorpusAuthority.active()`. Failure gives `TERRAIN_INDEX_BINDING_MISMATCH`.
5. The §2 constraints hold against the verified active URL count. Failure gives `TERRAIN_INDEX_INVALID`.

**On failure:** UNAVAILABLE. There is no fallback to the hostname table and no retry loop. ALL remains available.

## 6. Constraint, eligibility, states

**Constraint.** `captureSelectionConstraint()` returns the constraint defined in `SELECTION_TRANSACTION_V2.md` §2. It reads one explicit terrain state variable and the protocol policy only.

**Eligibility.** `R4b1tSelectionCore.eligiblePool(activeUrls, index, constraint)` implements ADR 0006 §4.

**Displayed count.** The count shown for each terrain is `eligiblePool(activeUrls, index, {terrain, protocolPolicy: current}).length`. It is shown before ROLL on:
- desktop terrain controls
- mobile filter proxies
- the mobile ROLL scope

ALL shows its own count.

**Small-pool notes**

| Count | Note | Disclosed meaning |
|---|---|---|
| 1 | `SINGLE ROUTE` | ROLL always returns that route |
| 2 | `ALTERNATES` | the immediate-repeat guard forces alternation after the first draw |

**States**

| State | Condition | Required behavior |
|---|---|---|
| LOADING | index not verified yet | typed terrains not shown as armable; ALL armable |
| READY | index verified | typed terrains armable when count > 0 |
| UNAVAILABLE | verification failed | no typed terrain controls; status `TERRAIN AUTHORITY UNAVAILABLE · <code>`; ALL armable |
| DRY | READY and count == 0 | `disabled`, `aria-disabled="true"`, reason `0 ELIGIBLE`; cannot be armed |
| EMPTY | armed terrain has 0 eligible routes at commit | no sampler draw, no transaction, no history; status `NO ELIGIBLE ROUTES IN <LABEL> UNDER CURRENT PROTOCOL POLICY`; terrain stays armed |
| AUTHORITY UNAVAILABLE | commit invoked without the trail selection authority | no selection; status `SELECTION AUTHORITY UNAVAILABLE` |

**Representation**
- Controls expose `data-terrain-id`, `data-terrain-label`, `data-eligible-count` and `aria-pressed`.
- Mobile proxies read these attributes, never `style`.
- Selection status is published on `#rollStatus` and as the `r4b1t:selection-status` document event.

## 7. Network and offline

- The index is fetched once per page session from the same origin.
- No third-party request is added.
- `resources.json` timing is unchanged.
- `sw.js` treats `/corpus/terrains/` as network-only corpus evidence.

## 8. Non-goals

- No ranking or ordering by count.
- No inferred terrain.
- No change to:
  - the ALL population
  - the sampler or repeat-guard semantics
  - Blind Descent
  - the promotion record
  - `corpus-authority.js`
