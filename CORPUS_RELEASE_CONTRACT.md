# R4B1T H0L3 Corpus Release Contract v1

Status: DRAFT FOR IMPLEMENTATION  
Release schema: `r4b1t-corpus-release-v1`  
Resource schema: `r4b1t-corpus-resources-v1`

## Purpose

The typed provenance and eligibility pipeline now produces a deterministic
candidate pool. RD-4G turns that ephemeral CI output into a portable release
bundle without granting it production selection authority.

A corpus release answers:

- exactly which canonical resources are in this candidate;
- what explicit resource type each carries;
- which provenance record backs each resource;
- which aggregate provenance artifact produced the candidate;
- which eligibility output produced the candidate;
- the exact bytes and digests of the portable release files.

It does not change what production ROLL selects.

## Inputs

The release builder consumes:

1. a verified compiled provenance artifact and aggregate summary;
2. a verified `eligibility-v1` output containing eligible and excluded
   decisions;
3. an explicit release identifier.

The aggregate artifact digest in the summary MUST match the compiled
provenance artifact digest.

The eligibility output MUST pass `verify_output()`.

## Output files

A release directory contains exactly:

```text
urls.txt
resources.json
manifest.json
```

### urls.txt

`urls.txt` contains one canonical eligible URL per line, sorted
lexicographically by canonical URL.

The file:

- ends with one newline when non-empty;
- contains no blank records;
- contains no canonical duplicates;
- contains no excluded resource;
- preserves HTTP versus HTTPS exactly as eligibility produced it.

This is the future sampler-compatible route material.

### resources.json

`resources.json` is a portable metadata artifact:

```json
{
  "schema": "r4b1t-corpus-resources-v1",
  "release_id": "typed-candidate-v0.1",
  "resources": [
    {
      "url": "https://example.org/tool",
      "resource_type": "security_tool",
      "provenance": "provenance:sha256:...",
      "eligibility_reason": "CONCRETE_SECURITY_TOOL"
    }
  ]
}
```

Resource order MUST exactly match `urls.txt`.

The provenance field is the authoritative source identity already carried by
the eligible decision. Release construction does not invent new provenance.

### manifest.json

The release manifest binds:

- release schema and release ID;
- status `candidate`;
- `selection_authority: false`;
- aggregate provenance artifact digest;
- eligibility output digest;
- eligibility ruleset and protocol policy;
- exact SHA-256 digest of `urls.txt` bytes;
- exact SHA-256 digest of `resources.json` bytes;
- resource count;
- unique host count;
- per-resource-type counts.

No timestamp participates in the deterministic payload.

## Candidate status

v1 release construction always emits:

```json
{
  "status": "candidate",
  "selection_authority": false
}
```

Changing either field is outside this builder's authority.

A checked-in candidate release does not authorize:

- production ROLL to load it;
- Blind Descent to load it;
- Trail runtime to hash it;
- replacement or deletion of legacy `urls.txt`.

Those require a separate runtime migration.

## Determinism

Given the same verified aggregate artifact, verified eligibility output, and
release ID, all three release files MUST be byte-identical regardless of input
array ordering.

## No ranking or weighting

The release MUST NOT contain or derive:

- score;
- rank;
- weight;
- probability;
- popularity;
- recommendation;
- personalization.

Release ordering is lexical serialization only. It carries no preference or
selection weight.

## Checked-in candidate

When a candidate release is committed under `corpus/releases/<release-id>/`,
CI MUST regenerate it from the pinned source catalogs and fail on any byte
difference.

This makes the checked-in release a reproducible artifact, not a hand-edited
corpus.

## Final invariant

> A corpus release may be portable and inspectable without becoming
> authoritative for selection.
