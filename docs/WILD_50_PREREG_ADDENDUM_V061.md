# WILD 50 preregistration addendum — v0.6.1 successor

Date: 2026-10-05

This addendum is appended before any authoritative WILD 50 campaign run.

## Why this addendum exists

The earlier v0.6 artifact was reported with:

- `wild1000.py` SHA-256:
  `f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e`
- reported test result: 91 passing checks

The exact v0.6 bytes are no longer recoverable from the currently accessible
conversation/library, GitHub, Drive, mounted runtime, or public search surfaces.
Therefore that 91-test result cannot be independently reproduced from the original bytes
in this run.

The original v0.6 hash remains in the record. It is not replaced or rewritten.

## Successor authority

A new successor is frozen as `wild-intake/0.6.1`.

It is derived from the retained v0.5 script whose SHA-256 is:

`e8d53c700db711e2ce710884510c57aa5e63fd9afe5d8aa3e5595e2215468ba7`

The intended v0.6 review-integrity changes were reapplied under RED/GREEN regression
coverage:

- duplicate review `site_key` rows fail closed;
- empty review `site_key` rows fail closed;
- accept verdicts use an explicit vocabulary;
- reject verdicts use an explicit vocabulary;
- unknown non-empty verdicts become `REVIEW_INVALID`;
- source-ledger/stat accounting includes invalid verdicts.

Frozen authoritative v0.6.1 script SHA-256:

`fb645cdcc0d2ce2fc0edfb62fd70750194324d754d41bcf02bcc09cb449510cd`

Published path:

`tools/wild-intake-v0.6.1/wild1000.py`

## Pre-run gates

Before the authoritative campaign is permitted to run, CI must prove:

1. the published script bytes match the SHA-256 above;
2. the real R4B1T site-key/v1 authority loads cleanly;
3. normative site-key vectors pass;
4. `experience-candidate-v0.4` recomputes to 7,033 URLs / 733 siteKeys / 0 unkeyed;
5. the v0.6.1 review-integrity regressions pass.

Only after those gates are green may v0.6.1 produce the authoritative WILD 50
observation log.

## Comparison semantics unchanged

`docs/WILD_50_COMPARISON_PREREG.md` remains authoritative for interpreting the run.
In particular:

- exploratory `LIVE_SECONDARY` is not authoritative live;
- exploratory `UNRESOLVED_FETCH` means unverified, not dead;
- only v0.6.1 output may supply the campaign states
  `LIVE_CANDIDATE`, `MANUAL_CHECK`, `RETRYABLE`, and `REJECTED`.
