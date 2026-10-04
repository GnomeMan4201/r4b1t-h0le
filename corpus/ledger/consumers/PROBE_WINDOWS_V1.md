# Shadow probe windows v1

Consumer of the frozen Corpus Ledger v1 contract, sections 10 and 16. This
specification adds no replay semantics and no public selection authority.

`r4b1t-shadow-head-v1` performs an explicit operator-selected, bounded window
of HEAD observations through the existing public-target guard and redirect
transport. Each redirect is checked, host requests are paced, timeout is eight
seconds, and redirect count is bounded by the existing transport. The guard is
not a complete DNS-rebinding defense. No private-target requests are authorized.
HEAD 2xx is recorded as probe success; other HTTP statuses and transport errors
as probe failure. Neither label claims GET/body reachability or current safety.
No response bodies are fetched or fabricated. Available status, final URL,
normalized headers digest, probe version and actual start/finish times are data.

`shadow-explicit-window-v1` is a manual closure policy: no timer, daily schedule
or automatic heartbeat cadence. A window contains 1–100 observations, ordered
by resource create sequence and then observation start/finish. The sequencer
alone assigns event order; observation timestamps are not identity chronology.
Every resource's first observation and outcome changes produce full probe events.
Repeated equivalent outcomes are suppressed as full events. One heartbeat per
resource binds **all** observations for that resource in the closed window,
including the full events, via domain-separated evidence bytes and exact count.
Equivalence is status/final URL/failure reason; changing headers alone does not
manufacture an outcome change. Success/failure observations never activate,
retire, infer availability, confirm aliases, merge, or trigger archive lifecycle.

Each immutable evidence window contains its schema, policy version, source
ledger head, producer manifest and observations. The manifest binds consumer
and reused transport code bytes. The normalized canonical window bytes are
hashed in the heartbeat domain. The first slice emits canonical **proposals**
and evidence only; append occurs through the existing single sequencer API.
An offline consumer verifier recomputes proposals from the evidence and compares
the actual appended events, beginning at the declared source head. It checks
window inclusion, manifest digests and bounded claims, not remote truth.

Caller-supplied source projections must be rederived from verified exports.
Unknown or absorbed identities, unconfirmed URLs, duplicate observations,
reversed/overlapping resource windows, unsupported policies and malformed
observations fail closed. Input order cannot change canonical output. Producer
output is published to a fresh isolated shadow directory, never overwriting an
existing window. Real network execution is explicit; unit tests never crawl.

Scheduled cadence, persistent probe scheduling, archive lifecycle, discovery
adapters, automated eligibility/availability transitions and public cutover are
not established by this consumer version.
