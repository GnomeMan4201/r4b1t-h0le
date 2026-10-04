# Scheduled shadow windows v1

This is a new shadow consumer policy, not a reinterpretation of manual
`shadow-explicit-window-v1`. That version and its archived witnesses remain
verifiable. The frozen ledger contract and public authority are unchanged.

`shadow-daily-round-robin-v1` closes at most one run per UTC date. Normal runs
allow 100 HEAD observations; explicit pilot runs may declare a smaller budget.
Every run records its date and actual budget. Missed dates are not backfilled.
Targets are all existing unabsorbed identities, regardless of eligibility or
previous outcomes, in numeric create-sequence order with a persistent rotating
cursor. This is network work allocation, never selection eligibility or ranking.

`shadow-daily-window-v1` uses window schema v2. It binds its versioned scheduling
policy and prior full probe outcomes from the committed prefix. First observations
and outcome changes emit full probe events. Unchanged outcomes emit only the
inclusion heartbeat, which binds every observation. Each bounded window closes
within its run; no successful observation is omitted from its evidence digest.
No observation changes eligibility, availability, aliases or archive lifecycle.

Durable history lives on `automation/corpus-ledger-shadow`, under
`corpus/ledger/shadow/history/`. Canonical event chunks, frozen genesis artifacts,
window evidence, producer files deduplicated by manifest digest, run records and
head/projection commitments form the declared offline inputs. Each publication
is a normal fast-forward Git commit; force pushes, history replacement, resets,
and automatic merging of evidence into main are prohibited. One Actions
concurrency group covers scheduled, push and manual writer invocations.

The sequencer stages proposals against the verified previous head. A cold writer
restores committed chunks exclusively by deterministic sequencer re-execution;
no producer writes SQLite directly. Final Git publication is the durable shadow
commit point. A stale remote branch rejects publication; unaccepted staging data
must not be represented as published history. A crashed or rejected run does not
advance the published cursor or date. Rerunning a completed date performs no
network work and appends nothing. Existing chunk/window/producer bytes are never
rewritten. Offline verification replays the log and independently reconstructs
each plan, emission, cursor and checkpoint from supplied artifacts.

The daily workflow is proposed for 11:47 UTC, separate from corpus maintenance.
It consumes no maintenance classifications. Published evidence remains shadow
analysis only; production code cannot read its projection. Public cutover,
archive lifecycle and discovery adapters remain separate slices.
