# ADR 0001: Anti-ranking boundary

Status: Accepted

## Decision

r4b1t separates corpus admission, explicit eligibility controls, mechanical repeat suppression, and route presentation.

The selection algorithm may depend only on:

1. the committed corpus revision;
2. an explicit terrain selected by the user;
3. protocol and policy exclusions chosen by the user; and
4. documented mechanical constraints that prevent an immediate repeat.

Within that boundary, selection is driven by the declared pseudorandom sampler. Route metadata must never silently increase or decrease a route's probability.

## Display-only metadata

The following fields may be shown in a route dossier but must not condition selection:

- HTTP status or redirect count;
- last-checked or first-seen time;
- archive availability;
- popularity, reputation, or editorial assessment; and
- any inferred quality, safety, or relevance score.

Corpus admission remains a reviewed governance action. Removing an invalid, credential-bearing, malicious, or policy-prohibited entry is not ranking. Liveness alone is not sufficient grounds for automatic removal.

## Verification

Selection code and tests must keep route metadata outside the sampler input. Any future weighted sampler requires a new ADR and must not replace the default unranked sampler silently.

## Amendment — terrain membership (ADR 0006)

"An explicit terrain selected by the user" (item 2 above) has membership defined by the active eligibility profile in `corpus/runtime/eligibility-profiles-v1.json`. That profile is a digest-bound `terrain-index-v1` compiled from release bytes. Terrain membership is not defined by any table in application code. The immediate-repeat guard (item 4) is unchanged.

## Clarification — uniform-with-repeat-guard-v1

The default production ROLL algorithm is **uniform per draw attempt**, not
unrestricted independent draws across adjacent committed ROLLs. The selection
transaction binds a trail-scoped previous-ROLL URL and a bounded 30-attempt
immediate-URL repeat guard. It never suppresses an entire hostname, and after
30 attempts a matching URL is still accepted. The first ROLL in a new scope
does not suppress a URL.

The fully specified algorithm, its draw-count provenance, and mathematical
adjacency expectations are in `SELECTION_TRANSACTION_V2.md` §4. The independent
Python re-executor implements the same retry limit and verifies recorded
draw consumption. A domain concentration analysis must report both the
unrestricted-independent and the guarded-model expectations, rather than
presenting a zero repeat count as evidence of independently uniform outcomes.

Changing this rule requires an explicit versioned decision; changing corpus
membership to improve domain diversity is a separate reviewed governance
action, not a change to this ADR.
