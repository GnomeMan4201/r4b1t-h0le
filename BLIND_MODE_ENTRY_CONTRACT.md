# R4B1T H0L3 Blind Mode Entry Contract v1

Status: DRAFT FOR IMPLEMENTATION

## Goal

BLIND DESCENT is a primary exploration mode, not a collection of secondary
tools.

When the phone user selects BLIND DESCENT, the primary stage presents one
decision:

`DESCEND BLIND`

Trail maps and other instruments stay available through MENU.

## Mobile Blind stage

The visible entry contains:

```text
COMMIT FIRST / SEE LATER
BLIND DESCENT
Lock one route before it is shown.

[ DESCEND BLIND ↓ ]
```

The entry MUST NOT contain a second `MAP TRAILS` action.

`MAP TRAILS` remains reachable through MENU.

## Mode switch semantics

Selecting the BLIND DESCENT mode:

- hides the ROLL hero/instrument;
- shows the Blind entry;
- does not select a URL;
- does not create a commitment;
- does not reveal a route;
- does not append a Trail route.

Selecting ROLL again returns the ordinary ROLL stage without altering Blind
state.

## Explicit descent semantics

Activating `DESCEND BLIND` keeps the existing Blind authority:

1. open the Blind Descent instrument;
2. create exactly one concealed commitment;
3. advance Blind depth by exactly one;
4. do not expose the committed URL in the ordinary result surface.

This is the existing P1-1 behavior; RD-4P only gives it clearer product
hierarchy.

## Tool ownership

The primary Blind entry does not duplicate:

- MAP TRAILS;
- export snapshot;
- reset genesis;
- Trail / Replay / proof tools.

Those remain inside the Blind instrument or MENU.

## Presentation

The Blind entry should visually match the simplified product direction:

- one red left edge rather than a heavy framed panel;
- one full-width primary CTA;
- no decorative second-action grid;
- concise copy;
- no proof hash or wear instrumentation before entering Blind Descent.

## Non-goals

RD-4P does not alter:

- Blind commitment serialization;
- nonce handling;
- reveal verification;
- corpus revision;
- uniform Blind selection;
- depth semantics;
- return semantics;
- persistent wear inside the Blind instrument;
- topology behavior;
- desktop Blind overlay behavior.

## Final invariant

> Choosing Blind changes the instrument. Descending creates one concealed
> commitment. Nothing is revealed until the user explicitly reveals it.
