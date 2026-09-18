# Worker trust-boundary audit

Date: 2026-09-18  
Deployment: `https://r4b1t-proxy.gnomeman4201.workers.dev`

This document records black-box observations of the deployed Worker that supports the GitHub Pages application. At the time of that audit, the Worker source was not versioned. A replacement/reference implementation is now versioned at [`worker/r4b1t-proxy.mjs`](../worker/r4b1t-proxy.mjs), but it is **not** claimed to match production until the deployment-equivalence gate in issue #38 is completed.

## Why this matters

The browser shell routes automatic metadata, favicon, preview-image, and optional Wikipedia enrichment requests through the Worker. That keeps those third-party fetches out of the browser, but it concentrates trust in the Worker implementation.

Browser Origin checks are an abuse-control and CORS boundary. They are **not authentication**: non-browser clients can forge an `Origin` header.

## Observed deployed contract

The following behavior was verified externally on 2026-09-18:

- `https://gnomeman4201.github.io` is accepted as a browser Origin.
- missing, `null`, unrelated, and prefix-confusion Origins are rejected.
- `https://r4b1t.badbananaresearch.com` is rejected. The current custom-domain shell does not call this Worker, so this is not presently a production break.
- `/proxy` accepted a normal public HTTPS target.
- `/proxy` rejected tested loopback, RFC1918, and link-local targets.
- decimal, hexadecimal, and octal loopback forms were rejected.
- tested `file:`, `data:`, `javascript:`, `ftp:`, and `gopher:` targets were rejected.
- a tested public redirect to loopback was rejected.
- `/og` rejected a loopback target.
- `/og` accepted a normal public HTTPS target and returned metadata JSON.
- `/api` currently returns a disabled-route response.
- `/og` advertises `GET, POST, OPTIONS` and also responds to `HEAD`.
- `/og` returned `Cache-Control: public, max-age=3600`.
- `/proxy` was observed returning a Cloudflare cache HIT.

No rate-limit headers were observed. The documented 60 requests/minute limit was deliberately not stress-tested.

## What is not proven by black-box testing

The following controls cannot be established confidently without source:

- DNS resolution and DNS-rebinding defenses;
- redirect re-validation on every hop;
- redirect-count limits;
- outbound request timeouts;
- maximum response size before buffering;
- exact content-type policy for each route;
- cache-key construction and cache-poisoning resistance;
- request/log retention behavior;
- whether every private/reserved IPv6 range is blocked;
- whether the deployed Worker corresponds to a reviewable repository commit.

## Required source-level baseline

When the Worker source is added to the repository, the implementation should make these controls explicit and testable:

1. HTTP/HTTPS target schemes only.
2. URL normalization before policy checks.
3. Loopback, RFC1918, link-local, multicast/reserved, and private/local IPv6 blocking.
4. DNS resolution checks before outbound fetches.
5. Redirect target re-validation on every hop.
6. A bounded redirect count.
7. An outbound request timeout.
8. A response-size limit before buffering.
9. Route-specific content-type handling.
10. An exact browser Origin allowlist.
11. Documentation that Origin allowlisting is not authentication.
12. `GET`/`HEAD`/`OPTIONS` only unless `POST` has a documented requirement.
13. Explicit cache TTLs and cache-key rules.
14. An explicit request/log retention policy.
15. Deterministic adversarial tests for the controls above.
16. Deployment instructions that tie the deployed Worker to a repository commit.

## Versioned replacement candidate

The repository now contains a source-level replacement candidate at [`worker/r4b1t-proxy.mjs`](../worker/r4b1t-proxy.mjs), deterministic adversarial coverage in [`tests/worker-security.test.mjs`](../tests/worker-security.test.mjs), and a manual production deployment workflow in [`.github/workflows/deploy-worker.yml`](../.github/workflows/deploy-worker.yml).

The candidate makes the previously unverified controls reviewable in code: target normalization, HTTP/HTTPS-only fetching, public-address DNS checks, private/reserved IPv4 and IPv6 rejection, redirect re-validation, redirect limits, timeouts, bounded response sizes, route-specific media-type policy, explicit caching, and no target-URL logging.

Its intended browser caller policy deliberately differs from the currently observed production Worker in one place: it allows both `https://gnomeman4201.github.io` and `https://r4b1t.badbananaresearch.com`. That policy remains a browser abuse/CORS control, not authentication.

The replacement contract is `GET`, `HEAD`, and `OPTIONS` for supported routes. Undocumented `POST` is rejected. The legacy `/api` route returns HTTP 410.

The deploy workflow is intentionally manual and main-branch-only. It runs the complete test suite before deployment, uses GitHub secrets for Cloudflare credentials, and performs post-deploy checks against the live Worker. Merging this source does **not** deploy it automatically.

A platform-level 60 requests/minute per-IP limit is still not reproduced in repository configuration. If that control exists in Cloudflare WAF/rate-limiting configuration, it remains part of the external trust boundary and must be documented before issue #38 closes.

## Reproducing the deployed and versioned contracts

The repository includes a bounded black-box probe for the live Worker:

```bash
npm run worker:audit
```

That mode checks the contract observed on 2026-09-18: the GitHub Pages Origin is allowed, the custom-domain Origin is rejected, legacy `/api` reports its disabled response, representative private/local targets and non-HTTP schemes are blocked, and a redirect toward loopback remains blocked.

After intentionally deploying the versioned replacement candidate, run:

```bash
npm run worker:audit:versioned
```

The versioned mode expects the replacement contract from `worker/r4b1t-proxy.mjs`: both documented browser Origins are accepted, legacy `/api` returns HTTP 410, POST is rejected, allowed preflight succeeds, the adversarial target checks remain blocked, and the production response exposes the expected security headers.

The probe is intentionally rate-safe and sequential. It does not stress-test Cloudflare rate limiting and does not replace the deterministic source-level tests in `tests/worker-security.test.mjs`.

## Current documentation drift

The historical changelog describes `/api` as an active OG metadata route. The deployed Worker currently reports that route as disabled. Treat the deployed behavior as authoritative until the Worker source and deployment procedure are versioned.

Tracking issue: #38.
