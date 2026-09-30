# R4B1T H0L3 Eligibility Contract v1

Status: implementation candidate  
Ruleset: `eligibility-v1`  
Authority boundary: raw resource records -> canonical eligible corpus  
Selection: out of scope

## Purpose

R4B1T must be able to answer a narrow question for every resource considered by ROLL:

> Why was this resource allowed into, or excluded from, the selection pool?

The answer must be deterministic, versioned, inspectable, and independent of user behavior. Eligibility is a boundary, not a ranking system.

## Pipeline

```text
raw corpus
  -> canonicalization
  -> eligibility-v1
       -> eligible.json
       -> excluded.json
       -> manifest.json
  -> selection
  -> commitment
  -> exposure
  -> history / rendering / inspection
```

Authority flows only downward. History, rendering, previous rolls, trails, popularity, and user behavior MUST NOT feed back into eligibility.

## Final states

Each input record has exactly one final state:

- `ELIGIBLE`
- `EXCLUDED`

There is no `MAYBE`, quality score, recommendation state, or interest score.

## Input contract

The normative input schema is `schemas/eligibility-input-v1.schema.json`.

Each document identifies a source and contains explicit records. A record contains a URL and may contain source provenance plus an explicit `resource_type` classification.

Metadata that affects eligibility must be preserved in the compiler input. Metadata may qualify a concrete resource, but it may not override structural exclusions such as unsupported protocols, generic platform roots, authentication surfaces, or pull requests excluded by the current ruleset.

## Canonicalization

Canonicalization runs before eligibility evaluation and is deterministic.

`eligibility-v1`:

- accepts HTTP and HTTPS only;
- lowercases schemes and hosts;
- removes a terminal hostname dot;
- applies deterministic IDNA hostname encoding;
- removes default ports;
- removes fragments;
- removes known tracking parameters;
- preserves unknown query parameters;
- resolves literal `.` and `..` path segments conservatively;
- removes unnecessary trailing path slashes;
- rejects embedded URL credentials;
- does not percent-decode resource identity;
- does not invent HTTPS equivalents;
- does not collapse meaningful application routes to a parent resource.

## Protocol policy

The protocol policy is explicit:

```json
{
  "version": "1",
  "excludeOnion": true
}
```

`.onion` resources are excluded under `eligibility-v1` with `PROTOCOL_POLICY_ONION_EXCLUDED`.

Changing this behavior requires a versioned policy or ruleset change.

## Atomic-resource rule

A resource is eligible when it represents a concrete, independently visitable cybersecurity resource and satisfies the current structural and classification rules.

Examples of atomic resources include:

- repositories;
- standalone PoC or source artifacts;
- technical documentation;
- vulnerability writeups;
- research papers and articles;
- advisories;
- security tools;
- software releases;
- datasets and feeds;
- labs and training resources.

The compiler must not ask whether a resource is interesting. It may only determine whether the resource fits an explicit eligible class.

## Generic containers

Generic platform roots are excluded. Initial v1 examples include:

```text
https://github.com/
https://gitlab.com/
https://medium.com/
https://slideshare.net/
https://youtube.com/
```

Primary reason: `GENERIC_HOST_ROOT`.

Search, tag, authentication, and generic discovery surfaces are excluded with named reasons such as `SEARCH_SURFACE`, `TAG_INDEX`, `AUTH_SURFACE`, and `GENERIC_DISCOVERY_SURFACE`.

## GitHub rules

A repository root such as:

```text
https://github.com/projectdiscovery/nuclei
```

is eligible as `repository` with `CONCRETE_REPOSITORY`.

Repository subpaths are not blindly collapsed to the repository root.

### Source files

A `/blob/...` URL is eligible as a standalone resource only when explicit input classification identifies it as `source_file`.

Administrative files such as `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `.github/*` are excluded as standalone discoveries with `REPOSITORY_ADMIN_ARTIFACT`.

### Issues

A numbered issue is eligible only when explicit classification identifies it as a substantive type supported for issues: `writeup`, `research`, `advisory`, or `vulnerability_record`.

Otherwise it is excluded with `ISSUE_RESOURCE_UNQUALIFIED`.

### Pull requests

Pull requests are excluded by default in v1 with `PULL_REQUEST_UNQUALIFIED`.

### Wiki pages and releases

Specific wiki pages may be eligible as technical documentation. Specific tagged releases may be eligible as `software_release`.

## Explicit resource types

`eligibility-v1` recognizes:

```text
repository
source_file
security_tool
documentation
article
writeup
research
paper
advisory
vulnerability_record
software_release
dataset
threat_feed
rule_collection
corpus
lab
challenge
training_resource
reference
other_explicit
```

Unqualified records that cannot be established under an explicit rule fail closed with `RESOURCE_TYPE_UNQUALIFIED`.

## Duplicate handling

Canonical duplicates MUST NOT increase selection probability.

Multiple eligible records resolving to one canonical URL produce exactly one selectable record. Additional equivalent records are emitted as exclusions with `CANONICAL_DUPLICATE`.

If multiple eligible records for the same canonical URL carry conflicting classifications, the canonical resource fails closed with `CONFLICTING_RESOURCE_METADATA` rather than allowing sort order or input order to choose an authority.

## Determinism

Given the same semantic compiler input and ruleset, the compiler output must be identical regardless of input record order.

The compiler produces:

```text
eligible.json
excluded.json
manifest.json
```

The manifest contains:

- ruleset;
- protocol policy;
- deterministic input digest;
- deterministic output digest;
- raw, eligible, excluded, and duplicate counts.

Wall-clock timestamps are not part of the deterministic payload.

## History blindness

Eligibility must not accept or read:

- history;
- session state;
- previous rolls;
- trail state;
- user identity;
- viewport/device state;
- click behavior;
- popularity or collective traffic.

The compiler is an offline corpus-build step. It does not inspect live application state.

## No selection authority

The compiler MUST NOT:

- choose a destination;
- assign selection probability;
- assign weights;
- rank eligible records;
- score resources;
- recommend resources;
- personalize resources.

Its output is a set of eligible resources plus evidence explaining the boundary.

Selection remains a separate authority.

## Stable reasons

Initial exclusion reasons include:

```text
INVALID_URL
UNSUPPORTED_PROTOCOL
PROTOCOL_POLICY_ONION_EXCLUDED
EMBEDDED_CREDENTIALS
GENERIC_HOST_ROOT
GENERIC_DIRECTORY
GENERIC_DISCOVERY_SURFACE
SEARCH_SURFACE
TAG_INDEX
CATEGORY_INDEX
AUTH_SURFACE
UNRESOLVED_REDIRECTOR
CANONICAL_DUPLICATE
CONFLICTING_RESOURCE_METADATA
ISSUE_RESOURCE_UNQUALIFIED
PULL_REQUEST_UNQUALIFIED
REPOSITORY_ADMIN_ARTIFACT
RESOURCE_TYPE_UNQUALIFIED
MISSING_REQUIRED_PROVENANCE
RULESET_UNSUPPORTED
```

Initial eligibility reasons include:

```text
CONCRETE_REPOSITORY
STANDALONE_TECHNICAL_ARTIFACT
SUBSTANTIVE_ISSUE_RESOURCE
CONCRETE_TECHNICAL_DOCUMENT
CONCRETE_SOFTWARE_RELEASE
CONCRETE_RESEARCH_RESOURCE
CONCRETE_SECURITY_TOOL
CONCRETE_DATA_RESOURCE
CONCRETE_LEARNING_RESOURCE
EXPLICIT_RESOURCE_CLASSIFICATION
```

Reason semantics must not change silently within a ruleset version.

## Verification

The normative output schema is `schemas/eligibility-output-v1.schema.json`.

The output digest binds the ruleset, protocol policy, eligible decisions, and excluded decisions. An inspector can recompute the digest and reject tampered output without trusting application state.

The input digest identifies the normalized semantic input document used by the compiler.

## Non-authoritative status

Landing the compiler does not automatically make `eligibility-v1` authoritative for production ROLL.

The production corpus remains unchanged until a later migration explicitly:

1. builds typed compiler input for the real corpus;
2. compiles the complete corpus;
3. reviews exclusion distribution and edge cases;
4. verifies deterministic artifacts;
5. wires ROLL to the compiled eligible set under an explicit release decision.

Until that migration, this compiler is evidence infrastructure, not production selection authority.

## Final invariant

> Eligibility is a boundary, not a ranking.

For every selectable resource, `WHY WAS THIS ALLOWED INTO THE POOL?` must have a boring, reproducible answer.
