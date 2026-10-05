# WILD 50 run reconciliation

Date: 2026-10-05

## Canonical campaign run

The canonical WILD 50 v0.6.1 campaign execution is the **first successful
post-preregistration run**:

- GitHub Actions run: `37362726635`
- head: `bf8bc1a04aa82c1e5fb3d7a3b5c4b0ff09cf2c88`
- artifact digest:
  `sha256:3dd3f572897203789c93ae5e75fbd2e1f4c0b41720a72e3ebf9fcb27e1cf8a89`
- campaign manifest SHA-256:
  `sha256:f0bead660cdc1d77b44b7acf29e2405d9bbdea3fa8a64666ed28fd47e87f5a4e`

Choosing the first successful run is an anti-cherry-picking rule. It was not selected
because its human-review outcome was preferable; it was chronologically first under the
already frozen tool, classification, lead set, workflow and preregistration.

The canonical reviewed result is:

- 30 `CAMPAIGN_ACCEPTED`
- 11 `REVIEW_REJECTED`
- 4 intentionally `UNREVIEWED`
- 0 `REVIEW_INVALID`

The 30-record accepted export at
`corpus/wild/reviews/wild-50-v061-campaign-accepted.jsonl` is the only WILD 50 input
authorized for Corpus Ledger shadow translation.

## Later duplicate run

Run `37363282447` was also a valid successful v0.6.1 execution. Its frozen inputs were
byte-identical to the canonical run:

- `wild1000.py`
- `resource-classification-v2.0`
- `leads-v1.txt`
- comparison preregistration
- v0.6.1 addendum
- workflow definition

It selected the **same 50 siteKey identities** and produced the **same intake status for
all 50**. Live web evidence differed on 17 identities (page-body hashes and/or archive
lookup outcomes), as expected for observations taken at a later time.

Its manifest SHA-256 is:

`sha256:d2ce78ceb521ffa9db4d91c762f4e220274b5168cf18dd90c93d1e5533b0ecc0`

The later run and its 35-accept review remain preserved as secondary evidence. They do
not supersede, merge with, or amend the canonical first-run campaign.

## Review differences

The later review accepted five identities that the canonical review did not accept:

- `60z.github.io` — canonical review rejected
- `99tools.net` — canonical review rejected
- `aaronj.sh` — canonical review left unresolved
- `aaronjeskie.com` — canonical review rejected
- `abordage.dev` — canonical review rejected

The canonical review also deliberately leaves `1984.ninja`, `23ro.de`, and
`46692.dev` unresolved rather than converting insufficient evidence into a rejection.

No decision from the later review is imported into the canonical export.

## Authority boundary

Neither campaign run changes public ROLL, the active corpus, terrain authority, or
Selection v3. The next step uses the canonical 30 records only to create deterministic
Corpus Ledger **shadow-mode CANDIDATE proposals**.
