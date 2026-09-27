# R4B1T H0L3 Typed Candidate Production Shadow Contract v1

Status: DRAFT FOR IMPLEMENTATION  
Candidate: `typed-candidate-v0.1`

## Purpose

RD-4G created a reproducible 841-resource typed corpus candidate.
RD-4H centralized runtime corpus authority while keeping legacy `urls.txt`
active.

RD-4I rehearses the candidate bytes through the real production runtime without
promoting them.

## Shadow injection

The browser acceptance test intercepts requests for the currently active legacy
corpus route and fulfills them with the exact checked-in bytes from:

`corpus/releases/typed-candidate-v0.1/urls.txt`

No production source descriptor is changed.

This tests runtime compatibility with candidate bytes while preserving
`legacy-urls-v1` as production authority.

## Required proof

The shadow MUST prove:

1. candidate `urls.txt` SHA-256 equals the release manifest
   `urls_digest`;
2. candidate line count equals the release manifest resource count;
3. production ROLL selects a URL contained in the candidate bytes;
4. a Trail artifact records the SHA-256 of those exact candidate bytes as
   `corpus_revision`;
5. a Blind Descent artifact records the same corpus revision;
6. Trail and Blind revisions are equal;
7. the candidate release remains `selection_authority: false` in production
   metadata during the rehearsal.

## Service-worker readiness

Corpus bytes and corpus release metadata are evidence/authority inputs, not
ordinary application shell assets.

The service worker MUST bypass cache handling for:

- any active corpus `.../urls.txt` route;
- `corpus/releases/*/urls.txt`;
- `corpus/releases/*/resources.json`;
- `corpus/releases/*/manifest.json`.

The required `corpus-authority.js` shell module MUST be precached.

## Non-authority

RD-4I does not:

- change `R4b1tCorpusAuthority.active()`;
- load the candidate in production;
- change selection probability;
- change category or Tor filtering;
- change Trail/Blind serialization.

## Final invariant

> Candidate bytes must survive the real production runtime before candidate
> authority can be considered for promotion.
