# Diverse corpus runtime promotion v1

The user's instruction to proceed accepts the proposed source-boundary admissions
for this cutover. This records an operational admission decision, not a human or
per-page content audit. The exact declarations and evidence limits remain in
[CORPUS_EXPANSION_V1.md](CORPUS_EXPANSION_V1.md).

## Exact authority

`corpus/runtime/active-v1.json` and `corpus-authority.js` promote
`diverse-candidate-v0.2`: 6,859 URLs, 318 hostnames and 13 resource types.

- URL digest: `sha256:ba52be7e2fc9120f3bd1ac2a6bacbc61fc937764e6d4637df8711ec2212bf75c`
- Metadata digest: `sha256:529a3bcf10b0933ce92428932035750ae0fe93f1490aaa1a40c1384d7ec57aca`
- Promotion ID: `diverse-candidate-v0.2-active-v1`

The release manifest retains `status: candidate` and
`selection_authority: false`, which describe the artifact at construction.
Runtime authority is granted separately. Missing or mismatched bytes reject the
load; no automatic fallback is introduced. The sampler remains uniform within
its existing explicit constraints. Source counts and host percentages do not
become selection weights.

All 841 previously active URLs remain. GitHub contributes 471 URLs (6.87%).
The largest host contributes 13.38%; the 750-domain goal remains unfinished.
This cutover broadens resource types substantially, while the admissions remain
focused on cybersecurity and investigation. Further independent publishers and
other discovery scopes need separately reviewed additions.

## Revision cutover and rollback

Existing revision checks reset saved Trail drafts and Blind genesis states
whose revision differs from the new active digest. Imported older artifacts
remain inspectable; they cannot fork into a different active corpus. This uses
the existing migration behavior without changing proof formats or algorithms.

For an explicit rollback to the previous 841-resource release, restore
`corpus-authority.js` and `corpus/runtime/active-v1.json` from commit
`3103b6c9fcb7fa5c433485cc7440c400b3818273`, restore corresponding public claims,
and validate the release digests and cutover tests before deploying. Historical
release bytes are unchanged. The legacy flat pool remains historical rollback
material rather than a hidden fallback.

## Acceptance

Unit tests bind the runtime descriptors and promotion record to the release's
actual bytes and metadata. Browser cutover tests load real checked-in bytes,
assert runtime versus artifact authority and verify the active digest and count.
The production shadow test is now included in the normal desktop/mobile CI
suite alongside ROLL membership and shared ROLL/Trail/Blind load tests. The
Production Shadow workflow waits for deployment, verifies serving parity, and
runs the same cutover checks against the live site on desktop and iPhone. Existing Trail, Blind, mobile provenance and metadata browser tests use
the expanded source.

Broader reachability checks sampled 363 destinations: 311 reachable responses,
52 indeterminate responses/timeouts, and no confirmed 404/410 responses.
Time-bounded observations are stored in
`corpus/expansion/reachability-promotion-v1.json`. The sample is deterministic,
not random; blocked responses and timeouts are indeterminate. These observations
provide no safety or quality assessment and do not automatically remove URLs.

Merging this PR triggers the repository's existing main-to-GitHub-Pages deploy.
Post-deploy acceptance must verify the public active descriptor, exact URL and
metadata digests, route count, ROLL membership, Trail/Blind revision, and absence
of requests to the legacy flat pool.
