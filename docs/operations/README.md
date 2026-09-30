# Corpus and release operations

[Documentation map](../README.md) · [Contributor checks](../../CONTRIBUTING.md) · [Tool guide](../../tools/README.md)

- [Corpus governance](CORPUS_GOVERNANCE.md): admission, provenance, review, and reversible removals.
- [Pool sweep operations](POOL_SWEEP_OPERATIONS.md): report-only network observations and review artifacts.
- [Closeout quality gate](QUALITY_GATE.md): historical release-completion checklist; apply checks relevant to the change.

`Corpus Quality` regenerates the typed candidate from pinned catalogs and compares release bytes. It also enforces [the reviewed legacy structural baseline](../../.github/corpus-policy.json); [the example policy](../../.github/corpus-policy.example.json) is a stricter target, not the enforced baseline. `Pool Sweep Evidence` publishes observations without replacing or pushing corpus data.

Changing root `urls.txt` does not promote a new runtime corpus. Promotion is a separate digest-bound decision governed by the [runtime authority](../contracts/RUNTIME_CORPUS_AUTHORITY_CONTRACT.md) and [promotion](../contracts/RUNTIME_CORPUS_PROMOTION_CONTRACT.md) documents.
