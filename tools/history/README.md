# Historical maintenance recipe

[Current tool guide](../README.md)

`r4b1t_pipeline.sh` is retained unchanged for provenance. It describes an earlier HTML-pool refresh workflow and depends on absent `liveness_check.py` and `generate_branch_injection.py` scripts. It also attempts to rewrite `index.html`; it is not a supported workflow for the promoted typed corpus.

Do not run it as current maintenance guidance. Extraction, cleaning, heuristic tagging, and classification utilities remain in `tools/` for investigation; their outputs do not establish provenance, eligibility, or runtime selection authority.
