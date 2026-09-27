# RD-4B — Legacy Provenance Recovery Boundary

Status: **PARTIAL RECOVERY ONLY**

## Question

Can the existing 50,109-entry `urls.txt` corpus be upgraded to typed
cybersecurity provenance without re-reviewing or rebuilding source evidence?

## What the repository preserves

The current repository preserves:

- the exact flat `urls.txt` corpus;
- deterministic corpus-health evidence and source hashes;
- corpus governance stating that entries require a relevance rationale;
- maintenance tooling that previously tagged URLs into categories;
- documentation stating that corpus work included Start.me OSINT/security
  collections, GitHub awesome-lists across 21 categories, manual curation,
  liveness sweeps, and human relevance review.

This is useful historical context, but it is not per-resource provenance.

## What is not preserved

Git history contains no committed versions of:

- `tagged_final.json`;
- `step1_url_tagged.json`;
- `branch_injection.js`.

Those transient files were the richer outputs of the old classification
pipeline.

Therefore the repository does not currently contain a durable mapping from
each URL to the catalog/list/reviewer that justified its inclusion.

## Old classifier boundary

The legacy tagger and NLP classifier remain useful maintenance/research tools,
but their outputs are not authoritative RD-4B provenance.

The tagger uses:

- URL token heuristics;
- response headers;
- page title/description signals;
- confidence values.

The phase-2 classifier uses:

- TF-IDF features;
- a LinearSVC model;
- decision-function margins converted to confidence values;
- a confidence threshold for automatic category assignment.

Those mechanisms can generate **review candidates**.

They cannot directly establish:

```text
scope = cybersecurity
```

under the new provenance contract.

Doing so would turn an opaque or heuristic score into corpus authority.

## Governance mismatch discovered

The legacy governance policy requires provenance "when provenance is
available."

That was sufficient for the older broad discovery corpus, but it is not strong
enough for the new product direction where every selectable resource should
have an inspectable answer to:

> Why is this inside the cybersecurity corpus?

RD-4B therefore strengthens future admission requirements rather than
pretending the missing historical mapping still exists.

## Recovery policy

Existing URLs fall into three groups.

### 1. Recoverable explicit provenance

A URL may be promoted when a durable source catalog, import record, or manual
review can explicitly assert cybersecurity scope.

This is authoritative provenance.

### 2. Deterministic structural typing only

A URL may have a resource type established mechanically, for example a GitHub
repository.

That answers "what is this?" but does **not** establish cybersecurity scope.

It remains blocked until a scope assertion exists.

### 3. Heuristic candidate

Old tagger/classifier logic may nominate a URL for review.

Candidate data must be labeled non-authoritative and must never be accepted by
`compile_provenance` as a scope assertion.

Human or catalog evidence is still required.

## Selection invariant

Recovering two, five, or twenty independent sources for one resource does not
give that resource two, five, or twenty entries in the selection pool.

Provenance multiplicity is evidence only.

It has zero selection weight.

## Decision

Do not attempt a blanket automatic conversion of `urls.txt` into the new
typed cybersecurity corpus.

Instead:

1. preserve `urls.txt` as legacy raw material;
2. build a new versioned typed corpus alongside it;
3. ingest explicitly scoped cybersecurity catalogs first;
4. use deterministic structural rules for resource type where possible;
5. use legacy taggers only to prioritize manual review of otherwise untyped
   legacy URLs;
6. keep all heuristic suggestions outside the authoritative provenance schema;
7. rerun the RD-4 eligibility audit against the typed corpus before any
   production cutover.

## Practical consequence

The next corpus should be smaller if necessary.

A 10,000-resource pool with explicit scope provenance is more consistent with
R4B1T's new contract than a 50,109-resource pool whose relevance cannot be
reconstructed per entry.

The legacy corpus is not discarded. It becomes a review reservoir rather than
automatic selection authority.
