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
