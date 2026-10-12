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

The audit verifies the active URL digest, uses the production eligibility core,
and reports expected domain shares alongside a reproducible URL-uniform
simulation. It does **not** claim to use production cryptographic roll
commitments, nor to measure live session outcomes. The previous-route retry
guard is modeled, but does not weight domains.

On the current release:
- `ALL`: gtfobins.org 478 / 7033 (6.8%); tmpout.sh 12 / 7033 (0.17%)
- `reference`: gtfobins.org 478 / 897 (53.29%)
- `article`: tmpout.sh 12 / 24 (50%); sector035.nl 6 / 24 (25%)

These concentrations can fully explain frequent repeats when using the
corresponding terrain. Changing random selection to suppress repeated hosts
would alter the chance model and must be handled as a separate reviewed
selection/provenance change, not a promotional-video repair.
