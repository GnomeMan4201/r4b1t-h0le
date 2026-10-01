# Strange corpus runtime promotion v1

Status: PROPOSED FOR THIS CUTOVER

This promotion activates the exact checked-in `strange-candidate-v0.3` release. It does not rewrite the historical candidate manifest: the release artifact remains `status: candidate` with `selection_authority: false`. Runtime authority is granted separately by `corpus/runtime/active-v1.json`.

## Exact authority

Active release:

- release ID: `strange-candidate-v0.3`
- resources: **6,975**
- unique hosts: **345**
- resource types: **14**
- URL digest: `sha256:f85a1c710977814c920ff13eb95cf0b86805486668c99dba2d5024d6b1bda3a7`
- metadata digest: `sha256:347bf83b013e3eec3aff9301863c6cd3acb62d62db6d39e5fa8c27f4c814dee1`
- promotion ID: `strange-candidate-v0.3-active-v1`

The runtime must reject missing or mismatched bytes. No silent fallback is introduced.

## Terrain authority

The promotion is paired with:

- profile: `strange-candidate-v0.3/resource-type-identity-v1`
- terrain index: `corpus/terrains/strange-candidate-v0.3/terrain-index-v1.json`
- terrain-index digest: `sha256:8282156e330ef423acfba8304e4f7419e6d978d7441ef7e5f146a76b9f6b5a00`

The prior `diverse-candidate-v0.2/resource-type-identity-v1` profile becomes `superseded`; it remains in the registry as historical authority evidence.

The 14 active terrain populations are:

| Terrain | Routes |
| --- | ---: |
| advisory | 43 |
| article | 24 |
| challenge | 8 |
| dataset | 22 |
| documentation | 1,408 |
| lab | 283 |
| paper | 913 |
| reference | 897 |
| repository | 470 |
| research | 1,605 |
| security_tool | 212 |
| threat_feed | 6 |
| training_resource | 12 |
| writeup | 1,072 |

They partition the complete release. No active route is reachable only through ALL.

## Selection semantics

This cutover changes the population and therefore fixed-seed outcomes. It does not change:

- the `uniform-with-repeat-guard-v1` sampler;
- `mulberry32-v1`;
- the trail-scoped immediate-repeat guard;
- ROLL transaction v2 semantics;
- Trail v0.3 serialization or verification;
- Blind Descent semantics;
- anti-ranking or no-personalization boundaries.

The new `challenge` terrain exists because `challenge` is a resource type in the promoted release. Resource counts are eligibility facts, never weights.

## Persisted-state cutover

The active corpus revision changes from the v0.2 URL digest to the v0.3 URL digest. Existing runtime revision guards therefore reset saved draft/genesis state whose bound corpus revision is no longer active. Imported older artifacts remain inspectable under their own recorded revision; they do not gain authority under the new release.

## Rollback

The runtime's explicit rollback descriptor remains `legacy-urls-v1`, as defined by the existing runtime authority contract. A rollback is an explicit authority change; no runtime failure may silently activate rollback bytes.

The superseded v0.2 release and terrain profile remain checked in as historical evidence and may be inspected independently.

## Acceptance

Before merge, verification must establish:

1. the active descriptor names `strange-candidate-v0.3`;
2. exact URL and metadata bytes match the release digests;
3. the active URL count is 6,975;
4. the active terrain index regenerates byte-identically from the release;
5. the active registry profile binds the full release and terrain-index digest;
6. all 14 terrain counts equal the release manifest;
7. every active route belongs to exactly one terrain;
8. fixed-seed ALL behavior matches the v0.3 promotion fixture;
9. ROLL, Trail and Blind share the new active corpus revision;
10. the release manifest itself remains non-authoritative;
11. no automatic fallback is introduced;
12. the full repository and browser suites are green.

## Evidence limit

Promotion establishes which checked-in bytes the runtime may select from. It does not certify the safety, truth, availability, ownership or quality of any external destination.
