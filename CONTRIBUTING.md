# Contributing to R4B1T H0L3

Low-ceremony. One maintainer. Contributions are welcome when they fit the project's philosophy and preserve the evidence/maintenance boundaries documented in the repository.

---

## Submitting a URL

The most valuable contribution is a URL worth adding to the pool.

**Via the tool:** click **SUBMIT URL** inside r4b1t.  
**Via GitHub:** [open an issue](https://github.com/GnomeMan4201/r4b1t-h0le/issues/new?labels=url-submission) with the label `url-submission`.

### What gets considered

- OSINT tools, frameworks, and methodology resources
- security research blogs and writeups
- threat-intelligence platforms and feeds
- digital-forensics and network-analysis tools
- CTF platforms and training resources
- verified `.onion` addresses with a useful description
- weird, niche, or genuinely hard-to-find corners of the internet

Candidate additions are expected to pass the pool-maintenance liveness checks at review time and a human relevance pass before being accepted. Reachability is time-bounded evidence: a URL that was live during review can still disappear later.

### What usually does not get added

- content that cannot be meaningfully evaluated without an account or subscription
- link farms, SEO aggregators, or low-value directory spam
- generic homepages that add little discovery value
- material that is unlawful to access in the jurisdictions relevant to the project

---

## Reporting a bug

Open an issue and include:

- what you expected
- what actually happened
- browser and OS
- console output when relevant
- the page/repository revision if the behavior may have changed recently

Do not include credentials, private browsing data, or third-party sensitive information in a public issue.

---

## Code contributions

The client is static HTML, JavaScript, and CSS with no production build step. `index.html` is the canonical entry; root modules implement the shell, selection, trails, and proof surfaces. The [application map](docs/architecture/README.md) explains those boundaries. Keep runtime paths stable unless a change has a concrete architectural reason.

Supporting tooling lives in `tools/` and `pool_sweep.py`; the service worker is `sw.js`.

**Before opening a PR:**

- run `npm test`, `npm run claims:verify`, and `npm run docs:verify`
- run `python -m unittest discover -s tests -p 'test_*.py' -v` after installing `requirements-pool-sweep.txt`
- test the mobile layout
- preserve device-local session/trail state and the absence of r4b1t analytics, recommendation profiles, and engagement tracking; [network requests have a separate boundary](docs/WORKER_TRUST_BOUNDARY.md)
- do not introduce new production JavaScript dependencies without a demonstrated need
- preserve the deployed `/r4b1t-h0le/` path behavior
- make targeted changes and verify the affected output before committing

Prefer small, reviewable PRs over framework migrations or unrelated rewrites.

---

## Corpus and tooling

The active source is the digest-bound typed release named by [`corpus/runtime/active-v1.json`](corpus/runtime/active-v1.json). Root `urls.txt` preserves the historical/rollback corpus. A URL submission, liveness observation, tagger output, or edit to `urls.txt` does not promote a resource into the active population.

Follow [corpus governance](docs/operations/CORPUS_GOVERNANCE.md) and the [tool guide](tools/README.md) for pinned catalogs, explicit provenance, deterministic eligibility, release construction, and separate runtime promotion. Preserve source hashes and review evidence. Reachability does not establish safety, truth, or relevance.

For network observations, use the [pool sweep operations guide](docs/operations/POOL_SWEEP_OPERATIONS.md). Keep reports in a scratch directory for review; do not pipe reachability results into a canonical corpus file. The older weekly HTML-rebuild recipe is [historical and incomplete](tools/history/README.md).

---

GnomeMan4201 / badBANANA Research
