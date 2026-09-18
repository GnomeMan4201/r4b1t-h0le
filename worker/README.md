# r4b1t-proxy Worker

This directory contains the source baseline for the Worker used by the GitHub Pages application.

## Security contract

The Worker is intentionally narrow:

- accepted browser Origins are exact matches from `ALLOWED_ORIGINS`;
- Origin checks are CORS/abuse controls, not authentication;
- only `GET`, `HEAD`, and `OPTIONS` are accepted;
- target URLs must use HTTP or HTTPS, contain no credentials, and use standard ports;
- literal private, loopback, link-local, reserved, multicast, and local-name targets are rejected;
- hostnames are resolved before fetch and every returned A/AAAA address must be public;
- redirects are handled manually and every hop is revalidated and re-resolved;
- redirects, request duration, and buffered response size are bounded;
- `/proxy` only returns browser-required image/JSON/text/XML content classes;
- `/og` only parses bounded HTML and returns metadata JSON;
- `/api` remains explicitly disabled;
- production requires the `R4B1T_RATE_LIMITER` binding.

The source performs no application-level request logging. Cloudflare platform-level logs/analytics, if enabled in the account, are a separate operational setting and are not controlled by this file.

## DNS limitation

The source performs explicit A/AAAA checks through Cloudflare DNS-over-HTTPS before every outbound hop. That materially narrows DNS-based SSRF, but it does not create an atomic binding between the validated DNS answer and the subsequent TLS connection. The `global_fetch_strictly_public` compatibility flag is enabled as defense in depth so global `fetch()` is routed as public-Internet traffic.

Do not describe this as proof that DNS rebinding is impossible. The source-level guarantee is: public-address DNS answers are required before each fetch and redirect hop, with public-only global fetch routing enabled.

## Rate limit

`wrangler.toml` defines a Cloudflare Workers rate-limit binding named `R4B1T_RATE_LIMITER` with 60 tokens per 60 seconds. The Worker keys that binding using Cloudflare's `CF-Connecting-IP` value.

If `REQUIRE_RATE_LIMIT=true` and the binding or client identity is unavailable, the Worker fails closed with HTTP 503.

## Local verification

The Worker policy is dependency-free and covered by the repository's normal Node test suite:

```bash
npm run test:unit
```

The full repository gate remains:

```bash
npm test
```

## Deployment

Deployment is intentionally separate from merging source.

1. Verify the Cloudflare account/zone and existing Worker before replacing anything.
2. Confirm the `R4B1T_RATE_LIMITER` namespace ID does not collide with another binding in the account.
3. Run the full repository test suite.
4. Authenticate Wrangler to the intended Cloudflare account.
5. Review the diff between the currently deployed Worker and this source if the old source can be recovered.
6. Deploy:
   ```bash
   npx wrangler@^4.36.0 deploy
   ```
7. Re-run the black-box checks in `docs/WORKER_TRUST_BOUNDARY.md`.
8. Record the deployed Git commit SHA in the audit document.

Do not close issue #38 merely because this source exists. Close it only after the deployed Worker is verified to correspond to a reviewed commit.
