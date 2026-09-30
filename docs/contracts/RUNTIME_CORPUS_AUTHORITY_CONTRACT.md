# R4B1T H0L3 Runtime Corpus Authority Contract v3

Status: DRAFT FOR IMPLEMENTATION  
Runtime API: `R4b1tCorpusAuthority`

## Active policy

Runtime selection authority is granted by
`corpus/runtime/active-v1.json`.

The active source is the exact checked-in `typed-candidate-v0.1` URL release:

- URL: `corpus/releases/typed-candidate-v0.1/urls.txt`
- expected SHA-256: `sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1`
- resource count: 841
- runtime selection authority: true

The release manifest remains historical evidence with
`selection_authority: false`; the separate promotion record is the authority
change.

## Rollback descriptor

Legacy `urls.txt` remains digest-bound rollback material:

- source: `legacy-urls-v1`
- SHA-256: `sha256:5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41`
- runtime selection authority: false

It is not an automatic fallback.

## API

The frozen runtime API exposes:

- `active()` — the promoted typed source;
- `candidate()` — the original non-authoritative release descriptor;
- `legacy()` — the non-authoritative rollback descriptor;
- `promotion()` — the immutable promotion identity;
- `loadActive()` — one page-session digest-verified load.

## Shared-byte invariant

ROLL, Trail, and Blind Descent all consume `loadActive()`.

The exact active bytes are fetched once per successful page session, verified
against the promoted digest, parsed once, and shared.

Digest failure rejects the load. There is no fallback to legacy.

## Persisted state

`docs/contracts/PERSISTED_CORPUS_STATE_CONTRACT.md` governs migration.

Because active source is no longer `legacy-urls-v1`:

- historical unstamped Trail drafts reset;
- Trail drafts stamped with the legacy revision reset;
- Blind geneses stamped with the legacy revision reset;
- imported legacy artifacts remain inspectable/replayable but cannot fork into
  the new active corpus.

## Selection semantics

Promotion changes the active population, not the selection algorithm.

No ranking, recommendation, score, provenance weighting, popularity, or
personalization is introduced.

## Final invariant

> One promoted, digest-bound 841-resource corpus supplies selection bytes to
> ROLL, Trail, and Blind; legacy is explicit rollback material only.
