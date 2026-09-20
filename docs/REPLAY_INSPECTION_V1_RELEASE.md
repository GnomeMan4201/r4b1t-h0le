# Replay / Inspection v1 — Release Baseline

Status: RELEASE CANDIDATE ACCEPTED — PRODUCTION VALIDATED
Product Contract: `CONTRACT.md` v1.0
Governing specification: `docs/REPLAY_INSPECTION_V1_SPEC.md` (frozen), audit record `docs/REPLAY_INSPECTION_V1_AUDIT.md`
Delegation boundary: `docs/REPLAY_INSPECTION_V1_DELEGATION.md`
Release tag: `replay-inspection-v1.0.0` (created from the release-record merge commit)
Baseline dependency: `prove-show-v1.0.0`

## Purpose

This document defines the release checkpoint for Replay / Inspection v1 as its own
independent release, per `docs/PROVE_AND_SHOW_V1_RELEASE.md` §"Next phase boundary."
It does not reopen or modify the frozen meaning of Prove & Show v1, Trail Cards v1,
Trail Comparison v1, Proof Sessions v1, Trail Topology v2, or Product Contract v1.0.

## Frozen feature baseline

| Milestone | Commit / PR |
| --- | --- |
| Replay / Inspection v1 pure core (state machine, exact-byte verification, source states) | `ceea5efe17c987ee4952756c7a98bd6fa8f5c4cf` (PR #125) |
| Multi-source / direct-lineage delegation boundary | `2b7b504b5acce41c4aeda331089e5df48df1a9a0` (PR #126) |
| Production entry point (Replay wired into the production shell) | `e7bb3184a9506b6566ff819f971acf5e65499bd5` (PR #128, `feat/replay-inspection-production-entry`) |
| Production acceptance harness merge | `84aa3198e0ce09b4bf6c9d662275fbe99367ebdc` (PR #129, `release/replay-inspection-v1-production-acceptance`) |

`84aa3198e0ce09b4bf6c9d662275fbe99367ebdc` is the accepted harness baseline and is a
direct descendant of `e7bb3184a9506b6566ff819f971acf5e65499bd5` (verified by ancestry
check). The `replay-inspection-v1.0.0` tag targets the later documentation-only merge
commit that adds this release record, so the immutable release includes its own
acceptance evidence without changing production application bytes.

## Release contents

Replay / Inspection v1 adds, on top of the frozen Prove & Show v1 baseline:

- local, deterministic replay/inspection of explicitly supplied r4b1t artifacts
- exact-byte SHA-256 verification before any evidentiary rendering
- frozen `VERIFIED` / `REJECTED` / `UNVERIFIED` source states
- `UNLOADED → READING → VERIFYING → ... → INSPECTING` lifecycle with concealed-route
  protection and defensive state snapshots (spec §7, §9, §10)
- deterministic multi-source inspection: explicit import order, exact-byte
  deduplication only, no auto-generated pairs
- black-box delegation through `proofSession.build()`, `proofSessionBundle.inspect()`,
  and `trailComparisonBundle.inspect()` — no second comparison/session algorithm
  inside Replay (spec §14, §15, §16;
  `docs/REPLAY_INSPECTION_V1_DELEGATION.md`)
- direct-only lineage: no transitive `A→C` manufacture from verified `A→B` and `B→C`
  facts
- dependency-scoped `UNREADABLE`: an unreadable source blocks only the facts that
  require it
- production entry point wired into the existing dual desktop/mobile shell, with no
  path from Replay state to sampler, corpus eligibility, or route ordering

The production entry point in PR #128 includes the local single-source Replay UI.
Multi-file Replay import UI (exposing the delegation layer through local portable
bundle import) is explicitly out of scope for `v1.0.0` — see "Next phase boundary"
below.

## Production acceptance policy

This release follows the same acceptance policy as `prove-show-v1.0.0`
(`docs/PROVE_AND_SHOW_V1_RELEASE.md`): a finding is release-blocking if it violates a
frozen Product Contract or Replay spec invariant, produces a materially different
proof/comparison/lineage result than the frozen implementation, leaks concealed or
canonical information where forbidden, persists Replay state automatically, or lets a
Replay feature influence sampler/corpus/selection state. Cosmetic, wording, or
non-critical presentation issues are non-blocking and deferred to a patch release.
Ambiguous findings are treated as release-blocking until demonstrated otherwise
(Product Contract clause 6 default).

## Production acceptance record

Production candidate commit:

`e7bb3184a9506b6566ff819f971acf5e65499bd5`

Acceptance harness merge commit:

`84aa3198e0ce09b4bf6c9d662275fbe99367ebdc`

### Live production acceptance

**Replay Inspection v1 Production Acceptance #4** — run
[`35504891244`](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/35504891244) —
**Success** (triggered by push `aaaf1bf` to
`release/replay-inspection-v1-production-acceptance`, September 20, 2026 10:22, total
duration 50s).

This workflow (`.github/workflows/replay-inspection-v1-production-acceptance.yml`)
pins `PRODUCTION_CANDIDATE_SHA=e7bb3184a9506b6566ff819f971acf5e65499bd5`, proves the
acceptance harness changed none of the release-critical Replay/Prove-&-Show bytes
relative to that candidate, then runs (in order): locked dependency install, high-
severity dependency audit, the full frozen Product Contract/proof unit gate
(`npm run test:unit`), a targeted re-run of the Replay core and delegation gates, live
production serving-layer parity re-verification, and live desktop + iPhone-width
Playwright acceptance against `https://r4b1t.badbananaresearch.com/`. All steps
passed on this run.

### Post-merge gates on the accepted commit

Verified individually (not inferred from the workflow-run listing):

- **Playwright E2E #427** — run
  [`35504991239`](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/35504991239)
  — **Success**
- **Production Shadow #68** — run
  [`35504991366`](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/35504991366)
  — **Success**
- **Deploy to GitHub Pages #233** — run
  [`35504991424`](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/35504991424)
  — **Success**
- **Replay Inspection v1 Audit #20** — run
  [`35504991208`](https://github.com/GnomeMan4201/r4b1t-h0le/actions/runs/35504991208)
  — **Success**

All four were triggered by the same push of `84aa3198e0ce09b4bf6c9d662275fbe99367ebdc`
to `main` (the PR #129 merge commit), September 20, 2026 10:24.

### Local re-verification (this acceptance pass)

Run from a fresh clone at `origin/main` = `84aa3198e0ce09b4bf6c9d662275fbe99367ebdc`:

```
npm ci --no-audit --no-fund
npm run test:unit
```

Result: **292 / 292 passing, 0 failed** (includes `replay-inspection-core.test.js`
and `replay-inspection-delegation.test.js`).

**Not re-run locally:** `npm run test:e2e` (Playwright). This sandbox has no
Chromium binary and no route to the Playwright browser CDN or to
`r4b1t.badbananaresearch.com`, so the live browser/serving-layer legs of acceptance
could not be independently repeated here. That coverage is not missing from the
release — it already ran and passed in CI as the linked Production Acceptance #4 and
Playwright E2E #427 runs above — it is simply not something this environment could
re-execute a second time.

### Release-blocking failures

None found in the above verification.

### Non-blocking findings for patch follow-up

None recorded.

## Release decision

Every condition this document can verify from repository state and linked CI
evidence is satisfied:

1. production candidate commit recorded and byte-pinned by the acceptance harness,
2. acceptance harness merge commit recorded as the accepted baseline,
3. live production acceptance workflow passed on the exact candidate,
4. all four post-merge gates (E2E, Pages, Replay audit, Production Shadow) passed on
   the exact accepted merge commit,
5. local re-run of the full frozen unit/contract suite passes on that same commit,
6. no release-blocking failure found.

**Remaining before the tag is created:** merge this documentation-only release record,
verify the resulting merge commit, then create the tag and GitHub release from that
exact merge commit.

## Finalization sequence

1. Merge this document into `main` (or land it in the same manner as
   `PROVE_AND_SHOW_V1_RELEASE.md` was landed).
2. Confirm the documentation-only merge changed no production application bytes and
   that its triggered repository gates are green.
3. Create the annotated tag on the release-record merge commit:

   ```
   git tag -a replay-inspection-v1.0.0 <release-record-merge-sha> \
     -m "Replay / Inspection v1 — production accepted"
   git push origin replay-inspection-v1.0.0
   ```

4. Create the GitHub release from that tag (e.g. via `gh release create
   replay-inspection-v1.0.0 --title "Replay / Inspection v1" --notes-file
   docs/REPLAY_INSPECTION_V1_RELEASE.md`), or via the UI.
5. Close PR [#72](https://github.com/GnomeMan4201/r4b1t-h0le/pull/72)
   (`feat/topology-export-schema-v01`), PR
   [#89](https://github.com/GnomeMan4201/r4b1t-h0le/pull/89)
   (`feat/trail-card-share-ux`), and PR
   [#90](https://github.com/GnomeMan4201/r4b1t-h0le/pull/90)
   (`feat/trail-card-share-export`) as superseded. All three were confirmed open and
   targeting `main` in this session. `main` already carries `trail-card-share.js` /
   `trail-card-share.css` (the point-to-point Trail Card handoff both #89 and #90
   independently propose) as of commit `ceea5efe17c987ee4952756c7a98bd6fa8f5c4cf`
   (PR #125) or earlier, and the universal independent topology verifier #72/#89
   describe is likewise already present. All three PRs' stated functionality is
   confirmed superseded; none needed to be taken on faith.

## Next phase boundary

Replay / Inspection v1 ships as a proof/presentation surface with a production entry
point but no multi-file import UI.

The next meaningful feature is multi-file Replay UI: exposing the existing Proof
Session and Trail Comparison delegation layer (`docs/REPLAY_INSPECTION_V1_DELEGATION.md`,
`replay-inspection-delegation.js`) through local portable-bundle import. The
underlying verification, comparison, and session logic is already frozen and
covered by `tests/replay-inspection-delegation.test.js`; only the user-facing import
and inspection surface — accepting multiple local files or a portable bundle,
presenting per-source and per-pair results, and rendering Proof Session `MATCH` /
`MISMATCH` / `UNREADABLE` classifications — remains to be built. It must not
reopen or relax any invariant already frozen in `docs/REPLAY_INSPECTION_V1_SPEC.md`
or `docs/REPLAY_INSPECTION_V1_DELEGATION.md`.
