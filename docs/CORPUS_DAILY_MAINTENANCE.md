# Daily corpus maintenance

The workflow `Daily Corpus Maintenance` runs at 11:17 UTC daily (06:17 Chicago during daylight saving, 05:17 in winter), or manually from Actions. GitHub may delay scheduled runs. Scheduling starts once this workflow is on the default branch.

It collects fresh links from the 65 reviewed HTML, feed and sitemap indexes in `registry-v2.json`. Two legacy Markdown lists remain pinned and are not rediscovered by this adapter. New publisher sources require an explicit registry review. Collection uses conditional ETag/Last-Modified requests after the first successful fetch. Source failures retain the previous index. Missing source membership never establishes a dead destination.

The first comparison uses each pinned source snapshot as its baseline. Existing unreviewed links in that snapshot are not retroactively admitted. New links accumulate in an unreviewed queue, with source identity and response digest. They are not automatically classified, admitted, ranked or fed into selection. A 10,000-item backlog limit stops advancing an overflowing source, so reviewers can clear the backlog without silently losing discoveries.

Each daily run checks at most 1,000 due URLs from the digest-verified **active runtime release**. Healthy destinations are due after seven days, indeterminate results after two, missing results after one. Checks prioritize never-checked and oldest due URLs. With the current 6,859 active URLs, initial coverage takes approximately a week; it is not a full daily sweep. Twelve workers, half-second minimum gaps per hostname, guarded redirects, bounded source bytes and eight-second health request timeouts limit traffic. Every redirect target is checked for public routability. The reused DNS guard is not a connection-pinned DNS rebinding guarantee.

HEAD rejection and 404/410 responses receive streaming GET confirmation. Only GET-confirmed 404/410 can propose retirement: at least three distinct UTC dates spanning 48 hours, with the newest observation no more than 36 hours old. Same-day reruns cannot count as additional days. A success or indeterminate result breaks the streak. Three or more sampled links from one hostname with at least half missing quarantine that hostname's retirement proposals for review. HTTP 403/429/5xx, authentication, timeouts and guard failures never authorize retirement. A quarantined proposal is also non-authoritative.

HTTP 200 establishes reachability at that moment, not safety, publisher ownership, freshness or continued relevance. A repurposed domain can still respond 200. Content changes and scope drift require review; this pipeline does not claim reliable automated semantic retirement. Old articles, historical exploits and papers remain useful and are not expired by age.

## Evidence and review

`automation/corpus-maintenance` holds the rolling history. Before checking, the workflow restores that branch's `state.json`; malformed or unsupported history fails rather than silently resetting. A missing branch starts with the state on main, or an empty baseline if neither exists. Losing history delays retirement; it never accelerates it.

Each successful run saves `state.json`, `proposals.json` and `report.md`, uploads a 30-day artifact, writes an Actions summary and updates one rolling PR. The bot rebases its evidence onto current main and uses a force-with-lease restricted to this dedicated branch. Do not commit manual work there. Concurrent modification causes the push to fail rather than overwrite it. Closing the PR does not disable the schedule; a later run opens another. Disable the workflow in Actions to pause it.

The job has contents/pull-request write permissions only for schedule/manual runs on main; PR runs execute offline tests with read-only permissions. Repository Actions settings must permit GitHub Actions to create PRs. Bot-created PR checks may require workflow approval; no `pull_request_target` bypass or personal access token is used. If PR creation is disabled, the run fails at that step, while the uploaded evidence and branch remain available.

Review the exact proposed URLs, publisher/source evidence, destination history, resource types and eligibility. Accepted changes need a separate pinned index/review update and deterministic release rebuild. Removal needs an explicit change to the relevant admissions/catalog. Promotion then updates the runtime pointer and runs the existing authority/parity checks. Merging the evidence PR alone neither adds nor removes active URLs.

## Local operation

```sh
python -m pip install -r requirements-pool-sweep.txt
python -m unittest discover -s tests -p 'test_maintain_corpus.py' -v
python tools/maintain_corpus.py --state /path/to/prior/state.json --out-dir /tmp/corpus-maintenance --limit 1000 --workers 12
```

The CLI performs real public network requests. `--limit 0` suppresses active health checks but still collects source indexes. Keep the previous state if you want successive runs to accumulate evidence. Proposed discoveries do not yet receive their own destination health probe: their admission review includes a separate reachability check.
