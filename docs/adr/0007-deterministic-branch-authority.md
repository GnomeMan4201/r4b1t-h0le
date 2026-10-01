# ADR 0007: Deterministic BRANCH authority

Status: Proposed

## Context

BRANCH is navigation, not the ROLL sampler, but it still offers routes to the user. The shipped implementation mixed several mutable inputs into that offer:

- rendered OG title and description text;
- best-effort Wikipedia enrichment through the Worker;
- page-session topology exclusions;
- ambient `Math.random()` shuffles;
- stable-sort/file-order tie breaking.

Those inputs made a BRANCH offer depend on presentation, network timing, session history, and incidental corpus ordering. They also made the displayed labels sound more semantically certain than the mechanism warranted.

Trail v0.3 now records a BRANCH step as explicit navigation from an earlier step, but deliberately does not claim that the branch label itself is independently proven.

## Decision

BRANCH suggestion authority becomes a deterministic pure function of exactly:

1. the current origin URL; and
2. the active corpus URL bytes.

The implementation is `branch-core.js`, exposed as `R4b1tBranchCore.generate(originUrl, corpusUrls)`.

No other input may affect the generated set or order.

### Forbidden authority inputs

BRANCH generation must not read:

- rendered title, description, hint, badge, or other DOM presentation;
- post-selection resource metadata;
- Wikipedia or any other network enrichment;
- session history, visited-node sets, trail wear, or topology state;
- `Math.random()` or any ambient/random source;
- current file order as an implicit tie breaker.

### Mechanical labels

The four existing labels remain UI vocabulary, but their reasons describe the actual deterministic mechanism:

- **DEEPER** — prefer the same stable URL scope, then strongest URL-token overlap;
- **SIDEWAYS** — different scope with strongest positive URL-token overlap, with deterministic fallback;
- **OPPOSITE** — different scope with zero overlap when available, otherwise weakest overlap;
- **WEIRD** — deterministic release tangent among the remaining candidates.

For GitHub URLs, the stable scope is `owner/repository`; for other URLs it is the normalized hostname. These are structural URL properties only.

The labels are navigation hints. They are not security classifications, recommendations, relevance claims, or quality judgments.

### Tie breaking

Ties use a namespaced deterministic FNV-1a 32-bit rank over:

`origin URL + branch label + candidate URL`

with lexical URL order as the final collision fallback.

The hash is not a randomness or fairness primitive. It exists only to remove file-order authority and make equal inputs reproduce equal outputs.

### Corpus order

The generated result must be invariant to permutation of the same corpus URL set. Exact selected URLs remain the original release strings; URL parsing is used only for structural comparison.

### Trail evidence

Trail v0.3 continues to record:

- the selected BRANCH route;
- `from_step`; and
- the displayed branch label.

This ADR does not widen v0.3 claims. Base v0.3 verification still proves recorded navigation integrity, not independent recomputation of BRANCH semantics. A later verifier may replay `branch-core/v1` against exact corpus bytes if that claim becomes useful.

## Consequences

- BRANCH can be reproduced offline from the active corpus and origin URL.
- Display copy and metadata enrichment can change without changing route offers.
- Session activity no longer suppresses or substitutes branch candidates.
- Repeated SPROUT from the same origin and corpus yields the same four suggestions.
- ROLL selection authority, terrain authority, sampler semantics, Blind Descent, and motion remain unchanged.
