# WILD 50 authoritative v0.6.1 comparison

Date: 2026-10-05

Authority:
- workflow run: `37363282447`
- run head: `404e64d512e99f2cfb76ad7455c795b055d6dd97`
- frozen tool: `wild-intake/0.6.1`
- `wild1000.py` SHA-256: `fb645cdcc0d2ce2fc0edfb62fd70750194324d754d41bcf02bcc09cb449510cd`
- evidence artifact: `wild-50-v061-evidence`
- artifact digest: `sha256:59a09c93652b45ad65b068637229958b19f80b570c71eb2780ec94fc31972cdc`
- campaign manifest: `sha256:d2ce78ceb521ffa9db4d91c762f4e220274b5168cf18dd90c93d1e5533b0ecc0`

The evidence archive's internal SHA-256 manifest verifies every campaign file.

## Gate result

All authoritative gates passed:

- frozen script hash;
- site-key/v1 authority and 25 normative vectors;
- baseline: 7,033 URLs / 733 siteKeys / 0 unkeyed;
- v0.6.1 review-integrity regressions;
- campaign initialization;
- lead harvest;
- first-50 verification;
- stats;
- evidence hashing and upload.

## Authoritative first 50

```text
LIVE_CANDIDATE  41
MANUAL_CHECK     4
RETRYABLE        4
REJECTED         1
TOTAL           50
```

The 45 LIVE_CANDIDATE + MANUAL_CHECK observations were added to the human review queue.

Archive outcomes for those 45 reviewable rows:

```text
FOUND           41
NONE_FOUND       4
```

All 45 reviewable response hashes used `probe_hash_scope=FULL`.

Non-LIVE reason codes:

```text
http_403          4
connect_error     3
dns_error         1
unsafe            1
```

The one policy rejection was a resolved non-public IPv6 destination. It is not counted as a dead-site observation.

## Preregistered identity comparison

Exploratory sample identities: **50**

Authoritative v0.6.1 identities: **50**

Identity overlap: **0**

Therefore:

- authoritative-only identities: 50;
- exploratory-only identities: 50;
- baseline collisions in the authoritative run: 0;
- the preregistered exploratory-status × v0.6.1-status matrix has no comparable rows.

This is not interpreted as a quality failure. The exploratory pass deliberately selected
10 identities from each of five lead cultures, while v0.6.1 selected from its canonical
campaign queue. `docs/WILD_50_COMPARISON_PREREG.md` explicitly states that differing
candidate order is not a quality failure unless campaign deterministic-ordering policy is
violated.

The zero overlap does mean the exploratory 39 direct-live / 4 secondary / 6 unresolved /
1 HTTP-502 observations cannot be used as validation of these authoritative 50 identities.

## Per-source authoritative verification

| lead_source_key | selected | LIVE | MANUAL | RETRYABLE | REJECTED | direct-live rate |
|---|---:|---:|---:|---:|---:|---:|
| 1mb.club | 8 | 6 | 2 | 0 | 0 | 75.0% |
| 512kb.club | 14 | 11 | 0 | 2 | 1 | 78.6% |
| github.com/eric-erki | 2 | 1 | 0 | 1 | 0 | 50.0% |
| github.com/jivoi | 5 | 4 | 1 | 0 | 0 | 80.0% |
| github.com/thedoubler | 1 | 1 | 0 | 0 | 0 | 100.0% |
| github.com/tigergate | 1 | 1 | 0 | 0 | 0 | 100.0% |
| indieweb.org | 1 | 1 | 0 | 0 | 0 | 100.0% |
| kickscondor.com | 5 | 5 | 0 | 0 | 0 | 100.0% |
| personalsit.es | 11 | 9 | 1 | 1 | 0 | 81.8% |
| recurse.com | 2 | 2 | 0 | 0 | 0 | 100.0% |

These are pilot observations, not source-quality rankings.

## Source concentration

No selected or pending source is near the campaign's accepted-resource cap of 50.

The first 50 are not a balanced 10×5 sample. This is expected from the authoritative
campaign queue and was preregistered as acceptable. Human review should still inspect
whether canonical ordering produces an undesirable concentration effect before scaling
to WILD 1000.

## Harvest behavior

The lead harvest emitted **8,058 candidates**.

Notable skip accounting at first verification:

```text
source_pipeline_full       5,247
extra_page_same_sitekey    1,282
sitekey_in_baseline          239
site-key parse rejection        4
```

This confirms that the intake is finding far more new identities than the 50-site pilot
needs while enforcing one entry point per siteKey and the frozen baseline boundary.

## Remaining preregistered metrics

Discovery-quality tags and classification coverage require human review. They are not
inferred from lead source or from the exploratory sample.

The next step is to classify and write a human reason/verdict for the 45 reviewable
authoritative candidates, then run v0.6.1 `stats` and `export` against that reviewed
queue. No public corpus or ledger mutation occurs at that stage.
