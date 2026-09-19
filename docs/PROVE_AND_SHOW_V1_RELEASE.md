# Prove & Show v1 — Release Baseline

Status: RELEASE BLOCKED — PRODUCTION DEPLOYMENT MISMATCH  
Product Contract: `CONTRACT.md` v1.0  
Release tag target: `prove-show-v1.0.0`

## Purpose

This document defines the single repository baseline for the completed Prove & Show phase.

It consolidates the four frozen feature families into one independently checkable release checkpoint and defines the production acceptance threshold before the release tag is created.

## Frozen feature baselines

| Feature family | Frozen baseline |
| --- | --- |
| Trail Topology v2 | `6f2ab698f70f1068fe6d3118725f9d7d49de6c91` |
| Trail Cards v1 | `fa539c093bbfbab5ea641c486f762dc752bc80e0` |
| Trail Comparison / Divergence v1 | `aac99f5da2be2fbbe6cd57d473440a2e69647f2a` |
| Proof Sessions v1 | `42468e1bee297030817279bdf3a78746814d470c` |

These SHAs are normative historical anchors for the four frozen feature families.

The Prove & Show release tag MUST point to the merge commit that accepts this release baseline and production acceptance record. The tag does not replace the four feature-family SHAs above.

## Release contents

### Trail Topology v2

- deterministic proof-backed lineage topology
- canonical relationship handling
- frozen topology specification and conformance boundary
- no selection, ranking, popularity, or recommendation feedback path

### Trail Cards v1

- one-way canonical artifact to portable presentation
- exact source-byte verification binding
- VERIFIED / REJECTED / UNVERIFIED states
- diagnostic separation
- portable source-preserving handoff
- point-to-point sharing only
- detached cards carry no evidence authority

### Trail Comparison / Divergence v1

- exactly two independently supplied canonical inputs
- independent source verification
- deterministic divergence and shared-prefix facts
- direct lineage through canonical verification only
- concealment preservation
- no winner, ranking, similarity percentage, or preference semantics
- portable comparison file set with fresh reinspection

### Proof Sessions v1

- ephemeral local working set for multiple independently supplied trails
- deterministic exact-byte deduplication
- complete VERIFIED unordered pair set
- pair semantics delegated exclusively to frozen Trail Comparison v1
- direct-only relationship graph
- no transitive evidence claims
- fixed closed summary vocabulary
- local multi-file browser UX
- explicit portable export
- offline inspection with fresh recomputation
- portable classifications exactly MATCH / MISMATCH / UNREADABLE
- no automatic persistence or recent-session state

## Phase-wide invariant

The Prove & Show stack is one-way with respect to selection:

```
canonical trails
      |
      +--> Topology v2
      |
      +--> Trail Cards v1
      |
      +--> Trail Comparison v1
      |
      +--> Proof Sessions v1

No proof, presentation, comparison, session, export, wear, or inspection result
feeds back into sampler state, corpus eligibility, route ordering, or future selection.
```

## Production acceptance policy

The production acceptance pass is intentionally bounded.

Its purpose is to determine whether the frozen implementation is correctly deployed and usable, not to reopen the phase for general polish.

### Release-blocking failure

A finding blocks the v1 release tag if any of the following is true:

1. production does not correspond to the intended release commit,
2. a frozen Product Contract invariant is violated,
3. a proof operation produces a materially different result from the frozen implementation,
4. exact-source verification, comparison, lineage, concealment, or portable reinspection is incorrect,
5. Proof Session state persists automatically across close or reload,
6. a proof/presentation feature influences sampler state, corpus eligibility, route ordering, or future selection,
7. canonical or concealed information leaks where the frozen specifications forbid it,
8. the required mobile/browser flow cannot be completed,
9. import, build, remove/recompute, close/discard, export, or inspection has a functional failure,
10. keyboard or phone-width behavior prevents completion of a required flow,
11. a required release or audit gate is red, cancelled, superseded, or not run on the exact candidate head,
12. the deployed asset set is stale or mixed such that production behavior cannot be tied to one candidate commit.

A release-blocking failure MUST be corrected before the tag is created.

### Non-blocking finding

A finding does not block the v1 tag when all frozen behavior remains correct and the issue is limited to presentation or polish, such as:

- cosmetic spacing or alignment,
- non-functional visual inconsistency,
- minor wording or copy issue,
- a documentation typo,
- an aesthetic issue that does not obscure proof state or authority boundaries,
- a non-critical accessibility improvement that does not prevent keyboard or mobile completion,
- a low-risk presentation defect with no trust, privacy, persistence, verification, concealment, or selection consequence.

Non-blocking findings MUST be recorded below and deferred to a patch release such as v1.0.1 rather than silently expanding the v1.0.0 acceptance scope.

### Ambiguous finding rule

If a finding could plausibly affect proof correctness, authority interpretation, concealment, ephemerality, local-first behavior, or selection isolation, it is release-blocking until demonstrated otherwise.

This is the Product Contract clause 6 default applied to release acceptance.

## Production acceptance checklist

Record the exact production candidate commit before testing.

- [x] Production candidate commit recorded below.
- [ ] Public deployment resolves to the intended candidate asset set. **FAIL — live UI differs from candidate.**
- [ ] Existing exploration flow still selects without history-dependent steering.
- [ ] Existing exploration route behavior is unchanged by proof features.
- [ ] Trail Topology v2 renders canonical lineage correctly.
- [ ] Trail Card creation produces expected VERIFIED / REJECTED / UNVERIFIED treatment.
- [ ] Trail Comparison accepts two explicit local files and produces frozen semantics.
- [ ] Concealed Comparison positions do not reveal route identity.
- [ ] Proof Session entry point is available on production. **FAIL — not present on live custom domain.**
- [ ] Phone-width multi-file selection works.
- [ ] Proof Session build works from explicit local files.
- [ ] Exact duplicate files collapse as specified.
- [ ] Removing a selected source recomputes from remaining exact bytes.
- [ ] Removing the final source clears the rendered session.
- [ ] Closing Proof Session clears in-memory selected files and rendered state.
- [ ] Reload does not restore a prior Proof Session.
- [ ] Diagnostic sources remain visible but contribute zero pair/relationship facts.
- [ ] Direct graph edges do not manufacture transitive relationships.
- [ ] Portable Proof Session export preserves exact source files.
- [ ] Offline inspection freshly recomputes before derived facts are accepted.
- [ ] Unmodified portable file set classifies MATCH.
- [ ] Modified stored derived presentation classifies MISMATCH.
- [ ] Missing required portable source material classifies UNREADABLE.
- [ ] README modification does not alter proof conclusions.
- [ ] No proof/session operation requires login, account, or server identity.
- [ ] No proof/session action creates remote telemetry or persistent session state.
- [ ] Desktop and phone-width required flows complete without horizontal overflow that blocks use.
- [x] Required exact-head CI/audit gates are green for the release-baseline PR: Playwright E2E #382 passed on exact head `0c5b9777a375798482098b2df82e16a5f38da965`.

## Production acceptance record

Production candidate commit:

`65b7ee5760fa76d9f72c8af87e8e05f694d21885`

Deployment checked at:

`2026-09-19 — https://r4b1t.badbananaresearch.com/`

Acceptance result:

`FAIL — RELEASE BLOCKED`

### Release-blocking failures

1. **Production deployment does not match the frozen repository build.**
   - The production page returned HTTP 200, but its rendered interface does not contain the frozen `proof session` entry point.
   - Production presents a different instrument shell and command dock than repository `main`.
   - Repository `main` at candidate commit `65b7ee5760fa76d9f72c8af87e8e05f694d21885` contains `proof-session.js`, `proof-session-renderer.js`, `proof-session-import.js`, the `proof session` button, and `#proofSessionOverlay` in `index.html`.
   - This matches release-blocking criteria 1, 8, 9, and 12: production cannot currently be tied to the accepted candidate asset set and the required Proof Session production flow is unavailable.

The `prove-show-v1.0.0` tag MUST NOT be created until production serves the accepted release candidate and the production acceptance pass is rerun.

### Non-blocking findings for patch follow-up

None recorded. The current finding is release-blocking, not cosmetic.

## Release decision

The `prove-show-v1.0.0` tag may be created only when:

1. every release-blocking checklist item passes,
2. the production candidate commit is recorded,
3. all release-blocking failures are resolved,
4. any non-blocking findings are explicitly recorded,
5. the release-baseline PR is merged,
6. the tag points to that accepted merge commit.

## Next phase boundary

Replay / Inspection is not part of Prove & Show v1.

Before implementation, its governing specification must begin from this boundary:

> Replay presents a verified recorded sequence step by step; it must not use replay state, viewing behavior, prior destinations, or proof results to recommend, rank, filter, or select what should be shown next.

Replay may extend the proof and presentation surface.

Replay may not reopen or modify the frozen selection boundary established by `CONTRACT.md` v1.0.
