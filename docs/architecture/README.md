# Application layout

[Documentation map](../README.md) · [Contracts](../contracts/README.md)

The client is served directly as static files. Root runtime paths remain stable because HTML loading, service-worker caching, browser tests, and deployed subpaths depend on them.

| Surface | Source |
| --- | --- |
| Static entry and desktop shell | [`index.html`](../../index.html); [`r4b1t.html`](../../r4b1t.html) redirects to the canonical entry |
| Responsive shell and result presentation | [`dual-shell.js`](../../dual-shell.js), [`dual-shell.css`](../../dual-shell.css) |
| Corpus loading and digest authority | [`corpus-authority.js`](../../corpus-authority.js), [`active-v1.json`](../../corpus/runtime/active-v1.json) |
| ROLL transaction and disclosure presentation | [`roll-production-integration.js`](../../roll-production-integration.js), [`roll-motion-machine.js`](../../roll-motion-machine.js), [`roll-disclosure-boundary.js`](../../roll-disclosure-boundary.js), [`roll-renderer.js`](../../roll-renderer.js) |
| Trail and Blind Descent | Root `trail-*` and `blind-*` modules; [trail](../adr/0002-content-addressed-trails.md) and [Blind Descent](../adr/0003-blind-descent-commit-reveal.md) ADRs |
| Derived proof and inspection surfaces | Root `trail-card-*`, `trail-comparison-*`, `proof-session-*`, `topology-*`, and `replay-inspection-*` modules; [specifications](../contracts/README.md) |
| Production artwork and motion tokens | [`r4b1t-h0l3-production.svg`](../../r4b1t-h0l3-production.svg), [`motion-tokens.js`](../../motion-tokens.js) |
| PWA caching | [`sw.js`](../../sw.js), [`manifest.json`](../../manifest.json) |
| External-fetch boundary | [`worker/r4b1t-proxy.mjs`](../../worker/r4b1t-proxy.mjs), [Worker boundary](../WORKER_TRUST_BOUNDARY.md) |
| Verification and maintenance | [`tests/`](../../tests/), [`tools/`](../../tools/README.md), [CI workflows](../../.github/workflows/) |

[Frontend interaction language](FRONTEND_INTERACTION_LANGUAGE.md), [Motion Pass 3](ROLL_MOTION_PASS_3.md), and [motion sync note](MOTION_SYNC.md) record presentation design and integration context. They do not grant selection authority or replace the [ROLL motion contract](../contracts/ROLL_MOTION_CONTRACT_V1.md). The sync note's separate Site target describes that integration's context, not a claim of current deployment parity.
