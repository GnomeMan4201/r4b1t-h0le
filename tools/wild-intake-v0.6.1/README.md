# wild-intake v0.6.1

v0.6.1 is a **new successor**, not a recovered copy of v0.6.

The previously delivered v0.6 claimed:
`wild1000.py sha256:f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e`

Those exact bytes are currently unrecoverable. v0.6.1 is derived from the retained v0.5
script (`e8d53c700db711e2ce710884510c57aa5e63fd9afe5d8aa3e5595e2215468ba7`)
with the intended review-integrity changes reapplied under TDD.

Frozen v0.6.1 script:
`sha256:fb645cdcc0d2ce2fc0edfb62fd70750194324d754d41bcf02bcc09cb449510cd`

Changes:
- duplicate review `site_key` rows fail closed;
- empty review `site_key` rows fail closed;
- explicit accept and reject verdict vocabularies;
- unknown non-empty verdicts are `REVIEW_INVALID`;
- source-ledger/stat accounting includes invalid verdicts.

Before any authoritative WILD run, CI must pass the real R4B1T site-key/v1 selftest against
`experience-candidate-v0.4` and the focused review-integrity regressions.
