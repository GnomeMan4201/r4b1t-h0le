# RD-4 — Live Corpus Eligibility Audit

Status: **NOT READY FOR PRODUCTION PROMOTION**

Audit date: 2026-09-27  
Ruleset: `eligibility-v1`  
Source: `urls.txt`

## Evidence identity

- Raw corpus SHA-256: `5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41`
- Compiler input digest: `sha256:fa1d5c8cafc7c82918ce6831642ca2de1db92a48c71dadacfb52f5bcb775bef6`
- Compiler output digest: `sha256:f9c2a42e66f6469544b91add5a40885588673848b291e9aeb650d3f4a508d674`

The audit was produced by the Corpus Quality workflow from commit
`53224c808166757aa843699a8f043b69e6ee50d3`.

## Current corpus

- Raw URLs: **50,109**
- Valid URLs: **50,109**
- Unique hosts: **12,396**
- Unique canonical URLs under the existing corpus-health canonicalizer: **49,072**
- Existing corpus-health canonical duplicates: **1,037**
- HTTP / HTTPS: **6,111 / 43,998**
- Top-10 host share: **61.5139%**
- Host HHI: **0.3311785576**

## eligibility-v1 result

- Eligible: **27,848**
- Excluded: **22,261**
- Eligibility-v1 canonical duplicates: **208**
- Eligible rate: **55.5748%**

### Exclusion reasons

| Reason | Count |
|---|---:|
| `RESOURCE_TYPE_UNQUALIFIED` | 21,425 |
| `GENERIC_DIRECTORY` | 597 |
| `CANONICAL_DUPLICATE` | 208 |
| `GENERIC_DISCOVERY_SURFACE` | 13 |
| `PULL_REQUEST_UNQUALIFIED` | 9 |
| `GENERIC_HOST_ROOT` | 6 |
| `AUTH_SURFACE` | 1 |
| `SEARCH_SURFACE` | 1 |
| `TAG_INDEX` | 1 |

## Critical finding

All **27,848 eligible records are from `github.com`**.

Current GitHub population:

- Raw GitHub records: **28,822**
- Eligible GitHub records: **27,848**
- Excluded GitHub records: **974**

Current non-GitHub population:

- Raw non-GitHub records: **21,287**
- Eligible non-GitHub records: **0**

`RESOURCE_TYPE_UNQUALIFIED` alone accounts for **42.7568%** of the complete
corpus.

This is not evidence that the non-GitHub resources are bad. It is evidence
that the legacy flat corpus does not carry enough provenance for the current
eligibility contract to classify them without guessing.

## Why promotion is blocked

Making this output authoritative for ROLL would turn the current discovery pool
into an effectively GitHub-only pool.

That would be inconsistent with the product direction: R4B1T should discover
concrete cybersecurity resources across the web, not merely random GitHub
repositories.

The correct response is **not** to weaken `eligibility-v1` until arbitrary
URLs pass.

The missing layer is typed corpus provenance.

## Decision

1. Do **not** wire the RD-4 eligible set into production ROLL.
2. Keep `urls.txt` unchanged as the legacy raw corpus for now.
3. Do not infer cybersecurity relevance from user behavior, popularity, stars,
   clicks, or an opaque content score.
4. Add a versioned provenance/enrichment layer that can state what a resource
   is and why it entered the cybersecurity corpus.
5. Re-run this audit after typed provenance exists.
6. Promotion requires a new explicit review; RD-4 itself grants no production
   authority.

## Next slice

The next corpus slice is **RD-4B: typed corpus provenance**.

Its job is to define a lossless record format such as:

```json
{
  "url": "https://example.org/resource",
  "source_id": "catalog-or-import-id",
  "source_url": "https://example.org/source",
  "resource_type": "research",
  "topic": "cybersecurity"
}
```

The exact schema still needs to be specified. In particular:

- `resource_type` and cybersecurity/topic provenance must remain separate;
- provenance must be inspectable and versioned;
- deterministic structural rules may classify known URL forms;
- ambiguous topic relevance must fail closed rather than use an opaque score;
- one resource may carry multiple source assertions without gaining additional
  selection probability;
- source provenance must never become selection weighting.

The target is not a larger number.

The target is a pool where every selectable resource has an explainable answer
to both:

> Why is this a concrete resource?

and:

> Why is this part of the cybersecurity corpus?
