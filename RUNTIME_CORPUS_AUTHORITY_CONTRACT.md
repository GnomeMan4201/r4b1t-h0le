# R4B1T H0L3 Runtime Corpus Authority Contract v1

Status: DRAFT FOR IMPLEMENTATION  
Runtime API: `R4b1tCorpusAuthority`

## Purpose

The browser currently names `urls.txt` independently in ROLL, Blind Descent,
and Trail corpus-revision loading.

That duplication makes a future corpus migration unsafe: one surface could
select from one corpus while another hashes or commits against another.

RD-4H introduces one browser authority seam without changing the active corpus.

## Sources

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

### Typed candidate

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

The candidate descriptor is informational in RD-4H. It is not a fallback and
is not fetched by selection runtime.

## Required consumers

The following production consumers MUST resolve their corpus through the same
active authority API:

- primary ROLL pool loading in `index.html`;
- Blind Descent corpus loading and corpus-revision hashing;
- Trail runtime corpus-revision hashing.

No one of those consumers may retain its own hardcoded `urls.txt` fetch.

## Fetch URL

`activeFetchUrl(tag)` returns the active source URL with a cache-busting
`v=<tag>` query parameter.

The query parameter is transport metadata only.

Corpus revision remains the SHA-256 digest of the exact response bytes.

## Fail closed

If `R4b1tCorpusAuthority` is unavailable, a corpus consumer MUST fail rather
than silently falling back to a separately hardcoded path.

This prevents hidden split authority.

## Immutability

The registry, active descriptor, and candidate descriptor are deeply frozen.

Application code may read them but cannot promote a candidate by mutation.

## Candidate boundary

RD-4H does not:

- fetch the typed candidate for ROLL;
- fetch the typed candidate for Blind Descent;
- hash the typed candidate for Trail;
- change selection probability;
- change current category or Tor filtering;
- change replay behavior;
- replace legacy `urls.txt`.

Promotion requires a later reviewed contract change.

## Final invariant

> One runtime authority decides which corpus bytes are active. In RD-4H that
> authority still names the legacy corpus.
