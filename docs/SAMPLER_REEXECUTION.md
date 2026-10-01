# Independent local sampler re-execution

Status: EXPERIMENTAL VERIFIER  
Tool: `tools/reexecute_trail.py`  
Input: `r4b1t-trail/v0.3`

The base Trail v0.3 verifier establishes canonical artifact integrity, route IDs,
step typing, immutable ROLL transaction shape, and recorded sampler-interval
continuity. It deliberately does not claim that a recorded ROLL destination was
actually produced by the declared local sampler.

`reexecute_trail.py` adds that second, independent check.

## What it re-executes

For every local `ROLL` step the Python implementation independently:

1. verifies the v0.3 envelope and route identifiers with CJ-1;
2. locates checked-in release bytes by the trail's `corpus_revision`;
3. verifies the exact `urls.txt` and `resources.json` digests;
4. rebuilds the eligible pool from the recorded constraint;
5. for typed terrain, requires the declared terrain-index digest to be
   registry-authoritative for that complete release binding;
6. folds the declared seed through the current FNV-1a 32-bit seed mapping;
7. independently runs `mulberry32-v1`;
8. consumes the declared interval under `uniform-with-repeat-guard-v1`;
9. checks eligible count, draw count, repeat-guard reference, and selected URL.

It imports no JavaScript implementation code.

```bash
python3 tools/reexecute_trail.py trail.json
python3 tools/reexecute_trail.py trail.json --json
cat trail.json | python3 tools/reexecute_trail.py - --json
```

A successful run reports:

```text
PROVENANCE REEXECUTED: 2 ROLL step(s)
...
bounded claims: route derivation PROVEN; seed fairness / non-cherry-picking / wall-clock order NOT ESTABLISHED
```

## Bounded claim

A successful re-execution establishes:

> Given the checked-in corpus bytes, the recorded eligibility constraint, the
> recorded seed, the current local sampler algorithm, and the recorded
> trail-scoped repeat guard, the recorded ROLL URL is the destination produced
> by that sampler interval.

It does **not** establish:

- that the seed was generated fairly or unpredictably;
- that somebody did not try many seeds and keep a preferred result;
- that the corpus was fixed before the seed was chosen;
- wall-clock ordering;
- authorship;
- human viewing or interaction;
- BRANCH semantic correctness.

Those are separate claims.

## Current seed width

The local runtime seed is displayed as a longer string, but
`trail-manifest.js` first folds that UTF-8 string through FNV-1a into one
32-bit value before starting Mulberry32.

For the characterization vector:

```text
seed = 00112233445566778899aabbccddeeff
FNV-1a state = 545826473
```

Therefore the current local sampler has at most 32 bits of initial PRNG state.
This verifier freezes that existing behavior so a future sampler change cannot
silently rewrite historical v0.3 provenance. This is a characterization of the
current format, not a fairness or security claim.

## Authority versus reproducibility

For `ALL`, the release URL bytes define the eligible population.

For a typed terrain, reproducing a pool from an arbitrary terrain map is not
enough. The verifier accepts the map only when
`corpus/runtime/eligibility-profiles-v1.json` binds its digest to the complete
release identity:

- release ID;
- URL digest;
- resource-metadata digest;
- terrain-index digest.

Both `active` and `superseded` registered profiles can reproduce historical
trail evidence. An unregistered map fails closed.

## Relationship to future public randomness

This verifier is intentionally about the **existing local sampler**. It is the
prerequisite for, not an implementation of, a future beacon-backed mode.

Public randomness can make an external entropy value independently verifiable.
It does not by itself prove non-cherry-picking. A stronger preregistration claim
also needs evidence that exactly one declaration was fixed before that future
randomness existed.
