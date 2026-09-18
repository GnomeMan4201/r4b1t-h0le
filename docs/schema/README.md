# Trail Topology export schema v0.1

This directory contains the normative machine-export schema for Trail Topology v2.

- `trail-topology-export-v0.1.schema.json` defines proof-relevant export structure.
- `tests/fixtures/topology-v2/golden-vectors.json` provides one committed fixture for each categorical proof state required by the v2 specification.

The five baseline states are deliberately categorical:

- `VERIFIED`
- `REJECTED`
- `PARENT ABSENT`
- `CONCEALED`
- `REVEALED`

They are facts at different scopes, not confidence levels. A rejected artifact belongs in diagnostics and must not enter the verified graph. A missing parent is an unresolved relationship, not a failed child artifact. Concealed and revealed are stop states, not quality judgments.

The schema carries the original manifest because the format-specific trail verifier remains authoritative. Rendered topology images are presentation artifacts and are not independently verifiable by themselves.
