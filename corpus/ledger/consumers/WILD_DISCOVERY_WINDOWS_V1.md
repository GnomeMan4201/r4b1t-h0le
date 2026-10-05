# Reviewed WILD shadow discovery windows v1

This adapter consumes only the canonical, human-reviewed WILD 50 accepted export.
It is a shadow-mode ledger bridge, not a crawler, liveness authority, terrain
authority, or production-selection input.

The canonical source is the first successful preregistered v0.6.1 campaign run,
GitHub Actions run `37362726635`. Its reviewed export contains 30 records.

Each window commitment binds:

- every complete `r4b1t-wild-accepted/v1` record, including human reason,
  classification, probe/archive observation and lead provenance;
- the preserved campaign manifest and frozen classification;
- the human review and descriptive quality-tag files;
- the WILD adapter producer bytes.

Only minimal data is projected through `RESOURCE_CREATED`:

- URL;
- `resource_type`;
- fixed candidate-only `eligibility_reason`;
- versioned commitment provenance.

`primary_subject`, `subjects`, the human reason, probe body hash, archive evidence
and lead metadata remain evidence-bound but are deliberately absent from the ledger
resource projection.

Every created identity starts as `CANDIDATE` with availability `None`. The
sequencer owns resource IDs and event order. This adapter cannot mark a resource
ACTIVE or LIVE, cannot mutate the active corpus, and cannot affect ROLL.

A window accepts 1–100 records, sorted by unsigned UTF-8 bytes of `site_key`.
Campaign and classification hashes must agree with the evidence manifest. Duplicate
siteKeys, already-recorded URLs, tampered producer/evidence bytes, stale source heads,
and reordered records fail closed.
