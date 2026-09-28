# R4B1T H0L3 Result Experience Contract v1

Status: DRAFT FOR IMPLEMENTATION

## Goal

The revealed route is a discovery decision surface, not a research console.

A user should be able to understand the selected destination and choose the
next action without scrolling through instrumentation.

## Primary loop

The revealed result MUST prioritize:

1. selected resource identity;
2. one clear open action;
3. one honest local keep action;
4. Inspect for deeper metadata;
5. Roll Again.

Mobile vocabulary:

- `OPEN DESTINATION ↗`
- `KEEP CARD`
- `INSPECT`
- `ROLL AGAIN`

Desktop uses the same open / keep / roll-again vocabulary.

## KEEP semantics

`KEEP CARD` delegates to the existing `shareCard()` capability.

It means: render and download the local PNG card for the current route.

It MUST NOT imply:

- server-side bookmarking;
- account persistence;
- recommendation feedback;
- ranking;
- proof authority.

## Primary result content

The primary mobile result MAY show:

- verified resource type;
- source-provided title when available;
- domain;
- source-provided description when available;
- canonical URL.

The primary result MUST NOT show:

- eligibility reason;
- provenance digest;
- proof-state labels;
- Trail Card verification language;
- route-wear instrumentation.

Those details remain available through existing Inspect / Trail / Replay
surfaces.

## Capability preservation

Removing primary-card buttons does not remove capabilities.

- Branch remains reachable through MENU → BRANCH.
- Trail Card creation remains reachable through KEEP CARD and existing desktop
  share-card controls.
- Route Inspect remains reachable directly from the result and through MENU.
- Trail, Replay, Comparison, Proof Session, and Topology remain instrument
  surfaces.

## Presentation boundary

This slice changes labels, hierarchy, and presentation only.

It MUST NOT change:

- corpus authority;
- eligible pool construction;
- terrain constraint capture;
- sampler behavior;
- commit/reveal ordering;
- Trail recording;
- Blind Descent semantics;
- metadata verification.

## Result ownership

One selected route owns the primary stage until the user opens it, keeps a
card, inspects it, or rolls again.

History remains in Trail/History rather than becoming a feed on the result
surface.

## Final invariant

> ROLL discovers. The result explains just enough to act. Inspect explains the
> machinery.
