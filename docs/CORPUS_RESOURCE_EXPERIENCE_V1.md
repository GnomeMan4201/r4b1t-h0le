# Resource experience review v1

This change adds 58 reviewed resources and promotes `experience-candidate-v0.4`: 7,033 routes, 350 hostnames, 72 assertion sources and 14 existing resource types. All 6,975 previous routes remain. The daily collector now uses the 70 reviewed indexes in `registry-v3.json`; the two legacy catalogs remain pinned.

## What the audit establishes

The baseline is bound to `sha256:f85a1c710977814c920ff13eb95cf0b86805486668c99dba2d5024d6b1bda3a7`. Its metadata assigns 5,895 of 6,975 resources (84.52%) to research, documentation, writeup, paper or reference. This is a type-based proxy for a reading-heavy population, not a content assessment of every page. Labs account for 283 routes; challenges for eight. Types alone do not establish that something is enjoyable, unusual or educational.

This batch addresses different activities rather than adding another large archive of text:

| Publisher/source | New routes | Form and reason |
| --- | ---: | --- |
| CCC 38C3 Security | 30 | Recorded talks with video/audio and technical demonstrations: file-format oddities, radio systems, hardware, privacy and incident investigations. One playback page per talk. |
| CryptoHack | 5 | Guided cryptography courses combining explanation and interactive puzzle sequences. |
| OverTheWire | 10 | Named terminal/web wargames for reverse engineering, crypto and exploitation. |
| pwn.college | 12 | Concrete browser labs covering exploitation, OSINT, firmware rehosting, fuzzing, operating systems and hacker history. |
| Google XSS game | 1 | Public browser puzzle entry point with an intentionally vulnerable application, source and hints. |

Examples of unusual audiovisual resources include [file-format tricks](https://media.ccc.de/v/38c3-fearsome-file-formats), [radio-controlled street lamps](https://media.ccc.de/v/38c3-blinkencity-radio-controlling-street-lamps-and-power-plants), and [fax-machine exploitation](https://media.ccc.de/v/38c3-dialing-into-the-past-rce-via-the-fax-machine-because-why-not). Hands-on examples include [cryptography courses](https://cryptohack.org/courses/intro/), [Natas](https://overthewire.org/wargames/natas), and [OSINT exercises](https://pwn.college/dojo/lord-of-osint~9e1a1da1).

The complete URL list, exact types, scope rationales and index digests are in the five `experience-*-v1` reviews. `corpus/expansion/experience-review-v1.json` binds the baseline, candidate and registry digests and records bounded destination observations and editorial format descriptors. Those descriptors remain review evidence; they do not enter runtime selection or become new terrain labels.

Every admitted destination returned HTTP 200 with a bounded publisher response during acquisition. Public descriptions, source placement and route shapes were inspected. We did not solve challenges, test SSH servers, play full videos, or audit the content of all 7,033 destinations. pwn.college execution generally needs an account; some CryptoHack progress functions need an account. OverTheWire requires a terminal for its SSH games. Talk languages vary. Reachable instructions do not certify the underlying service is usable on every device.

## A caught false positive

Google XSS levels 2, 3 and 5 returned HTTP 200 while showing a previous-level completion gate without a playable challenge. Only level 1 is admitted. A response code alone would have missed this. Alternate media encodings, playlist routes, scoreboards, account controls, semester duplicates and offline OverTheWire games were excluded from the batch.

## Review gate for further discoveries

For each admission, record a concrete destination and supported cybersecurity/investigation purpose; identify what the visitor can read, watch, listen to, play, inspect or use; check that the page actually exposes that resource; note account, progress or device dependencies; and exclude duplicate aliases, generic containers and navigation controls. A publisher's new page remains a proposal until this review is recorded. Unknown relevance and an HTTP 200 never establish quality automatically.

Educational, unusual and entertaining are editorial motivations, not measurable guarantees for every visitor. This batch improves activity coverage, but the overall pool remains dominated by reading. Source families and resource types overlap, and adding many pages from a single publisher is not equivalent to adding many independent perspectives. Future curation should keep seeking independent projects, demonstrations, investigative datasets, tools, games and explainers instead of chasing the total URL count.

## Explicit runtime cutover

The new release manifest remains `status: candidate` and `selection_authority: false`. `corpus/runtime/active-v1.json` separately grants authority to its exact bytes; the new terrain profile binds the regenerated index. The prior v0.3 profile becomes superseded and its release, index and 300-roll fixture remain unchanged. Rollback stays explicit, with no silent fallback.

Sampler, PRNG, immediate-repeat guard, motion, Trail and Blind Descent semantics are unchanged. The population change alters fixed-seed outcomes; a separately pinned 300-roll v0.4 fixture covers the cutover. Imported historical artifacts retain their recorded revision, and existing corpus-revision guards invalidate stale runtime drafts. No ranking, personalization, interest score or format weighting is introduced.

## Rebuild

```sh
python tools/build_expanded_corpus.py --registry corpus/expansion/registry-v3.json --out-dir /tmp/experience-build
diff -ru corpus/releases/experience-candidate-v0.4 /tmp/experience-build/release
python tools/terrain_index.py check --release corpus/releases/experience-candidate-v0.4 --index corpus/terrains/experience-candidate-v0.4/terrain-index-v1.json
```

Both previous expansion registries/releases remain reproducible. CI also compares the new release and descriptive diversity reports byte-for-byte and runs authority, terrain and browser acceptance tests.
