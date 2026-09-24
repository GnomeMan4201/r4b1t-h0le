# Workstream Status

This file is the coordination handoff for parallel ChatGPT/Codex workstreams.

## Ownership model

- **Account 1 — Product / UX lab:** mobile/desktop behavior, information architecture, accessibility, labels, presentation, rendered-affordance tests. It may prepare patches, but does not own publication or merge.
- **Account 2 — Integrity / red-team lab:** provenance, proof/replay boundaries, async races, offline behavior, reset semantics, adversarial reproductions. It normally stops before remediation.
- **Integrator / release lane:** owns GitHub publication, PR creation, CI triage, merge, deployment verification, and cross-workstream conflict resolution.

Workers should begin by reading current `main`, `CONTRACT.md`, and this file. Repository state remains authoritative over stale handoff text.

## Verified release baseline

Current audited `main`:

`ec614b672aa36596f1195802451afaf2f523e4d6`

Post-merge release verification on this commit:

- GitHub Pages — PASS.
- Playwright E2E — PASS.
- Replay Inspection v1 Audit — PASS.
- Production Shadow — PASS on rerun after the custom-domain cache window cleared.

This commit closes the frozen P0–P3 mobile audit/polish queue. New work should not reopen that queue without fresh evidence from the current integrated product.

## Product / UX lane

### Closed mobile audit / polish baseline

- P0-1 — Trail Comparison mobile reachability: complete.
- P0-2 — Proof Session mobile reachability: complete.
- P0-3 — cross-shell capability-reachability contract: complete.
- P1-1 — Blind Descent shell semantics: frozen as intentional shell adaptation.
- P1-2 — Random ↔ Branch mobile capability parity: complete.
- P1-3 — Topology vs Wear Sample discoverability: complete.
- P1-4 — Route Info vs Replay / Proof labeling: complete.
- P2-1 — URL suggestion mobile parity: complete. Mobile delegates to the existing `submitUrl()`; suggestion opens a pre-filled public GitHub issue and does not mutate corpus, session, trail, or evidence state.
- P2-2 — Copy Trail mobile parity: complete. Mobile delegates to the existing `shareTrail()`.
- P2-3 — mobile Help adaptation: complete.
- P2-4 — mobile theme control: complete using the existing `html.light` / `r4b1t_theme` system.
- P2-5 — duplicate History / Replay mobile IA cleanup: complete. History and Replay have one persistent bottom-navigation entry each.
- P3-1 — mobile landscape width utilization: complete.
- P3-2 — Trail / topology density and typography: complete.

The mobile workstream is closed at the verified release baseline above.

## Integrity / red-team lane

### CF-1 — repaired and merged

The prior CF-1 reproduction established that the old mobile ROLL path could export inaccurate selection provenance while remaining internally verifiable.

The shared selection-authority repair is now landed. Current production:

- commits selection through the shared immutable ROLL authority;
- records selection-time terrain and sampler state;
- no longer uses pending-action inference, DOM mutation observation, export-time terrain lookup, or temporary global `Math.random` replacement as provenance authority;
- preserves the frozen ROLL Motion Contract and machine-owned reveal boundary.

Do not treat the historical CF-1 finding as an active remediation item on current `main`.

ADR 0004 remains the architectural authority for truthful transaction provenance. Legacy format compatibility and Blind Descent boundaries remain governed by their existing specifications and tests.

## Active release-audit lane

The P0–P3 mobile queue is complete. The active lane is now a fresh whole-product release audit against current `main`.

Audit the integrated product rather than assuming the previous checklist is exhaustive. Priorities:

- Product Contract clauses and selection/proof authority boundaries.
- Desktop/mobile capability reachability and semantic parity.
- Proof, Replay, Trail Comparison, Trail Cards, Topology, and Proof Session delegation boundaries.
- Privacy and controlled network boundary.
- Accessibility, focus, keyboard/touch reachability, and orientation behavior.
- Motion authority and reveal-boundary preservation.
- PWA/offline behavior and repository/deployment path consistency.
- Repository `main`, GitHub Pages, and custom-domain byte parity.

Each finding should be classified from current evidence before remediation. Do not create a new polish queue merely because the previous one closed.

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

- Do not let Product / UX and Integrity / red-team work modify the same authority boundary concurrently.
- Product/UX work may continue in parallel with integrity investigation only when file and semantic scope are independent.
- Integrity defects outrank cosmetic polish once remediation is authorized.
- Never bundle unrelated audit findings into one PR.
- Do not reopen completed P0–P3 work without current-main evidence.
