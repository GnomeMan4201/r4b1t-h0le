# Release evidence — 2026-09-18 Worker verification baseline

This record freezes the repository/deployment state that closed the Worker trust-boundary gap tracked in issue #38.

## Identifiers

| Surface | Verified value |
| --- | --- |
| Repository | `GnomeMan4201/r4b1t-h0le` |
| Repository commit | `76cfcb3f9dad365889272891ed1f3cd01b42a602` |
| Worker | `https://r4b1t-proxy.badbanana6969.workers.dev` |
| Cloudflare Worker version | `959f8e67-cd44-425e-96e9-01fd25da5d10` |
| Deployment workflow | `deploy r4b1t worker #9` |
| Deployment workflow run | `35369506203` |
| Tracking issue | `#38` — closed 2026-09-18 |

## Verified gates

The deployment workflow for the commit above completed successfully with all of these gates green:

- locked dependency installation;
- high-severity dependency audit;
- desktop/mobile Playwright suite;
- tracked-secret guard;
- versioned Cloudflare Worker deployment;
- production trust-boundary verification.

The post-deploy verification established the versioned replacement contract at the deployed Worker endpoint: both documented application Origins accepted, unsupported caller Origin rejected, normal public metadata fetch operational, private/local target policy enforced, non-HTTP target policy enforced, legacy `/api` removed with HTTP 410, and the documented security headers present.

## Repository controls represented at this baseline

- versioned Worker source at `worker/r4b1t-proxy.mjs`;
- native Worker DNS resolution with public-address validation;
- redirect destination re-validation;
- bounded redirects, response sizes, and outbound time;
- `global_fetch_strictly_public` defense in depth;
- 60 requests / 60 seconds Cloudflare rate-limit binding;
- production fail-closed rate-limit requirement;
- exact documented caller-Origin policy;
- browser client, audit tooling, deployment workflow, and documentation aligned to the deployed Worker hostname.

## Evidence boundary

This record proves the tested repository/deployment relationship for the identifiers above. It does not prove continued availability or safety of third-party corpus destinations, nor does it claim that later commits or Worker versions retain these properties without re-verification.

The live contract can be rechecked with:

```bash
npm run worker:audit:versioned
npm run claims:verify:live
```
