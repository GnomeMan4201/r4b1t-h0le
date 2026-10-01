# R4B1T H0L3 Typed Corpus Promotion Contract v1

Historical contract for the initial 841-resource promotion. The current cutover
is documented in [CORPUS_EXPANSION_PROMOTION_V1.md](docs/CORPUS_EXPANSION_PROMOTION_V1.md).

Status: IMPLEMENTED FOR INITIAL TYPED PROMOTION
Promotion schema: `r4b1t-runtime-corpus-promotion-v1`

## Decision

Promote the exact checked-in `typed-candidate-v0.1` URL bytes to production
runtime selection authority.

This is a runtime-policy decision. It does not mutate the historical release
artifact that was built and reviewed as a candidate.

## Active source

The promoted active source is:

```text
source id: typed-candidate-v0.1
URL: corpus/releases/typed-candidate-v0.1/urls.txt
SHA-256: sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1
resources: 841
```

The source is active only when its exact bytes match that digest.

## Separation of artifact and authority

The checked-in release manifest remains:

```json
{
  "release_id": "typed-candidate-v0.1",
  "status": "candidate",
  "selection_authority": false
}
```

That field records the authority held by the release artifact at construction.

Runtime authority is granted separately by:

```text
corpus/runtime/active-v1.json
```

The promotion record therefore explicitly preserves both facts:

- release artifact selection authority: false;
- runtime active-source selection authority: true.

No release evidence is rewritten to manufacture retrospective authority.

## Rollback source

Legacy `urls.txt` remains in the repository as rollback material:

```text
source id: legacy-urls-v1
SHA-256: sha256:5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41
```

It is no longer active after this promotion.

Rollback is an explicit future authority change. Runtime MUST NOT silently fall
back to legacy bytes if the typed source is unavailable or fails digest
verification.

## Runtime authority API

`R4b1tCorpusAuthority` advances to
`r4b1t-runtime-corpus-authority-v3`.

Required descriptors:

- `active()` — promoted typed source, `selectionAuthority: true`;
- `candidate()` — original typed release assertion,
  `selectionAuthority: false`;
- `legacy()` — rollback descriptor, `selectionAuthority: false`;
- `promotion()` — immutable promotion identity.

`loadActive()` continues to provide one page-session, digest-verified corpus
load shared by ROLL, Blind Descent, and Trail.

## Persisted state migration

RD-4K rules apply at cutover.

On first load after promotion:

- a stamped Trail draft whose revision is the legacy digest resets;
- an unstamped historical Trail draft resets because active source is no
  longer `legacy-urls-v1`;
- a saved Blind genesis with the legacy revision resets;
- imported foreign/legacy Trail artifacts may still be inspected/replayed;
- a foreign/legacy Trail artifact cannot fork into the typed active corpus.

## Selection proof

Production acceptance must prove, without request interception:

1. active authority ID is `typed-candidate-v0.1`;
2. exactly the checked-in candidate URL bytes are loaded;
3. active revision equals sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1;
4. active route count is 841;
5. primary ROLL selects a URL contained in the promoted release;
6. Trail revision equals the promoted digest;
7. Blind revision equals the promoted digest;
8. no production request is made to legacy `urls.txt`.

## CF-1 fixture

CF-1's test-only corpus fixture must patch the currently active expected digest
and fulfill the currently active corpus path.

The fixture must not depend on legacy being active.

## No fallback / no weighting

Promotion does not add:

- ranking;
- recommendation;
- popularity;
- personalization;
- provenance-derived weighting;
- silent fallback.

Selection remains uniform over the eligible active pool subject only to the
existing explicit runtime constraints.

## Final invariant

> The exact 841-resource typed release is the sole active production corpus;
> legacy remains explicit rollback material, not a hidden fallback.
