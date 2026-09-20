# ROLL Motion Contract v1.0

Status: FROZEN

Governs: the ROLL interaction only. Reference implementation for all future r4b1t motion (Blind Descent, Reveal, Topology, etc.), not to be extended to those surfaces until ROLL itself passes its gates on device.

## Purpose

Make ROLL feel like the physical centerpiece of r4b1t while preserving selection integrity. Motion communicates state; it never participates in selection, and it never carries authority over application truth.

## Core invariant

Route selection completes independently of presentation. No animation duration, easing, distance, intermediate position, sound, haptic, or rendered frame may depend on the selected route's identity, URL, domain, category, rank, or other content.

The animation may display the selected route only at the defined reveal boundary. It must never encode information about it beforehand.

Presentation is deterministic: same duration, same acceleration curve, same overshoot, same number of synthetic strip movements, same reveal boundary, on every ROLL. Route-independence is necessary but not sufficient — determinism removes RNG-derived presentation as a variable entirely, rather than merely making it unrelated to route identity.

## State machine

```
IDLE
  ↓ pointerdown
PRESSED
  ↓
COMPRESSING
  ↓ pointerup
RELEASED
  ↓ selection committed
STRIP_ACCELERATING
  ↓
STRIP_DECELERATING
  ↓
LOCKED
  ↓ reveal boundary
CARD_ENTERING
  ↓
SETTLED
```

`LOCKED` means presentation has reached its destination. It does not mean selection occurs there. Selection is committed outside the animation system, at `RELEASED`.

### REVEAL_BOUNDARY is an application event, not an animation event

The renderer may report that it reached `LOCKED`. It does not independently decide that disclosure is now permitted. The state machine — not the renderer — advances to `REVEAL_BOUNDARY` and grants disclosure. The renderer only responds to that state; it never triggers it.

### Cancellation

```
PRESSED / COMPRESSING
  pointercancel → IDLE

RELEASED+
  navigation / reset → CANCELLED → IDLE

new ROLL while active
  → ignored
```

No queuing. One physical action produces one committed result.

### Active ROLL

A ROLL transaction is ACTIVE from entry into `PRESSED` through completion of `SETTLED`.

While ACTIVE:
- additional ROLL activation MUST NOT initiate selection;
- additional activation MUST NOT create or queue another transaction;
- exactly one selection and at most one trail mutation may result from the transaction.

The control becomes eligible for another ROLL only after `SETTLED`.

## Physical behavior

- Touch-down: ~70–100 ms compression, 2–3 px downward travel, slight vertical squash, lower-edge darkening/compression, arrow sinking an additional ~1 px independently.
- Release: ~100–140 ms rebound, small overshoot only. A substantial mechanical switch, not a rubbery spring, not an iOS default button.
- Strip: accelerates quickly, traverses enough material that starting position cannot be visually associated with the result, decelerates, overshoots final alignment by a few pixels, reverses, seats.
- Total perceived duration: target ~600–700 ms, prototyped at ~640 ms and hand-tuned on device. Not treated as a normative number — the state machine and invariants above are normative; the millisecond figures are a starting point for tuning.

## Commit/reveal boundary

```
SELECTION COMMIT
      │
      │   presentation only
      ▼
 [mechanical motion]
      │
      ▼
PRESENTATION LOCK
      │
      ├──── REVEAL BOUNDARY
      ▼
RESULT CONTENT VISIBLE
```

### Pre-reveal non-disclosure

Route-specific result content MUST NOT exist in the rendered DOM or accessibility tree before `REVEAL_BOUNDARY`.

Implementations MUST enforce this through deferred node creation. Visibility mechanisms including `display:none`, `visibility:hidden`, opacity, clipping, off-screen positioning, and `aria-hidden` do not satisfy this requirement.

The result node is created and populated only after `REVEAL_BOUNDARY`.

## Reduced motion

`prefers-reduced-motion` does not eliminate causality:

```
press
  → small immediate depression
  → release
  → committed-state flash/change
  → result
```

No traveling strip, overshoot, large transforms, blur, or spatial movement. The user still perceives action → commitment → consequence.

## Interruption

Test explicitly: pointercancel, drag-out release, double tap, navigation during strip motion, visibility changes, background/foreground, reduced-motion changes mid-session, ROLL after settlement, and ROLL while active.

None may produce two selections, two trail entries, a stale result, a wrong result, an early reveal, orphan animation state, or a stuck disabled control.

Animation completion is never authoritative for committed application state.

## Haptics

Progressive enhancement only. Touch-down, lock, and reveal are visual; commit may optionally add a subtle haptic. No semantic information exists exclusively in vibration.

## Acceptance criteria

**1. Selection integrity** — Removing all animation must leave selection, commitment, trail recording, replayability, and revealed result identical.

**2. Non-disclosure** — With route labels replaced by identical placeholders, an observer recording only animation geometry and timing cannot distinguish which route was selected.

**3. Authority separation** — No renderer callback is capable of creating, changing, repeating, or invalidating a route selection or trail mutation.

```
SELECTION INTEGRITY   — removing motion changes nothing
NON-DISCLOSURE        — observing motion reveals nothing
AUTHORITY SEPARATION  — motion cannot mutate truth
```

## Implementation order

1. This contract (frozen).
2. Conformance test suite, derived directly from the state machine and the three acceptance criteria — written before implementation.
3. Pure motion state machine (no DOM, no rendering).
4. Renderer.
5. iPhone Safari manual pass.
6. Production shadow.
7. Release.

Blind Descent and other motion surfaces are not touched until ROLL passes its own gates and is validated by hand on device. ROLL then becomes the reference vocabulary for the rest of the motion grammar.

## v1.0 implementation clarification — renderer/state ownership

The phrase “The renderer may report that it reached `LOCKED`” describes presentation completion only. It does not grant the renderer authority over the `LOCKED` machine state.

- `LOCKED` is state-machine-owned.
- The renderer may report completion of presentation work associated with locking.
- Renderer messages cannot directly request or force `LOCKED`.
- Renderer messages cannot create or trigger `REVEAL_BOUNDARY`.
- Renderer messages cannot authorize result disclosure.
- `REVEAL_BOUNDARY` originates exclusively within the state machine.
- The renderer observes resulting machine state and renders it.

This clarification changes no v1.0 invariant or acceptance criterion.
