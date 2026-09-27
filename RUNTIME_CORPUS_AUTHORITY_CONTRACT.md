# R4B1T H0L3 Runtime Corpus Authority Contract v1

Status: implementation candidate  
Runtime API: `R4b1tCorpusAuthority`

## Purpose

ROLL, Blind Descent, and Trail must not merely agree on a corpus pathname.
Within one page session they must consume the same exact active response bytes
and the same SHA-256 revision.

A deployment changing `urls.txt` between independent fetches must never allow
one subsystem to select from one corpus while another records a different
corpus revision.

## Registry

The authority registry contains two immutable descriptors.

### Active legacy source

```json
{
  "id": "legacy-urls-v1",
  "url": "urls.txt",
  "status": "active",
  "selectionAuthority": true
}
```

### Typed candidate shadow

```json
{
  "id": "typed-candidate-v0.1",
  "url": "corpus/releases/typed-candidate-v0.1/urls.txt",
  "resourcesUrl": "corpus/releases/typed-candidate-v0.1/resources.json",
  "manifestUrl": "corpus/releases/typed-candidate-v0.1/manifest.json",
  "status": "candidate",
  "selectionAuthority": false
}
```

The candidate is diagnostic only in this contract.

## Active byte authority

`loadActive()` performs one network fetch per successful page-session load.

It returns an immutable snapshot containing:

- the active source descriptor;
- `revision = sha256:<digest of exact response bytes>`;
- the parsed ordered URL array.

The successful promise is cached.

ROLL, Blind Descent, and Trail all consume that same snapshot. They do not
perform independent corpus fetches.

A failed load clears the cached promise so a later explicit retry can recover.
Failure never promotes another source.

## Candidate shadow

`loadCandidateShadow()` may fetch and hash the typed candidate independently.

It has its own cache and returns the same snapshot shape.

Calling it:

- never replaces the active snapshot;
- never changes `active()`;
- never changes `selectionAuthority`;
- never supplies bytes to `_commitRollSelection`;
- never changes Trail or Blind corpus revision.

## Fetch policy

Active transport URL:

```text
urls.txt?v=authority-v1
```

Candidate shadow transport URL:

```text
corpus/releases/typed-candidate-v0.1/urls.txt?v=shadow-v1
```

Query parameters are transport metadata only. Revision is always the digest of
response bytes.

The service worker bypasses both legacy `/urls.txt` and
`/corpus/releases/` reads so the authority module owns their network policy.

## Parsing

A usable route:

- is absolute HTTP or HTTPS;
- has no embedded username/password.

Empty or unusable corpora fail closed.

Order is preserved.

## Immutability

Registry descriptors, snapshots, and URL arrays are frozen.

The candidate descriptor cannot be mutated into authority.

## No cutover

This contract does not:

- promote the typed candidate;
- change selection probability;
- replace legacy `urls.txt`;
- change category/Tor filtering;
- change replay semantics.

A production cutover requires a separate reviewed change.

## Final invariant

> One page session has one successful active corpus byte snapshot. Every
> selection and recorded corpus revision in that session derives from it.
