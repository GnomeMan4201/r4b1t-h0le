# Corpus expansion v1

Status: proposed candidate; maintainer admission review and runtime promotion pending.

## Result

`diverse-candidate-v0.2` expands the 841-resource active release to 6,859
resources across 318 unique hostnames, using 37 assertion sources. GitHub
remains at 471 URLs, declining from 56.00% to 6.87% of the candidate.

The candidate adds technical documentation, security papers, vulnerability
research, forensic writeups, public lab descriptions, hacker publications,
OSINT methodology articles, and threat-data services. It preserves all active
release URLs. No selection or motion code changes.

The complete counts, source identities and host concentration are in
[`../corpus/expansion/diversity-v1.md`](../corpus/expansion/diversity-v1.md).
The largest host is 13.38% of the pool. This is still concentrated: 318
hostnames are neither 318 independent publishers nor 750 registrable domains.
The initial size goal of 5,000 resources is met; broader publisher/domain
coverage remains work for subsequent candidate releases.

## Collection and admission are separate

`capture_source_index.py` performs one explicit network fetch. It collects:

- HTML anchor URLs, resolving relative anchors against the document's first
  HTTP(S) base URL, or the final response URL when no base is present;
- direct RSS item links or Atom HTML alternate-entry links;
- absolute sitemap URL-set locations.

It does not crawl recursively, assign types, establish scope, or promote
resources. Sitemap indexes require separate explicit child captures. XML DTD
and entity declarations are rejected. Feed GUIDs, body links, images and
scripts do not become feed entries. HTTP failures and empty feeds fail capture
without modifying any existing snapshot.

Collected indexes retain URLs, the requested/final source URL, extractor
version and original response digest. They do not redistribute article bodies,
RSS summaries, publisher markup or abstracts.

**Evidence limit:** these are normalized URL indexes, not exact publisher
response snapshots. The response digest is an acquisition observation, not an
independently verifiable publisher attestation. Without the original response
bytes, a historical extraction cannot be independently replayed. The snapshot
digest in a review binds the collected index bytes, not the original response.

Each proposed admission is an exact URL plus an explicit resource type in
`corpus/reviews/`. It must occur in the pinned collected index. A review declares
cybersecurity scope and gives a source-specific rationale. Unknown fields,
duplicate admissions, unknown types, missing index membership, and changed
snapshot bytes fail closed. Unreviewed URLs never enter provenance.

The initial declarations were prepared by Codex from publication scopes and
archive structure, with explicit route-level exclusions. They are **proposed
maintainer trust decisions**, not a claim that a human reviewed every page or
that every destination received a body-content audit. Resource types and
scope assertions should be corrected in the review files when necessary.
The release stays a candidate until these trust decisions are accepted.

## Offline compilation

The reviewed-index compiler emits existing
`r4b1t-corpus-provenance-v1` records using the `manual_review` source kind. Source
revision, path and digest identify the reviewed collected index. No existing
provenance, eligibility, aggregation or release contract is weakened.

The expansion registry explicitly names the two existing pinned Markdown
catalogs and the proposed review manifests. It does not glob future files into
authority. Changing a registry path, review, or snapshot changes rebuild
evidence. All compilation after collection is offline:

```bash
python tools/build_expanded_corpus.py \
  --registry corpus/expansion/registry-v1.json \
  --out-dir /tmp/r4b1t-expanded

diff -ru corpus/releases/diverse-candidate-v0.2 /tmp/r4b1t-expanded/release
diff -u corpus/expansion/diversity-v1.json /tmp/r4b1t-expanded/diversity.json
diff -u corpus/expansion/diversity-v1.md /tmp/r4b1t-expanded/diversity.md
```

The output includes aggregate provenance, compiled eligibility, a three-file
candidate release, and diversity evidence. Source and input order do not
change the result. Multiple sources for one URL add evidence without adding
routes. Downstream eligibility retains canonicalization and exclusion authority.

Percentages and family counts are descriptive build evidence. Families label
acquisition sources and can span multiple resource types; the resource-type
table is the authoritative type breakdown. Neither family coverage, domain
concentration, reachability nor source multiplicity enters the sampler.

## Adding another source

```bash
python tools/capture_source_index.py \
  --url https://example.org/security/feed.xml \
  --extractor feed-entries-v1 \
  --out /tmp/new-source-index.json
```

Review the collected URLs and the publisher's actual scope. Prepare an exact
admission list following `schemas/reviewed-source-index-v1.schema.json`, with a
repository-relative snapshot path and SHA-256 of those exact index bytes. Keep
generic navigation, unresolved types and unsubstantiated scope outside the
admissions. Then add the manifest path to a new candidate registry and rebuild.

Existing source indexes and reviews are pinned evidence. Refresh them as an
explicit new revision; never replace a live pool from a successful fetch alone.

## Promotion boundary

This change does not edit `corpus/runtime/active-v1.json`, the active release,
legacy `urls.txt`, or runtime code. Production therefore continues selecting
the existing 841-resource release.

Before promotion, accept/correct source scope and type declarations, review
concentration and duplicates, run broader time-bounded reachability checks,
and follow `RUNTIME_CORPUS_PROMOTION_CONTRACT.md`. Some Academy lab descriptions
are public while launching the exercise requires an account. Historical links
can be stale. A timeout or blocked response is indeterminate, not an automatic
deletion or a safety verdict.

An initial deterministic sample checked three admissions per new source:
105 destinations, 102 reachable responses and three indeterminate timeouts
(all Bishop Fox). There were no confirmed 404/410 responses in that sample.
This is not a full-pool census, random sample, per-page relevance audit, or
safety assessment. Exact URLs, timestamps, method and observations are in
[`../corpus/expansion/reachability-sample-v1.json`](../corpus/expansion/reachability-sample-v1.json).

The before/after release artifacts, exact admission files and deterministic
rebuild retain the complete addition history. No active resources were removed.
