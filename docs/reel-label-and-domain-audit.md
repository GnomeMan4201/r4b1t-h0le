# Reel label quality and repeat audit

The active release contains 7,033 unique URL entries across 348 distinct hosts.
Reel labels currently derive from URL paths in `roll-reel.js`, not from the live
page's `<title>` or `og:title`. Numeric/date-only segments such as
`/articles/2024-30`, `/4`, and `/4/4.html` are now displayed with their
domain and full path, rather than falsely implying that `2024 30` or `4`
is a verified document title. This is an honest *identifier fallback*, not
fetched source metadata.

**Title sourcing limitation:** Loading `<title>` or `og:title` before the
selection/reveal boundary would conflict with the current post-selection
metadata contract. A future release could include a reviewed, digest-pinned
title sidecar at corpus build time. Do not label URL heuristics as page titles.

To audit host concentration without affecting provenance:

```sh
node tools/reel_domain_audit.js --terrain ALL,article,reference --rolls 300
node tools/reel_domain_audit.js --terrain ALL,article,reference --rolls 1000 --seed 4201 --json
node --test tests/reel-label-quality.test.js tests/reel-domain-audit.test.js
```

The audit verifies the active URL and terrain index digests, uses production
eligibility, and reports **expected vs observed adjacent transitions** for
two competing models: (1) unrestricted independent URL draws and (2) the
documented `uniform-with-repeat-guard-v1` sampler. It uses a reproducible
Mulberry32-seeded URL choice, but this is an **offline model**, not a
production cryptographic commitment, real browser run, or seed-fairness proof.

The production sampler is `index.html` `ee(pool, rng, reference)`, and the
independent Python verifier in `tools/reexecute_trail.py` lines 535–542
applies the same rule: each attempt is URL-uniform, the previous committed
**URL** (not domain) is rejected, up to 30 attempts. The 30th attempt always
returns a result, even when it repeats the previous URL. Each rejected draw
advances the PRNG cursor and is part of `draw_count`. The first draw in a
new trail uses `reference=null`.

For a fixed 24-URL ARTICLE pool over 300 consecutive rolls:

| Transition | Unrestricted independent expected | Guarded expected | Seeded observed |
|---|---:|---:|---:|
| Identical URL | 12.458 | 1.173e-39 | 0 |
| Same host | 106.934 | 98.583 | 106 |

Host expectation uses the actual ARTICLE host counts: 12 tmpout.sh, 6
sector035.nl, 5 bellingcat.com and 1 hacking.art. These expected values
apply to rolls within **one fixed terrain**, not changing terrain or resetting
the trail. CI pins the expectation formulas, the seeded outputs, the production
30-attempt code path (including singleton and max-draw repeats), and
cross-language re-executor parity. Changing the sampler or simulation
will break tests instead of silently redefining the contract.

On the current release:
- `ALL`: gtfobins.org 478 / 7033 (6.8%); tmpout.sh 12 / 7033 (0.17%)
- `reference`: gtfobins.org 478 / 897 (53.29%)
- `article`: tmpout.sh 12 / 24 (50%); sector035.nl 6 / 24 (25%)

These concentrations can fully explain frequent repeats when using the
corresponding terrain. Changing random selection to suppress repeated hosts
would alter the chance model and must be handled as a separate reviewed
selection/provenance change, not a promotional-video repair.
