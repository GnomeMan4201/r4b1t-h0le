# R4B1T H0L3 Blind Action State Contract v1

Status: DRAFT FOR IMPLEMENTATION

## Goal

The Blind Descent overlay must not present invalid transitions as if they are
currently actionable.

This slice makes the controls reflect the existing Blind state machine. It
does not create a new state machine.

## READY / depth 000

Before any concealed commitment:

- `DESCEND BLIND` is enabled;
- `REVEAL ROUTE` is disabled;
- `RETURN` is disabled.

The user cannot reveal something that has not been committed and cannot return
above depth zero.

## CONCEALED / depth > 000

After an explicit descent creates a concealed commitment:

- the descend action remains enabled and reads `DESCEND DEEPER`;
- `REVEAL ROUTE` becomes enabled;
- `RETURN` becomes enabled.

Both descending deeper and revealing are valid choices.

## REVEALED

After the most recent concealed route is revealed:

- `REVEAL ROUTE` becomes disabled until another concealed commitment exists;
- `DESCEND DEEPER` remains enabled;
- `RETURN` remains enabled while depth is above zero.

Reveal verification and ordinary route projection remain unchanged.

## RETURN

When return reaches depth zero:

- `RETURN` becomes disabled.

Returning does not delete or mutate existing commitments.

## Secondary tools

The following remain available regardless of primary-action state:

- EXPORT PUBLIC SNAPSHOT;
- MAP TRAILS;
- NEW GENESIS;
- CLOSE.

## Accessibility

Disabled transitions use the native `disabled` attribute so:

- pointer activation cannot fire them;
- keyboard focus traversal skips them;
- assistive technology receives native disabled semantics.

Visual styling may reinforce disabled state but must not substitute for the
native attribute.

## Authority boundary

RD-4Q does not change:

- commitment creation;
- commitment hashes;
- nonce handling;
- uniform route selection;
- reveal verification;
- corpus revision;
- manifest serialization;
- depth arithmetic;
- public/private persistence;
- return behavior;
- keyboard/API access to the existing exported Blind functions.

Programmatic `blindReveal()`, `blindReturn()`, and `blindDescend()` retain
their existing validation behavior. This contract governs presentation
controls.

## Final invariant

> The Blind controls tell the truth about the current state: commit first,
> reveal only when something is concealed, and return only when below the
> surface.
