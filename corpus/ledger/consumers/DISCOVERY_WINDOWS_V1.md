# Recorded shadow discovery windows v1

Consumer of the frozen ledger contract §§3, 7.3, 13.3, 15 and 16. No change
to event schema, identity, serialization, projection or public authority.

`r4b1t-shadow-recorded-discovery-v1` accepts explicit recorded declarations,
not a crawler or a provider feed. Each declaration supplies an HTTP(S) URL,
millisecond timestamp, nonempty declaration basis, and metadata containing
only an optional opaque resource_type label. The timestamp records the supplied
declaration time, not publication age or external web chronology. No clock,
network, environment, classification inference or user behavior is consulted.

A window contains 1–100 declarations in explicitly supplied order. Array order
is producer input; the sequencer alone assigns authoritative sequence and IDs.
The window binds its schema, adapter version, verified source ledger head,
declarations and exact five-file producer inventory. Its CJ-1 bytes are committed
in the existing manifest hash domain. No competing serializer is introduced.

Exact duplicate URLs, known resource URLs and recorded URL/redirect/alias
lineage are rejected for explicit identity review. This is a conservative
ingestion guard, not URL normalization or an alias/merge decision. URL string
variants are not inferred to represent distinct or identical resources.

Each declaration emits only RESOURCE_CREATED with the supplied URL/timestamp
and optional label. Metadata provenance binds adapter version, complete window
digest and zero-based declaration index. The basis remains in the committed
window; it is never expanded into fabricated observations or lineage. New
resources are CANDIDATE with unknown availability. No activation, legacy ACTIVE
exception, alias confirmation, merge, probes, retirement or archive operation
is emitted. Producer submissions cannot contain IDs or event authority fields.

Offline verification re-executes emission against the verified prefix, hashes
the exact supplied producer files, compares every committed creation and replays
the complete chain. Byte commitments do not claim those bytes were executed or
establish transitive authority. Recorded declarations do not prove remote truth,
classification correctness, external chronology, safety or public eligibility.

This slice introduces no scheduled ingestion, security discovery adapter,
provider fetching, changes to durable daily/archive history or public cutover.
