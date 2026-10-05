# WILD 50 comparison preregistration

Date: 2026-10-05

Status: frozen comparison plan written **before** any authoritative `wild-intake-v0.6` run.

This document defines how the exploratory WILD 50 pass will be compared with the
authoritative v0.6 campaign output. It exists to prevent the exploratory results from
changing the interpretation criteria after the fact.

## Inputs

Exploratory sample:
- 50 siteKey/v1 identities
- exactly 10 identities from each of five lead-source identities
- zero collisions with the frozen 733-site baseline
- exploratory statuses recorded in
  `docs/WILD_50_EXPLORATORY_2026-10-05.md`

Authoritative run:
- exact `wild1000.py` SHA-256:
  `f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e`
- baseline release: `experience-candidate-v0.4`
- expected baseline: 7,033 URLs / 733 siteKeys
- frozen classification: `resource-classification-v2.0`
- authoritative states are only those emitted by v0.6:
  `LIVE_CANDIDATE`, `MANUAL_CHECK`, `RETRYABLE`, `REJECTED`

## Status semantics

Exploratory status labels are **not** authoritative intake states.

- `LIVE_DIRECT`: current content was returned directly by the exploratory web fetch.
- `LIVE_SECONDARY`: direct fetch did not verify the candidate; a separate current source
  corroborated that the site exists. This is **not** counted as LIVE in the authoritative
  comparison.
- `UNRESOLVED_FETCH`: exploratory fetch failed or could not establish current content.
  This is **unverified**, not dead.
- `HTTP_502`: the exploratory path received a 502. It is an observed upstream/fetch
  failure, not evidence that the identity is permanently dead.

No `LIVE_SECONDARY` or `UNRESOLVED_FETCH` entry is promoted to live unless v0.6
directly verifies it.

## Preregistered comparison metrics

### 1. Identity agreement

Report:
- overlap count between the exploratory 50 siteKeys and the first authoritative 50;
- authoritative identities not present in the exploratory 50;
- exploratory identities not selected by v0.6;
- baseline collisions in either set.

Do not reinterpret differing candidate order as a quality failure unless it violates
the campaign's deterministic ordering/policy.

### 2. Status agreement matrix

For identities present in both sets, publish the full matrix:

```text
exploratory_status x v0.6_status -> count
```

Special attention:
- `LIVE_SECONDARY -> LIVE_CANDIDATE`: direct confirmation by v0.6;
- `LIVE_SECONDARY -> MANUAL_CHECK/RETRYABLE`: remains not directly verified;
- `UNRESOLVED_FETCH -> LIVE_CANDIDATE`: exploratory fetcher blind spot;
- `UNRESOLVED_FETCH -> MANUAL_CHECK/RETRYABLE`: still unverified;
- any exploratory live -> `REJECTED`: inspect reason before concluding the site is bad.

### 3. Per-source verification rate

For each of the five lead-source identities, report:
- selected count;
- `LIVE_CANDIDATE`;
- `MANUAL_CHECK`;
- `RETRYABLE`;
- `REJECTED`;
- direct-live rate = LIVE_CANDIDATE / selected.

Do not combine `MANUAL_CHECK` or secondary corroboration into the live rate.

### 4. Failure taxonomy

For every non-LIVE authoritative observation, group by reason:
- DNS;
- connect/timeout/TLS;
- HTTP status;
- unsafe/canonicalization rejection;
- parked/spam/content screen;
- redirect collision/baseline collision;
- retry exhaustion;
- other.

The purpose is to distinguish **web failure** from **fetcher limitation** from
**policy rejection**.

### 5. Archive evidence

Report authoritative archive statuses for the 50:
- FOUND;
- NONE_FOUND;
- BLOCKED;
- ERROR;
- NOT_CHECKED where applicable.

Archive presence does not substitute for current liveness.

### 6. Discovery-quality tags

Human review will assign one or more non-authoritative quality tags to each candidate:
- weird/experimental;
- technically useful;
- educational;
- investigative/security;
- scientific/data;
- artistic/creative;
- historical/archive;
- playful/game;
- personal/indie;
- other.

These tags are descriptive only. They must not affect ROLL selection weight or
campaign admission.

Report:
- tag counts for the authoritative 50;
- number of distinct tags represented;
- per-source tag distribution;
- number of candidates with at least two quality tags.

### 7. Classification coverage

For human-reviewed candidates, report:
- resource_type counts;
- primary_subject counts;
- multi-subject count;
- `unclassifiable` count;
- classification validation failures.

No classification is inferred from lead source.

### 8. Source concentration

Confirm:
- no source exceeds the campaign source cap;
- selected counts by `lead_source_key`;
- accepted counts by `lead_source_key`.

The exploratory 10 x 5 balance is context, not an acceptance requirement for v0.6.

## Decision rules

After the authoritative run:

- Do **not** call a candidate dead solely because either fetch path could not verify it.
- Do **not** count secondary corroboration as authoritative liveness.
- Investigate systematic source-specific or status-specific disagreement before expanding
  beyond WILD 50.
- A high `UNRESOLVED_FETCH -> LIVE_CANDIDATE` rate indicates the exploratory fetch path
  was the limitation.
- A high exploratory-live -> v0.6 `RETRYABLE/MANUAL_CHECK` rate indicates v0.6 may have
  a fetcher/browser compatibility limitation worth measuring before WILD 1000.
- Public corpus/ledger admission remains blocked on human review and authoritative v0.6
  evidence regardless of exploratory results.
