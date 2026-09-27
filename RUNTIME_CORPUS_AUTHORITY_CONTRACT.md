# R4B1T H0L3 Runtime Corpus Authority Contract v2

Status: DRAFT FOR IMPLEMENTATION  
Runtime API: `R4b1tCorpusAuthority`

## Purpose

One page session must have one active corpus byte sequence, one verified corpus
revision, and one parsed route set shared by ROLL, Blind Descent, and Trail.

The runtime authority owns that load. Consumers do not independently fetch or
hash corpus files.

RD-4J keeps the legacy corpus active. It only strengthens the authority seam
ahead of a later reviewed promotion.

## Active legacy source

```json
{
  "id": "legacy-urls-v1",
  "url": "urls.txt",
  "expectedDigest": "sha256:5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41",
  "status": "active",
  "selectionAuthority": true
}
```

## Typed candidate

```json
{
  "id": "typed-candidate-v0.1",
  "url": "corpus/releases/typed-candidate-v0.1/urls.txt",
  "resourcesUrl": "corpus/releases/typed-candidate-v0.1/resources.json",
  "manifestUrl": "corpus/releases/typed-candidate-v0.1/manifest.json",
  "expectedDigest": "sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1",
  "status": "candidate",
  "selectionAuthority": false
}
```

Candidate metadata remains informational and non-authoritative in this slice.

## Shared active load

`loadActive()` is the only production corpus-byte loader.

On first call it:

1. fetches the active source with `cache: no-store`;
2. reads exact response bytes;
3. computes SHA-256 over those bytes;
4. compares the digest to `active().expectedDigest`;
5. fails closed on mismatch;
6. decodes the bytes as UTF-8;
7. derives the non-empty HTTP(S) route list;
8. returns an immutable object containing:
   - `source`;
   - `revision`;
   - `urls`;
   - exact byte length.

The successful promise is cached for the page session. Concurrent or later
consumers receive the same result object without another corpus request.

A failed load clears the cached promise so an explicit retry may re-fetch, but
no consumer silently falls back to another source.

## Required consumers

- primary ROLL populates its selection pool from `loadActive().urls`;
- Blind Descent uses `loadActive().urls` and
  `loadActive().revision`;
- Trail uses `loadActive().revision`.

Those consumers MUST NOT call `fetch()` for the corpus themselves.

## Revision semantics

`revision` is the SHA-256 digest of the exact active corpus bytes.

The query string used for transport/cache busting is not part of corpus
identity.

## Fail closed

A response error, digest mismatch, invalid UTF-8, or empty usable route set
rejects `loadActive()`.

The authority does not fall back to legacy or candidate bytes after a failure.

## No promotion in RD-4J

This contract does not change:

- active source ID;
- active URL;
- production selection distribution;
- category filtering;
- Blind Descent semantics;
- replay semantics;
- candidate release metadata.

The typed candidate remains `selectionAuthority: false`.

## Final invariant

> ROLL, Blind Descent, and Trail consume one verified active corpus load and
> therefore share one corpus revision by construction.
