# ROLL Authority + Transaction Navigation v1

Status: **FROZEN FOR IMPLEMENTATION**

This contract defines the authority boundary used by the first Previous/Undo slice. It does not change ROLL distribution, Trail v0.3 public schema, Blind Descent, or the frozen ROLL/RESULT/BLIND motion contract.

## Authority invariant

At every observable point there are **zero or one** non-terminal `PREPARED` transactions globally.

A lock holder MUST:

1. acquire the global ROLL Web Lock;
2. resolve the existing `PREPARED` transaction, if one exists;
3. reconcile committed transactions whose reveal/projection completion is not recorded;
4. assert that no non-terminal `PREPARED` remains;
5. persist exactly one new `PREPARED`;
6. deterministically draw from its frozen inputs;
7. atomically allocate `authoritySequence` and persist `COMMITTED` or `FAILED`;
8. release the lock only after the transaction is terminal.

A second non-terminal `PREPARED` is a protocol violation. It MUST NOT be ordered or recovered heuristically.

## PREPARED

`PREPARED` is the write-ahead boundary. It fixes:

- transaction ID;
- current Trail identity and next Trail ROLL sequence;
- corpus digest;
- exact eligible URL snapshot retained for recovery;
- captured selection constraint;
- frozen sampler version;
- structured seed source;
- immutable seed material;
- sampler draw start;
- repeat-guard reference.

Current seed source:

```json
{ "kind": "local-csprng" }
```

A future externally verifiable source is a new `seedSource` variant, not a migration of the record shape.

Once `PREPARED` exists, the draw identity cannot be cancelled or rewritten.

## Frozen sampler registry

Sampler implementations are pure versioned modules. Published versions are immutable.

v1:

```text
uniform-repeat-guard-mulberry32/v1
```

Changing sampler behavior requires a new sampler version.

A sampler receives only persisted preparation inputs. It MUST NOT read current time, current corpus state, network state, UI state, or mutable globals.

## Terminal outcomes

Every `PREPARED` resolves exactly once to:

- `COMMITTED`; or
- `FAILED` with a stable reason code.

Current deterministic failure codes include:

- `CORPUS_SNAPSHOT_UNAVAILABLE`
- `EMPTY_ELIGIBLE_SET`
- `SAMPLER_VERSION_UNAVAILABLE`
- `PREPARED_RECORD_INVALID`
- `SEED_MATERIAL_INVALID`
- `SAMPLER_EXECUTION_FAILURE`

Every terminal outcome receives one globally monotonic `authoritySequence`.

The sequence and terminal record MUST be persisted in the same IndexedDB transaction.

Client timestamps are informational only and MUST NOT establish authority ordering.

## Persistence

Authority state lives in IndexedDB, not localStorage.

Authority writes request strict IndexedDB durability where the browser supports the durability option. Logical recovery remains required even when strict durability is requested.

The app requests persistent browser storage with `navigator.storage.persist()`; granting that request is not itself an authority guarantee.

## Recovery

Any holder of the draw lock owns recovery.

Recovery first resolves the single orphan `PREPARED`, if present, using the persisted eligible snapshot, sampler version, seed material, and draw position.

A crash after terminal commit but before presentation completion remains recoverable. Trail projection is idempotent by authority transaction ID, and recovery may safely replay that projection before presenting the committed result.

## Trail boundary

The authority transaction ID is private implementation metadata on the local draft. It is not added to the public Trail v0.3 selection-transaction schema.

The public Trail ROLL transaction remains `r4b1t-selection-transaction/v2`.

Navigation never appends, removes, or rewrites Trail steps.

Current local-CSPRNG records establish deterministic internal consistency and replayability. They do **not** independently prove that selection was random or unbiased.

## Transaction navigation

Navigation state is tab-local and stored in `sessionStorage`:

```text
transactionId[]
cursor
```

PREVIOUS and FORWARD move only the cursor.

If the cursor is behind the tail and a new ROLL is revealed, forward navigation entries are dropped, matching browser-history semantics.

Repeated resources are allowed. History uniqueness is per authority transaction ID, not per result URL.

Browser Back/Forward and in-app PREVIOUS/FORWARD resolve through the same cursor state. Escape routes through PREVIOUS when no higher-priority dialog or sheet owns Escape.

The visible card exposes `DRAW <authoritySequence>` so two consecutive selections of the same URL are still visibly distinct transactions.

## Rapid input

Before PREPARED, intent is disposable and may be coalesced or cancelled.

Once a draw is active, repeated ROLL activation occupies at most one pending-next slot. Additional activations coalesce into that slot.

Navigation clears a pending-next intent that has not reached PREPARED.

The existing motion machine remains the presentation authority. Durable draw authority is independent of animation completion.

## Test invariants

Model-based and boundary tests MUST assert:

1. non-terminal PREPARED count is always 0 or 1;
2. PREPARED identity never changes;
3. every PREPARED reaches exactly one terminal outcome;
4. authority sequences are unique and monotonic;
5. a committed transaction is projected at most once logically, using transaction-ID idempotence;
6. repeated result URLs may belong to different transaction IDs;
7. cursor navigation never mutates Trail authority;
8. visible DRAW identity resolves to the committed transaction;
9. crash/reload at PREPARED and terminal/reveal boundaries is reproducible from a failing fast-check seed.

## Deferred from this PR

- BroadcastChannel live cross-tab projection updates;
- store-generation / continuity-loss UX;
- quota-management and archival UI;
- externally verifiable chance;
- richer neutral result-card metadata;
- shared-element INSPECT/Trail transitions.
