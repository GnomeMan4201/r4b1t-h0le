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
