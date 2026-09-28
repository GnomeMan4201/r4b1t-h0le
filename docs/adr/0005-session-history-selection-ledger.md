# ADR 0005: Session History records route-selection events

Status: Proposed

## Context

The product language describes History as the current-session selection ledger, but current runtime behavior appends `_sessionHistory` from the OPEN/visit path. That makes History an opened-destination ledger rather than a selection ledger.

History is presentation evidence only. It must not become selection authority, recommendation input, popularity state, or a second Trail authority.

## Decision

History records a route when the route becomes explicitly established for the user during the current session.

### Recording events

| Event | Append History? | Boundary |
| --- | --- | --- |
| successful ROLL reveal | yes | after the committed route is revealed |
| BLIND DESCENT concealed commitment | no | identity remains concealed |
| BLIND explicit reveal | yes | after commitment verification and explicit reveal |
| explicit Branch route choice | yes | when the chosen Branch route becomes the current route |
| OPEN DESTINATION | no | navigation/visit is downstream of selection |
| History row revisit | no | reopens an existing recorded route |
| Inspect / Keep / Copy | no | presentation-only actions |
| Trail replay/import | no | inspection of an artifact is not a fresh selection |

### Storage and presentation

- `_sessionHistory` remains session-only and memory-local.
- Storage remains newest-first: `index 0` is the latest recorded selection.
- Presentation may reverse the entries without mutating storage.
- An entry remains `{ url, ts }`; History does not acquire proof or selection authority.
- Distinct selection actions may record the same URL more than once.
- A single selection/reveal action records at most once.

### Trail separation

The existing persisted Trail / visit bookkeeping remains separate.

Opening a destination may still update visited-node state, depth/count, and Trail state as defined by the existing runtime, but it must not append a second History entry.

## Authority boundary

```text
selection authority
    ↓
commit / route choice
    ↓
reveal or explicit route establishment
    ↓
History observes once
    ↓
presentation / OPEN / Inspect

History ─X→ eligible pool
History ─X→ RNG
History ─X→ terrain
History ─X→ commit
History ─X→ future selection
```

History must have zero feedback path into selection.

## Consequences

- A ROLL is visible in History before the user opens the destination.
- Concealed Blind commitments do not leak through History.
- Explicit Blind reveal becomes visible in History without rerolling.
- Branch choices are represented as user-selected routes.
- Reopening a History row never manufactures another History event.
- OPEN DESTINATION does not duplicate the existing selection record.

## Verification

The implementation PR must prove:

1. ROLL reveal appends exactly one History entry before OPEN.
2. OPEN does not append another entry.
3. concealed Blind descent appends nothing.
4. Blind reveal appends the exact revealed URL once.
5. explicit Branch selection appends once.
6. History-row revisit does not append.
7. History actions do not invoke or alter sampler/RNG state.
