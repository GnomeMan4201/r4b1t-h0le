# Worker trust-boundary audit

Date: 2026-09-18  
Deployment: `https://r4b1t-proxy.badbanana6969.workers.dev`

The Worker that supports the browser application is now versioned in this repository at [`worker/r4b1t-proxy.mjs`](../worker/r4b1t-proxy.mjs), deployed through [`.github/workflows/deploy-worker.yml`](../.github/workflows/deploy-worker.yml), and verified against production after deployment.

The current deployment is **production-equivalent** to the reviewed repository contract recorded in [`docs/releases/2026-09-18-worker-verification.md`](./releases/2026-09-18-worker-verification.md).

## Why this boundary exists

The browser shell routes automatic metadata, favicon, preview-image, and optional Wikipedia enrichment requests through the project-controlled Worker. This keeps those automatic third-party requests out of the browser while concentrating the external-fetch trust boundary in one reviewable component.

Browser Origin checks are an abuse-control and CORS boundary. They are **not authentication**: a non-browser client can forge an `Origin` header.

## Current deployed contract

The current production contract was verified on 2026-09-18:

- `https://gnomeman4201.github.io` is accepted as a browser Origin.
- `https://r4b1t.badbananaresearch.com` is accepted as a browser Origin.
- missing, `null`, unrelated, and prefix-confusion Origins are rejected.
- supported routes accept `GET`, `HEAD`, and `OPTIONS`; undocumented `POST` is rejected.
- legacy `/api` returns HTTP 410.
- `/og` accepts normal public HTTPS targets and returns bounded metadata JSON.
- `/proxy` accepts allowed public content classes and rejects unsupported media types.
- loopback, RFC1918, link-local, reserved/private IPv4 and IPv6, alternate loopback spellings, and non-HTTP(S) schemes are blocked.
- DNS answers are validated before fetches and redirect destinations are revalidated on every hop.
- redirects, outbound duration, and buffered response sizes are bounded.
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` are emitted.
- a Cloudflare rate-limit binding enforces 60 requests per 60 seconds per client key.
- production fails closed if the required rate-limit binding or client identity is unavailable.
- `global_fetch_strictly_public` is enabled as defense in depth.

The source performs no application-level request logging of target URLs. Cloudflare platform-level logging or analytics, if enabled at the account level, is a separate operational concern.

## DNS and SSRF boundary

The Worker uses Cloudflare Workers' native `node:dns` support to resolve A and AAAA records before outbound requests. Every returned address must satisfy the public-address policy. Redirect targets are canonicalized, resolved, and rechecked before the next request.

This is paired with `global_fetch_strictly_public` so global `fetch()` uses public-Internet routing. These controls materially reduce SSRF and rebinding risk, but the documentation deliberately does not claim that every possible DNS race is mathematically impossible.

## Rate-limit boundary

`wrangler.toml` defines the `R4B1T_RATE_LIMITER` binding at 60 requests per 60 seconds. The Worker keys the limiter with Cloudflare's `CF-Connecting-IP` value.

With `REQUIRE_RATE_LIMIT=true`:

- missing rate-limit binding → HTTP 503;
- missing client identity → HTTP 503;
- exhausted limit → HTTP 429.

## Reproducing the contract

Static/source checks:

```bash
npm run test:unit
npm run claims:verify
```

Bounded live Worker audit:

```bash
npm run worker:audit
```

Live public-claim verification:

```bash
npm run claims:verify:live
```

The live probes are deliberately bounded and sequential. They do not stress-test the rate limiter.

## Deployment evidence

The verified production baseline is frozen at:

- repository commit `76cfcb3f9dad365889272891ed1f3cd01b42a602`;
- Cloudflare Worker version `959f8e67-cd44-425e-96e9-01fd25da5d10`;
- successful deployment workflow `deploy r4b1t worker #9`;
- closed tracking issue `#38`.

Later commits or Worker versions require their own verification rather than inheriting these claims automatically.

## Historical note

Earlier revisions of this document described a black-box Worker whose source was not yet versioned, rejected the custom-domain Origin, accepted undocumented POST behavior, and exposed a disabled legacy `/api` response instead of HTTP 410. Those observations remain useful history, but they are no longer the current production contract.

The historical changelog may describe the old `/api` route because it records earlier releases. Current behavior is defined by the versioned Worker, tests, deployment workflow, and live verification above.
