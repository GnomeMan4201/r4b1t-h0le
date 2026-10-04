# Explicit shadow archive windows v1

Consumer of the frozen ledger contract §§8, 10.4 and 16. No change to event,
serialization, identity or projection v1, public authority or historical proofs.

This consumer records explicitly declared archive targets and bounded HEAD
observations. It performs no provider lookup, Wayback resolution, rescue UX,
automatic retirement, activation or availability transition. A declared target
association is recorded evidence, not proof that it archives the resource.

`shadow-archive-explicit-window-v1` closes 1–100 explicitly ordered operations
against a verified source head. Target operations are ARCHIVE_RESOLVED,
ARCHIVE_TARGET_REPLACED and ARCHIVE_TARGET_GONE, with resource ID, explicit
millisecond timestamp, archive_url and a nonempty declaration basis. RESOLVED
requires no current target; REPLACED requires a current, different target;
GONE must name the current target. Failure of a probe never emits GONE.

ARCHIVE_PROBE operations contain a complete `r4b1t-shadow-archive-head-v1`
HEAD payload. observed_url must equal the current declared target. HTTP 2xx
records success; other statuses and transport errors record failure. A redirect
is recorded in final_url, never inferred as target replacement or alias.
Bodies are neither collected nor claimed. Recorded observations may be supplied
explicitly, or collected by the guarded transport; neither verifier proves a
remote server returned them or that a target remains reachable now.

Target records and archive probe history remain attached to their original
stable identity, including after absorption. The view reports the verified
canonical identity as well. Merging identities never chooses between their
archive targets or fabricates replacement/loss. Both original target records
remain visible. This view is a versioned consumer of projection observations,
not a replacement projection or selection policy. Strict lifecycle validation
is this consumer's acceptance boundary; opaque historical archive evidence
remains valid under its original core ledger verification semantics.

First/changed probe outcomes emit ARCHIVE_PROBE_SUCCEEDED/FAILED. Equivalent
outcomes (status, final_url, reason) are suppressed across windows for that same
original identity and current target. One PROBE_HEARTBEAT per probed identity
binds every probe operation and the complete window, including declarations,
with this policy version and exact probe count. Explicit target changes clear
prior outcome. No operation may precede that original identity's last committed
archive boundary. No clock is consulted in emission or verification.

Target event evidence digests bind the complete canonical window and operation
index. The window commits its source head, version and exact producer inventory.
Offline verification reconstructs the lifecycle and expected proposals from the
verified prefix, authenticates producer bytes, checks exact recording and replays
both chains. Missing, duplicate, stale or altered operations fail closed.

Durable explicit windows use history schema v2 on the existing isolated evidence
branch and the same ordered writer concurrency group. Daily history schema v1
and all prior windows remain supported. Explicit archive windows do not advance
the daily cursor/date. Names reserve immutable paths; existing names cannot be
reused. Publication remains an ordinary fast-forward Git commit. Staging has
no public authority; failed staging/publication advances no published state.
