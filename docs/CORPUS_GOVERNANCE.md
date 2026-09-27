# Corpus Governance and Removal Policy

## Purpose

The r4b1t corpus is a curated discovery dataset, not an indiscriminate link dump. A URL is eligible only when it contributes a defensible security, OSINT, research, development, reference, archival, or unusual-web use case.

## Canonical source

`urls.txt` is the canonical ordered corpus. Generated sweep databases, alive/dead lists, reports, and browser artifacts are evidence products; they do not replace the source corpus until a reviewed change is merged.

Every corpus-quality report must record the SHA-256 of the exact `urls.txt` bytes it analyzed. Counts without a source hash are informational only.

## Admission criteria

A candidate URL must satisfy all applicable criteria:

1. Uses `http` or `https` and contains a valid hostname.
2. Does not embed credentials, access tokens, session identifiers, or other secrets.
3. Is not an exact or trivially canonicalized duplicate.
4. Has explicit, inspectable provenance establishing its supported discovery scope; for the cybersecurity corpus, this means at least one versioned source assertion of `cybersecurity` scope.
5. Has a concrete resource type established by an explicit source assertion or a deterministic, versioned structural rule.
6. Does not depend on deceptive labeling or an unsupported claim of safety.
7. Is reviewed for obvious malware-delivery, credential-harvesting, unlawful-content, and privacy risks before inclusion.
8. Preserves source provenance sufficient to explain both what the resource is and why it belongs in the corpus.

A successful HTTP response is not evidence that a URL is relevant, safe, or trustworthy.

## Liveness classifications

The sweep pipeline must distinguish:

- **reachable** — a request produced a response that supports continued review;
- **soft failure** — timeout, DNS failure, TLS failure, rate limiting, bot protection, or transient server error;
- **method mismatch** — `HEAD` failed but a bounded `GET` probe may still succeed;
- **candidate dead** — repeated `404` or `410` results across independent runs;
- **manual review** — redirects, ownership changes, parked domains, authentication walls, or content drift;
- **confirmed removal** — evidence meets the removal rule below.

A single failed request must never automatically delete a corpus entry.

## Removal rule

Automated checks may nominate entries, but removal requires one of:

1. repeated `404` or `410` results in at least two scheduled sweeps separated by seven or more days;
2. a verified redirect to an unrelated, parked, malicious, or replacement destination;
3. confirmed content drift that defeats the original inclusion rationale;
4. a security, privacy, legal, or maintainer-request reason documented in the review record;
5. an exact duplicate where the retained canonical entry is identified.

Bulk removals require a pull request containing before/after counts, source hashes, reason counts, and a recoverable list of removed URLs.

## Automation boundaries

Scheduled jobs operate in report-only mode unless a reviewed policy explicitly permits a bounded mutation. They must not push destructive corpus changes directly to the protected default branch.

A corpus mutation workflow must:

- use least-privilege permissions;
- preserve the pre-change source hash and removed-entry list;
- enforce a maximum removal percentage per run;
- fail closed on missing or empty output;
- require review when thresholds are exceeded;
- publish machine-readable and human-readable evidence;
- remain reproducible from the committed inputs and declared tool version.

## Quality metrics

The structural analyzer records at minimum:

- source SHA-256;
- total and valid URL counts;
- exact and conservative canonical duplicates;
- invalid and credential-bearing URLs;
- HTTP/HTTPS distribution;
- unique-host and singleton-host counts;
- top-host concentration and host HHI;
- line-addressable findings.

Network liveness, semantic relevance, category balance, and SPROUT suggestion quality are separate measurements and must not be inferred from structural metrics.

## Provenance authority

For newly promoted cybersecurity corpus records, `CORPUS_PROVENANCE_CONTRACT.md` defines the authoritative provenance shape. Resource type and cybersecurity scope are separate claims. Deterministic URL structure may establish resource type, but it must never establish cybersecurity relevance by itself.

Heuristic taggers, NLP classifiers, confidence scores, popularity signals, stars, clicks, and user behavior may nominate records for review. They are not authoritative admission evidence and must not become selection weights.

Multiple provenance assertions for one logical resource improve auditability only; they do not create duplicate selectable records or increase selection probability.

The legacy flat `urls.txt` corpus remains governed as historical raw material until records are explicitly promoted through the typed provenance and eligibility pipeline.

## Corrections and removals

False removals and incorrect classifications are tracked as correction events. Corrections must identify the affected source hash, decision, evidence, and restoring commit. The project should prefer reversible review artifacts over silent mutation.

## Release gate

A release may describe the corpus as verified only when the statement names or links to the verification method, date, source hash, limitations, and relevant report. Counts in the README and application metadata must match the released corpus evidence.
