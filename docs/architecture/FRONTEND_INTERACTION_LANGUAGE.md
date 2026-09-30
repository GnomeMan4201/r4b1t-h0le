# R4B1T Frontend Interaction Language v1

Status: working design contract for the mobile exploration surface.

This document defines presentation behavior only. It MUST NOT alter route selection,
commit/reveal authority, proof state, corpus membership, trail authority, or evidence
semantics.

## 1. Core rule

Change the experience of operating the machine without changing what the machine decides.

Machine/presentation state and evidence/selection state are separate systems. Presentation
may react to authoritative state; it may never manufacture, predict, substitute, rerank,
or reinterpret authoritative state.

## 2. Attention hierarchy

At any instant the interface has three visual depths.

1. PRIMARY — the single thing the user is operating or receiving now: ROLL, revealed
   destination, or active Blind Descent step.
2. SECONDARY — controls required to continue or leave the current operation.
3. AMBIENT — terrain, scope, hashes, ticks, diagnostics, wear, protocol and machine labels.

Ambient information should remain discoverable but must not compete with PRIMARY.

## 3. Physical vocabulary

MASS
- ROLL face: heavy.
- Chassis: heavier than the face and reacts less/follows later.
- Instrument labels: massless; they do not bounce with the mechanism.
- Revealed route: stable; it replaces the mechanism as PRIMARY rather than floating above it.

DEPTH
- Base plane: shell/chrome.
- Instrument plane: ROLL / Blind Descent.
- Disclosure plane: revealed destination.
- Access plane: MENU.
- Inspection plane: Trail / Comparison / Proof Session / Replay.

TIME
- Contact response is immediate.
- Commitment is a distinct event from contact.
- Travel belongs to the machine after commitment.
- Reveal happens only after the authoritative reveal boundary.
- Settling may delay presentation, never authority.

## 4. ROLL presentation states

The renderer may expose these presentation states:

IDLE
CONTACT
COMPRESSION
COMMITTED
TRAVEL
BRAKE
SEAT
REVEAL
REVEALED

These names do not replace the authoritative roll state machine. They are a projection of
presentation around it.

IDLE
- Chassis at full height.
- Ambient instrumentation visible but quiet.
- ROLL face is the highest-contrast object.

CONTACT
- Immediate shallow face displacement.
- No route information may appear.
- No fake progress.

COMPRESSION
- Face travels farther than chassis.
- Chassis follows with smaller displacement.
- Contrast tightens; no decorative bounce.

COMMITTED
- One tactile/visual commitment punctuation.
- User input no longer visually implies control of the selected route.

TRAVEL
- Ambient chrome recedes.
- Mechanism owns attention.
- Motion remains deterministic.

BRAKE
- Deceleration is visibly longer than initial acceleration.
- No renderer anticipation of destination.

SEAT
- Mechanical motion resolves.
- Short visual quiet point.
- Chassis and face return to stable geometry without elastic/cartoon bounce.

REVEAL
- Authoritative reveal boundary has already occurred.
- Destination replaces the exploration mechanism spatially.
- Domain arrives first; metadata/actions follow.

REVEALED
- Destination is PRIMARY.
- ROLL apparatus is absent from the primary stage.
- ROLL AGAIN is continuation, not equal visual competition.

## 5. Motion principles

- Heavy objects move fewer pixels than light objects.
- Entry and exit directions must preserve spatial memory.
- Closing a layer reverses enough of its opening logic to explain where it went.
- No generic fade may substitute for a meaningful spatial transition.
- No randomized motion.
- No animation may influence selection or evidence.
- Reduced-motion keeps state sequencing and hierarchy while removing nonessential travel.

Initial timing targets are design hypotheses, not frozen constants:
- contact acknowledgement: 35–65 ms
- compression: 70–120 ms
- commitment punctuation: 40–80 ms
- seat quiet point before disclosure emphasis: 80–160 ms
- destination hierarchy build: 180–320 ms

Tune on device. Freeze only after capture/review.

## 6. Reveal choreography

The disclosed route is a payoff, not a card appearing below a button.

Sequence:
1. machine reaches authoritative presentation-complete boundary;
2. mechanism seats;
3. surrounding ambient information reaches minimum emphasis;
4. domain becomes PRIMARY;
5. descriptive metadata enters;
6. actions become available;
7. ambient instrumentation returns only as useful context.

The route domain should carry the strongest typographic scale on the revealed surface.

## 7. Blind Descent

Blind Descent is not a second ROLL skin.

Its spatial vocabulary is vertical/depth-oriented:
- each committed descent advances the visual world deeper;
- prior depth remains perceptible through wear/depth markers;
- RETURN reverses the depth relationship;
- concealed routes stay concealed until their own allowed reveal transition.

No visual treatment may imply verification or authority that Blind Descent does not possess.

## 8. MENU

MENU is an access plane, not a generic app modal.

- Primary stage remains spatially locatable behind it.
- Opening establishes a clear foreground plane.
- Closing reverses that relationship.
- Trail and tools are secondary instruments.
- MENU must not look like another exploration result.

## 9. Inspection surfaces

Trail Comparison, Proof Session and Replay use the same materials but a different mode:

Exploration: space, mass, controlled motion, large hierarchy, few controls.
Inspection: density, stability, explicit labels, small data, immediate controls.

Inspection motion must never make proof state look probabilistic or theatrical.

## 10. Visual material rules

- Near-black base, warm off-white text, red reserved for action/state emphasis.
- Full rectangular borders are scarce. Prefer alignment, rules and negative space.
- Complete boxes imply real containment or a separate plane.
- Instrumentation is ambient unless actionable.
- Display type is rare and large.
- Control type is compact and legible.
- Data is monospace.
- Microtype is never required to understand the primary action.

Avoid: SaaS cards, glassmorphism, decorative gradients, universal rounded corners,
generic 200 ms fades, ornamental animation, popularity/recommendation visual language.

## 11. Mobile physicality

Design for a hand, not merely a viewport.

Verify:
- thumb reach;
- finger occlusion during ROLL contact;
- safe areas;
- portrait and landscape;
- orientation during a transition;
- Safari background/foreground;
- rapid taps;
- interrupted navigation;
- reduced motion;
- 320–430 px phone widths.

## 12. Implementation architecture

Do not continue indefinitely stacking final override blocks.

Next implementation slices should:
1. centralize mobile material/spacing/type/motion tokens;
2. expose presentation state with one explicit state attribute/class surface;
3. consolidate ROLL component rules around those tokens;
4. preserve the existing authoritative machine boundary;
5. add focused regression coverage before behavior changes;
6. verify every motion slice on an actual phone recording before freezing it.

A visual improvement is not complete because CSS renders. It is complete when the state
transition remains correct, the phone capture reads correctly, reduced motion is coherent,
and existing authority/proof tests remain green.
