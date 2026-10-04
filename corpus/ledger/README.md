# Corpus Ledger v1 — shadow substrate

Contract: `docs/CORPUS_LEDGER_CONTRACT_V1.md` (ratified #254).
Public corpus authority, ROLL, terrain, Trail, BRANCH, UI and motion are unchanged.
Nothing in the production dependency graph imports this package or reads shadow
storage. Ledger validation does not prove external observations are truthful.

The only write API is `Sequencer.submit` / `submit_many`. Producers supply
versioned payloads and timestamps as data; creation proposals cannot assign an
ID, seq, prev or hash. SQLite `BEGIN IMMEDIATE` orders concurrent threads/processes.
A rejected batch rolls back completely; a corrupt existing chain cannot extend.
Only storage below `corpus/ledger/shadow/` is accepted, including after symlink
resolution. The SQLite file is mutable storage, not a trusted release commitment;
canonical export plus offline verification establishes chain integrity.

Pure `replay(events)` validates and derives projection v1 from supplied inputs.
New identities start CANDIDATE, with availability `null` (unknown); successful
probes imply neither ACTIVE nor LIVE. Every axis change is an explicit event.
Merges preserve original identity records, numeric survivors and permanent
resolution, including later events that reference absorbed IDs. Merge operations
do not infer new state axes or overwrite the survivor's original provenance.

Archive/batch observations remain recorded evidence; archive lifecycle,
heartbeat cadence, release approval and public policy/cutover are future work.
The schema does not promote those consumers. The projection has no clock,
network, filesystem, environment, randomness, configuration or mutable global
inputs. CI audits the complete project-owned dependency closure, forbidden
builtin references, alias escapes, nested module/class containers and defaults,
then replays identical inputs under separate hash seeds in network namespaces.

A storage owner can corrupt SQLite directly; that is not an authorized append.
The sequencer rejects a corrupt chain and the offline verifier rejects changed
committed exports. No claim of filesystem access control against its owner is
made. Public signed release trust is outside this phase.

The genesis importer commits raw bytes of the current promotion, profile registry,
all four shipped release corpora/manifests, every registered terrain index and
legacy `urls.txt`. It validates registry/release/index binding and import-record
commitments before the explicit legacy ACTIVE exception. Source order assigns
IDs; creation sequence conveys ledger order only, never historical chronology.
No successful probe, date, availability or lineage is inferred from import.

`shadow/bootstrap-v1.json` pins the 7,034-event baseline at main commit
`340139e719d2f6afbc7bfa5b83b5826626f45d99`. Its timestamp describes this new
boundary, not historical resource creation. CI reproduces the entire export and
uploads the frozen input artifacts; these artifacts are shadow evidence, not
public corpus authority or signed releases. The descriptor is a commitment,
not an append log. Persistent append history lives in an operator-owned SQLite
store and fresh immutable exports, never in ephemeral CI storage.

```sh
python3 -m corpus.ledger.tools.check_baseline --out /tmp/shadow-bootstrap
python3 -m corpus.ledger.tools.shadow verify --bundle-dir /tmp/shadow-bootstrap/corpus/ledger/shadow/baseline
python3 -m corpus.ledger.tools.shadow append --store /tmp/shadow-bootstrap/corpus/ledger/shadow/baseline.sqlite3 --boundary-export /tmp/shadow-bootstrap/corpus/ledger/shadow/baseline --proposals proposals.json --out /tmp/shadow-bootstrap/corpus/ledger/shadow/export-2
```

Proposals are a canonical CJ-1 ordered array with one final LF. Only the
sequencer appends. A verified export contains `events.jsonl`, `projection.json`,
`commitments.json` and its frozen `artifacts/`. Publication reserves a fresh
path, stages and independently verifies all files, then renames atomically.
An export failure reports whether the ledger commit already exists; operators
must retry export, not resubmit committed events. Existing exports and stores
are never reset. Offline verification accepts explicit expected genesis/head
commitments and checks schema, hashes, continuity, identity, merge resolution,
projection and historical boundary artifacts. Integrity does not establish
remote truth, publication chronology or transitive Trail proof.

The five-event synthetic fixture in `fixtures/replay-v1.jsonl` independently
pins projection hash
`sha256:46a1f273784540b265ea04d595725cd2d61b448c75de33a4ef4b3e516ad9743f`.
It exercises explicit activation and permanent merge resolution; it is not a
real corpus bootstrap. Heartbeat cadence, actual probe producers, archive
lifecycle and discovery adapters remain outside Phase 1.

Phase 2's first consumer is specified in `consumers/PROBE_WINDOWS_V1.md`.
It performs explicitly selected HEAD windows, retains outcome changes and binds
all observations in a heartbeat. It has no scheduled cadence and changes no
eligibility or availability state. Header/body and reachability claims are
bounded to actual HEAD evidence. Network execution is separate from pure replay.

```sh
# resources.json is a canonical ordered array of existing, unabsorbed IDs + LF.
python3 -m corpus.ledger.tools.probe collect --boundary-export /path/corpus/ledger/shadow/before --resources resources.json --samples 2 --out /path/corpus/ledger/shadow/window-1
# Read source_head from window-1/window.json and pass it as expected-head.
python3 -m corpus.ledger.tools.shadow append --store /path/corpus/ledger/shadow/store.sqlite3 --boundary-export /path/corpus/ledger/shadow/before --proposals /path/corpus/ledger/shadow/window-1/proposals.json --expected-head sha256:SOURCE_HEAD --out /path/corpus/ledger/shadow/after
python3 -m corpus.ledger.tools.probe verify --before /path/corpus/ledger/shadow/before --after /path/corpus/ledger/shadow/after --window /path/corpus/ledger/shadow/window-1
```

Producer files are frozen alongside each window for offline code-commitment
checks. The sequencer rejects a stale source head within its write transaction.
No adapter may reserve identities or append directly. Archive lifecycle,
discovery admissions still require their own
consumer slices; no external maintenance classification is ledger authority.

The scheduled consumer is separately versioned in
`consumers/SCHEDULED_WINDOWS_V1.md` and `consumers/shadow-daily-v1.json`.
It closes at most one window per UTC date, normally up to 100 observations,
rotating through numeric IDs regardless of state or prior outcomes. First and
changed outcomes retain full events; unchanged outcomes retain heartbeats.
Explicit two-observation pilot runs declare their budget and close that date.

The daily Actions writer publishes only to `automation/corpus-ledger-shadow`,
under `corpus/ledger/shadow/history/`. Main contains code and policy, not this
operational history. Git fast-forward publication is the durable commit point;
SQLite is staging, restored through sequencer re-execution. Immutable chunks,
genesis artifacts, windows, producer bytes and run plans permit offline replay.
The derived `HEAD.json` is checked against them. Verification proves artifact
integrity and declared emission, not remote truth or signed publication.

```sh
# Use frozen authority artifacts matching shadow/bootstrap-v1.json.
python3 -m corpus.ledger.tools.history initialize --authority-root /path/frozen-authority --out /path/corpus/ledger/shadow/history
python3 -m corpus.ledger.tools.history verify --history /path/corpus/ledger/shadow/history
python3 -m corpus.ledger.tools.history run --history /path/corpus/ledger/shadow/history --day YYYY-MM-DD --budget 100 --out /path/corpus/ledger/shadow/staged-history
```

`run` only stages evidence. Publish from the previously accepted Git parent
using a normal fast-forward push. Never force, reset, overwrite old evidence or
merge this branch into main. A completed-date rerun performs no network work.
Failed staging/publication cannot advance the published cursor or date. Public
ROLL cannot consume this history; archive lifecycle and discovery adapters
remain future work.

Explicit archive evidence is specified separately in
`consumers/ARCHIVE_WINDOWS_V1.md`. Recorded declarations/probe observations may
be staged with `history archive`. Each target change is explicit; HEAD failure
never infers loss, eligibility or availability. Original identity target records
survive merges independently; the canonical identity is also reported.
History v2 adds immutable archive windows while retaining v1 verification and
all prior bytes. Archive windows never advance the daily cursor or date.

```sh
# operations.json is a canonical ordered array + LF. See the consumer spec.
python3 -m corpus.ledger.tools.history archive --history /path/corpus/ledger/shadow/history --name explicit-archive-1 --operations operations.json --out /path/corpus/ledger/shadow/archive-staged
```

The daily workflow's optional manual archive inputs use the same writer group
and evidence branch. Scheduled/push runs perform no archive discovery or lookup.
Producer commitments and verification prove declared inputs and deterministic
emission, not that an archive snapshot belongs to a resource or remains live.

To collect actual HEAD evidence, `corpus.ledger.tools.archive collect` accepts
a canonical explicit ID array and probes only their already-declared targets.
It uses the existing public-target guard/redirect transport, binds the original
source head and stages a verified window through the same sequencer. No target
lookup, association inference or automatic lifecycle transition is performed.
A manual workflow invocation chooses recorded operations or live collection,
never both; scheduled invocations remain limited to the live-resource policy.
