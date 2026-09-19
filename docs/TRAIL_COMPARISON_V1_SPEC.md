# Trail Comparison / Divergence v1 — Normative Specification

Status: DRAFT
Scope: proof/presentation only
Contract clauses touched: 3, 4, 5, 6, 7, 9
Depends on: `CONTRACT.md` v1.0 (frozen), Trail Topology v2 (frozen), Trail Cards v1 (frozen)

> Comparison describes relationships between independently supplied artifacts. It never changes what r4b1t selects or shows next.

This sentence governs every other clause in this specification.

---

## 1. Purpose

Trail Comparison / Divergence v1 compares exactly two independently supplied canonical trail artifacts and produces a deterministic description of where their verified histories agree and where they diverge.

The comparison exists to answer questions such as:

- do these trails share verified lineage,
- what verified prefix do they have in common,
- where is the first divergence,
- which later stops differ,
- which positions remain concealed on either side,
- is a claimed parent/fork relationship actually supported by the supplied artifacts.

Comparison is descriptive evidence analysis. It is not recommendation, similarity search, discovery, ranking, clustering, or route selection.

## 2. Inputs are canonical artifacts, never Trail Cards

The only authoritative comparison inputs are canonical trail artifacts supported by the standalone trail verifiers:

- `r4b1t-trail/v0.1`
- `r4b1t-trail/v0.2`

Trail Cards, screenshots, exported images, summaries, labels, or prior comparison results MUST NOT be used as evidence inputs.

Each input MUST be independently verified during the same comparison operation. A prior VERIFIED card or prior successful verification does not satisfy this requirement.

The comparison implementation MUST bind each side to the SHA-256 digest of the exact UTF-8 source bytes supplied to that operation.

## 3. Input roles are symmetric

The two inputs are named `left` and `right` only to make the output addressable.

Neither side is the reference, canonical winner, preferred trail, baseline, control, or recommended path.

Swapping the two inputs MUST preserve the same shared-lineage and divergence facts, with only side-specific fields exchanged.

The comparison MUST NOT assign a score, winner, rank, quality, relevance, trust preference, similarity percentage, or overall better/worse judgment.

## 4. Verification states

Each input is classified independently as exactly one of:

- **VERIFIED** — the exact supplied source bytes successfully verify.
- **REJECTED** — verification ran and positively detected invalidity or tampering.
- **UNVERIFIED** — verification could not be completed, including unsupported artifact format.

These states have the same meanings frozen for Trail Cards v1.

A comparison result may contain derived shared/divergence facts only when both inputs are VERIFIED.

If either side is REJECTED or UNVERIFIED, the result is diagnostic-only and MUST NOT infer a fork point, shared prefix, route difference, lineage relationship, or similarity judgment from unverified material.

## 5. Comparison output is derived presentation, not a new evidence authority

The comparison result is a deterministic derived artifact describing two separately authoritative sources.

It MUST contain:

- exact source format and exact SHA-256 source digest for both inputs,
- each input's verification state,
- when both verify, enough deterministic derived fields to describe shared lineage and divergence,
- a fixed notice that the comparison does not replace either source artifact and that each source must be independently re-verified.

The comparison result MUST NOT become a second canonical trail format.

There is no reverse path:

    canonical trail A + canonical trail B
        --verify both, compare deterministically-->
    comparison result

A comparison result MUST NOT be used to reconstruct, modify, merge, extend, repair, or synthesize a canonical trail.

## 6. Stop identity rules

Comparison is position-aware.

For a revealed v0.1 stop, route identity is the verified `route_id` derived by the canonical trail verifier.

For a revealed v0.2 stop, route identity is the verified revealed route's `route_id`.

For a concealed v0.2 stop, route identity is unavailable by design. Comparison MUST NOT guess, resolve, brute-force, enrich, or infer the concealed route identity.

At each compared position, the public comparison state is one of:

- **MATCH_REVEALED** — both sides are revealed and their verified route IDs are identical.
- **DIFFER_REVEALED** — both sides are revealed and their verified route IDs differ.
- **LEFT_CONCEALED** — left is concealed and right is revealed.
- **RIGHT_CONCEALED** — right is concealed and left is revealed.
- **BOTH_CONCEALED_SAME_COMMITMENT** — both are concealed and the verified commitment identifiers are identical.
- **BOTH_CONCEALED_DIFFERENT_COMMITMENT** — both are concealed and the verified commitment identifiers differ.
- **LEFT_ONLY** — the position exists only on the left after the other trail has ended.
- **RIGHT_ONLY** — the position exists only on the right after the other trail has ended.

No other stop comparison state exists in v1.

A concealed stop MUST never expose a route ID or URL through comparison output.

## 7. Shared prefix and first divergence

The **shared prefix length** is the number of consecutive positions from index 0 whose comparison states prove equality without revealing concealed identity beyond what the canonical artifacts already expose.

A position extends the shared prefix only when its state is:

- MATCH_REVEALED, or
- BOTH_CONCEALED_SAME_COMMITMENT.

The **first divergence index** is the first position whose state is not one of those two shared states.

If every compared position is shared and both trails end at the same length, `first_divergence_index` is null.

If one trail is an exact verified prefix of the other, the first extra position is the divergence index and is classified LEFT_ONLY or RIGHT_ONLY.

No probabilistic, fuzzy, semantic, domain-based, title-based, hostname-based, or content-based similarity may extend the shared prefix.

## 8. Lineage relationship

Comparison may describe lineage only from the canonical parent metadata embedded in the verified source artifacts.

Allowed lineage classifications are:

- **SAME_TRAIL** — both verified source trail IDs are identical.
- **LEFT_PARENT_OF_RIGHT** — right directly names left as parent and the supplied pair passes canonical lineage verification.
- **RIGHT_PARENT_OF_LEFT** — left directly names right as parent and the supplied pair passes canonical lineage verification.
- **SHARED_ANCESTRY_NOT_PROVEN** — the supplied pair shares one or more verified stop positions but neither supplied artifact directly proves a parent relationship to the other.
- **NO_SHARED_PREFIX** — the verified pair has no shared prefix.
- **INDETERMINATE** — lineage facts cannot be derived because at least one input is not VERIFIED.

A shared prefix is not, by itself, proof of common ancestry.

The implementation MUST NOT invent a missing ancestor or infer an unsupplied intermediate trail.

## 9. Direct parent/fork consistency

When one supplied artifact directly names the other as parent, comparison MUST use the existing canonical lineage verifier for that format.

A direct parent relationship is reported only if lineage verification succeeds.

The reported fork position MUST come from verified canonical parent metadata, not from a visual or heuristic comparison.

If parent metadata names the supplied counterpart but canonical lineage verification fails, that input is REJECTED rather than silently downgraded to an ordinary divergence.

## 10. Concealed versus revealed differences

Comparison MUST preserve concealment boundaries.

When one side is concealed and the other is revealed:

- the state identifies which side is concealed,
- the revealed side may expose only information already present in its verified source,
- the concealed side contributes its commitment only where the output schema explicitly allows it,
- the implementation MUST NOT test the revealed route against the concealed commitment in a way that discloses or confirms concealed identity unless the canonical blind-trail verification operation itself has already revealed that stop.

Comparison is observation of supplied proof state, not a reveal oracle.

## 11. Diagnostic-only results

If either input is REJECTED or UNVERIFIED:

- the result MUST clearly identify each side's state and reason,
- no shared-prefix length may be asserted,
- no first-divergence index may be asserted,
- no lineage classification other than INDETERMINATE may be asserted,
- no route comparison states may be emitted,
- the result MUST explicitly state that it does not establish trail comparison facts.

Diagnostic comparison MUST NOT mutate any verified atlas, graph, corpus, sampler, wear state, share history, or future comparison cache.

## 12. Determinism

Given identical left source bytes, identical right source bytes, and the same explicit verification timestamp inputs where timestamps are part of the output, comparison MUST produce byte-for-byte equivalent canonical comparison semantics.

DOM layout, theme, locale formatting, and presentation animations are outside the comparison core and MUST NOT change derived facts.

## 13. Local-first execution

Comparison, verification, and export MUST work without:

- account or login,
- server-side identity,
- network access,
- server-side storage,
- public upload,
- telemetry,
- remote enrichment.

A user may compare artifacts received through point-to-point handoff entirely offline.

## 14. Selection isolation

Comparison is forbidden from reading or writing any state that can affect future route selection.

The comparison core, renderer, import/export, and UI MUST NOT:

- call or configure a sampler,
- mutate corpus eligibility,
- assign route weights,
- update wear as a selection signal,
- infer exploration constraints,
- reorder candidate routes,
- trigger SPROUT/ROLL behavior,
- create recommendation inputs,
- write popularity, engagement, or behavioral scores.

Comparison results MUST NOT be consumed by any of those mechanisms.

## 15. Cross-user boundary

Comparison may accept artifacts generated by different users, devices, or sessions.

Cross-user data may verify or compare only.

Comparison output MUST NOT create:

- user profiles,
- social graphs,
- follower/following relationships,
- public comparison galleries,
- leaderboards,
- similarity rankings,
- “people like you” groupings,
- recommendation paths,
- aggregate steering signals.

## 16. Export and sharing

A portable comparison handoff MAY contain:

- exact left canonical source bytes,
- exact right canonical source bytes,
- deterministic comparison projection,
- a README explaining source authority.

The handoff MUST remain a file set, not a new evidence format.

Both canonical sources remain independently authoritative; the comparison projection remains derived presentation.

Sharing follows the frozen Trail Cards v1 point-to-point boundary. No gallery, recent list, popularity counter, discovery surface, or server-side share record is permitted.

## 17. Renderer requirements

A comparison renderer MUST:

- identify both source digests,
- show both verification states textually,
- show shared-prefix and divergence facts only for two VERIFIED inputs,
- preserve concealment without route leakage,
- distinguish diagnostic-only results structurally from verified comparisons,
- convey all proof and divergence states without relying on color alone,
- remain semantically equivalent on desktop and mobile.

The renderer MUST NOT perform verification itself. It consumes only a validated comparison projection.

## 18. Non-goals for v1

Explicitly out of scope:

- comparing more than two artifacts at once,
- fuzzy similarity,
- content similarity between destination pages,
- domain/category similarity scoring,
- ranking trails by closeness,
- nearest-neighbor trail search,
- automatic discovery of comparison candidates,
- merging trails,
- synthesizing a “best” trail,
- choosing a route based on divergence,
- comparing Trail Cards as evidence inputs,
- public comparison collections.

## 19. Initial implementation order

Trail Comparison / Divergence v1 SHOULD be implemented in this order:

1. frozen comparison-state and projection schema,
2. pure verification + comparison core,
3. deterministic renderer,
4. local two-file import UX,
5. portable point-to-point comparison bundle,
6. final contract audit,
7. freeze v1.

Each slice must preserve the proof-only boundary before the next slice begins.
