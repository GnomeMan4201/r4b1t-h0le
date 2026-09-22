# Workstream Status

This file is the coordination handoff for parallel ChatGPT/Codex workstreams.

## Ownership model

- **Account 1 — Product / UX lab:** mobile/desktop behavior, information architecture, accessibility, labels, presentation, rendered-affordance tests. It may prepare patches, but does not own publication or merge.
- **Account 2 — Integrity / red-team lab:** provenance, proof/replay boundaries, async races, offline behavior, reset semantics, adversarial reproductions. It normally stops before remediation.
- **Integrator / release lane:** owns GitHub publication, PR creation, CI triage, merge, deployment verification, and cross-workstream conflict resolution.

Workers should begin by reading current `main` and this file. Repository state remains authoritative over stale handoff text.

## Current main

`7c962a17b6867d185ac36fa8abb12ebc341adfff`

## Product / UX lane

### Completed

- P0-1 Trail Comparison mobile reachability.
- P0-2 Proof Session mobile reachability.
- P0-3 cross-shell capability reachability contract.
- P1-1 Blind Descent entry semantics — intentional shell adaptation.
- P1-2 explicit mobile Random-mode reachability.
- P1-3 Topology vs Wear Sample discoverability — presentation/IA defect.
  - PR #153 merged.
  - Mobile now promotes **MAP TRAILS** through the existing canonical snapshot → Topology path.
  - **VIEW SAMPLE** remains inside Topology.
  - No Topology/wear/proof/selection/motion semantics changed.
- P1-4 Route Info vs Replay / Proof labeling — labeling/IA defect.
  - PR #155 merged.
  - Mobile fixed navigation now says **ROUTE INFO** while the sheet remains **INSPECT ROUTE** and evidence inspection remains **REPLAY / INSPECTION**.
  - Presentation text only; no proof/replay or route behavior changed.

### Queued

P2-1 — **Submit URL mobile parity** is classified as a genuine capability loss with misleading desktop terminology.

Frozen product meaning:

> Suggesting a URL opens a pre-filled public GitHub issue for human review. It does not add the URL to the corpus, session, trail, or evidence state and does not guarantee inclusion.

Approved direction after the CF-1 authority repair lands:
- desktop label **submit url** → **suggest url**;
- mobile **ROUTE INFO** gains **SUGGEST THIS URL ↗**;
- mobile delegates to the existing `submitUrl()` function;
- no in-app free-text submission form, corpus write, trail/evidence mutation, or duplicated issue construction.

Implementation is intentionally queued because it touches `index.html`, which is also expected to participate in the active CF-1 authority repair. Do not create concurrent production edits in that file.

## Integrity / red-team lane

### CF-1 — CONFIRMED

Executable production-path reproduction confirms that the mobile v0.1 ROLL export can carry inaccurate provenance while remaining internally verifiable:

- mobile ROLL exported action **SELECT** instead of **ROLL**;
- declared sampler/seed did not independently reproduce the selected mobile route;
- changing terrain after selection rewrote exported terrain provenance;
- that metadata mutation changed `trail_id`;
- `route_id` remained stable;
- existing v0.1 verification still accepted the artifact;
- desktop production ROLL did not show the action-provenance mismatch.

No claim has been established against Blind Descent / v0.2.

### Contract

ADR 0004 is merged and freezes the immutable selection transaction authority. New truthful transaction-provenance ROLL trails use `r4b1t-trail/v0.3`; legacy v0.1 remains byte/ID-stable and integrity-valid; Blind Descent v0.2 is untouched.

### Active

CF-1 shared selection authority implementation is authorized on Account 2.

Required sequence:
- commit production-path RED tests first;
- implement the smallest GREEN shared authority repair;
- remove pending-action inference, DOM mutation observation, export-time terrain lookup, and temporary global `Math.random` replacement as provenance authority;
- preserve ROLL Motion Contract v1, Motion Pass 3, and machine-owned REVEAL_BOUNDARY;
- stop before the separate provenance-verifier/migration slice.

## Publication rules

Parallel worker sessions do **not** own publication.

For each task, return a handoff packet with:

- workstream;
- classification;
- base main SHA;
- finding/goal;
- repository evidence;
- exact files to change;
- whether production behavior changes;
- prepared commit/patch and changed-file stats;
- tests and results;
- frozen boundaries untouched;
- next safe action;
- explicit stop condition.

The integrator recreates/publishes the branch, opens the PR, inspects CI, and merges only when required gates are green.

## Conflict rules

- Do not let Account 1 and Account 2 modify the same authority boundary concurrently.
- Product/UX work may continue in parallel with integrity investigation only when file/semantic scope is independent.
- CF-1 remediation outranks cosmetic polish once its repair design is approved.
- Never bundle unrelated audit findings into one PR.
