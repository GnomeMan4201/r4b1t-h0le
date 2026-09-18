# r4b1t_h0le Product Contract v1.0 — Prove & Show Phase

**Core promise:** Explore freely. r4b1t does not profile you or steer the next
result. It records, proves, and visualizes the path you actually took.

Anything that changes selection because of observed behavior is out.
Anything that describes, proves, visualizes, preserves, compares, or replays
what happened is in.

## Clauses

1. **Selection is blind to history.** No behavioral signal — session
   activity, hesitation, backtrack count, wear, popularity, collective
   traffic — may influence which route is offered next. Selection reads
   only the corpus, the sampler seed, and any explicit fixed constraint
   selected by the user under clause 8.

2. **Selection precedes exposure.** Whenever a route is subject to delayed
   reveal, challenge, sealed choice, or proof-of-prior-selection semantics,
   its commitment must exist before exposure. Reveal may disclose a prior
   selection; it may never create, substitute, rerank, or filter that
   selection.

3. **Every exported trail is independently verifiable.** A trail card,
   dossier, or topology export must let a third party recompute commitments
   and verify the claimed event sequence, ordering, lineage, and reveal
   consistency without trusting r4b1t's servers or app. Verification proves
   the integrity of the recorded trail; it does not by itself prove that a
   person viewed or interacted with every destination.

4. **The instrument records and displays; it does not recommend.**
   Dossiers, topology, and wear describe what happened. None of them may be
   surfaced as "you might like" or ranked by anything resembling relevance.

5. **Local-first, no account required to prove anything.** Trail creation,
   possession, export, replay, and verification must not depend on a
   server-side identity, profile, or login. A trail must contain everything
   required for its integrity claims to be independently checked.

6. **New features extend the proof surface, not the selection surface.** Any
   proposed feature is evaluated by which surface it touches:
   presentation/verification (in) vs. what-gets-shown-next (out). If a
   feature is ambiguous, it defaults to out until specified otherwise.

7. **Wear and history are diagnostic, not predictive.** They may describe a
   trail's shape after the fact. They may never be read by the sampler, the
   corpus, or any ranking logic, even indirectly through aggregate stats.

8. **User-declared constraints are allowed; inferred constraints are not.**
   A user may explicitly choose a fixed exploration rule — such as
   category, protocol, corpus subset, age range, or independently defined
   site class — and the sampler may operate within that declared subset.
   The system may not infer, activate, tighten, relax, or reorder such
   constraints from observed behavior.

9. **Cross-user data may verify or compare, never steer.** Collaborative
   trails, shared seeds, aggregate verification counts, and divergence
   comparisons may describe relationships between independently generated
   trails. Cross-user data may not alter corpus eligibility, sampler
   weighting, route order, or future selection for any participant.

## Feature review process

Every feature proposal from this point forward gets evaluated against:

- Which clause(s) it touches
- Whether it changes selection in any way, directly or indirectly
- What evidence demonstrates compliance (test, proof scheme, or
  architectural argument)

Ambiguous cases default to **out** (clause 6) until the proposal specifies
exactly how it stays on the proof/presentation side of the line.
