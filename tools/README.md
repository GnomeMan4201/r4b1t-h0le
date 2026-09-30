# Verification and corpus tooling

[Documentation map](../docs/README.md) · [Contribute](../CONTRIBUTING.md)

Run commands from the repository root. These tools support local artifact inspection and reviewed corpus maintenance; their output does not independently grant runtime authority.

| Task | Entry points |
| --- | --- |
| Verify trail integrity and declared lineage | `npm run trail:verify -- trail.json [parent.json]` |
| Verify a topology export | `npm run topology:verify -- topology.json` |
| Create / inspect portable projections | `card:bundle` / `card:inspect`, `comparison:bundle` / `comparison:inspect`, `session:bundle` / `session:inspect` npm scripts; see each tool's `Usage` line for positional arguments |
| Check authored local documentation links and CI paths | `npm run docs:verify` |
| Check repository claims | `npm run claims:verify` |
| Check deployed claims and serving parity | `npm run claims:verify:live`, `npm run shadow:verify` |
| Audit the Worker boundary | `npm run worker:audit` (current contract); `worker:audit:legacy` is an explicit historical comparison |
| Compile pinned source catalogs | `source_catalog.py` |
| Aggregate explicit provenance | `aggregate_provenance.py` |
| Compile / profile eligibility | `compile_eligibility.py`, `profile_eligibility.py` |
| Construct digest-bound candidate releases | `build_corpus_release.py` |
| Analyze legacy structural health / provenance | `corpus_health.py`, `corpus_provenance.py` |
| Observe URL reachability | Root [`pool_sweep.py`](../pool_sweep.py); [operations guide](../docs/operations/POOL_SWEEP_OPERATIONS.md) |

## Reproduce the typed candidate

The deterministic corpus pipeline uses Python's standard library. Use a scratch output directory; never write generated outputs over checked-in release files during investigation.

```bash
mkdir -p /tmp/r4b1t-corpus-review/catalogs
for manifest in corpus/catalogs/*.json; do
  name="$(basename "$manifest" .json)"
  python3 tools/source_catalog.py --manifest "$manifest" --root . \
    --out-dir "/tmp/r4b1t-corpus-review/catalogs/$name"
done
python3 tools/aggregate_provenance.py \
  --input /tmp/r4b1t-corpus-review/catalogs/*/provenance.json \
  --out-dir /tmp/r4b1t-corpus-review/aggregate
python3 tools/compile_eligibility.py \
  --input /tmp/r4b1t-corpus-review/aggregate/eligibility-input.json \
  --out-dir /tmp/r4b1t-corpus-review/eligibility
python3 tools/build_corpus_release.py \
  --aggregate-dir /tmp/r4b1t-corpus-review/aggregate \
  --eligibility-dir /tmp/r4b1t-corpus-review/eligibility \
  --release-id typed-candidate-v0.1 \
  --out-dir /tmp/r4b1t-corpus-review/release
diff -r corpus/releases/typed-candidate-v0.1 /tmp/r4b1t-corpus-review/release
```

The [Corpus Quality workflow](../.github/workflows/corpus-quality.yml) is the CI recipe. Release construction preserves `selection_authority: false`; [promotion](../docs/contracts/RUNTIME_CORPUS_PROMOTION_CONTRACT.md) is a separate decision.

## Investigation utilities

`extract_pool.py`, `clean_pool.py`, `r4b1t_tagger.py`, and `r4b1t_classifier.py` support earlier extraction and heuristic experiments. Extracting links from `index.html` does not recover the active runtime corpus. Heuristic categories and confidence scores are not authoritative resource type or cybersecurity-scope evidence and must not become selection weights.

The tagger uses `aiohttp`; extraction uses `beautifulsoup4`; the classifier uses `scikit-learn`. Install optional dependencies in a virtual environment only when using those utilities. The retained classifier output hint names a historical, absent branch-injection script; it is not a supported next step.

The incomplete weekly HTML-pool rebuild recipe is retained under [`history/`](history/README.md). Current instructions do not depend on its missing scripts.
