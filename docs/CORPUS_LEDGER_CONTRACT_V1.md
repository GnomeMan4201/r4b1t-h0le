# Corpus Ledger Contract v1

> **STATUS: FROZEN — PENDING PR1–PR4**
>
> **IMPLEMENTATION MODE: SHADOW MODE FIRST**
>
> **PUBLIC AUTHORITY: UNCHANGED UNTIL EXPLICIT RELEASE CUTOVER**
>
> This document is normative for the future corpus-ledger implementation. It does not alter the scope, runtime behavior, selection authority, trail semantics, terrain authority, sampler, or public corpus model of PR1–PR4.
>
> Implementation work MUST NOT begin until PR1–PR4 have shipped. The ledger may then land internally on `main` in shadow mode while the existing public authority remains unchanged. Public cutover is a separate, explicit release event.

## 1. Scope

This contract defines only the corpus-ledger authority boundary:

1. event schema;
2. sequencer and single-writer authority;
3. canonical serialization;
4. hash-chain construction;
5. projection purity;
6. stable resource identity;
7. aliases, lineage, and merges;
8. eligibility and availability state axes;
9. observation and event-emission policy;
10. genesis and legacy-boundary commitments;
11. corpus selection policy;
12. release manifest;
13. verification procedure;
14. verifier claim boundary;
15. shadow mode and public cutover.

Adapters, probe implementations, archive resolvers, SPROUT, TERRAIN presentation, CLI presentation, coverage diagnostics, and UI behavior are consumers of this contract. They require separate consumer specifications and MUST NOT add ledger semantics that are absent here.

Normative terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used in the RFC 2119 sense.

---

## 2. Event schema

The authoritative corpus history is a single append-only ordered event log.

The current corpus projection is derived from that log. The projection is not an independent authority.

Every event MUST contain:

```json
{
  "schema": "r4b1t-corpus-ledger-event-v1",
  "seq": 18493,
  "prev": "sha256:...",
  "timestamp": "2026-10-03T18:21:04.000Z",
  "type": "PROBE_SUCCEEDED",
  "resource_id": "r4b1t:r:000000000018493",
  "payload": {},
  "hash": "sha256:..."
}
```

### 2.1 Required fields

- `schema` identifies the event schema version.
- `seq` is a positive safe integer assigned only by the sequencer.
- `prev` is the hash of the immediately preceding event, or the declared genesis predecessor value for the first ledger event.
- `timestamp` is an observation/append timestamp supplied to the sequencer and stored as data. Projection code MUST NOT consult a clock.
- `type` is one event type from the versioned event registry.
- `resource_id` identifies the affected resource where applicable. Ledger-global events MAY omit it only when the event registry explicitly permits omission.
- `payload` contains all data needed to replay the event without network, clock, randomness, environment, or configuration access.
- `hash` is the event hash defined in §5.

### 2.2 Event registry

The v1 implementation MUST maintain a versioned registry of allowed event types and their payload schemas.

At minimum, the registry MUST support the following semantic families:

```text
GENESIS_BOUNDARY

RESOURCE_CREATED
LEGACY_RESOURCE_IMPORTED

URL_OBSERVED
REDIRECT_OBSERVED
ALIAS_CANDIDATE
ALIAS_CONFIRMED
RESOURCE_MERGED

PROBE_SUCCEEDED
PROBE_FAILED
PROBE_HEARTBEAT

MARKED_ACTIVE
MARKED_SUSPECT
MARKED_RETIRED

AVAILABILITY_LIVE
AVAILABILITY_INTERMITTENT
AVAILABILITY_ARCHIVED_ONLY
AVAILABILITY_GONE

ARCHIVE_RESOLVED
ARCHIVE_PROBE_SUCCEEDED
ARCHIVE_PROBE_FAILED
ARCHIVE_TARGET_REPLACED
ARCHIVE_TARGET_GONE

BATCH_REVOKED

POLICY_BOUND
RELEASE_BOUND
```

The registry MAY use more precise event names, but the semantics above MUST remain explicit.

### 2.3 No inferred authority

If a state transition matters to selection, release identity, lineage, or verification, that transition MUST be represented by an event.

Replay MUST NOT infer authoritative transitions from elapsed time or accumulated observations.

For example:

```text
PROBE_FAILED
PROBE_FAILED
PROBE_FAILED
MARKED_SUSPECT
```

is valid.

This is not valid:

```text
if failures_in_last_7_days >= 3:
    eligibility = SUSPECT
```

because the result depends on replay time.

Archive resolution follows the same rule. A snapshot lookup result MUST be stored in an event payload. Replay MUST NOT query an archive service.

---

## 3. Sequencer and single-writer authority

The ledger has exactly one ordering authority: the sequencer.

Adapters, probes, migration tools, review tools, and administrative tools are evidence producers. They MUST NOT append ledger events directly.

The write path is:

```text
producer
   |
   v
submission
   |
   v
SEQUENCER
   |
   +-- validate schema
   +-- assign seq
   +-- assign prev
   +-- mint resource_id when required
   +-- canonicalize
   +-- compute hash
   +-- append atomically
```

### 3.1 Sequencer responsibilities

The sequencer MUST:

1. serialize accepted submissions into one total order;
2. assign each event a unique monotonically increasing `seq`;
3. assign `prev` from the current ledger head;
4. mint resource IDs only for identity-creating events;
5. validate event and payload schemas before append;
6. reject invalid merge-survivor declarations;
7. canonicalize and hash the event deterministically;
8. append the complete event atomically;
9. return the assigned sequence number, event hash, and any minted resource ID.

### 3.2 Resource-ID minting

Only the sequencer MAY mint a resource ID.

Producers submit an identity-creation request without a final resource ID. The sequencer assigns `seq`, derives the ID defined in §7, appends the event, and returns the minted ID.

No adapter or concurrent producer may reserve, predict, or self-assign a resource ID.

---

## 4. Canonical serialization

Ledger hashes MUST use the repository's canonical JSON authority rather than introduce a competing serializer.

The v1 ledger serialization profile is:

```text
serialization_version = "r4b1t-cj1-ledger-v1"
base_profile          = "CJ-1"
```

`docs/CANONICAL_JSON_CJ1.md` remains the base canonical JSON definition.

### 4.1 Additional ledger restrictions

In addition to CJ-1:

- floats are forbidden;
- all numeric values MUST be safe integers;
- timestamps MUST be UTC;
- timestamps MUST use fixed millisecond precision:
  `YYYY-MM-DDTHH:mm:ss.SSSZ`;
- unordered semantic collections MUST be converted to explicitly sorted arrays before canonical serialization;
- semantically ordered arrays MUST preserve their defined order;
- duplicate object keys are forbidden;
- strings MUST satisfy CJ-1 Unicode requirements;
- no platform-native map/set encoding is permitted;
- no implementation-specific serialization is permitted.

Changing these rules requires a new serialization version and therefore a new ledger/release contract version.

### 4.2 Hash-domain separation

Each hash purpose MUST be domain-separated.

At minimum:

```text
r4b1t:event:v1
r4b1t:projection:v1
r4b1t:policy:v1
r4b1t:manifest:v1
r4b1t:heartbeat:v1
```

A hash defined for one domain MUST NOT be reused as though it proves an object in another domain.

---

## 5. Hash-chain construction

The ledger is a linear hash chain.

For event `E[n]`:

```text
E[n].prev = E[n-1].hash
```

The event hash MUST be computed over the canonical event representation with the `hash` field omitted:

```text
event_hash =
  SHA-256(
    UTF8("r4b1t:event:v1") ||
    CJ1_LEDGER(event_without_hash)
  )
```

The exact byte framing between the domain tag and serialized payload MUST be fixed in implementation vectors before shadow-mode writes begin. Ambiguous concatenation MUST NOT be used.

### 5.1 Genesis predecessor

The first ledger event MUST use a fixed, versioned genesis predecessor constant declared in this contract's implementation vectors.

The first authoritative event is the legacy/genesis boundary event described in §11.

### 5.2 Checkpoints

Checkpoints MAY be introduced for replay performance after v1 proves stable.

A checkpoint MUST:

- be derivable from prior authoritative events;
- identify the exact event head it summarizes;
- include the projection hash at that head;
- never permit verification to skip chain validation unless the checkpoint itself is independently trusted by an explicit release manifest.

Checkpoints do not replace the event log.

---

## 6. Projection purity

The authoritative corpus state is:

```text
projection = F(event_log)
```

and nothing else.

For identical canonical event bytes, conforming implementations MUST derive identical projection bytes.

### 6.1 Forbidden replay inputs

Projection/replay code MUST NOT read or depend on:

- wall clock;
- monotonic clock;
- network;
- DNS;
- filesystem state outside the supplied ledger/replay inputs;
- environment variables;
- process configuration not committed into the input;
- randomness;
- locale;
- host timezone;
- external database state;
- mutable global state.

All external observations that affect authority MUST already exist in an event payload.

### 6.2 Structural enforcement

Purity MUST be enforced structurally, not only by behavior tests.

For a Python implementation, CI MUST at minimum:

- enforce a static import allowlist for the projection package;
- reject use of `time`, live clock access, `socket`, network clients, `os.environ`, `random`, and equivalent side-effect sources;
- run replay in a subprocess or sandbox with no usable network namespace;
- provide projection inputs explicitly;
- fail when undeclared external dependencies are accessed.

Equivalent structural controls MUST be used for other implementation languages.

Behavior tests MAY supplement these controls but MUST NOT be the only purity guarantee.

---

## 7. Stable resource identity

A resource ID identifies a ledger resource, not a URL and not a content hash.

URLs, redirects, mirrors, archive targets, and observed moves are properties or lineage of a stable resource identity.

### 7.1 Minted identity format

Resource IDs are derived from the sequence number of the identity-creating event.

The v1 textual format is:

```text
r4b1t:r:<fixed-width-decimal-create-seq>
```

with a 15-digit zero-padded decimal sequence field:

```text
r4b1t:r:000000000018493
```

The numeric `create_seq` is authoritative.

Implementations MUST NOT compare arbitrary resource-ID strings to determine age or merge survival; they MUST parse and compare the numeric `create_seq`.

If the sequence space outgrows this encoding, a new identity version is required. Existing IDs MUST NOT be rewritten.

### 7.2 Meaning of create_seq

`create_seq` records the order in which a resource identity became authoritative within the ledger.

It MUST NOT be interpreted as:

- publication time;
- historical age;
- first appearance on the public web;
- original discovery time outside the ledger;
- evidence that one resource predates another in the real world.

### 7.3 Identity creation

A newly discovered resource begins with an identity-creation event and initial eligibility `CANDIDATE`, unless §11 explicitly authorizes a legacy import as `ACTIVE`.

Discovery alone never makes a new resource selectable.

---

## 8. Aliases, lineage, and merges

A stable resource may accumulate multiple observed URLs.

URL changes MUST NOT mint a new identity when evidence establishes that the new URL is an alias or move of the existing resource.

### 8.1 Lineage observations

Lineage-capable events include:

```text
URL_OBSERVED
REDIRECT_OBSERVED
ALIAS_CANDIDATE
ALIAS_CONFIRMED
```

Fuzzy similarity, near-duplicate content, title similarity, or heuristic classification MUST NOT automatically emit `ALIAS_CONFIRMED`.

Such evidence MAY emit `ALIAS_CANDIDATE`.

### 8.2 Merge rule

When two already-minted resources are later proven to represent one logical resource, the ledger emits `RESOURCE_MERGED`.

The survivor is deterministic:

```text
survivor =
  resource with numerically lowest create_seq
```

The event MUST name both identities and the survivor.

The sequencer MUST reject a merge event whose declared survivor violates this rule.

### 8.3 Absorbed IDs remain valid

A merge MUST NOT invalidate historical references.

The projection MUST retain a permanent resolution map:

```text
absorbed_id -> survivor_id
```

Old trails, receipts, proof sessions, and release artifacts that reference an absorbed ID MUST continue to resolve and verify through this mapping.

Resource IDs MUST never be recycled.

### 8.4 Local validation versus full verification

Because `create_seq` is encoded in the ID, a verifier can locally check that a merge declares the correct numeric survivor.

That local check does not prove that:

- both identities legitimately exist;
- neither was already absorbed inconsistently;
- prior lineage events are valid;
- the surrounding ledger is intact.

Full ledger verification remains required.

---

## 9. State axes

Eligibility and availability are separate authoritative axes.

### 9.1 Eligibility

```text
CANDIDATE
ACTIVE
SUSPECT
RETIRED
```

Semantics:

- `CANDIDATE`: discovered/imported but not yet authorized for normal selection;
- `ACTIVE`: authorized by current corpus policy;
- `SUSPECT`: retained but not currently authorized for normal selection unless a future policy explicitly says otherwise;
- `RETIRED`: no longer eligible for normal selection.

A transition into or out of these states MUST occur through an explicit event.

In particular:

```text
CANDIDATE -> ACTIVE
```

MUST be represented by an explicit activation event. It MUST NOT be inferred from a successful probe count.

### 9.2 Availability

```text
LIVE
INTERMITTENT
ARCHIVED_ONLY
GONE
```

Availability describes observed access state, not selection authority.

### 9.3 Classification is not state

Properties such as:

```text
advisory
research
tooling
archive
zine
mailing-list
ctf
academic
```

are classification/provenance data, not eligibility or availability states.

### 9.4 Selection consequence

Whether an availability state is selectable is a policy decision.

For example, whether `ARCHIVED_ONLY` may be selected MUST be declared in the release-bound selection policy, not hidden in runtime code.

---

## 10. Observation and event-emission policy

The ledger MUST preserve authoritative state changes without requiring one event for every routine network probe.

### 10.1 State-change events

A probe or observation that changes authoritative projection state MUST emit the corresponding event or event sequence.

Examples:

- first verified success that activates a candidate;
- transition to intermittent;
- explicit suspect marking;
- recovery from suspect;
- archive target resolution;
- archive target loss;
- retirement;
- redirect/alias evidence that changes lineage.

### 10.2 Routine probe suppression

Repeated routine probes that do not change authoritative state SHOULD NOT each produce a full ledger event.

Instead, the implementation SHOULD use periodic `PROBE_HEARTBEAT` events carrying evidence digests sufficient to bind the suppressed observation window.

The exact heartbeat cadence and inclusion rules are policy-bound and versioned.

A release manifest MUST identify the heartbeat policy version used to produce its ledger.

### 10.3 Probe evidence digest

When a probe observation is recorded, the payload SHOULD include enough normalized evidence to make the observation specific without claiming independent proof of the remote server.

At minimum, where available:

```json
{
  "status": 200,
  "observed_url": "https://example.org/",
  "final_url": "https://example.org/",
  "headers_digest": "sha256:...",
  "body_digest": "sha256:...",
  "body_bytes": 38142,
  "probe_version": "probe-v1",
  "started_at": "2026-10-03T18:21:04.000Z",
  "finished_at": "2026-10-03T18:21:05.000Z"
}
```

Normalized selected headers MAY also be retained.

A digest proves only what bytes/normalized observations were committed into the ledger; it does not independently prove that the remote system actually returned them.

### 10.4 Archive observations

Archive targets are external resources and decay too.

Archive probe observations follow the same event-emission principles as live-resource probes.

An `ARCHIVED_ONLY` resource MUST NOT be treated as durably reachable merely because an archive snapshot was once resolved.

---

## 11. Genesis and legacy boundary

The ledger begins at an explicit boundary with the pre-ledger corpus authority.

Genesis MUST bind the new ledger to the exact existing authority artifacts rather than pretend earlier history occurred inside the ledger.

### 11.1 Boundary commitments

The genesis boundary event MUST commit to all applicable pre-ledger authorities, including:

- the then-current runtime corpus promotion record;
- its corpus/release digests;
- the active resource metadata digest;
- the PR1 terrain artifact digest and registry/profile binding once PR1 is final;
- any existing corpus commitment required to verify pre-ledger Trail v0.1/v0.2/v0.3 artifacts;
- the importer version and deterministic import input digest.

The concrete values MUST be taken from shipped PR1–PR4 artifacts at implementation time. This frozen contract intentionally does not pre-fill hashes that can still change before PR1–PR4 ship.

### 11.2 Verification continuity

The genesis boundary MUST permit a verifier to establish:

```text
pre-ledger trail/receipt
        |
        v
recorded legacy corpus/terrain commitment
        |
        v
GENESIS_BOUNDARY
        |
        v
ledger release
```

No migration may create a verification gap where old artifacts become unverifiable merely because the ledger model was introduced.

### 11.3 Legacy imports

Legacy corpus records MAY be imported as `ACTIVE` when the genesis/import contract proves that the record was already part of the authoritative selectable corpus at the boundary.

Such imports MUST NOT require a synthetic post-hoc probe merely to satisfy the new `CANDIDATE -> ACTIVE` rule.

The import event MUST make the exception explicit and bind it to the genesis authority.

Unknown historical facts MUST remain unknown.

The migration MUST NOT invent:

- historical discovery times;
- historical probe times;
- historical liveness;
- lineage that was not recorded;
- provenance not established by existing artifacts.

### 11.4 Deterministic migration

Given identical legacy inputs and importer version, migration MUST produce byte-identical canonical event submissions and, when fed to an empty deterministic test sequencer with the same genesis inputs, byte-identical ledger output.

---

## 12. Corpus selection policy

Selection policy is explicit release authority.

It defines which projected resources are members of the selectable population.

At minimum, the policy MUST declare:

```json
{
  "schema": "r4b1t-corpus-selection-policy-v1",
  "eligibility": ["ACTIVE"],
  "availability": ["LIVE", "INTERMITTENT", "ARCHIVED_ONLY"],
  "heartbeat_policy": "heartbeat-v1",
  "serializer": "r4b1t-cj1-ledger-v1"
}
```

The example above illustrates a policy shape; actual allowed availability states are fixed only when the policy is approved.

### 12.1 ARCHIVED_ONLY

Whether `ARCHIVED_ONLY` resources remain selectable MUST be an explicit policy field.

Changing that choice changes the selection population and therefore MUST change the policy hash and release identity.

### 12.2 Hidden governance forbidden

Corpus concentration controls, domain caps, source-family throttles, exclusion rules, or equivalent mechanisms that alter the selectable population MUST NOT exist only in ingestion/runtime code.

If such a rule changes selection odds, it MUST be represented in an auditable policy or in the event history that produced the release.

### 12.3 No implicit ranking

This contract does not authorize:

- recommendation scores;
- engagement weights;
- popularity weights;
- behavior-derived ordering;
- relevance ranking.

Membership policy may alter the population. The sampler remains governed by its separate selection contract.

---

## 13. Release manifest

A public ledger-backed corpus release MUST include a canonical manifest.

At minimum:

```json
{
  "schema": "r4b1t-corpus-ledger-release-v1",
  "release_id": "corpus-ledger-v1.0.0",
  "event_head": "sha256:...",
  "event_count": 18493,
  "projection_hash": "sha256:...",
  "policy_hash": "sha256:...",
  "serializer": "r4b1t-cj1-ledger-v1",
  "heartbeat_policy": "heartbeat-v1",
  "adapter_manifest_hash": "sha256:...",
  "legacy_boundary_hash": "sha256:..."
}
```

The manifest MAY bind additional consumer manifests, but those consumers do not become ledger authority merely by being referenced.

### 13.1 Projection hash

The projection hash is:

```text
SHA-256(
  framed(
    "r4b1t:projection:v1",
    CJ1_LEDGER(canonical_projection)
  )
)
```

The canonical projection schema MUST be versioned.

### 13.2 Policy hash

The exact selection policy bytes MUST be hashed and bound to the release.

A release MUST NOT claim the same identity after a policy change that modifies the selectable population.

### 13.3 Adapter manifest

The release MAY bind a versioned adapter manifest containing adapter names, versions, and code digests.

Adapter details are consumer provenance. They do not replace event evidence.

---

## 14. Verification procedure

A conforming verifier MUST be able to validate a release offline using only the supplied release artifacts and declared trust inputs.

At minimum it MUST check:

```text
serialization profile........ PASS/FAIL
event schemas................ PASS/FAIL
sequence continuity.......... PASS/FAIL
prev/hash chain.............. PASS/FAIL
resource ID minting.......... PASS/FAIL
merge survivor rules......... PASS/FAIL
absorbed-ID resolution....... PASS/FAIL
projection replay............ PASS/FAIL
projection hash.............. PASS/FAIL
selection policy hash........ PASS/FAIL
release manifest............. PASS/FAIL
legacy boundary.............. PASS/FAIL
```

### 14.1 Determinism requirement

For the same verified event log:

```text
same log
-> same projection
-> same projection bytes
-> same projection hash
-> same policy-bound selectable population
```

Conforming independent implementations MUST agree.

### 14.2 Required negative tests

The implementation acceptance suite MUST prove rejection of at least:

```text
alter one event
alter event order
alter prev
alter event hash
alter serializer/version
alter policy
alter projection bytes
alter archive-resolution payload
declare the wrong merge survivor
break absorbed-ID resolution
invent ACTIVE from replay-time probe history
consult clock during replay
consult network during replay
consult environment/config during replay
remove required legacy-boundary commitment
```

### 14.3 Old artifact verification

Verification MUST continue to support pre-ledger trail and receipt artifacts according to their original contracts.

A merge, migration, or new corpus release MUST NOT silently invalidate an otherwise valid historical artifact.

---

## 15. Verifier claim boundary

The ledger proves integrity and publication consistency, not external truth.

A successful verification MAY claim that:

1. the supplied event log matches the release's committed head;
2. event ordering and hash linkage are intact;
3. the projection is exactly derivable from the verified log under the declared serializer and projection version;
4. the supplied selection policy is exactly the policy bound to the release;
5. the selectable population is exactly the population produced by that verified projection and policy;
6. legacy-boundary commitments match the artifacts declared by the release;
7. no verified event bytes have been silently rewritten relative to the release commitment.

A successful verification MUST NOT claim, solely from the ledger, that:

- a remote probe actually happened;
- a remote server actually returned the recorded response;
- a response body was truthful, safe, or authentic;
- a URL remains reachable now;
- archive.org or another archive still serves a recorded snapshot;
- an adapter's classification is objectively correct;
- a resource is safe;
- a resource is relevant;
- chronology outside the ledger is proven;
- authorship is proven.

Verifier output SHOULD state this boundary directly.

Recommended wording:

```text
EVIDENCE BOUNDARY

This verification establishes that the corpus state, policy, and
recorded observations are exactly those committed by this R4B1T
release and that the supplied ledger is internally consistent with
that commitment.

It does not independently prove that remote systems returned the
recorded observations, that those observations remain current, or
that third-party content is safe, accurate, or authentic.
```

---

## 16. Shadow mode and public cutover

After PR1–PR4 ship, implementation SHOULD land incrementally on `main` in shadow mode.

Shadow-mode components MAY:

- run sequencer infrastructure;
- ingest adapter submissions;
- execute probes;
- produce ledger events;
- replay projections;
- test migration;
- generate candidate manifests;
- compare shadow selection populations with the current public corpus.

Shadow-mode components MUST NOT become public selection authority before explicit cutover.

During shadow mode:

```text
public ROLL -> current authority

shadow ledger -> observation + validation only
```

The ledger MUST NOT silently alter:

- ROLL;
- terrain membership;
- Trail authority;
- Blind Descent;
- proof-session semantics;
- public archive behavior;
- current corpus revision checks.

### 16.1 Cutover

Public cutover is one explicit release transition.

It MUST require:

1. PR1–PR4 shipped and their final authority digests recorded;
2. genesis boundary built from those shipped artifacts;
3. deterministic migration verified;
4. shadow ledger chain verified;
5. independent projection replay passing;
6. legacy artifact verification passing across the boundary;
7. release manifest complete;
8. selection policy explicitly approved;
9. verifier claim boundary present in user-facing verification output;
10. acceptance suite and negative tests passing.

Until that event, the current corpus model remains authoritative.

---

## Frozen decisions

The following decisions are part of v1 and MUST NOT be changed during implementation without reopening/versioning this contract:

- ledger authority is append-only and event-sourced;
- projection is a pure function of the log;
- sequencer is the single ordered writer;
- only the sequencer mints resource IDs;
- IDs are stable identities, not URL/content hashes;
- `create_seq` is encoded in each v1 resource ID;
- `create_seq` means ledger authority order, not historical age;
- new discoveries begin as `CANDIDATE`;
- `CANDIDATE -> ACTIVE` is event-driven, never inferred;
- legacy imports may begin `ACTIVE` only when bound to genesis authority;
- merge survivor is the numerically lowest `create_seq`;
- absorbed IDs remain permanently resolvable;
- eligibility and availability are separate axes;
- policy, not runtime code, decides which availability states are selectable;
- routine probes may be suppressed only under a versioned heartbeat policy;
- genesis binds the ledger to pre-ledger corpus and terrain commitments;
- verifier claims stop at published integrity and internal consistency;
- implementation lands in shadow mode first;
- public authority changes only at explicit release cutover.

## Non-goals

This contract does not specify:

- discovery adapter internals;
- archive-provider lookup algorithms;
- SPROUT sampling;
- TERRAIN UI;
- CLI formatting;
- mobile/desktop presentation;
- coverage dashboards;
- ranking;
- recommendation;
- personalization;
- behavior-derived scoring.

Those consumers MUST conform to this ledger contract rather than extend it implicitly.
