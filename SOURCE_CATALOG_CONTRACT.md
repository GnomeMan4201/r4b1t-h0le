# R4B1T H0L3 Source Catalog Contract v1

Status: DRAFT FOR IMPLEMENTATION  
Manifest schema: `r4b1t-source-catalog-v1`  
Extractor: `markdown-links-v1`

## Purpose

RD-4B defines authoritative per-resource provenance. RD-4C defines how a
curated cybersecurity catalog can be imported into that provenance model
without turning scraping, heuristics, or ranking into corpus authority.

A catalog import has two independent questions:

1. Does the source explicitly scope its entries to cybersecurity?
2. Can R4B1T establish the concrete resource type of each extracted URL?

The first question is answered by a reviewed, pinned catalog manifest.

The second is answered by either a deterministic structural rule or an
explicit, reviewed source assertion recorded in the pinned catalog manifest.

## Pinned source

Each catalog manifest binds:

- a stable catalog ID;
- a public source URL;
- an exact source commit/revision identifier;
- the source path within that revision;
- a SHA-256 digest of the exact local snapshot bytes;
- the local snapshot path;
- an explicit `cybersecurity` scope assertion;
- the extractor version.

The compiler is offline. It never fetches the catalog.

A digest mismatch fails closed.

## Scope authority

The manifest explicitly asserts:

```text
scope = cybersecurity
```

for entries intentionally listed by the pinned curated catalog.

This assertion is reviewable because the exact source URL, revision, path,
snapshot bytes, and snapshot digest are preserved.

The importer MUST NOT infer cybersecurity scope from:

- URL tokens;
- page titles;
- stars;
- popularity;
- model/classifier scores;
- user behavior;
- previous rolls.

## Markdown extraction v1

`markdown-links-v1` is intentionally narrow.

It extracts absolute HTTP(S) destinations from:

- Markdown inline links: `[label](https://example.org)`
- Markdown autolinks: `<https://example.org>`

Only links under an active Markdown heading of depth 2 through 6 are candidates.

The extractor ignores:

- content before the first depth-2-or-deeper heading;
- image destinations;
- fenced code blocks;
- relative links;
- fragment-only links;
- mailto and other non-HTTP(S) schemes.

Exact duplicate destinations produce one candidate record. Evidence may retain
multiple occurrences, but duplicates do not create selection weight.

## Type promotion

Catalog membership establishes cybersecurity scope only.

Automatic promotion to typed provenance follows two authorities in order:

1. a versioned structural rule, when URL shape proves the resource type;
2. an exact, human-reviewed catalog-heading assertion when no structural rule
   applies.

Structural rules have priority and cannot be overridden by catalog headings.

Initial structural rules are those already admitted by
`CORPUS_PROVENANCE_CONTRACT.md`:

- `github-repository-v1`
- `github-wiki-v1`
- `github-release-v1`

Example:

```text
https://github.com/projectdiscovery/nuclei
  -> repository
  -> structural basis: github-repository-v1
  -> cybersecurity scope basis: pinned curated catalog
```

A catalog manifest MAY include reviewed heading assertions:

```json
"type_assertions": [
  {
    "heading": "Web Vulnerability Scanners",
    "resource_type": "security_tool"
  },
  {
    "heading": "Books",
    "resource_type": "reference"
  }
]
```

A heading assertion is an explicit human review decision about that pinned
catalog. Matching is against the extracted, whitespace-normalized heading
string exactly; the compiler does not infer synonyms, lowercase matches,
keywords, or semantic similarity.

When a structurally untyped destination appears under a mapped heading, its
resource type uses a `source_assertion` basis pointing to that catalog.

Duplicate mappings for one heading are permitted only when they assert the same
resource type. Conflicting mappings fail closed.

Every reviewed heading mapping MUST match at least one extracted candidate in
the pinned snapshot. A stale, misspelled, or wrong-case heading fails closed
instead of being silently ignored.

A non-GitHub resource under an unmapped heading remains in the untyped review
queue.

## Output

A compiled source catalog emits:

- source identity and snapshot digest;
- deterministic extracted candidates;
- deterministic typed provenance for structurally provable resources;
- deterministic typed provenance for explicitly mapped catalog headings;
- deterministic untyped review candidates;
- counts separating structural and source-asserted typing.

The promoted provenance document MUST conform to
`r4b1t-corpus-provenance-v1`.

## No weighting

The importer MUST NOT emit or derive:

- score;
- rank;
- weight;
- probability;
- recommendation;
- popularity.

Repeated links, repeated headings, or multiple catalog sources never increase
selection probability.

## Reproducibility

Given the same manifest and exact snapshot bytes, compilation is deterministic.

The snapshot digest is part of the result.

Changing source bytes requires updating the manifest digest and creates a new
reviewable source revision.

## Review boundary

A source catalog manifest is a human-reviewed trust decision.

The importer proves that R4B1T processed the reviewed source bytes
deterministically.

It does not prove that every external source claim is objectively correct.

## Final invariant

> Catalog membership can establish scope. It cannot silently establish resource
> type, quality, rank, or selection weight.
