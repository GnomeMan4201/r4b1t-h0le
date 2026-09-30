# Projection schemas

[Documentation map](../README.md) · [Feature contracts](../contracts/README.md)

| Format | Machine schema | Human-readable boundary |
| --- | --- | --- |
| Trail Topology export v0.1 | [JSON Schema](trail-topology-export-v0.1.schema.json) | [Topology specification](../contracts/TRAIL_TOPOLOGY_V2_SPEC.md) |
| Trail Card v0.1 | [JSON Schema](trail-card-v0.1.schema.json) | [Projection document](TRAIL_CARD_V0.1_SCHEMA.md) |
| Trail Comparison v0.1 | [JSON Schema](trail-comparison-v0.1.schema.json) | [Projection document](TRAIL_COMPARISON_V0.1_SCHEMA.md) |
| Proof Session v0.1 | [JSON Schema](proof-session-v0.1.schema.json) | [Projection document](PROOF_SESSION_V0.1_SCHEMA.md) |

Each document retains its recorded status. Derived projections do not acquire evidence authority. The format-specific source verifier establishes only its supported claims; a detached rendered image is not independently verifiable proof.

Committed [golden vectors](../../tests/fixtures/) exercise categorical states and rejection boundaries. Corpus/provenance/eligibility machine schemas remain under root [`schemas/`](../../schemas/); their paths and bytes are unchanged.
