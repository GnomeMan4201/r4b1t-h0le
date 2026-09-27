# R4B1T H0L3 Runtime Corpus Shadow Contract v1

Status: DRAFT FOR IMPLEMENTATION  
Schema: `r4b1t-runtime-corpus-shadow-v1`

## Purpose

RD-5A turns the typed provenance/eligibility build into static runtime-ready
artifacts without granting those artifacts production selection authority.

Production ROLL and Blind Descent continue to consume `urls.txt`.

The shadow artifact exists so the future cutover can be tested against the
exact same deterministic corpus bytes that CI reviewed.

## Inputs

The builder consumes three already-produced artifacts:

- compiled typed provenance (`r4b1t-corpus-provenance-compiled-v1`);
- `eligibility-v1` `eligible.json`;
- the corresponding eligibility manifest.

The compiled provenance artifact MUST verify independently.

Every eligible record MUST reference an existing provenance record ID and its
resource type MUST agree with that provenance record.

The eligibility manifest count MUST equal the eligible-record count.

## Outputs

The builder emits exactly:

### `typed-urls-v1.txt`

- one canonical selectable URL per line;
- UTF-8;
- final newline present;
- lexicographically sorted;
- no blanks;
- no duplicates.

These bytes are a future runtime pool candidate. They are not production
authority in RD-5A.

### `typed-runtime-v1.json`

A deterministic metadata artifact containing:

- schema;
- corpus ID;
- eligibility ruleset;
- provenance artifact digest;
- eligibility input digest;
- eligibility output digest;
- SHA-256 of the exact `typed-urls-v1.txt` bytes;
- record count;
- aggregate resource-type counts.

Per-resource provenance is deliberately not duplicated into the runtime
manifest. The authoritative provenance/eligibility artifacts remain upstream,
while `typed-urls-v1.txt` is the only deployable per-resource runtime payload.

## Digest binding

`urlPoolDigest` is:

```text
sha256:<64 lowercase hex>
```

over the exact UTF-8 bytes of `typed-urls-v1.txt`, including its final
newline.

Changing order or URL bytes changes the digest.

## Fail-closed rules

The build fails when:

- the provenance compiled artifact does not verify;
- the eligibility manifest uses another ruleset;
- the manifest's eligible count differs from `eligible.json`;
- an eligible record is malformed;
- an eligible record references unknown provenance;
- resource type disagrees with provenance;
- canonical URL is duplicated;
- an unsupported field is required to make the runtime artifact authoritative.

## No selection authority

RD-5A MUST NOT:

- change `urls.txt`;
- change production ROLL;
- change Blind Descent;
- install a runtime hook;
- consume RNG;
- add score, rank, weight, popularity, recommendation, or personalization.

The checked-in runtime snapshot is evidence and a future migration candidate
only.

## Reproducibility gate

CI MUST rebuild the runtime shadow artifacts from pinned catalogs and compare
the rebuilt bytes to the checked-in files.

A source/provenance/eligibility change that does not update the runtime snapshot
must fail CI.

## Final invariant

> RD-5A may make the new corpus deployable. It may not make it selectable.
