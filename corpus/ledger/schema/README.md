# Ledger implementation profile v1

Normative parent: `docs/CORPUS_LEDGER_CONTRACT_V1.md`. This package is offline
shadow infrastructure, with no production selector imports.

`events.py` is the closed, versioned payload validator; unknown fields/types fail
closed. `serialization.py` delegates to the shared Python CJ-1 implementation,
and `serialization.js` delegates to existing `cj1.js`. Historical verifier error
semantics remain unchanged. All timestamps in event/payload timestamp fields
use validated UTC milliseconds. No replay-time timestamps are generated.

Hash framing is ASCII `r4b1t:<purpose>:v1`, one NUL byte, then CJ-1 UTF-8.
Purposes are event, projection, policy, manifest, heartbeat. The first event uses
`sha256:` followed by 64 zeroes as its v1 predecessor. Both are fixed in golden
vectors before shadow writes. Unordered collections use ascending CJ-1 **UTF-8
bytes**, reject duplicates, and are explicitly validated. Ordered event logs,
source corpus order, and observation histories retain their original order.

The registry supports all frozen event families, including future archive,
batch, policy, and release records. Schema support does not promote a producer,
heartbeat cadence, selection policy, release manifest, or public cutover.

Identity parsing uses exactly 15 ASCII decimal digits, positive create_seq, and
numeric survivor comparisons. Parsing does not mint or reserve an identity.
