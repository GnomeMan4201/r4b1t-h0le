# Expanded corpus candidate

- [Registry](registry-v1.json): explicit source inputs for `diverse-candidate-v0.2`.
- [Diversity report](diversity-v1.md): counts, resource types, host concentration and source coverage.
- [Machine-readable evidence](diversity-v1.json).
- [Release bundle](../releases/diverse-candidate-v0.2/).
- [Collection/admission contract and rebuild instructions](../../docs/CORPUS_EXPANSION_V1.md).

`../indexes/` contains non-authoritative URL-only collected indexes.
`../reviews/` contains exact proposed scope/type admission declarations.
These declarations require maintainer review before runtime promotion.

The active runtime corpus remains unchanged. Rebuilds and CI use pinned local
evidence and never contact the publishers.
