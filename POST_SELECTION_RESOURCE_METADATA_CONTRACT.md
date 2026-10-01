# R4B1T H0L3 Post-Selection Resource Metadata Contract v1

Status: DRAFT FOR IMPLEMENTATION

## Purpose

The promoted typed corpus contains verified display metadata for every active
resource:

- `resource_type`;
- `eligibility_reason`;
- provenance record identifier.

That metadata can make a revealed result more useful, but it MUST NOT acquire
selection authority.

RD-4M therefore introduces a separate, digest-bound metadata load that begins
only after a route has already crossed the reveal boundary.

## Source

Active metadata bytes:

```text
corpus/releases/typed-candidate-v0.1/resources.json
SHA-256: sha256:2c7bd5f0a492646cb5cc250b426ed720f1e0953615172717f562379e88eeb691
records: 841
```

The metadata digest is the exact `resources_digest` from the checked-in release
manifest.

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

1. fetch the active `resourcesUrl` with `cache: no-store`;
2. hash the exact response bytes;
3. require the active source's exact expected resources digest;
4. decode strict UTF-8;
5. parse schema `r4b1t-corpus-resources-v1`;
6. require release ID `typed-candidate-v0.1`;
7. require exactly 841 unique URL records;
8. require each metadata URL to exist in the verified active URL set;
9. expose immutable URL-keyed records;
10. cache the successful metadata load for the page session.

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
