# Machine-readable schemas

This directory contains normative machine-readable schemas for portable R4B1T artifacts.

## Trail v0.3

- `trail-v0.3.schema.json` defines the structural shape of `r4b1t-trail/v0.3`.
- [`docs/TRAIL_V03_SCHEMA.md`](../TRAIL_V03_SCHEMA.md) defines the semantic rules the JSON Schema cannot express, including route-ID recomputation, ROLL continuity, imported-prefix lineage, and bounded claims.
- The JavaScript verifier is `trail-v03.js`.

The JSON Schema is intentionally not the complete verifier. Cross-field integrity and content-addressed identity remain code-verifiable rules.

## Trail Topology export schema v0.1

- `trail-topology-export-v0.1.schema.json` defines proof-relevant export structure.
- `tests/fixtures/topology-v2/golden-vectors.json` provides one committed fixture for each categorical proof state required by the v2 specification.

The five baseline states are deliberately categorical:

- `VERIFIED`
- `REJECTED`
- `PARENT ABSENT`
- `CONCEALED`
- `REVEALED`

They are facts at different scopes, not confidence levels. A rejected artifact belongs in diagnostics and must not enter the verified graph. A missing parent is an unresolved relationship, not a failed child artifact. Concealed and revealed are stop states, not quality judgments.

The topology schema carries the original manifest because the format-specific trail verifier remains authoritative. Rendered topology images are presentation artifacts and are not independently verifiable by themselves.
