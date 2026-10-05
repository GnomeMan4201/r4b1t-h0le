# WILD 50 exploratory live-web pass

Date: 2026-10-05

Status: **non-authoritative exploratory evidence only**.

This pass does **not** replace the pinned `wild-intake-v0.6` run. The exact v0.6 bytes
(`wild1000.py` SHA-256
`f7078be2763a34aea633356a3b559d287dfd30125d301f4a2aaac5cd049f7a9e`)
were not available in the execution runtime. No earlier or reconstructed intake build
was substituted.

The purpose of this pass was to exercise the frozen baseline and lead strategy against
the live web while PR #266 remains draft.

## Frozen baseline check

The site-key/v1 authority from the Selection v3 stack was recomputed against
`experience-candidate-v0.4`:

- URLs: **7,033**
- siteKey/v1 identities: **733**

A pool of 87 candidate identities was harvested from five independent lead cultures.
All 87 were outside the 733-site baseline. A balanced first 50 was then selected:
10 candidates from each source identity.

## Probe result

- selected siteKeys: **50**
- baseline collisions: **0**
- supported live by direct web fetch: **39**
- supported live by a current secondary web result after direct fetch was unavailable: **4**
- unresolved by this web-fetch path: **6**
- explicit upstream 502: **1**

So **43/50** have current live-web support in this exploratory pass.

These labels are deliberately *not* the intake tool's LIVE/MANUAL/RETRY/REJECT states.
Only the exact pinned v0.6 run may produce those campaign observation states.

## Balanced 50

| # | lead_source_key | site_key | candidate URL | exploratory state |
|---:|---|---|---|---|
| 1 | openweird.com | playables.net | https://coin.playables.net/ | LIVE_DIRECT |
| 2 | openweird.com | ouaismaisbon.ch | https://ouaismaisbon.ch/ | UNRESOLVED_FETCH |
| 3 | openweird.com | puginarug.com | https://puginarug.com/ | LIVE_DIRECT |
| 4 | openweird.com | perpetual.pizza | https://perpetual.pizza/ | LIVE_DIRECT |
| 5 | openweird.com | mrdoob.com | https://mrdoob.com/projects/chromeexperiments/spinpainter/ | LIVE_SECONDARY |
| 6 | openweird.com | bestuselesswebsites.com | https://bestuselesswebsites.com/originals/hexagonal-maze.html | UNRESOLVED_FETCH |
| 7 | openweird.com | window-swap.com | https://window-swap.com/ | LIVE_DIRECT |
| 8 | openweird.com | trypap.com | https://trypap.com/ | LIVE_DIRECT |
| 9 | openweird.com | pointerpointer.com | https://pointerpointer.com/ | LIVE_DIRECT |
| 10 | openweird.com | neal.fun | https://neal.fun/deep-sea/ | LIVE_DIRECT |
| 11 | 512kb.club | fegis.net | https://fegis.net/ | UNRESOLVED_FETCH |
| 12 | 512kb.club | thejollyteapot.com | https://thejollyteapot.com/ | LIVE_SECONDARY |
| 13 | 512kb.club | ctrl-c.club | https://ctrl-c.club/ | LIVE_DIRECT |
| 14 | 512kb.club | smalltictactoe.dpdns.org | https://smalltictactoe.dpdns.org/ | LIVE_DIRECT |
| 15 | 512kb.club | emnace.org | https://ig.emnace.org/ | LIVE_DIRECT |
| 16 | 512kb.club | stchris.net | https://www.stchris.net/ | LIVE_DIRECT |
| 17 | 512kb.club | karl.berlin | https://www.karl.berlin/ | LIVE_DIRECT |
| 18 | 512kb.club | buchh.org | https://buchh.org/ | LIVE_DIRECT |
| 19 | 512kb.club | steamosaic.com | https://steamosaic.com/ | HTTP_502 |
| 20 | 512kb.club | gsthnz.com | https://gsthnz.com/ | LIVE_DIRECT |
| 21 | personalsit.es | trebledj.me | https://trebledj.me/ | LIVE_DIRECT |
| 22 | personalsit.es | sanjaynair.me | https://sanjaynair.me/ | LIVE_DIRECT |
| 23 | personalsit.es | tyfromtheinternet.com | https://tyfromtheinternet.com/ | LIVE_DIRECT |
| 24 | personalsit.es | lazaruscorporation.co.uk | https://www.lazaruscorporation.co.uk/ | LIVE_DIRECT |
| 25 | personalsit.es | robertjelenic.com | https://www.robertjelenic.com/ | LIVE_DIRECT |
| 26 | personalsit.es | vishwas.tech | https://vishwas.tech/ | LIVE_SECONDARY |
| 27 | personalsit.es | aydinnyunus.github.io | https://aydinnyunus.github.io/ | LIVE_DIRECT |
| 28 | personalsit.es | jarv.is | https://jarv.is/ | LIVE_DIRECT |
| 29 | personalsit.es | thechels.uk | https://thechels.uk/ | LIVE_DIRECT |
| 30 | personalsit.es | declanbyrd.co.uk | https://declanbyrd.co.uk/ | UNRESOLVED_FETCH |
| 31 | ring.recurse.com | rulethepla.net | https://rulethepla.net/ | LIVE_DIRECT |
| 32 | ring.recurse.com | izz.ee | https://izz.ee/ | LIVE_DIRECT |
| 33 | ring.recurse.com | alanza.xyz | https://alanza.xyz/ | UNRESOLVED_FETCH |
| 34 | ring.recurse.com | slinkp.com | https://slinkp.com/ | LIVE_DIRECT |
| 35 | ring.recurse.com | fredkettelhoit.com | https://fredkettelhoit.com/ | LIVE_DIRECT |
| 36 | ring.recurse.com | audreygu.io | https://audreygu.io/ | UNRESOLVED_FETCH |
| 37 | ring.recurse.com | veryth.ink | https://veryth.ink/ | LIVE_DIRECT |
| 38 | ring.recurse.com | fauxtrots.com | https://www.fauxtrots.com/ | LIVE_SECONDARY |
| 39 | ring.recurse.com | brianagude.com | https://www.brianagude.com/ | LIVE_DIRECT |
| 40 | ring.recurse.com | itsrainingmani.dev | https://itsrainingmani.dev/ | LIVE_DIRECT |
| 41 | 1mb.club | btxx.org | https://cv.btxx.org/ | LIVE_DIRECT |
| 42 | 1mb.club | t0.vc | https://t0.vc/ | LIVE_DIRECT |
| 43 | 1mb.club | jdurham.me | https://jdurham.me/ | LIVE_DIRECT |
| 44 | 1mb.club | ukarim.com | https://ukarim.com/ | LIVE_DIRECT |
| 45 | 1mb.club | 0b.ee | https://tutor.0b.ee/ | LIVE_DIRECT |
| 46 | 1mb.club | cleberg.net | https://cleberg.net/ | LIVE_DIRECT |
| 47 | 1mb.club | lejtzen.dev | https://1kb.lejtzen.dev/ | LIVE_DIRECT |
| 48 | 1mb.club | vik.tf | https://vik.tf/ | LIVE_DIRECT |
| 49 | 1mb.club | tenox.net | https://tenox.net/ | LIVE_DIRECT |
| 50 | 1mb.club | nocss.club | https://nocss.club/ | LIVE_DIRECT |

## What this already tells us

1. **Breadth works.** A small selection of lead generators produced at least 87 site identities
   that were completely absent from the 733-site baseline.
2. **The five-source split avoided curator capture.** The exploratory 50 contains exactly
   10 identities from each lead-source identity.
3. **The broad classification direction is justified by the material.** Even this first pass
   spans browser experiments, programming/security writing, lightweight web culture, art,
   personal sites, games, tools, and educational material.
4. **Live-web ambiguity is real.** Fetch restrictions, robots, TLS/tool behavior, and transient
   upstream errors affect a meaningful minority of candidates. This validates keeping
   MANUAL_CHECK / RETRYABLE distinct from hard rejection in v0.6.
5. **No public-corpus cutover is warranted yet.** The exact v0.6 observation log and human
   classification review remain the acceptance authority.

## Next authoritative step

Run the exact pinned v0.6 artifact:

```text
selftest -> campaign-init -> harvest -> verify --limit 50
```

Then compare its 50 selected identities and observation states with this exploratory sample.
