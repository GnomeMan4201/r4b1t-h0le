# r4b1t Worker trust boundary

## Status

This directory contains the version-controlled replacement/reference implementation for the Worker used by the browser shell.

As of the commit that introduced this document, **production equivalence has not yet been established**. The deployed service at `r4b1t-proxy.gnomeman4201.workers.dev` predates this source and its implementation was not previously committed. Issue #36 remains open until the versioned Worker is deployed and production behavior is verified.

Historical repository claims about the deployed Worker — RFC1918 blocking, one-hour edge caching, a 60 req/min per-IP limit, and origin locking — should therefore be read as deployment claims, not as independently reproducible properties of the old Worker.

## Supported browser routes

The current browser client requires only:

- `GET /og?url=...` — fetch bounded HTML metadata and return JSON.
- `GET /proxy?url=...` — fetch bounded JSON or image content without exposing the browser directly to the upstream host.

The old `/api` path is treated as removed and returns HTTP 410 in the versioned implementation.

## Code-enforced controls

The versioned Worker:

- accepts callers only from the published GitHub Pages origin or `r4b1t.badbananaresearch.com`, using `Origin` with a `Referer` fallback for image requests;
- permits only HTTP and HTTPS targets;
- rejects embedded credentials and non-web ports;
- rejects localhost, private, carrier-grade NAT, link-local, multicast, reserved, and documentation IP ranges covered by the validator;
- resolves hostnames through DNS-over-HTTPS and rejects a target if any returned A/AAAA address is non-public;
- revalidates every redirect target before following it;
- stops after four redirects;
- applies an eight-second outbound timeout per request;
- caps HTML and JSON at 1 MB and images at 5 MB;
- restricts `/proxy` to JSON and image media types;
- does not forward browser cookies, authorization headers, or other caller headers upstream;
- does not log requested target URLs;
- uses explicit no-sniff and no-referrer response policy;
- returns cacheable public responses with a one-hour TTL and uses the Cache API when available.

## Residual boundary

DNS preflight materially reduces rebinding risk but cannot cryptographically pin the subsequent Workers `fetch()` subrequest to the DNS answer returned by the preflight resolver. The Cloudflare Workers network/runtime remains part of the trust boundary. Redirects are revalidated, and direct private/reserved IP literals are rejected before any target fetch.

## Dashboard / platform controls

The repository does **not** currently reproduce a global 60 req/min per-IP rate limit. If production uses a Cloudflare WAF/rate-limiting rule, that configuration must be exported or separately documented before issue #36 can be closed.

The deployed Worker should be built from this repository, and the deployed commit SHA should be recorded here after verification.

## Verification gate

Issue #36 closes only after all of the following are true:

1. the deployed Worker is built from version-controlled source;
2. CI passes the Worker security tests;
3. production `/og` and `/proxy` are verified from an allowed browser origin;
4. blocked-origin, unsafe-scheme, private-address, redirect-to-private, oversized-response, and unsupported-content cases are verified in production or an equivalent staging deployment;
5. any external Cloudflare configuration that contributes to the trust boundary is documented.
