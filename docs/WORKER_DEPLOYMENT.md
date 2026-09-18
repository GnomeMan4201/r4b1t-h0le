# Worker deployment verification

The Worker source is versioned under `worker/src/`. The deployed service must not be assumed to match repository source until a deployment is performed and verified.

## Pre-deployment gate

- [ ] `npm test` passes.
- [ ] `worker/src/policy.mjs` and `worker/src/index.mjs` are reviewed.
- [ ] `wrangler.toml` points at the intended Worker name.
- [ ] `ALLOWED_ORIGINS` contains only intentional browser origins.
- [ ] the rate-limit namespace is unique for this Cloudflare account.
- [ ] no secrets or credentials are present in repository configuration.
- [ ] issue #38 acceptance criteria have been reviewed.

## Post-deployment evidence

Record:

- repository commit SHA;
- deployment timestamp in UTC;
- Wrangler version;
- Worker route/hostname;
- accepted Origin probe result;
- rejected unrelated/null Origin results;
- public target success;
- loopback/private/link-local rejection;
- encoded loopback rejection;
- redirect-to-private rejection;
- non-HTTP scheme rejection;
- `/api` disabled response;
- `/og` method/CORS/cache headers;
- rate-limit behavior using a bounded test that does not create unnecessary load.

The live deployment should be treated as unverified if the commit SHA cannot be tied to the deployment.
