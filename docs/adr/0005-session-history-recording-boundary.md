# ADR 0005 — Session History Recording Boundary

Status: proposed

## Context

R4B1T's product contract requires history to remain diagnostic and downstream of selection. The current runtime stores Session History inside the visit recorder: a route is added to `_sessionHistory` only when OPEN/visit runs. That makes the UI behave as a visited-destination ledger even though the product language treats History as the session's route-selection ledger.

Moving the existing visit recorder wholesale would be incorrect because it also owns Trail/count/visited-node mutation. History needs its own narrow boundary.

Blind Descent adds a second constraint: a concealed commitment must never leak its URL through History before explicit reveal.

## Decision

Session History is the local, ephemeral ledger of **disclosed discovery selections**.

A History record is created only when a route becomes disclosed through an exploration action:

| Action | Record History? | Reason |
| --- | --- | --- |
| Successful ROLL reveal | yes | committed selection becomes disclosed |
| BLIND DESCENT concealed commitment | no | URL remains concealed |
| Explicit Blind REVEAL | yes | verified committed route becomes disclosed |
| Explicit Branch direction selection | yes | user establishes a disclosed route from a generated branch |
| OPEN DESTINATION / visit | no | opening acts on an already-disclosed route |
| KEEP / INSPECT / MENU | no | no new discovery selection |
| History-row revisit | no | reopens an existing record |
| Trail replay/import | no | inspection/replay is not a new discovery selection |
| Topology-node open | no | inspection/navigation is not a new sampler decision |
| Direct `selectUrl()` projection | no | this primitive is shared by replay/inspection surfaces |

The ledger remains current-session only and newest-first in storage. Presentation may reverse it without mutating storage.

Consecutive duplicate disclosures of the same URL MAY be coalesced so an idempotent reveal/projection retry cannot fabricate movement.

## Authority boundary

History observes disclosure after selection authority has finished. It MUST NOT be read by:

- corpus eligibility;
- terrain filtering;
- protocol policy;
- RNG or uniform sampling;
- commit construction;
- Blind selection;
- ranking or recommendation.

Recording History MUST NOT mutate Trail state, visit counts, topology ancestry, commitment bytes, or sampler state.

## Implementation shape

Introduce a narrow recorder dedicated to Session History. Remove the History write from the visit/Trail recorder while leaving its Trail/count behavior unchanged.

Call the History recorder only from the explicit disclosure boundaries listed above.

Blind runtime may call the recorder only after commitment verification succeeds and the URL is explicitly revealed.

## Consequences

- A route appears in History immediately after ROLL reveal even if it is never opened.
- Opening a route does not create a duplicate History row.
- Concealed Blind commitments cannot leak through History.
- Replay/history/topology projections remain non-authoritative and do not create discovery history.
- Trail semantics remain independent from History semantics.
