# R4B1T H0L3 Typed Candidate Production Shadow Contract v1

Status: HISTORICAL ACCEPTED REHEARSAL  
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


## RD-4J digest-bound authority update

The original RD-4I rehearsal intentionally fulfilled the active legacy request
with candidate bytes to prove runtime compatibility before promotion.

RD-4J supersedes that interception technique. Once the active source carries an
expected digest, candidate bytes MUST NOT be accepted while the legacy source
remains active. The continuing regression now proves the inverse boundary:

- the candidate manifest still binds its exact 841-resource bytes;
- candidate bytes presented as the active legacy source are rejected on digest
  mismatch;
- the candidate remains non-authoritative.

Future compatibility proof after RD-4J must occur through an explicit authority
promotion, never by making one source impersonate another.


## RD-4L promotion status

RD-4I and RD-4J are historical pre-promotion evidence.

RD-4L explicitly promoted the exact checked-in `typed-candidate-v0.1` URL
bytes to runtime authority through `corpus/runtime/active-v1.json`.

The old statements in this document that legacy remains production authority
describe the RD-4I/RD-4J rehearsal state, not current production authority.

Current authority is defined by:

- `docs/contracts/RUNTIME_CORPUS_PROMOTION_CONTRACT.md`;
- `docs/contracts/RUNTIME_CORPUS_AUTHORITY_CONTRACT.md`;
- `corpus/runtime/active-v1.json`.

The release manifest itself remains unchanged as historical candidate evidence;
runtime authority is the separate promotion decision.
