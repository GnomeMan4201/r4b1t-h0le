WILD intake v0.6.1

Successor provenance
    v0.6 was previously delivered with wild1000.py SHA-256
    f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e,
    but those exact bytes are no longer recoverable in the current execution surfaces.
    v0.6.1 is a new, separately frozen successor derived from the retained v0.5 package
    plus the intended v0.6 review-integrity changes. It must never be represented as v0.6.

# WILD intake v0.5

    pip install -r requirements.txt
    R=~/research_hub/repos/r4b1t-h0le            # feat/selection-v3-site-weighted, clean

    # 0. authority + baseline sanity (expect 25 vectors, 7033 URLs -> 733 siteKeys)
    python3 wild1000.py selftest --r4b1t-root $R --release experience-candidate-v0.4

    # 1. freeze the classification: review classification-v2.draft.json, edit,
    #    set "status": "frozen", bump "version", save as e.g. classification-v2.0.json

    # 2. bind the campaign (manifest is immutable once written)
    python3 wild1000.py campaign-init --r4b1t-root $R --campaign wild-50 \
        --campaign-id wild-50-pilot --release experience-candidate-v0.4 --expect-sitekeys 733 \
        --classification classification-v2.0.json --campaign-target 1000 --source-cap 50 --pending-cap 100

    # 3. pilot
    python3 wild1000.py harvest --r4b1t-root $R --campaign wild-50 --leads leads.txt --source-registry corpus/wild/source-registry-v2.json
    python3 wild1000.py verify  --r4b1t-root $R --campaign wild-50 --limit 50
    #    ... human review in wild-50/review.csv ...
    python3 wild1000.py stats   --r4b1t-root $R --campaign wild-50
    python3 wild1000.py export  --r4b1t-root $R --campaign wild-50   # -> campaign-accepted.jsonl

    # tests (mocked DNS/HTTP, real authority + real v0.4 baseline)
    R4B1T_ROOT=$R python3 tests/test_wild.py

Run from a host with direct egress: proxies are deliberately ignored.

Files
    classification-v2.draft.json          taxonomy draft (status: draft — freeze it yourself)
    legacy-v1-to-v2-migration.draft.json  v1 type -> v2 mapping policy; gates v2 terrain
                                          authority over the existing corpus, not WILD
