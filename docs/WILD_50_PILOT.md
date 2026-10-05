# WILD 50 Pilot

Status: setup only. No corpus or ledger mutation is performed by this branch.

## Pinned inputs

- baseline release: `experience-candidate-v0.4`
- expected baseline: 7,033 URLs / 733 `site-key/v1` groups
- classification: `corpus/classification/resource-classification-v2.0.json`
- leads: `corpus/wild/leads-v1.txt`
- intake tool: `wild-intake-v0.6`
- required `wild1000.py` SHA-256:
  `f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e`

Do not substitute an older intake tool.

## Run

```bash
R=/path/to/r4b1t-h0le
W=/path/to/wild1000.py

printf '%s  %s\n' \
  f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e \
  "$W" | sha256sum -c -

python3 "$W" selftest \
  --r4b1t-root "$R" \
  --release experience-candidate-v0.4

python3 "$W" campaign-init \
  --r4b1t-root "$R" \
  --campaign wild-50 \
  --campaign-id wild-50-pilot \
  --release experience-candidate-v0.4 \
  --expect-sitekeys 733 \
  --classification "$R/corpus/classification/resource-classification-v2.0.json" \
  --campaign-target 1000

python3 "$W" harvest \
  --r4b1t-root "$R" \
  --campaign wild-50 \
  --leads "$R/corpus/wild/leads-v1.txt"

python3 "$W" verify \
  --r4b1t-root "$R" \
  --campaign wild-50 \
  --limit 50
```

## Pilot acceptance

The first pass is observational. Review all 50 resulting site identities before any ledger admission.

Check at minimum:

- exactly one review row per new siteKey;
- no accepted siteKey exists in the 733-site baseline;
- lead-source concentration and redirect collisions;
- LIVE / MANUAL / RETRY / REJECT distribution;
- archive lookup outcomes;
- parked/placeholder false positives and false negatives;
- classification coverage across resource type and subject;
- full human reason for every CAMPAIGN_ACCEPTED row.

The existing-corpus v1-to-v2 migration is not a WILD 50 gate.
