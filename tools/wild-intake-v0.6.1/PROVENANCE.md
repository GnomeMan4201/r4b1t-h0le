# wild-intake v0.6.1 provenance

This package is a successor, not a recovered copy of v0.6.

- retained base: wild-intake v0.5 (`wild1000.py` SHA-256 `e8d53c700db711e2ce710884510c57aa5e63fd9afe5d8aa3e5595e2215468ba7`)
- unrecoverable prior release claim: v0.6 `wild1000.py` SHA-256 `f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e`
- v0.6.1 intended changes reapplied:
  - reject duplicate `site_key` rows at the shared `Campaign.load_review()` gate
  - reject empty `site_key` review rows
  - explicit accept and reject verdict vocabularies
  - unknown non-empty verdicts become `REVIEW_INVALID`
  - source-ledger/stats account for invalid verdicts
- classification and legacy migration drafts remain unchanged from v0.5.

The v0.6.1 script hash and package hash are frozen separately before any authoritative campaign run.
