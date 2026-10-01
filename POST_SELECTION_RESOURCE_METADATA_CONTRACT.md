# R4B1T H0L3 Post-Selection Resource Metadata Contract v1

Status: DRAFT FOR IMPLEMENTATION

## Purpose

The active promoted corpus contains verified display metadata for every active
resource:

- `resource_type`;
- `eligibility_reason`;
- provenance record identifier.

That metadata can make a revealed result more useful, but it MUST NOT acquire
selection authority.

RD-4M therefore introduces a separate, digest-bound metadata load that begins
only after a route has already crossed the reveal boundary.

## Source

The metadata source is not a fixed file. It is whatever the active runtime
corpus authority names. This contract never pins a release, digest or count;
those values live only in the promotion record and the runtime authority that
mirrors it.

```text
corpus/runtime/active-v1.json            active promotion (promotion_id, active.release_id)
  └─ R4b1tCorpusAuthority.active()       activeSource, pinned to that promotion
       ├─ releaseId                      must equal resources.json `release_id`
       ├─ resourcesUrl                   corpus/releases/<releaseId>/resources.json
       ├─ expectedResourcesDigest        = the release manifest's `resources_digest`
       ├─ expectedResourceCount          = the release manifest's `counts.resources`
       └─ resources.json bytes           SHA-256 must equal expectedResourcesDigest
```

`claims:verify` proves the chain: the runtime authority's active source equals
the promotion record, its digests and count equal the release manifest, and the
checked-in `resources.json` bytes hash to `expectedResourcesDigest`. Promoting a
new release changes the record and the runtime pins. It does not change this
contract.

## Selection boundary

Primary selection remains:

```text
verified urls.txt ─┐
                   ├─> declared terrain (membership from the verified, registry-anchored terrain-index-v1) -> protocol policy -> sampler -> commit -> reveal
verified terrain-index-v1 (compiled at build time from release bytes) ─┘
```

Runtime-loaded resource metadata (`resources.json` through `loadResourceMetadata()`) is not an input to:

- eligible-pool construction;
- terrain filtering;
- random draw;
- repeat guard;
- commitment;
- Blind Descent commitment selection.

`resource_type` participates in eligibility **only** through the build-time compiled, digest-bound `terrain-index-v1` artifact. That artifact is authoritative through `corpus/runtime/eligibility-profiles-v1.json` (`TERRAIN_AUTHORITY_CONTRACT.md`, ADR 0006). It is verified before selection like `urls.txt`. It contains line positions, not metadata. The runtime never derives eligibility from metadata it loads.

The browser MUST NOT request `resources.json` merely by loading the app.

The first metadata request may occur only after a route has been selected and
revealed for presentation.

## Metadata loader

`R4b1tCorpusAuthority` exposes a post-selection metadata API.

A successful metadata load MUST:

1. obtain the active source through the corpus authority (`activeSource`, the
   same source as the verified active URL load), never from a hard-coded path;
2. fetch that active source's `resourcesUrl` with `cache: no-store`;
3. hash the exact response bytes;
4. require the digest to equal `activeSource.expectedResourcesDigest`;
5. decode strict UTF-8;
6. require schema `r4b1t-corpus-resources-v1`;
7. require `parsed.release_id === activeSource.releaseId`;
8. require `parsed.resources.length === activeSource.expectedResourceCount`;
9. require every metadata URL to exist in the verified active URL set, with no
   duplicate URL and every active URL covered;
10. expose immutable URL-keyed records;
11. cache the successful metadata load for the page session.

A failed metadata load clears only the metadata-load promise. It MUST NOT clear,
replace, or invalidate the already verified active URL selection load.

## Result projection

For a revealed active route, the primary result MAY display:

- humanized resource type;
- humanized eligibility reason.

The Inspect surface MAY additionally display:

- full provenance identifier.

No title, summary, safety claim, quality claim, or recommendation may be
invented from these fields.

Examples:

```text
security_tool -> SECURITY TOOL
CONCRETE_SECURITY_TOOL -> CONCRETE SECURITY TOOL
```

## Missing or unavailable metadata

If the selected URL has no verified record, or metadata verification fails:

- the selected route remains selected;
- Trail recording remains valid;
- Visit / Replay / Blind semantics remain unchanged;
- metadata presentation stays hidden or explicitly unavailable.

Metadata failure never causes reroll or fallback.

## Stale async responses

If a second route is revealed before a previous metadata lookup completes, the
older response MUST NOT overwrite the newer route's presentation.

## Mobile projection

The mobile route card shows the verified resource type without replacing the
existing heuristic/source tag.

Mobile Route Info exposes separate fields for:

- resource type;
- eligibility reason;
- provenance.

These are projections of the same desktop source metadata nodes.

## Final invariant

> Selection decides the route first. Verified typed metadata may describe that
> already-selected route afterward. A route's type can define eligibility only
> through a registry-anchored terrain index compiled from release bytes; runtime
> metadata can never decide what gets selected.
