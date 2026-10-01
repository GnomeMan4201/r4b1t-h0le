# ADR 0006: Release-bound terrain authority

Status: Proposed

## Context

Terrain is the user-declared eligibility constraint permitted by CONTRACT clause 8 and ADR 0001 §2.

On `main` @ `c29d6bd`, terrain membership is decided by a hostname→tag table embedded in `index.html` (`O`, 43 hosts) and applied by `_getCatFilteredPool()`. Measured on the running page against the promoted `typed-candidate-v0.1` URL bytes:

- **12 of 16 terrains select nothing:** BLOG, NEWS, PAPER, OSINT, BOUNTY, VIDEO, SOCIAL, ARCHIVE, PKG, EVENT, HARDWARE and TOR. ROLL returns `null` and the UI does not change.
- **Two terrains are nearly empty:** RESEARCH has 2 routes and COURSE has 1. 318 of 841 routes are reachable only under ALL.
- **Membership cannot be recomputed.** The terrain behind a recorded ROLL cannot be derived from repository or release bytes, because the table lives in application code.
- **The armed terrain is read from styles.** `trail-runtime.js terrain()` and `dual-shell.js sourceFilterIsActive()` derive it from button *style* attributes.

Each release route already carries an explicit, provenance-backed `resource_type` in `resources.json`. But `POST_SELECTION_RESOURCE_METADATA_CONTRACT.md` forbids runtime metadata from feeding eligibility and forbids loading `resources.json` before a reveal. `CORPUS_RELEASE_CONTRACT.md` fixes a release directory to exactly three CI byte-checked files.

## Decision

### 1. Terrain membership is a compiled, digest-bound artifact

`corpus/terrains/<release_id>/terrain-index-v1.json` (schema `r4b1t-terrain-index-v1`) is compiled deterministically by `tools/terrain_index.py` from the release's own `urls.txt` and `resources.json`.

- Members are zero-based line positions in `urls.txt`, ascending, so release order is preserved.
- The file bytes are `CJ-1(document) + "\n"` (`docs/CANONICAL_JSON_CJ1.md`).
- The release directory and its manifest are not modified.

### 2. Authority anchor: the eligibility profile registry

A terrain index is reproducible from release bytes, but reproducible does not mean authoritative. A digest written into a selection transaction proves *which* map was used. It does not prove that the map was the project's authoritative mapping for that release.

Authority is anchored in a committed, version-controlled registry, `corpus/runtime/eligibility-profiles-v1.json` (schema `r4b1t-eligibility-profiles-v1`). It is keyed by release and records for each profile:

- profile ID and status (`active` or `superseded`)
- release ID, URL digest and resources digest
- the promotion it applies to
- mapping semantics ID
- terrain index path, schema and expected digest

Profile records are never deleted, and their binding fields are immutable. The only permitted lifecycle mutation is `status: active → superseded`, with at most one active profile per release (`TERRAIN_AUTHORITY_CONTRACT.md` §4).

The authority chain is:

```text
corpus/runtime/active-v1.json                    active release: typed-candidate-v0.1, urls sha256:5bb70a72…
  └─ corpus/runtime/eligibility-profiles-v1.json  active profile for that release + expected terrain-index digest
       └─ corpus/terrains/typed-candidate-v0.1/terrain-index-v1.json   bytes whose SHA-256 must equal that digest
            └─ eligible set = members(terrain) → urls.txt lines, then protocol policy
```

This follows the existing corpus authority model exactly:
- `active-v1.json` is a committed record.
- `corpus-authority.js` pins its constants rather than fetching it.
- `claims:verify` proves the pins match the record.

The new chain mirrors each step:
- `terrain-authority.js` pins the active profile.
- `claims:verify` proves `active-v1.json` → registry → pins → file bytes agree.
- `tools/terrain_index.py --check` proves the bytes regenerate from the release.

**Verifiers never trust a digest supplied inside a trail.** `classifyBinding(registry, release, index_digest)` (JS, in `terrain-authority.js`; Python, in `tools/terrain_index.py classify`) takes the complete release binding (`release_id`, `urls_digest`, `resources_digest`) and returns one of four results:

| Result | Meaning |
|---|---|
| `AUTHORITATIVE_ACTIVE` | the map is the registry's active profile for that release |
| `AUTHORITATIVE_SUPERSEDED` | the map was registered for that release, and is no longer active |
| `UNREGISTERED_MAP` | the complete release binding is known, but this map was never registered for it. The trail can be reproducible and still not authoritative |
| `UNREGISTERED_RELEASE` | no profile has that complete release binding (ID, URL digest and resources digest) |

The promotion record `active-v1.json`, `corpus-authority.js` (`r4b1t-runtime-corpus-authority-v3`) and the active population are unchanged. A later promotion format may absorb the profile reference; until then, the registry is the single anchor.

### 3. First vocabulary: `resource-type-identity-v1`

One terrain per distinct `resource_type` present in the release, with no grouping or renaming:

| ID | Label | Routes |
|---|---|---|
| dataset | DATASET | 22 |
| documentation | DOCUMENTATION | 1 |
| lab | LAB | 10 |
| reference | REFERENCE | 123 |
| repository | REPOSITORY | 470 |
| security_tool | SECURITY TOOL | 203 |
| training_resource | TRAINING RESOURCE | 12 |

The 16 legacy labels are retired. `ALL` remains the unconstrained state and is not a terrain.

**Why identity**
- There is no editorial step.
- Membership is a one-line recomputation.
- A dry terrain is impossible by construction.
- Tiny terrains are corpus facts, shown rather than hidden.

Grouping can be introduced later as a new mapping with a new registry entry.

### 4. Eligibility

```text
eligible(constraint) = (terrain == ALL ? activeUrls : members.map(i => activeUrls[i])), then remove '.onion' URLs if excludeOnion
```

`activeUrls` is the digest-verified, immutable array from `R4b1tCorpusAuthority.loadActive()`. Nothing else participates.

### 5. The runtime loads and verifies the index before typed terrains can be armed

- **Index checks:** the exact bytes must match the pinned digest, re-serialize under CJ-1, bind to the active release, and be structurally valid.
- **No metadata before reveal:** the runtime still never requests `resources.json` before a reveal. `resource_type` reaches eligibility only through the compiled index.
- **On failure:** typed terrains are UNAVAILABLE and ALL remains available. There is no fallback to the hostname table.

### 6. Selection transaction v2 (`SELECTION_TRANSACTION_V2.md`)

The in-memory ROLL transaction additionally records:
- the terrain index binding
- the eligible count
- the repeat-guard reference **that was actually used**

Recording does not change behavior.

### 7. Explicit states

These replace silent no-ops:

| State | Meaning |
|---|---|
| LOADING | terrain index not yet verified |
| READY | index verified; typed terrains armable |
| UNAVAILABLE | index verification failed |
| DRY | a terrain with 0 eligible routes, which cannot be armed |
| EMPTY | an armed terrain with 0 eligible routes at commit time: no draw, no transaction, visible message, terrain stays armed |
| AUTHORITY UNAVAILABLE | ROLL attempted without the trail selection authority: no selection. This removes `ee`'s `Math.random` fallback |

### 8. Small pools stay on the existing sampler contract, and are disclosed

`uniform-with-repeat-guard-v1` is unchanged. Its consequences are now visible:

| Eligible routes | Behavior | UI note |
|---|---|---|
| 1 | deterministic | `SINGLE ROUTE` |
| 2 | the immediate-repeat guard forces strict alternation after the first draw | `ALTERNATES` |

Changing that behavior requires a new sampler version and its own ADR. It is not part of this decision.

### 9. The hostname tag badge is no longer a terrain vocabulary

The result badge derived from the hostname table now reads `SITE HINT · <tag>`, with an explicit non-authoritative description. It has no selection role.

## Not decided here

- Grouped vocabularies.
- Blind Descent terrain: unchanged; full corpus, genesis terrain `ALL SIGNALS`.
- Branch candidate authority (ADR 0008).
- Trail-scoped repeat guard, sampler cursor and sequence restore, and recording of repeated committed ROLLs. These are a dedicated sampler-continuity change (PR 1b), kept separate from eligibility.

## Verification

| Check | Proves |
|---|---|
| `tools/terrain_index.py --check` (CI) | the bytes regenerate from release data |
| `tests/terrain-authority.test.js` | an independent recompute from `resources.json` equals the index; the authority chain agrees; classification |
| `tests/terrain-eligibility.spec.js` | production eligibility equals index membership for every terrain; counts are visible; DRY, EMPTY and UNAVAILABLE states; ALL parity with `main` |
| `claims:verify` | promotion → registry → pins → bytes |
