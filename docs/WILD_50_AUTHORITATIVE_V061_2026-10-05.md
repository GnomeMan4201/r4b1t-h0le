# WILD 50 authoritative v0.6.1 result

Date: 2026-10-05

## Authority

This is the first authoritative WILD 50 observation run.

- tool: `wild-intake/0.6.1`
- frozen `wild1000.py` SHA-256:
  `fb645cdcc0d2ce2fc0edfb62fd70750194324d754d41bcf02bcc09cb449510cd`
- workflow run: `37362726635`
- head: `bf8bc1a04aa82c1e5fb3d7a3b5c4b0ff09cf2c88`
- campaign manifest:
  `sha256:f0bead660cdc1d77b44b7acf29e2405d9bbdea3fa8a64666ed28fd47e87f5a4e`
- evidence artifact: `wild-50-v061-evidence`
- artifact id: `11366568810`
- artifact digest:
  `sha256:3dd3f572897203789c93ae5e75fbd2e1f4c0b41720a72e3ebf9fcb27e1cf8a89`

The workflow re-verified the frozen script bytes before execution.

## Pre-run gates

PASS:

- site-key/v1 authority loaded cleanly;
- 25 normative site-key vectors;
- baseline `experience-candidate-v0.4`;
- 7,033 baseline URLs;
- 733 baseline siteKeys;
- 0 unkeyed baseline URLs;
- seven v0.6.1 review-integrity regressions.

No exploratory status was imported into the campaign.

## Harvest

31 pinned lead URLs were attempted.

The harvester emitted **8,058 candidates**.

Notable lead yields:

| lead identity | outbound candidates |
| --- | ---: |
| personalsit.es | 1,949 |
| github.com/jivoi | 1,427 |
| 512kb.club | 1,024 |
| kickscondor.com | 969 |
| 1mb.club | 824 |
| github.com/eric-erki | 485 |
| github.com/hal9ai | 441 |
| github.com/tigergate | 240 |
| github.com/elasticlabs | 149 |
| github.com/thedoubler | 125 |
| github.com/louisbarclay | 97 |
| maxintel.org | 62 |
| github.com/radiovisual | 59 |
| indieweb.org | 56 |
| recurse.com | 55 |
| neocities.org | 31 |
| github.com/public-apis | 18 |
| github.com/williamrthomas | 17 |
| experiments.withgoogle.com | 16 |
| github.com/awesomedata | 9 |
| osintframework.com | 3 |
| wackywebs.com | 1 |
| openweird.com | 1 |

The Smithsonian Open Access lead returned HTTP 403 during harvesting.
Several JS-heavy/directory leads yielded zero static outbound candidates.

## Verify --limit 50

The tool reported:

```text
candidates=8058
probing=50
skipped:
  extra_page_same_sitekey      1282
  sitekey_in_baseline           239
  source_pipeline_full         5247
  SITE_KEY_URL_INVALID            4
```

Authoritative states:

| state | count | rate |
| --- | ---: | ---: |
| LIVE_CANDIDATE | 41 | 82% |
| MANUAL_CHECK | 4 | 8% |
| RETRYABLE | 4 | 8% |
| REJECTED | 1 | 2% |

Reason taxonomy:

- 4 × `http_403` → MANUAL_CHECK
- 3 × `connect_error` → RETRYABLE
- 1 × `dns_error` → RETRYABLE
- 1 × unsafe/non-public IPv6 resolution → REJECTED

The rejected identity was `1clicklinux.org`, resolving to
`2002:57cd:fe9:0:2ad2:44ff:fe2e:e579` under the run's DNS observation.

The four HTTP 403 identities remain manual checks, not dead resources.
The four retryable identities remain unverified, not dead resources.

## Per-source authoritative status

| lead_source_key | selected | LIVE | MANUAL | RETRY | REJECT | direct-live rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 512kb.club | 14 | 11 | 0 | 2 | 1 | 78.6% |
| personalsit.es | 11 | 9 | 1 | 1 | 0 | 81.8% |
| 1mb.club | 8 | 6 | 2 | 0 | 0 | 75.0% |
| github.com/jivoi | 5 | 4 | 1 | 0 | 0 | 80.0% |
| kickscondor.com | 5 | 5 | 0 | 0 | 0 | 100% |
| github.com/eric-erki | 2 | 1 | 0 | 1 | 0 | 50.0% |
| recurse.com | 2 | 2 | 0 | 0 | 0 | 100% |
| github.com/thedoubler | 1 | 1 | 0 | 0 | 0 | 100% |
| github.com/tigergate | 1 | 1 | 0 | 0 | 0 | 100% |
| indieweb.org | 1 | 1 | 0 | 0 | 0 | 100% |

No source is near the campaign's 50 accepted-resource quota. Human acceptance is still zero.

## Archive evidence

For the 45 LIVE_CANDIDATE + MANUAL_CHECK rows:

- FOUND: 35
- NONE_FOUND: 10

All 45 successful/manual probes have `FULL` probe hashes.

Archive evidence is not treated as current liveness.

## Human review state

The run produced **45 review rows**:

- CAMPAIGN_ACCEPTED: 0
- REVIEW_ACCEPTED: 0
- REVIEW_REJECTED: 0
- REVIEW_INVALID: 0
- awaiting review: 45

No resource has been admitted to the corpus or ledger.

Discovery-quality tags and classification coverage remain intentionally unreported until
human review; they are not inferred from lead source or page title.

## Exploratory comparison preregistration

The exploratory pass used a manually balanced 10 × 5 sample.
The authoritative tool selected its first 50 deterministically from the actual harvested
campaign candidate set.

Identity overlap:

- exploratory siteKeys: 50
- authoritative siteKeys: 50
- overlap: **0**

Therefore there are **no cells to populate** in the preregistered
`exploratory_status × v0.6.1_status` agreement matrix.

This is not a status disagreement. It is a sampling difference. The preregistration
explicitly said not to interpret differing candidate order as a quality failure unless the
campaign deterministic ordering/policy is violated; no such violation was observed.

A same-identity diagnostic re-probe may be run separately if fetcher agreement itself
needs measurement. Such a diagnostic must not be presented as campaign admission evidence.

## Evidence digests

The downloaded artifact's internal evidence manifest verified successfully:

- campaign manifest:
  `f0bead660cdc1d77b44b7acf29e2405d9bbdea3fa8a64666ed28fd47e87f5a4e`
- candidates:
  `87e06800e765fae5c61788394654d416f2b206df628bfa6e3021fae82b290992`
- classification:
  `d2137e77fe3b676253bd54b08acd7ed2a2cb46d548412860572d108ed1b5a88b`
- leads:
  `4ee9c875951ec86a20db6f1007e4d96ef4c22cb94ade7e82f740c0798daae2d7`
- observations:
  `4b0fa1a6021e9b6889570c39f10a95b278c0005ee2263858e282068887b083aa`
- review sheet:
  `7bcd83501b80616aa66d514ca1fc5ccb92137fcaf37c99ebc38d829f51213529`
- skipped report:
  `7e86dece6b115d8b5759f730f5e88264e2f8b99074c9c5383047bd0fc7140da1`

## Pilot finding

The live run validates the intake architecture, but also exposes a useful difference between
**source quota** and **pilot sampling balance**.

The source cap prevents any one lead identity from contributing more than 50 accepted
resources to WILD 1000. It does not make `verify --limit 50` a round-robin sample across
lead identities. The first 50 are deterministic and therefore source-skewed.

That is not a campaign-authority defect, but it matters when using a 50-item pilot to test
breadth. Any future change to pilot sampling should be specified separately rather than
quietly altering campaign selection.
