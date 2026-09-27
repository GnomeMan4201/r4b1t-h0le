# R4B1T H0L3 Corpus Provenance Contract v1

Status: DRAFT FOR IMPLEMENTATION  
Schema: `r4b1t-corpus-provenance-v1`  
Scope: typed cybersecurity corpus input before `eligibility-v1`

## Purpose

RD-4 proved that the legacy flat URL corpus cannot explain two different facts:

1. **what a resource is**, and
2. **why that resource belongs in the cybersecurity corpus**.

Those claims must remain separate.

The provenance layer exists to preserve explicit, reviewable evidence for both
without ranking, scoring, recommending, or changing selection probability.

## Pipeline

```text
source catalogs / manual review / deterministic structural rules
        |
        v
corpus provenance v1
        |
        v
typed eligibility input
        |
        v
eligibility-v1
        |
        v
uniform selection
```

Provenance is upstream evidence. It does not select resources.

## Source registry

Every external assertion source is declared once:

```json
{
  "id": "catalog-pentest-v1",
  "url": "https://example.org/catalog",
  "kind": "curated_catalog",
  "revision": "pinned-revision",
  "path": "README.md",
  "sha256": "sha256:..."
}
```

Allowed v1 source kinds:

- `curated_catalog`
- `manual_review`
- `publisher_assertion`

Source IDs are stable identifiers within one provenance document.

Duplicate source IDs are invalid.

A source MAY carry pinned evidence fields `revision`, `path`, and `sha256`. When any one is present, all three MUST be present. These fields bind a source assertion to exact reviewable source bytes; source-catalog imports MUST include them.

## Resource records

A provenance record contains:

- the resource URL;
- one explicit resource type;
- the basis for that resource type;
- one or more explicit cybersecurity-scope assertions.

Example:

```json
{
  "url": "https://example.org/research/kernel-bugs",
  "resource_type": {
    "value": "research",
    "basis": {
      "kind": "source_assertion",
      "source_id": "catalog-pentest-v1"
    }
  },
  "scope_assertions": [
    {
      "scope": "cybersecurity",
      "source_id": "catalog-pentest-v1"
    }
  ]
}
```

## Resource type

Resource type answers:

> What kind of concrete resource is this?

It does not answer:

> Is this cybersecurity-related?

The resource-type vocabulary is inherited from `eligibility-v1`.

A type basis is one of:

### Source assertion

```json
{
  "kind": "source_assertion",
  "source_id": "catalog-pentest-v1"
}
```

The referenced source explicitly supplied or reviewed the type.

When multiple independent sources explicitly assert the same resource type,
aggregation may normalize them into a multi-source basis:

```json
{
  "kind": "source_assertions",
  "source_ids": [
    "catalog-pentest-v1",
    "catalog-security-v1"
  ]
}
```

The source IDs are unique and deterministically sorted. This is corroborating
evidence only; the number of sources never changes selection probability.

### Structural rule

```json
{
  "kind": "structural_rule",
  "rule_id": "github-repository-v1"
}
```

A structural rule may establish resource shape only.

Initial v1 structural rules:

- `github-repository-v1`
- `github-wiki-v1`
- `github-release-v1`

Structural rules are deterministic and versioned.

They MUST NOT establish cybersecurity relevance.

## Cybersecurity scope

Every record MUST contain at least one explicit assertion:

```json
{
  "scope": "cybersecurity",
  "source_id": "catalog-pentest-v1"
}
```

The source ID must exist in the source registry.

A URL pattern, hostname, repository host, star count, title token, popularity
signal, user behavior, or opaque classifier score cannot substitute for a
scope assertion.

If cybersecurity scope cannot be established explicitly, the record does not
enter the typed corpus.

## Multiple assertions

A resource may carry multiple independent source assertions.

Additional assertions:

- preserve provenance;
- may improve reviewability;
- MUST NOT create additional selectable records;
- MUST NOT increase selection probability;
- MUST NOT be converted into weights or scores.

One logical resource remains one eligibility input record.

## Record identity

Each normalized provenance record receives a deterministic identifier:

```text
sha256:<64 lowercase hex characters>
```

The identifier binds the semantic record after deterministic ordering of
assertions.

Changing URL, type, type basis, or scope provenance changes the identifier.

## Projection to eligibility-v1

A valid provenance record projects to exactly one eligibility input record:

```json
{
  "url": "https://example.org/research/kernel-bugs",
  "resource_type": "research",
  "source": "provenance:sha256:..."
}
```

The top-level eligibility input source identifies the provenance artifact.

The eligibility compiler still owns canonicalization and final structural
eligibility. Provenance does not override exclusions such as generic roots,
unsupported protocols, auth surfaces, or other `eligibility-v1` rules.

## Determinism

Semantically equivalent provenance documents MUST compile identically despite:

- source declaration order;
- record order;
- scope assertion order.

Wall-clock time is not part of the deterministic payload.

## Fail-closed rules

Compilation fails when:

- the schema version is unsupported;
- source IDs are duplicated;
- a source reference is unknown;
- a record lacks cybersecurity scope;
- a resource type is unsupported;
- a type basis is unsupported;
- a source-backed type basis references an unknown source;
- a structural rule ID is unknown;
- a structural rule is used as cybersecurity-scope evidence;
- unsupported fields appear in an authoritative object.

Ambiguity is not converted into a guess.

## No selection authority

The provenance artifact MUST NOT contain or derive:

- score;
- rank;
- weight;
- probability;
- popularity;
- recommendation;
- personalization.

The number of provenance sources has zero authority over selection.

## Legacy corpus

`urls.txt` remains legacy raw input.

RD-4B does not automatically claim that its records are cybersecurity
resources. Legacy URLs become eligible for the typed corpus only when explicit
provenance is reconstructed or newly asserted under this contract.

Loss of historical provenance is not repaired by guessing.

## Final invariant

For every typed resource, R4B1T must be able to answer independently:

> What is this resource?

and:

> What evidence places it inside the cybersecurity corpus?

Neither answer may be a hidden score.
