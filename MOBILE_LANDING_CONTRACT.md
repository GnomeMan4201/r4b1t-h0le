# R4B1T H0L3 Mobile Landing Contract v1

Status: DRAFT FOR IMPLEMENTATION

## Goal

A fresh phone session should present one immediate decision:

- ROLL, or
- BLIND DESCENT.

Everything else remains available, but it does not compete with that decision
on the primary landing surface.

## Visible fresh-session hierarchy

Before the first selection, the mobile shell shows:

1. R4B1T H0L3 brand;
2. primary mode switch: ROLL / BLIND DESCENT;
3. the product statement `A HOLE, NOT A FEED.`;
4. one short explanatory line;
5. the active primary instrument;
6. persistent bottom navigation: ROLL / MENU.

The ROLL control MUST be visible without scrolling at the supported
390x844 portrait viewport.

## Removed from the visible landing

The primary landing MUST NOT render separate visible rows for:

- header THEME / HELP / .ZIP utilities;
- TERRAIN FILTER;
- APERTURE / RANDOM status;
- branch/unbounded status.

Those capabilities remain reachable through MENU.

## Compatibility state

The existing `r4mFilterLabel` and `r4mModeLabel` state mirrors remain in
the DOM for compatibility and testability, but they are hidden and carry no
visual hierarchy.

The visible ROLL scope remains the user-facing terrain indication:

- FULL CORPUS;
- CODE ROUTES;
- BLOG ROUTES;
- etc.

## Hero copy

Fresh ROLL mode uses:

```text
RANDOM DISCOVERY / CYBERSECURITY WEB
A HOLE, NOT A FEED.
NO PROFILE. NO RANKING. COMMITTED BEFORE REVEAL.
```

The rabbit aperture remains part of the identity.

## Menu ownership

MENU remains the single home for secondary mobile utilities:

- TERRAIN FILTER;
- BRANCH;
- ROUTE INFO;
- MAP TRAILS;
- HISTORY;
- TRAIL FILE / REPLAY;
- COPY TRAIL;
- COMPARE TRAILS;
- PROOF SESSION;
- VERIFY + REPLAY;
- TOUCH GUIDE;
- THEME;
- .ZIP.

Removing duplicate header/filter controls MUST NOT remove these capabilities.

## Mode ownership

Exactly one primary exploration instrument owns the stage.

ROLL mode:
- shows hero + ROLL;
- hides Blind Descent entry.

BLIND DESCENT mode:
- hides hero + ROLL;
- shows Blind Descent entry.

Returning to ROLL hides the Blind Descent entry again.

Changing primary mode MUST NOT itself select, commit, reveal, or record a
route.

## Non-goals

RD-4O does not alter:

- corpus membership or authority;
- selection distribution;
- terrain semantics;
- commit/reveal ordering;
- Trail recording;
- Blind commitment semantics;
- result-card hierarchy;
- desktop layout.

## Final invariant

> The phone landing explains the product once, exposes one active exploration
> instrument, and moves everything else behind MENU.
