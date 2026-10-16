# Corpus Ledger v1 Contract

> **STATUS: FROZEN — PENDING PR1–PR4**
>
> **IMPLEMENTATION: SHADOW MODE FIRST**
>
> **PUBLIC AUTHORITY: UNCHANGED UNTIL RELEASE CUTOVER**
>
> This document defines the normative ledger contract only. It may be merged before PR1–PR4 complete, but no implementation work under this contract may reopen or alter PR1–PR4 scope.

Normative terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used as requirements.

The architectural invariant is:

```text
projection = F(validated_event_log)
```

The projection is rebuildable from the log alone. External observations become authoritative only by being recorded as events.

---

## 1. Event schema

Every stored event MUST use schema `r4b1t_corpus_ledger_event_v1`.

The event body is:

```json
{
  "schema": "r4b1t_corpus_ledger_event_v1",
  "seq": 0,
  "prev": null,
  "recorded_at": "2026-10-04T04:30:00.000Z",
  "type": "LEDGER_GENESIS",
  "resource_id": null,
  "payload": {}
}
```

The stored event adds:

```json
{
  "hash": "sha256:..."
}
```

Requirements:

- `seq` MUST be a CJ-1 safe integer.
- Sequence numbering starts at `0` and MUST increase by exactly one.
- `prev` MUST be `null` for `seq = 0`; otherwise it MUST equal the immediately preceding stored event hash.
- `recorded_at` MUST be UTC RFC 3339 with exactly millisecond precision: `YYYY-MM-DDTHH:MM:SS.SSSZ`.
- Timestamps are recorded evidence only. They MUST NOT determine sequence authority, merge survival, or replay-time state.
- `resource_id` MUST be `null` for ledger-global events and the stable resource ID for resource-scoped events.
- Unknown event types MUST fail closed unless a later ledger schema explicitly defines them.

Core v1 event types are:

| Event | Purpose |
| --- | --- |
| `LEDGER_GENESIS` | Establish the ledger and bind the pre-ledger authority boundary. |
| `RESOURCE_CREATED` | Mint a new non-legacy resource identity. |
| `LEGACY_RESOURCE_IMPORTED` | Mint a resource identity from a committed pre-ledger source. |
| `ROUTE_URL_SET` | Explicitly set the current original route URL used by the resource projection. |
| `URL_OBSERVED` | Record an observed URL without changing route authority by itself. |
| `REDIRECT_OBSERVED` | Record an observed redirect or move without merging identities by itself. |
| `ALIAS_CANDIDATE` | Record a possible alias with no identity authority. |
| `ALIAS_CONFIRMED` | Attach a confirmed URL alias to an existing resource. |
| `RESOURCE_MERGED` | Absorb one stable resource identity into another under the deterministic merge rule. |
| `PROVENANCE_RECORDED` | Attach source/version/batch provenance evidence. |
| `ELIGIBILITY_SET` | Explicitly change the eligibility axis. |
| `AVAILABILITY_SET` | Explicitly change the availability axis. |
| `PROBE_EVIDENCE_HEARTBEAT` | Commit periodic probe evidence when no state transition is emitted. |
| `ARCHIVE_TARGET_SET` | Record a pre-resolved archive rescue target as event payload. |
| `ARCHIVE_TARGET_STATUS_SET` | Explicitly change the recorded health of that archive target. |

An event type that changes core projection semantics requires a new contract version or an explicitly versioned extension adopted by a later contract. Consumers MUST NOT smuggle new state transitions through opaque payload fields.

---

## 2. Sequencer and single-writer authority

The ledger has exactly one ordered appender.

Adapters, probes, importers, review tools, and administrative tools MAY run concurrently, but they submit observations or requested transitions to the sequencer. They MUST NOT assign `seq`, `prev`, event hashes, or stable resource IDs.

The sequencer MUST:

1. validate the submission against the active event schema;
2. assign the next `seq`;
3. assign `prev`;
4. mint a stable resource ID when the event creates an identity;
5. assign `recorded_at`;
6. canonicalize the event body;
7. compute the event hash;
8. append exactly one canonical record.

Ordering authority is the sequence number, not wall-clock time.

A submission that cannot be validated MUST NOT advance the sequence.

---

## 3. Canonical serialization

Corpus Ledger v1 adopts the repository's **CJ-1 canonical JSON profile** defined in `docs/CANONICAL_JSON_CJ1.md`.

This contract does not create a second serializer.

The ledger MUST use the exact frozen CJ-1 profile active after PR1–PR4. An incompatible future change to CJ-1 MUST receive a new serialization-profile identifier and MUST NOT silently alter Corpus Ledger v1 hashes.

Additional ledger rules:

- floats are forbidden;
- all timestamps use the fixed UTC millisecond format defined above;
- object keys MUST satisfy CJ-1;
- arrays with semantic order preserve that order;
- arrays representing sets MUST be sorted by the rule defined for that field before serialization;
- duplicate logical set members are forbidden;
- malformed Unicode is forbidden.

The canonical ledger file format is UTF-8 JSON Lines:

```text
CJ1(stored_event_0) + LF
CJ1(stored_event_1) + LF
...
```

Every record, including the final record, MUST end with a single `0x0A` LF byte. No BOM, CRLF, blank line, leading whitespace, or trailing whitespace is allowed.

---

## 4. Hash-chain construction

The event hash is:

```text
SHA256(
  ASCII("r4b1t:corpus-ledger:event:v1")
  || 0x00
  || CJ1(event_body)
)
```

The stored form is lowercase hexadecimal prefixed with `sha256:`.

The `hash` field itself is excluded from `event_body`.

Domain-separated hashes MUST also be used for other ledger objects:

```text
r4b1t:corpus-ledger:projection:v1
r4b1t:corpus-ledger:policy:v1
r4b1t:corpus-ledger:manifest:v1
```

A verifier MUST reject:

- a missing sequence;
- duplicate sequence numbers;
- non-contiguous ordering;
- a `prev` mismatch;
- an event-hash mismatch;
- non-canonical event bytes;
- a schema/profile version mismatch.

The release manifest additionally binds the digest of the exact canonical ledger JSONL bytes.

---

## 5. Projection purity

The authoritative current resource record is not separately maintained authority. It is a rebuildable projection of the validated event log.

```text
project(events) -> projection
```

`project` MUST NOT read or depend on:

- wall-clock time;
- network state;
- DNS;
- archive services;
- environment variables;
- random-number generation;
- mutable configuration;
- filesystem state other than the already-supplied event stream;
- process-global mutable state.

Examples that are forbidden during replay:

```text
"three failures in seven days as of now" -> SUSPECT
Wayback lookup -> archive target
DNS lookup -> availability
environment flag -> selectable
```

Instead, the system that performs external work MUST emit an explicit event such as `ELIGIBILITY_SET`, `AVAILABILITY_SET`, or `ARCHIVE_TARGET_SET`.

Purity MUST be structurally enforced, not merely convention-tested.

For a Python implementation:

- the projection package MUST have an explicit static import allowlist checked by CI;
- wall-clock APIs, `socket`, `os.environ`, `random`, HTTP clients, and network/process helpers are forbidden from the projection module;
- replay acceptance MUST execute in a subprocess with network access denied;
- projection input MUST be plain parsed ledger values, not service objects with hidden I/O capability.

Equivalent enforcement is required if another implementation language is used.

---

## 6. Stable resource identity

Resource identity MUST NOT be derived from URL bytes, canonical URL bytes, or content hashes.

Only the sequencer may mint a resource ID.

Identity-creating events are:

- `RESOURCE_CREATED`
- `LEGACY_RESOURCE_IMPORTED`

The resource ID is derived from that event's sequence number:

```text
resource_id =
  "r4b1t:r:" + zero_pad_decimal(create_seq, 16)
```

Example:

```text
create_seq = 18493
resource_id = r4b1t:r:0000000000018493
```

The numeric `create_seq` is authoritative. The fixed-width string representation is order-preserving but MUST NOT replace numeric validation.

`create_seq` means only **the order in which the identity became authoritative inside this ledger**. It MUST NOT be interpreted as publication date, discovery date, resource age, or remote-server age.

A newly created non-legacy resource begins with:

```text
eligibility = CANDIDATE
availability = null
```

and has no selectable route until a `ROUTE_URL_SET` event establishes one.

A `LEGACY_RESOURCE_IMPORTED` event MAY establish explicit initial state and route URL only when its payload binds those claims to the genesis/import authority described in section 10. Unknown historical facts MUST remain unknown; the importer MUST NOT invent historical discovery, success, or liveness timestamps.

---

## 7. Aliases, lineage, and merges

URLs are observed aliases of a stable resource identity. They are not the identity itself.

`URL_OBSERVED` and `REDIRECT_OBSERVED` preserve lineage but MUST NOT automatically merge resource identities.

Fuzzy similarity, body-hash similarity, title similarity, shared hostname, or heuristic classification MAY emit `ALIAS_CANDIDATE`. They MUST NOT emit `ALIAS_CONFIRMED` or `RESOURCE_MERGED` without the evidence rule defined by the relevant consumer spec.

### Route authority

The projection MUST carry one explicit `route_url` or `null`.

A change of original navigable route is authoritative only through `ROUTE_URL_SET`. The projection MUST NOT choose a preferred alias by recency, lexical order, redirect status, or probe success.

Archive rescue URLs are separate from `route_url` and MUST NOT silently replace it.

### Merge survivor

Before validating a merge, both IDs are resolved through any already-published merges.

For two distinct surviving resources:

```text
survivor = resource with numerically lower create_seq
absorbed = resource with numerically higher create_seq
```

The event MUST name both. A verifier MUST reject an event that declares the wrong survivor.

This makes the survivor rule locally decidable, but local validation does not replace full replay: full replay is still required to prove that both identities legitimately exist and are not already the same resolved identity.

### Historical resolution

An absorbed ID MUST remain resolvable forever through the projection.

Old trails, receipts, proof sessions, and other artifacts retain the original ID they recorded. Verification MAY report:

```text
recorded_id -> resolved_current_id
```

but MUST NOT rewrite the historical artifact.

A merge does not delete the absorbed resource's event history.

Corpus Ledger v1 defines no automatic unmerge operation. Uncertain identity relationships remain candidates rather than being merged speculatively.

---

## 8. Eligibility and availability axes

The projection maintains two independent state axes.

Eligibility:

```text
CANDIDATE
ACTIVE
SUSPECT
RETIRED
```

Availability:

```text
null
LIVE
INTERMITTENT
ARCHIVED_ONLY
GONE
```

`null` means availability has not been authoritatively established in the ledger. It is not a fifth liveness classification and is never selectable.

State changes are event-driven only.

A replay MUST NOT derive a state transition from timestamps, probe counts, current time, or external conditions.

For example, this is forbidden inside the projector:

```text
if failures >= 3 and now - first_failure <= 7 days:
    eligibility = SUSPECT
```

The probe/lifecycle system instead emits an explicit `ELIGIBILITY_SET` event when its published policy says that threshold has been reached.

`CANDIDATE -> ACTIVE` MUST occur through explicit authority. A successful probe alone does not activate a resource during replay.

Imported legacy resources MAY begin `ACTIVE` only when `LEGACY_RESOURCE_IMPORTED` explicitly establishes that state from a commitment allowed by section 10.

`HISTORICAL`, `ADVISORY`, `RESEARCH`, and similar labels are classifications, not lifecycle states.

---

## 9. Observation and event-emission policy

The ledger MUST record every core state transition. It does not need one full ledger event for every routine probe.

A release-bound policy MUST define:

- probe transition rules;
- SUSPECT/ACTIVE/RETIRED transition rules;
- availability transition rules;
- heartbeat cadence;
- evidence-record schema/version;
- any retry or independence requirements that affect whether a transition event is emitted.

Those thresholds are producer policy. They are not projector logic.

When a probe changes eligibility, availability, route authority, or archive-target state, the resulting transition event MUST carry or reference the evidence digest and the policy rule/version that caused the producer to emit it.

When probes occur without a core state change, the producer MUST periodically emit `PROBE_EVIDENCE_HEARTBEAT` at the cadence bound by the release policy.

A heartbeat MUST at minimum commit:

- resource ID;
- producer/probe version;
- policy version;
- number of probe observations represented;
- first and last observation timestamps;
- digest of the evidence bundle represented by the heartbeat.

The evidence bundle may contain response status, normalized-header digest, body digest, body byte count, observed URL, final URL, and producer timing. The ledger contract does not claim those remote observations are true merely because their digest was published.

This transition-plus-heartbeat model exists to prevent routine daily probing from producing an unnecessary full-event-per-resource-per-day log while retaining auditable evidence commitments.

---

## 10. Genesis and the legacy boundary

`seq = 0` MUST be `LEDGER_GENESIS`.

Genesis MUST bind the exact pre-ledger authority that the public system used at the migration boundary.

At minimum, the genesis payload MUST commit to:

1. the active pre-ledger corpus promotion/release authority;
2. the exact existing corpus commitment(s) needed to verify pre-ledger trails and receipts;
3. the PR1 digest-bound terrain artifact authoritative at the boundary;
4. the serializer/profile identifiers needed to verify those commitments;
5. any additional pre-ledger artifact explicitly required for continuity by PR1–PR4.

The commitment list is a set and MUST use a deterministic sorted order.

A commitment record MUST include at least:

```json
{
  "kind": "terrain_index",
  "id": "typed-candidate-v0.1/terrain-index-v1",
  "digest": "sha256:...",
  "profile": "cj-1"
}
```

The exact final hashes are captured at implementation/cutover time from the completed PR1–PR4 baseline. This frozen contract MUST NOT guess or overwrite those future final values.

### Legacy import

Each `LEGACY_RESOURCE_IMPORTED` event MUST identify the committed source it came from and a deterministic source locator.

The import payload MUST include enough information to prove:

```text
committed pre-ledger source
    -> exact legacy record / URL
    -> minted ledger resource ID
```

The importer MUST be deterministic over identical committed input bytes.

Pre-ledger artifacts MUST continue to verify across the boundary when their recorded corpus/terrain commitment is one of the genesis commitments. If their resource identity is later absorbed by a merge, section 7 resolution applies.

The ledger does not retroactively claim observations that the pre-ledger system never recorded.

---

## 11. Corpus selection policy

Selection policy is a separate canonical object bound into each release. It is not hidden runtime configuration and is not an input to the core resource projection.

The policy MUST use schema `r4b1t_corpus_selection_policy_v1` and CJ-1.

It MUST explicitly declare at least:

```json
{
  "schema": "r4b1t_corpus_selection_policy_v1",
  "policy_id": "example-v1",
  "eligibility_allow": ["ACTIVE"],
  "availability_allow": ["ARCHIVED_ONLY", "INTERMITTENT", "LIVE"],
  "require_route_url": true,
  "exclude_absorbed": true,
  "terrain_authority_digest": "sha256:..."
}
```

The arrays above are sets and MUST be sorted lexicographically.

Normative restrictions:

- `CANDIDATE` MUST NOT be selectable.
- `RETIRED` MUST NOT be selectable.
- `availability = null` MUST NOT be selectable.
- Whether `SUSPECT` is selectable is an explicit policy decision.
- Whether `ARCHIVED_ONLY` is selectable is an explicit policy decision.
- Changing any allowed state changes the policy digest and therefore the release identity.
- No implementation may silently fall back to a default state list when the policy is absent or invalid.

If `ARCHIVED_ONLY` is selectable, the selected resource remains the original resource with its original `route_url`; an archive target is a separate rescue action and does not become the selected resource.

This contract does not redefine the current sampler, PRNG, terrain filtering, immediate-repeat rules, or Trail selection transaction. Those existing authorities consume the release-bound eligible population through separate contracts.

---

## 12. Release manifest

A ledger-backed corpus release MUST publish a canonical manifest using schema `r4b1t_corpus_ledger_release_v1`.

Required fields:

```json
{
  "schema": "r4b1t_corpus_ledger_release_v1",
  "release_id": "corpus-ledger-v1-example",
  "ledger_schema": "r4b1t_corpus_ledger_event_v1",
  "serialization_profile": "cj-1",
  "genesis_hash": "sha256:...",
  "ledger_head": "sha256:...",
  "ledger_event_count": 1,
  "ledger_bytes_digest": "sha256:...",
  "projection_schema": "r4b1t_corpus_projection_v1",
  "projection_digest": "sha256:...",
  "selection_policy_digest": "sha256:...",
  "authority_mode": "shadow",
  "attachments": []
}
```

`attachments` is a set of externally specified, digest-bound consumer artifacts and MUST be sorted deterministically by `kind`, then `digest`.

Examples may later include producer manifests, adapter manifests, archive-resolver evidence, or consumer-specific indexes. Their semantics belong to their own specs; the ledger verifier only proves that the release manifest binds their declared digests.

`authority_mode` is one of:

```text
shadow
public
```

The release manifest hash is:

```text
SHA256(
  ASCII("r4b1t:corpus-ledger:manifest:v1")
  || 0x00
  || CJ1(manifest_without_manifest_hash)
)
```

A different policy, projection, ledger head, attachment set, or authority mode produces a different release identity.

---

## 13. Verification procedure

A conforming verifier MUST fail closed.

Verification order:

1. validate the manifest schema and serialization profile;
2. validate the exact ledger JSONL byte format;
3. compute and compare `ledger_bytes_digest`;
4. parse each event and prove that each line is its canonical CJ-1 stored form;
5. verify contiguous `seq`;
6. verify `prev`;
7. recompute every event hash;
8. validate event-type semantics;
9. validate sequencer-derived resource IDs;
10. validate every merge survivor rule;
11. validate historical absorbed-ID resolution;
12. validate the genesis commitments;
13. rebuild the projection from the validated log only;
14. compute and compare `projection_digest`;
15. validate the selection-policy bytes and digest;
16. validate manifest-bound attachment digests when those artifacts are supplied;
17. if verifying a pre-ledger trail/receipt, prove its recorded commitment crosses the genesis boundary and resolve any absorbed IDs without rewriting the artifact.

At minimum, acceptance fixtures MUST prove:

```text
same log -> same projection -> same projection digest
same policy + projection -> same eligible population
```

Negative fixtures MUST reject at least:

```text
one altered event
reordered events
missing event
wrong prev
wrong event hash
non-canonical JSON
serializer/profile mismatch
wrong sequence-derived resource ID
wrong merge survivor
broken absorbed-ID resolution
altered genesis commitment
altered selection policy
altered projection
projection code that reads clock/network/environment/randomness
```

The purity boundary MUST be exercised under a runtime with network access denied in addition to static dependency enforcement.

---

## 14. Verifier claims, scope boundary, shadow mode, and cutover

### Allowed verifier claims

A successful Corpus Ledger v1 verification MAY claim:

- the supplied ledger bytes are canonical and match the release manifest;
- the event chain is internally ordered and hash-consistent;
- the published projection is exactly the deterministic projection of that validated event log;
- the supplied selection policy is the exact policy bound to the release;
- the release binds the declared genesis/pre-ledger commitments;
- merge and absorbed-ID resolution follow the published deterministic rules;
- supplied pre-ledger artifacts can be linked across the declared genesis boundary when their recorded commitments match;
- the published ledger has not been semantically rewritten relative to the verified release.

A successful verification MUST NOT claim, from the ledger alone:

- that a network probe actually happened;
- that a remote server actually returned the recorded bytes/status/headers;
- that a timestamp proves real-world wall-clock ordering;
- that a resource is safe, accurate, relevant, lawful, useful, or currently reachable;
- that a provenance assertion is true merely because it is recorded;
- that the corpus is complete;
- that an adapter or operator did not omit observations;
- authorship, operator identity, or intent not independently established by other evidence.

Probe response digests strengthen traceability of what was published. They do not convert an operator observation into third-party cryptographic attestation.

Verifier output SHOULD state this evidence boundary adjacent to PASS/FAIL results.

---

### Scope boundary, shadow mode, and cutover

This frozen document defines only the ledger contract:

- event schema;
- sequencer/single-writer authority;
- canonical serialization;
- hash-chain construction;
- projection purity;
- stable identity;
- aliases/lineage/merges;
- eligibility and availability axes;
- observation/event-emission policy;
- genesis and legacy commitments;
- corpus selection policy;
- release manifest;
- verification procedure;
- allowed verifier claims.

The following are consumers and require separate short specs:

- discovery adapters and adapter-specific provenance;
- exact archive-resolver choice rules;
- archive UI/rescue presentation;
- TERRAIN presentation;
- SPROUT projection/sampling;
- CLI presentation;
- web/mobile UI.

#### Shadow mode

After PR1–PR4 ship, ledger internals SHOULD land incrementally on `main` in non-authoritative shadow mode rather than live for months on a divergent release branch.

In shadow mode:

- sequencer, adapters, probes, importer rehearsals, and replay/verifier code MAY run against production observations;
- shadow data MUST NOT become ROLL authority merely because it exists;
- the public UI and current selection model continue to use the existing authority;
- shadow releases use `authority_mode = shadow`;
- a defective shadow ledger MAY be discarded and restarted before any public manifest adopts it.

Once a ledger prefix has been published by an `authority_mode = public` release, that published history is immutable relative to that release.

#### Public cutover

Public cutover is one externally visible authority change, not one giant implementation merge.

Cutover requires:

1. PR1–PR4 complete;
2. genesis bound to the final pre-ledger commitments and PR1 terrain digest;
3. deterministic legacy import verified;
4. shadow replay stable under real production probe patterns;
5. structural purity checks green;
6. release verification green end-to-end;
7. historical pre-ledger trail/receipt continuity fixtures green;
8. the public runtime explicitly switched to one verified `authority_mode = public` manifest.

Until that switch, this contract changes no public selection authority.

