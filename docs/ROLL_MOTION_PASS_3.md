# ROLL — Motion Pass 3: Energy Transfer (Descent → Reveal)

**Status:** DRAFT
**Scope:** Post-release presentation only (STRIP_ACCELERATING → STRIP_DECELERATING → LOCKED → CARD_ENTERING → SETTLED)
**Relationship to prior work:** Builds on PR #143 (press/release weight, now provisionally locked). Does not modify, extend, or reinterpret `docs/ROLL_MOTION_CONTRACT_V1.md` or its erratum. Pass 3 tunes presentation constants within the boundaries that contract already established.

---

## 1. Purpose

PR #143 established the physical character of press and release. The remaining weak point is the descent/reveal phase: the strip's motion after release does not yet read as the visible consequence of the energy loaded during compression. Motion Pass 3 addresses that gap — acceleration through the travel, braking near the destination, and a single settling correction — without touching selection, disclosure, or authority behavior.

## 2. Normative Invariants

These are binding for this pass and for any future retuning of the same constants:

1. **Directional overshoot.** The strip travels 14–18px past its final seat position in the direction of travel. Overshoot is a single directional excursion, not an oscillation.
2. **Exactly one reverse correction.** After overshoot, the strip makes exactly one backward correction into the final seat. No second bounce, no decaying spring, no multi-cycle settle.
3. **Peak velocity before midpoint.** Forward velocity peaks before the travel's temporal midpoint and decreases through braking until the directional overshoot. The subsequent reverse correction is a single bounded movement into the final seat and introduces no additional forward acceleration or oscillation.
4. **Deterministic fixed curves and constants.** All durations, easing curves, and distances are fixed values, identical on every roll. Nothing in this phase may vary by route identity, by RNG, or by any other input.
5. **REVEAL_BOUNDARY remains machine-owned.** This pass changes renderer presentation only. It introduces no new authority path, no renderer-invoked state transition, and no change to when or how REVEAL_BOUNDARY fires.
6. **Presentation sub-phases are not machine states.** Acceleration, braking, directional overshoot, reverse correction, and seating may be represented as distinct renderer beats and may use distinct fixed easing curves. They do not add lifecycle states or completion authority. Completion of a CSS/keyframe sub-phase cannot trigger selection, disclosure, or REVEAL_BOUNDARY.

## 3. Prototype Tuning Constants (non-normative)

The following are current best-guess values, expected to move after the next on-device iPhone recording. They express intent (the ~40/60 acceleration-to-braking split, defined per the invariants above) and are not contract requirements:

- Acceleration phase: **~260ms**
- Braking/overshoot/seat phase: **~360ms**
- Final reverse correction: consumes roughly the **last 120–140ms** of the braking phase and may use its own fixed easing curve
- Total travel duration: held near the existing ~600–700ms envelope (not lengthened)

Changing any of these values (e.g. 260ms → 240ms) after further device testing is a routine tuning update, not a spec violation, provided the invariants in §2 still hold.

## 4. Rationale

The braking phase is allotted more time than acceleration because that is where the user needs to perceive the destination acquiring mass and locking into position — the felt sense of the strip "deciding" to stop, rather than simply running out of motion. Acceleration establishes that energy was transferred at release; braking and the single correction establish that the energy resolved into a specific, settled outcome.

The correction is visually distinct from the overshoot but remains a renderer-owned presentation sub-phase inside the existing lifecycle. It is not a new state-machine state and does not emit or authorize a reveal transition.

## 5. Unchanged Boundaries

Motion Pass 3 does not alter, and this document does not grant permission to alter:

- Selection or trail commitment logic
- The commit/reveal boundary or REVEAL_BOUNDARY ownership
- DOM/accessibility non-disclosure behavior prior to reveal
- Reduced-motion semantic equivalence
- Interruption/cancellation handling
- Any deterministic-presentation guarantee already established in `docs/ROLL_MOTION_CONTRACT_V1.md`

If tuning work in this pass appears to require touching any of the above, that is a signal to stop and open a separate design discussion — not to extend this document's scope.

## 6. Out of Scope

The following are known issues, logged separately, and are explicitly not addressed by this pass or this document:

- External-page/return flow visual jarring
- Stray `\n` rendered at the upper-left of the Rabbit Hole page after returning

## 7. Implementation Order

1. Commit this document.
2. Add a focused motion test encoding the §2 invariants (directional overshoot magnitude, single correction, peak-velocity-before-midpoint, deterministic fixed constants) — written to fail against current implementation.
3. Tune acceleration/braking/overshoot/seat implementation until the test passes.
4. Run full gate suite.
5. Merge; record a new on-device iPhone pass.
6. Address the two out-of-scope bugs independently.
