# R4B1T H0L3 — documentation map

[Open the instrument](https://r4b1t.badbananaresearch.com) · [Repository overview](../README.md) · [Contribute](../CONTRIBUTING.md)

| Read for | Location |
| --- | --- |
| Product boundaries and feature specifications | [Product contract](../CONTRACT.md) · [Contracts](contracts/README.md) |
| Architectural decisions and their acceptance status | [ADRs](adr/README.md) |
| Runtime layout and presentation ownership | [Architecture](architecture/README.md) |
| Verification results and audit baselines | [Audits](audits/README.md) · [Corpus evidence](evidence/README.md) |
| Versioned release and deployment records | [Releases](releases/README.md) |
| Corpus governance and maintenance procedures | [Operations](operations/README.md) · [Tools](../tools/README.md) |
| Export formats | [Projection schemas](schema/README.md) · [Corpus schemas](../schemas/) |
| Network and vulnerability boundaries | [Worker boundary](WORKER_TRUST_BOUNDARY.md) · [Security policy](../SECURITY.md) |
| Current artwork and earlier experiments | [README assets](readme/README_ASSETS.md) · [Historical presentation](history/README.md) |

Runtime authority comes from [`corpus/runtime/active-v1.json`](../corpus/runtime/active-v1.json), which binds the promoted release's URL digest. Release manifests, source catalogs, legacy `urls.txt`, and liveness reports have separate roles; none independently replaces that authority.

Document status matters. Drafts and proposed ADRs remain proposals; dated audits and releases establish evidence only for their recorded baselines. The [workstream handoff](WORKSTREAM_STATUS.md) records an earlier coordination baseline, not a certification of current main.
