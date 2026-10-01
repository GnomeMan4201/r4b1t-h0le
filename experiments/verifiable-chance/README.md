# Verifiable Chance experiment

Status: **experimental; not wired into production ROLL**

This directory tests one narrow claim:

> Given a declared release, explicit constraint, pinned drand Quicknet round,
> and the resulting beacon, an independent implementation can reproduce the
> exact selected route.

It does **not** claim that the declaration was fixed before that round existed.
Without an external pre-round witness, a person can search past rounds or make
many declarations and publish only one they like. Therefore
`non_cherry_picked` remains `NOT_ESTABLISHED`.

## Trust root

`quicknet-v1.json` pins:

- beacon: `quicknet`
- chain hash: `52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`
- scheme: `bls-unchained-g1-rfc9380`
- period: 3 seconds
- genesis: 1692803367
- the Quicknet G2 public key
- RFC 9380 G1 BLS domain separation tag

The values match the drand Quicknet configuration published by the drand
client and network documentation.

## Protocol sketch

```text
active/superseded release bytes
        +
release-bound terrain map
        +
declaration
        +
Quicknet beacon
        ↓
sha256-ctr-rejection/v1
        ↓
one route + receipt
```

A declaration binds:

- release ID
- URL digest
- resource metadata digest
- terrain + terrain-index digest (or ALL)
- protocol policy
- sampler identifier
- Quicknet chain hash
- one exact round number

The declaration ID is:

```text
sha256(CJ-1(declaration))
```

For counter `c = 0, 1, ...`:

```text
block = SHA256(
  "r4b1t-sha256-ctr-rejection/v1\0"
  || raw(declaration_id)
  || raw(beacon.randomness)
  || uint64be(c)
)

limit = 2^256 - (2^256 mod eligible_count)

accept block only when integer(block) < limit
index = integer(block) mod eligible_count
```

This is integer-only rejection sampling: there is no floating-point selection
and no modulo bias.

## Receipt boundary

The receipt contains the declaration, beacon, selected index/route and the
derivation block. It deliberately has `witness: null` in v1.

A receipt is not self-authenticating. Run a verifier.

### JavaScript verifier

```bash
node experiments/verifiable-chance/public-roll.mjs declare \
  --round 1000 \
  --terrain ALL \
  --out declaration.json

node experiments/verifiable-chance/public-roll.mjs receipt \
  --declaration declaration.json \
  --beacon experiments/verifiable-chance/fixtures/quicknet-round-1000.json \
  --out receipt.json

node experiments/verifiable-chance/public-roll.mjs verify \
  --receipt receipt.json
```

The JavaScript path independently checks repository/release/terrain bytes and
route derivation. It checks that `randomness == SHA256(signature)`, but it does
**not** implement BLS. Its result therefore says:

```text
beacon_signature: NOT_ESTABLISHED_BY_THIS_VERIFIER
```

### Python verifier

Install the experiment-only dependency:

```bash
python -m pip install -r experiments/verifiable-chance/requirements.txt
python experiments/verifiable-chance/verify_public_roll.py self-test
python experiments/verifiable-chance/verify_public_roll.py verify receipt.json
```

The Python verifier independently implements the release/terrain/sampler path
and additionally verifies the Quicknet G1 BLS signature against the pinned G2
public key using `py_ecc`.

A successful result establishes:

- declaration integrity
- repository release binding
- terrain-map authority (when a typed terrain is used)
- beacon randomness/signature validity
- exact route derivation

It still reports:

```text
non_cherry_picked: NOT_ESTABLISHED
```

## Fixture

`fixtures/quicknet-round-1000.json` is a captured Quicknet round used as an
offline positive vector:

- round: 1000
- randomness: `fe290beca10872ef2fb164d2aa4442de4566183ec51c56ff3cd603d930e54fdd`
- signature: `b44679b9a59af2ec876b1a6b1ad52ea9b1615fc3982b19576350f93447cb1125e342b73a8dd2bacbe47e4b6b63ed5e39`

It is old on purpose: this prototype tests reproducibility, not preregistration.

## Explicitly out of scope

- production UI integration
- replacing local ROLL
- automatic use of a "latest" round
- RFC 3161 / blockchain / public-log witnessing
- a claim that the seed or round was not cherry-picked
- sampling lenses
- Merkle corpus proofs
- changing existing trail formats

The next experiment, if this one holds up, is a pre-round witness that can
upgrade `non_cherry_picked` from `NOT_ESTABLISHED` to a narrowly defined
preregistration claim.
