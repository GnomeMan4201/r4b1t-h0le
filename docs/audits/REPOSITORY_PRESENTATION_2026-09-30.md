# Repository presentation audit — 2026-09-30

Base: `c29d6bd71738873f6085470753e3724f22998b22` (current main when audited).
Scope: repository organization, documentation, assets, and public metadata.

## Findings and move plan

| Finding | Destination and affected files | Improvement | Move risk |
| --- | --- | --- | --- |
| 13 specialist `*_CONTRACT.md` files share the root with application modules; feature specifications are scattered through `docs/`. | `docs/contracts/`: all 13 specialist contracts, five feature specs, Replay delegation and three UI boundaries, ROLL motion contract. Keep root `CONTRACT.md`. | One place for behavioral boundaries, with the product contract still prominent. | Literal paths, CI filters, and two spec-reading tests require updates. Preserve statuses and substantive text. |
| Acceptance audits and release records are mixed with specifications. | `docs/audits/`: six feature/closeout audits and mobile polish baseline; `docs/releases/`: two phase release records alongside existing version/deployment records. | Distinguish a rule from dated evidence of compliance. | Preserve commit identifiers and historical claims; rebase links and path references. |
| Legacy corpus evidence is presented as a README asset; RD-4 records occupy root. | `docs/evidence/`: legacy corpus baseline and both RD-4 records. | Make the evidence lineage discoverable without confusing it with active corpus authority. | Update README and claims-verifier paths; no evidence bytes or authority artifacts are removed. |
| Operations and motion guidance lack a clear map. | `docs/operations/`: governance, pool sweep, quality gate; `docs/architecture/`: frontend interaction language, motion pass, motion sync. Human-readable projection schemas join `docs/schema/`. | Separate contributor procedures, presentation design, and schema documentation. | Update workflow filters and links. Keep Worker trust-boundary and workstream handoff paths stable. |
| README experiments remain mixed with the sole active hero. | Remove 12 unreferenced JPEG/WebP files. Archive `field-reel-mobile-shell.svg` under `docs/history/readme/`. | Keep current assets unambiguous; preserve the authored historical shell diagram explicitly. | Searches found no consumers. Raster revisions remain recoverable from Git history. |
| `tools/README.md` describes missing scripts and a weighted injection workflow. `r4b1t_pipeline.sh` calls missing `liveness_check.py` and `generate_branch_injection.py`. | Retain pipeline unchanged under `tools/history/`; replace current tool guide with actual commands and authority boundaries. | Contributors no longer follow an incomplete recipe that rewrites the HTML pool. | Search found only contributor-guide references to the pipeline. Classifier's historical output hint stays unchanged; tested by path-consistency checks. |

## Classification

- **Runtime/product:** root HTML, JS, CSS, PWA files and SVGs; `worker/`; deployment configuration. Keep paths and bytes unchanged. `banana-note.svg` is precached, `rabbit-aperture.svg` is rendered/precached, and `demo.svg` is linked from the changelog: none is dead artwork.
- **Normative boundaries:** root product contract, specialist contracts, feature specs, Replay boundaries, motion contract, schema documents. Draft/proposed/frozen labels remain as recorded; filing a document under contracts does not accept it.
- **Decisions:** all five `docs/adr/` records, with their existing statuses.
- **Evidence/releases:** feature audits, release baselines, Worker deployment record, RD-4 evidence, legacy corpus measurements. Historical records do not certify current HEAD.
- **Developer material:** CONTRIBUTING, SECURITY, tool guide, operations, presentation architecture, package scripts, CI, tests. Workstream handoff remains dated coordination context, not a current release certificate.
- **Authority/data:** `corpus/runtime/active-v1.json` grants runtime authority; immutable `corpus/releases/typed-candidate-v0.1/` bytes remain unchanged. `corpus/sources/` and `corpus/catalogs/` are pinned inputs. Root `urls.txt` is historical/rollback material, not the active population.
- **README assets:** `open-instrument-hero.svg` alone is active. It retains clip paths, transform wrappers, and hidden state elements; its asset guide must say so.
- **Historical/stale:** field-reel artwork, retired raster directions, incomplete weekly recipe. No other unreferenced file is deleted on appearance alone.

## Asset history

The raster experiments originated in `0efcacd` (banner/mechanism), `134c4ab` (five WebP panels), and `813a9e0` (five JPEG counterparts). These are presentation experiments, not measured evidence. Inspection found several raster files undecodable or black in local decoders; none has a current repository reference. The field-reel SVG (`e17925a`) preserves an authored earlier mobile-shell composition and is archived with an explicit historical label. Active hero geometry is unchanged.

## Metadata

Observed description: “Random discovery across security, OSINT, research, development, and the weird internet. No ranking, no tracking; local-first verifiable trails.” Homepage: empty.

Target description: “Chance-driven discovery across security, OSINT, research, development, and the weird web. No ranking or recommendation profile; device-local trails.”

Target homepage: `https://r4b1t.badbananaresearch.com`.

Target topics: `discovery`, `security`, `osint`, `security-research`, `local-first`, `pwa`, `vanilla-js`. Remove redundant `infosec`, comparison-brand `stumbleupon`, and `tor` (the active typed release excludes onion resources). No changes to repository features, permissions, or deployment settings.
