# ADR 0004: Immutable selection transaction authority

Status: Proposed

## Context

Executable production-path regression work for CF-1 established that the version 0.1 reproducible-trail path can emit internally hash-valid artifacts whose selection provenance is not truthful.

Observed failures on the mobile production ROLL path include:

- semantic action exported as `SELECT` instead of `ROLL`;
- mobile selection using ambient `Math.random()` while the manifest declares the trail's seeded `mulberry32-v1` sampler;
- export-time terrain being re-derived from mutable UI state rather than bound at selection time;
- a presentation-only filter change changing the resulting `trail_id` even when the recorded route itself did not change.

The current implementation reconstructs provenance from several mutable or presentation-owned sources: a `MutationObserver` over `#previewUrl`, `state.pendingAction`, temporary replacement of global `Math.random`, and export-time inspection of the active filter.

ADR 0002 remains correct about version 0.1 integrity semantics: a matching trail ID proves canonical manifest integrity, not that every provenance declaration was actually consumed by the production selection path. Historical version 0.1 artifacts must remain hash-verifiable and replayable.

Blind Descent `r4b1t-trail/v0.2` is outside CF-1 and is not changed by this decision.

## Decision

A sampled route selection must create exactly one immutable selection transaction at the authoritative selection/commit boundary.

The transaction binds all facts that can affect the meaning of the selection before route identity is exposed:

- semantic action;
- complete selection-time constraint state;
- exact corpus revision;
- sampler algorithm and PRNG;
- seed;
- sampler cursor / draw start;
- draw count consumed by repeat rejection;
- selected route URL;
- monotonically increasing transaction sequence.

Presentation state, DOM mutation, current filter styling, and renderer callbacks are not authority sources.

Desktop and mobile ROLL must use the same selection transaction authority and the same explicit sampler path.

## Authority boundary

The runtime exposes one narrow transaction authority with this conceptual shape:

```text
begin(action, constraint, corpus_revision)
  -> attempt

attempt.nextFloat()
  -> explicit sampler draw

attempt.commit(route, draw_count)
  -> deeply frozen committed transaction
```

Required properties:

1. `begin()` captures action and the complete selection constraint before sampling.
2. The sampler is explicit. Production selection must not depend on temporary replacement of global `Math.random`.
3. `commit()` is single-use.
4. Failed or cancelled attempts produce no trail record.
5. The committed transaction is deeply immutable.
6. Trail recording consumes the committed transaction directly.
7. Presentation receives the route from the committed transaction; presentation does not manufacture the transaction.
8. Renderer, motion, and disclosure callbacks cannot amend provenance.
9. Desktop and mobile use the same authoritative commit path.

The implementation may keep trail draft persistence, seed lifecycle, and ledger projection in `trail-runtime.js`, but live selection transaction semantics must be isolated behind the narrow authority API rather than spread across DOM observers and shell-specific wrappers.

## Transaction shape

The minimum committed transaction is:

```json
{
  "transaction_version": "r4b1t-selection-transaction/v1",
  "sequence": 1,
  "action": "ROLL",
  "constraint": {
    "terrain": "CODE"
  },
  "corpus_revision": "sha256:...",
  "sampler": {
    "algorithm": "uniform-with-repeat-guard-v1",
    "prng": "mulberry32-v1",
    "seed": "...",
    "draw_start": 0,
    "draw_count": 1
  },
  "route": {
    "url": "https://example.test/route"
  }
}
```

The constraint object must include every selection-affecting input used by the production pool builder. Before implementation, the RED test slice must inventory those inputs rather than assuming terrain is the only constraint.

`draw_start` and `draw_count` are normative because repeat rejection can consume multiple sampler values. Seed alone is not sufficient to identify the exact sampler interval used for an individual route.

For a non-random semantic selection, sampler provenance must be explicit rather than inherited:

```json
{
  "action": "SELECT",
  "sampler": null
}
```

The exact action taxonomy for non-ROLL paths must be frozen from existing product semantics before implementation; the repair must not invent a new action merely to satisfy tests.

## Recording rule

The authoritative flow is:

```text
selection authority commits immutable transaction
-> trail ledger records that exact transaction once
-> presentation reveals transaction.route
-> export projects recorded transactions into a manifest
```

The following must cease to be provenance authority:

- `state.pendingAction`;
- `MutationObserver` inference from `#previewUrl`;
- export-time filter / terrain inspection;
- temporary global `Math.random` replacement.

Those mechanisms may remain temporarily for presentation synchronization only if they cannot create or alter authoritative trail provenance.

## ROLL motion boundary

This decision does not change ROLL Motion Contract v1, Motion Pass 3, or the machine-owned `REVEAL_BOUNDARY`.

The mobile motion machine continues to decide when commit and reveal boundaries occur. The committed payload passed through disclosure becomes the immutable transaction rather than a URL-only result.

No renderer may select, reroll, substitute, filter, or amend a committed transaction.

## Artifact versioning

Do not silently extend the meaning of `r4b1t-trail/v0.1`.

ADR 0002 froze version 0.1 as a specific canonical manifest contract, and existing published version 0.1 trail IDs must remain stable.

New transaction-provenance exports use a distinct format identifier:

```text
r4b1t-trail/v0.3
```

Version 0.3 is the ROLL/reproducible-trail successor format carrying route-level selection provenance.

Version 0.2 remains reserved for Blind Descent and is unchanged.

Version 0.3 may retain familiar top-level fields where useful for display or compatibility, but route-level committed selection data is authoritative for provenance. A mixed-constraint trail must not pretend that the last visible UI filter describes every route.

## Legacy compatibility

Existing `r4b1t-trail/v0.1` artifacts:

- retain their exact canonical bytes and trail IDs;
- remain integrity-verifiable;
- remain replayable;
- are never rewritten as version 0.3;
- are not retroactively assigned transaction provenance that was not recorded.

Persisted version 0.1 drafts do not contain sampler cursor or immutable selection transactions. The implementation must not invent those facts.

On upgrade, legacy recorded routes remain legacy. New provenanced sampling begins only at an explicit new provenance epoch / new trail boundary defined by the implementation slice. Historical trail IDs are never silently changed.

## Provenance verification

Semantic provenance verification is separate from base integrity verification.

A later verifier slice may distinguish:

- `INTEGRITY_VALID / PROVENANCE_PROVEN`;
- `INTEGRITY_VALID / PROVENANCE_UNPROVEN`;
- `INTEGRITY_INVALID`.

Version 0.1 artifacts without transaction records are `PROVENANCE_UNPROVEN`, not invalid.

Version 0.3 provenance is `PROVENANCE_PROVEN` only when the verifier has the exact corpus bytes for the declared `corpus_revision` and can independently replay the declared constraint, sampler interval, repeat guard, and selected route. If those exact corpus bytes are unavailable, integrity may still be valid while provenance remains unproven.

Verifier strengthening belongs in a separate PR from the authority repair.

## Required RED coverage before GREEN implementation

The authority implementation PR must preserve an explicit RED -> GREEN history and cover at least:

1. rendered mobile ROLL exports `action: ROLL`;
2. rendered desktop ROLL uses equivalent transaction semantics;
3. same corpus, constraint, seed, and sampler cursor produce equivalent desktop/mobile provenance;
4. changing UI terrain after selection cannot rewrite the committed transaction or artifact identity;
5. forcing ambient `Math.random` cannot alter ROLL selection;
6. repeat rejection records the exact sampler draw interval;
7. a mixed-constraint trail preserves each route's own committed constraint;
8. non-random selection does not inherit ROLL sampler provenance;
9. commit is single-use and double activation cannot create two transactions;
10. cancellation and renderer removal cannot mutate or manufacture transaction data;
11. published version 0.1 golden vectors retain their exact IDs and remain integrity-valid.

The final PR must be green; failing RED assertions are committed first on the same focused implementation branch, followed by the minimal GREEN authority repair.

## PR sequence

1. **Contract PR**
   - this ADR;
   - documentation only;
   - no failing CI and no production behavior changes.

2. **Shared authority PR**
   - first commit: production-path RED tests;
   - subsequent commit(s): smallest GREEN implementation;
   - shared desktop/mobile authority;
   - no ROLL motion or Blind Descent changes.

3. **Verifier and migration PR**
   - version 0.3 semantic provenance verification;
   - provenance status presentation;
   - legacy draft migration UX and release notes;
   - no rejection or rewriting of historical version 0.1 artifacts.

## Consequences

The repair deliberately adds an explicit transaction boundary instead of adding more shell-specific wrappers around existing DOM observation.

This slightly increases schema/runtime structure, but it removes four competing provenance authorities and makes selection claims attributable to one immutable commit-time record.

The format-version change avoids overstating the guarantees of historical version 0.1 artifacts while preserving their existing integrity and replay behavior.
