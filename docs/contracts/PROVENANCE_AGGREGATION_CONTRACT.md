# R4B1T H0L3 Provenance Aggregation Contract v1

Status: DRAFT FOR IMPLEMENTATION  
Aggregate schema: `r4b1t-corpus-provenance-aggregate-v1`

## Purpose

Pinned catalogs produce independent provenance documents. Before those
documents can form one typed discovery corpus, overlapping resources must be
combined without creating duplicate selection authority.

RD-4D defines that combination step.

## Inputs

Every input MUST independently satisfy
`docs/contracts/CORPUS_PROVENANCE_CONTRACT.md` and compile successfully under
`r4b1t-corpus-provenance-v1`.

All input documents MUST name the same corpus.

Each input document is identified in aggregate evidence by its compiled
provenance artifact digest.

Input order is non-authoritative.

## Source registry merge

Source registries are merged by source ID.

If the same source ID appears more than once with byte-equivalent normalized
source metadata, it is stored once.

If the same source ID refers to different metadata, aggregation fails closed.

A source ID can never mean two different assertion authorities inside one
aggregate.

## Resource merge

Exact resource URLs are the v1 aggregation key.

When the same exact URL appears in multiple inputs:

1. its resource-type **value** MUST agree;
2. identical structural bases remain unchanged;
3. agreeing source-backed type assertions are unioned into a deterministic
   `source_assertions` basis;
4. cybersecurity scope assertions are unioned by source ID;
5. the result contains one provenance record.

Additional matching sources increase audit evidence only.

They do not create additional eligibility records and do not change selection
probability.

## Type conflicts

If one exact URL carries different resource-type values, aggregation fails.

If two bases are both source-backed and the type value agrees, their source IDs
are merged as corroborating evidence.

Structural-rule bases remain strict: differing structural rules, or a
structural/source-backed basis disagreement, fail closed rather than selecting
a preferred authority.

v1 does not choose a majority vote, confidence winner, or first-seen record.

The conflict must be corrected or explicitly reviewed upstream.

## Canonical variants

RD-4D intentionally does not invent a second URL canonicalization authority.

Distinct input strings remain distinct provenance records.

The downstream `eligibility-v1` compiler remains authoritative for URL
canonicalization and canonical duplicate handling before selection.

Therefore URL variants cannot gain selection weight: eligibility compilation
still collapses canonical duplicates.

## Output

Aggregation emits:

- `provenance.json` — one merged authoritative provenance document;
- `compiled.json` — the content-addressed compiled provenance artifact;
- `eligibility-input.json` — the deterministic projection consumed by
  `eligibility-v1`;
- `summary.json` — input artifact identities and merge counts.

The summary records at least:

- number of input documents;
- raw input records;
- unique merged records;
- merged exact duplicates;
- merged sources;
- input provenance artifact digests;
- aggregate provenance artifact digest.

## Determinism

Semantically identical inputs produce the same aggregate regardless of:

- document order;
- source order inside each document;
- record order inside each document;
- scope assertion order.

No timestamp participates in the deterministic payload.

## No selection authority

Aggregation MUST NOT emit or derive:

- score;
- rank;
- weight;
- probability;
- popularity;
- recommendation;
- personalization.

The number of catalogs asserting a resource is evidence, not weight.

## Final invariant

> Many sources may explain one resource. They must still produce one logical
> resource before selection.
