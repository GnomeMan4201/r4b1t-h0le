# Selection Transaction v3

Status: frozen for implementation; not production selection authority until the v3 integration gate is merged.

## 1. Purpose

v3 changes ROLL from URL-uniform selection to deterministic, auditable, site-aware two-stage selection while preserving v1/v2 replay semantics unchanged.

The eligible URL set is still produced before selection by the existing release, terrain, and protocol-policy authorities. v3 groups only that already-eligible set.

## 2. Site identity

The grouping function is `site-key/v1`.

Inputs are pinned by content hash:

- PSL source snapshot: `selection/site-key-v1/public_suffix_list.dat`
- PSL source: publicsuffix/list commit `6cd82aff889e3d64e5e03bc5c1f43da1934a960a`
- PSL source SHA-256: `sha256:102b252c18b5f87f4c81f017e75282a82c18e00cd0c2e601b5b02a0f7a601f2c`
- authoritative ASCII PSL derivative: `selection/site-key-v1/public_suffix_list_ascii_v1.dat`
- ASCII PSL derivation: `unicode-nfc-lower-rfc3492/v1`, sorted and deduplicated once at freeze time
- authoritative PSL SHA-256: `sha256:2b44fcd3f7a3da5f9d326073a495629a65eaf66c88a9f018b494067933f026e8`
- platform override table: `selection/site-key-v1/platform-overrides.json`
- override SHA-256: `sha256:36945dc17210612eb86f3e46762601467d81f0355e8f8dceceb4e13a3e0f003d`

Every v3 transaction MUST commit both hashes and `site_key_version: "site-key/v1"`.

### 2.1 URL/host normalization

For an HTTP(S) URL:

1. Parse the URL.
2. Use the hostname only; userinfo is forbidden by the corpus contract.
3. The authoritative URL serialization MUST already contain an ASCII hostname. IDNs therefore enter the corpus in canonical `xn--` punycode form. Raw Unicode authority bytes fail closed before URL parsing.
4. Lowercase the ASCII hostname.
5. Strip one trailing dot.
6. The URL parser removes the port before hostname processing.
7. Bare IP literals are their own site keys.
8. For normal hosts, resolve the registrable domain (eTLD+1) against the pinned authoritative ASCII PSL derivative. `www.` is not a special case; it disappears only because eTLD+1 resolution collapses it.

Selection MUST NOT invoke the host runtime's ambient IDNA implementation. The raw PSL source is provenance; grouping consumes only the frozen ASCII derivative. This prevents browser/Python Unicode and IDNA version drift.

### 2.2 Platform overrides

Overrides run against the normalized hostname before the default registrable-domain result is returned.

The v1 table currently defines:

- `github.com/<owner>`: first non-empty serialized pathname segment, lowercased.
- `gitlab.com/<owner>`: first non-empty serialized pathname segment, lowercased.
- `medium.com/@user`: first non-empty serialized pathname segment only when it starts with `@`, lowercased.

Path segments are taken from the parsed URL pathname exactly as serialized. They are not percent-decoded before owner extraction. Case folding changes ASCII letter case only through the runtime's lowercase operation. When an override does not match its required path shape, selection falls back to the registrable domain.

A changed override table is a changed pinned input and MUST have a new committed SHA-256.

## 3. Canonical grouping

Given the eligible URL array:

1. Derive `siteKey(url)` for every URL.
2. Group URLs by site key.
3. Sort site keys by unsigned UTF-8 byte order.
4. Sort URLs inside every site bucket by unsigned UTF-8 byte order.

The incoming corpus order MUST NOT affect v3 indexing.

## 4. Weight modes

The transaction commits one enumerated mode. No floating-point arithmetic participates in selection.

```
UNIFORM_SITE: weight(n) = 1
UNIFORM_URL:  weight(n) = n
SQRT_DEPTH:   weight(n) = isqrt(n << 32)
```

`isqrt` is the exact floor integer square root.

For `SQRT_DEPTH`, the common implicit scale is 2^16. No normalization or floating-point square root is performed.

The sum of all site weights MUST satisfy:

```
0 < total_site_weight < 2^32
```

Otherwise v3 fails closed.

## 5. PRNG and integer mapping

v3 uses `mulberry32-u32-v1`.

Seed normalization is the existing FNV-1a 32-bit seed derivation used by the trail sampler. Each sampler step returns the raw unsigned 32-bit Mulberry32 output before division by 2^32.

For a site draw `u32` and total weight `W`:

```
site_target = (u32 * W) >> 32
```

The multiplication and shift MUST use integer arithmetic wide enough to hold the product. The site is the first canonical site whose cumulative integer weight is greater than `site_target`.

For a bucket of `n` URLs:

```
url_index = (u32 * n) >> 32
```

This mapping is deterministic. Its bounded modulo-style quantization is accepted by v3 and is part of the contract. Rejection sampling is not used.

## 6. Site repeat guard

The guard compares site keys, never raw URLs.

The reference is derived by the verifier. The claimed `repeat_guard.reference` is not trusted.

Reference source:

- first successful ROLL in a trail/session: `null`;
- otherwise: apply the transaction's pinned `site-key/v1` inputs to the route URL of the previous successful ROLL;
- this rule also applies across a v2 -> v3 boundary: derive the site key from the previous v2 ROLL route URL;
- BRANCH, SELECT, IMPORTED, or other intervening steps do not replace the previous successful ROLL reference.

The derived reference MUST equal the committed `repeat_guard.reference`.

### 6.1 Guard modes

If the reference is null:

- mode = `none`;
- one site draw is consumed.

If `eligible_site_count == 1` and a reference exists:

- mode = `single-site-bypass`;
- one site draw is consumed and accepted even when it equals the reference;
- `exhausted = false`.

If more than one site is eligible and a reference exists:

- mode = `redraw`;
- matching site draws are rejected;
- at most 30 site draws are consumed;
- if draw 30 still resolves to the guarded site, draw 30 is accepted and `exhausted = true`;
- otherwise `exhausted = false`.

A URL draw is consumed only after the site has been accepted.

Therefore `draw_count = site_draw_count + 1`.

## 7. Required transaction fields

A v3 ROLL transaction commits at minimum:

```json
{
  "transaction_version": "r4b1t-selection-transaction/v3",
  "sequence": 1,
  "action": "ROLL",
  "constraint": {},
  "corpus_revision": "sha256:...",
  "grouping": {
    "algorithm": "site-weighted-two-stage-v1",
    "site_key_version": "site-key/v1",
    "psl_sha256": "sha256:2b44fcd3f7a3da5f9d326073a495629a65eaf66c88a9f018b494067933f026e8",
    "overrides_sha256": "sha256:36945dc17210612eb86f3e46762601467d81f0355e8f8dceceb4e13a3e0f003d",
    "weight_mode": "UNIFORM_SITE"
  },
  "eligible_url_count": 7033,
  "eligible_site_count": 733,
  "total_site_weight": 733,
  "sampler": {
    "algorithm": "site-weighted-two-stage-v1",
    "prng": "mulberry32-u32-v1",
    "seed": "...",
    "draw_start": 0,
    "draw_count": 2,
    "site_draw_count": 1,
    "url_draw_count": 1,
    "repeat_guard": {
      "kind": "site-key",
      "reference": null,
      "max_site_draws": 30,
      "mode": "none",
      "exhausted": false
    }
  },
  "selection": {
    "site_draw_u32": 0,
    "site_target": 0,
    "site_index": 0,
    "site_key": "...",
    "site_weight": 1,
    "site_bucket_size": 1,
    "url_draw_u32": 0,
    "url_index": 0
  },
  "route": {
    "url": "https://..."
  }
}
```

Raw accepted site and URL draws are committed as diagnostic evidence. Re-execution still begins from `seed + draw_start`; the verifier MUST derive the draw stream and reject a mismatch in the committed raw draws.

## 8. Verification order

A verifier MUST:

1. validate transaction shape and version;
2. verify corpus revision and reconstruct the eligible URL pool from the committed constraint;
3. verify the authoritative ASCII PSL derivative and override bytes against the committed SHA-256 values; the raw PSL source hash is provenance and does not participate in per-roll selection;
4. derive the previous successful ROLL site reference and compare it with `repeat_guard.reference`;
5. rebuild canonical site buckets;
6. recompute counts and integer weights;
7. re-create `mulberry32-u32-v1` from the seed and advance exactly `draw_start` draws;
8. execute the guard and two-stage sampler;
9. compare draw counts, raw draws, targets, indices, site key, bucket size, and route URL;
10. reject on any mismatch.

No rendered state, history score, popularity signal, or post-selection metadata participates.

## 9. Backward compatibility

v1 and v2 transactions retain their existing semantics forever. v3 verification MUST NOT reinterpret v1/v2 ROLL selection as site-aware selection.

A trail may contain a v2 ROLL followed by a v3 ROLL. Only the v3 transaction uses site-aware grouping; its guard reference is derived from the previous ROLL route as described above.

## 10. Normative cross-language vectors

`tests/fixtures/selection-v3-vectors.json` is normative.

The JavaScript and Python implementations MUST reproduce the same transaction object and the same canonical JSON bytes for every vector.

Required vector coverage includes:

- all three weight modes;
- PSL subdomain collapse;
- GitHub/GitLab platform-owner separation;
- mixed-case GitHub owner equivalence;
- canonical punycode IDN input and rejection of raw Unicode authority bytes;
- trailing-dot normalization;
- site-level redraw;
- single-site bypass;
- guard exhaustion;
- non-zero draw_start;
- v2 -> v3 guard derivation.

## 11. Tamper requirements

Tests MUST reject changes to at least:

- `corpus_revision`;
- `site_key_version`;
- PSL hash;
- override-table hash;
- `weight_mode`;
- `draw_start`;
- `draw_count`;
- `repeat_guard.reference`;
- `site_index`;
- `site_key`;
- `url_index`;
- committed raw draws;
- route URL.

## 12. Diversity evidence for experience-candidate-v0.4

Using the pinned site-key inputs above over the current 7,033 active URLs:

| mode | effective sites (exp Shannon entropy) | maximum per-site probability |
| --- | ---: | ---: |
| current URL-uniform | 33.447607 | 13.052751% |
| SQRT_DEPTH | 448.640335 | 2.721151% |
| UNIFORM_SITE | 733 exactly | 0.136426% |

The pinned grouping produces **733 site keys**.

These metrics describe the marginal site distribution before the repeat guard. Under UNIFORM_SITE the guard preserves the uniform long-run marginal by symmetry, so the effective-site count remains exactly 733.

They are independently recomputable from checked-in bytes with:

```bash
python3 tools/selection_v3_metrics.py --release-dir corpus/releases/experience-candidate-v0.4
```

The report binds the release URL digest plus the authoritative ASCII PSL and override-table digests.

## 13. Production gate

This contract and the pure implementations may land before public cutover.

Production ROLL MUST remain on v2 until:

- JS and Python cross-language vectors pass;
- v3 tamper tests pass;
- v1/v2 replay tests remain unchanged;
- the production integration records v3 evidence atomically with the selected route;
- independent re-execution passes on production-shadow evidence.
