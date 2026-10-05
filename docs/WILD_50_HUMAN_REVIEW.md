# WILD 50 human review — v0.6.1

> **SECONDARY / NON-CANONICAL.** This document describes the later duplicate run `37363282447` and its review. The canonical campaign is the first successful post-preregistration run `37362726635`, as frozen in `docs/WILD_50_RUN_RECONCILIATION.md`. Do not use this document or its review outcome for Corpus Ledger shadow translation.
Date: 2026-10-05
Scope: the 45 authoritative `LIVE_CANDIDATE` + `MANUAL_CHECK` rows from workflow run `37363282447`. The four `RETRYABLE` observations and one intake-level `REJECTED` observation are not converted into human-review rows.
This review does not mutate the public corpus or ledger. It supplies human verdict, frozen classification-v2.0 fields, and the required one-line reason.
## Result

- campaign-acceptable after classification validation: **35**
- human rejected: **10**
- still outside human review because intake was RETRYABLE/REJECTED: **5**
The bar was intentionally conservative: distinctive technical, investigative, creative, scientific, or handmade personal-web resources may pass; generic consulting/vendor/VC pages and candidates with insufficient evidence do not.
## Discovery-quality tags

These tags are descriptive only and never influence ROLL or admission weighting.
- `personal/indie`: 28
- `technically useful`: 23
- `educational`: 20
- `artistic/creative`: 9
- `investigative/security`: 7
- `weird/experimental`: 5
- `historical/archive`: 3
- `scientific/data`: 2
- `playful/game`: 2
- `web_culture`: 1

All 35 accepted candidates received at least two descriptive quality tags.
## Classification coverage

### Resource types
- `personal_site`: 24
- `interactive_tool`: 4
- `directory`: 2
- `challenge`: 1
- `article`: 1
- `visualization`: 1
- `experiment`: 1
- `reference`: 1

### Primary subjects
- `programming`: 7
- `web_culture`: 6
- `osint`: 4
- `systems`: 4
- `society_economics`: 2
- `film_media`: 2
- `engineering`: 2
- `visual_art`: 2
- `offensive_security`: 1
- `defensive_security`: 1
- `transport`: 1
- `forensics`: 1
- `design_typography`: 1
- `literature`: 1

All accepted rows have the primary subject present in `subjects`, no more than four subjects, and a human reason longer than the frozen 20-character minimum.
## Source outcome
- `1mb.club`: 6 accepted / 2 rejected
- `512kb.club`: 8 accepted / 3 rejected
- `github.com/eric-erki`: 0 accepted / 1 rejected
- `github.com/jivoi`: 5 accepted / 0 rejected
- `github.com/thedoubler`: 1 accepted / 0 rejected
- `github.com/tigergate`: 0 accepted / 1 rejected
- `indieweb.org`: 1 accepted / 0 rejected
- `kickscondor.com`: 4 accepted / 1 rejected
- `personalsit.es`: 8 accepted / 2 rejected
- `recurse.com`: 2 accepted / 0 rejected

No source approaches the campaign acceptance cap of 50.
## Manual-check handling

Three of the four `MANUAL_CHECK` rows were accepted only after supplemental human lookup established what the resource is; their intake status remains `MANUAL_CHECK` and is not rewritten to `LIVE_CANDIDATE`. `46692.dev` was rejected because the available evidence remained insufficient.
## Candidate decisions

| siteKey | intake | verdict | type | primary subject | reason |
|---|---|---|---|---|---|
| `0xded.dev` | LIVE_CANDIDATE | **accepted** | `personal_site` | `offensive_security` | Handmade hacker/maker homepage combining technical projects with independent-web culture and a distinctive cyberia aesthetic. |
| `0xedward.io` | LIVE_CANDIDATE | **accepted** | `personal_site` | `defensive_security` | Security engineer's independent site mixes software-security work, practical code, and reflective writing on technology and philosophy. |
| `100daystooffload.com` | LIVE_CANDIDATE | **accepted** | `challenge` | `web_culture` | A durable independent-web challenge that encourages people to publish one hundred posts instead of leaving ideas inside social feeds. |
| `100r.co` | LIVE_CANDIDATE | **accepted** | `article` | `transport` | Long-form North Pacific sailing logbook documents a difficult Japan-to-Canada passage with unusual firsthand detail and practical value. |
| `1984.ninja` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The site returned content, but the available evidence exposes only the title '=T0k3n!z3R=' and is insufficient to classify or justify admission. |
| `1thingaweek.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `web_culture` | Long-running weekly independent blog combines software, design, maps, devices, and personal experiments in a consistent small-web format. |
| `2050.earth` | LIVE_CANDIDATE | **accepted** | `visualization` | `society_economics` | Interactive future-forecast project turns predictions from scientists and users into an explorable visual map of possible life in 2050. |
| `23ro.de` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The live probe exposed only a personal-page title and current manual web access is blocked, leaving too little evidence for a defensible WILD classification. |
| `24hoursofhappy.com` | LIVE_CANDIDATE | **accepted** | `experiment` | `film_media` | A browser-native twenty-four-hour music-video experiment is a distinctive piece of interactive web and media history rather than a normal video page. |
| `24timezones.com` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The selected URL is a stale 2020 event countdown on a general time utility site; it does not add enough distinctive discovery value for WILD. |
| `250kb.club` | LIVE_CANDIDATE | **accepted** | `directory` | `web_culture` | Curated directory of websites under 250 KB exposes intentionally lightweight web design and useful examples of minimal technical publishing. |
| `29a.ch` | LIVE_CANDIDATE | **accepted** | `interactive_tool` | `forensics` | Forensically provides browser-based clone detection, error-level analysis, metadata inspection, and other practical image-forensics tools. |
| `2chat.co` | LIVE_CANDIDATE | **accepted** | `interactive_tool` | `osint` | Focused public OSINT utility checks whether a phone number is registered on WhatsApp, making it a concrete investigation resource with clear privacy relevance. |
| `2earth.github.io` | LIVE_CANDIDATE | **accepted** | `personal_site` | `design_typography` | Independent design site publishes reflections on technology-centered design and its interaction with society, adding a non-security technical perspective. |
| `41j.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `engineering` | Hands-on technical blog covers sequencing hardware, microscopy, sensor modifications, and other unusual engineering experiments with scientific equipment. |
| `42crunch.com` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The candidate is primarily a commercial enterprise security-platform landing page; the pilot should favor directly useful resources over vendor marketing. |
| `44mb.club` | LIVE_CANDIDATE | **accepted** | `directory` | `web_culture` | Small-web webring organized around the 1.44 MB floppy-disk constraint provides a distinctive route into lightweight independent sites. |
| `46692.dev` | MANUAL_CHECK | **rejected** | `—` | `—` | The authoritative probe reached only an HTTP 403 and supplied no title or description, so there is not enough evidence to classify or admit the site. |
| `4chansearch.com` | LIVE_CANDIDATE | **accepted** | `interactive_tool` | `osint` | Purpose-built search interface for public 4chan content provides a focused investigation path into an otherwise difficult-to-query web community. |
| `60z.github.io` | LIVE_CANDIDATE | **accepted** | `personal_site` | `programming` | Independent front-end developer portfolio emphasizes experimental web projects and unusual technology-driven builds rather than a static résumé alone. |
| `64b.it` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The page is primarily a software consulting sales site, with little unique standalone resource value beyond advertising professional services. |
| `8yd.no` | LIVE_CANDIDATE | **accepted** | `personal_site` | `programming` | Senior web developer's independent site documents interface work, technical exercises, and the craft required to build sites and applications. |
| `96tilinfinity.com` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The live evidence is too sparse to identify a distinct public resource, while external traces point mainly to a design/business identity rather than a clear WILD artifact. |
| `99tools.net` | MANUAL_CHECK | **accepted** | `interactive_tool` | `osint` | The selected email-extractor sits inside a large browser-based utility collection and offers a practical text/OSINT tool without requiring local software. |
| `a16z.com` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The selected AI playbook is broad corporate venture content rather than a distinctive independent tool, archive, experiment, or specialist reference. |
| `aadinternals.com` | LIVE_CANDIDATE | **accepted** | `reference` | `osint` | Azure AD OSINT toolkit is a specialized reference for red teams, blue teams, bounty hunters, and identity-focused investigators. |
| `aanandmadhav.com` | LIVE_CANDIDATE | **rejected** | `—` | `—` | The evidence describes a conventional product-management and UX career portfolio; it does not add enough distinctive resource value for this WILD intake. |
| `aaqa.dev` | LIVE_CANDIDATE | **accepted** | `personal_site` | `systems` | Infrastructure engineer's independent site explores ML systems, inference engineering, and distributed computing—strong adjacent material for technical discovery. |
| `aaronj.sh` | LIVE_CANDIDATE | **accepted** | `personal_site` | `programming` | Small independent developer site collects projects, writing, and links in a lightweight format that fits the personal technical web WILD is seeking. |
| `aaronjeskie.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `programming` | Compact engineer-built site documents embedded systems, data pipelines, strict TDD practice, and deployed personal projects across several technical domains. |
| `aaronmassicotte.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `visual_art` | Lightweight personal site deliberately combines photography, recipes, and writing, offering a calm handcrafted alternative to platform-based publishing. |
| `aaronstrick.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `web_culture` | Highly exploratory personal website mixes original music, interactive projects, code, handmade hardware, random pages, and deliberately surfable navigation. |
| `aashvik.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `engineering` | Independent site focused on computers and robotics adds hands-on engineering material rather than another general-purpose software resource. |
| `aavina.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `film_media` | Personal site crosses books, technology, games, board games, and movies, providing a broad human-curated path across several non-algorithmic interests. |
| `aawadia.dev` | MANUAL_CHECK | **accepted** | `personal_site` | `systems` | Technical blog contains concrete experiments with self-hosting, Docker registries, VPS benchmarking, Kotlin, networking, and distributed systems. |
| `abandon.ie` | LIVE_CANDIDATE | **accepted** | `personal_site` | `programming` | Long-running developer identity links active code experiments and opinionated independent-web work, adding a recognizable handmade technical voice. |
| `aberle.photo` | MANUAL_CHECK | **accepted** | `personal_site` | `visual_art` | Personal travel-photography site combines field stories, geographic exploration, galleries, and an ad-free photo stream outside mainstream social platforms. |
| `abhishe.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `society_economics` | Independent blog publishes original writing plus curated resources on business, wealth, books, and the web under open content and source-code licenses. |
| `abjectsubli.me` | LIVE_CANDIDATE | **accepted** | `personal_site` | `literature` | Independent personal blog participates in the small-web/RSS ecosystem and provides authored writing outside algorithmic publishing platforms. |
| `abmurrow.com` | LIVE_CANDIDATE | **accepted** | `personal_site` | `systems` | Developer and NixOS maintainer's site connects Linux and software practice with blogging and experimental literature, an unusually cross-disciplinary mix. |
| `abordage.dev` | LIVE_CANDIDATE | **accepted** | `personal_site` | `systems` | Detailed backend-engineering site covers distributed architecture, resilience, observability, APIs, home labs, and concrete open-source tooling. |
| `abouhanna.com` | LIVE_CANDIDATE | **rejected** | `—` | `—` | Available evidence describes a conventional product-design/development portfolio and does not show enough distinctive standalone material for WILD admission. |
| `aboutdavid.me` | LIVE_CANDIDATE | **accepted** | `personal_site` | `web_culture` | Quirky independent personal homepage participates in the small-web community and provides a human-made destination outside large publishing platforms. |
| `afranca.com.br` | LIVE_CANDIDATE | **accepted** | `personal_site` | `programming` | Open-source enthusiast's personal blog publishes technical and social-web writing, including independent analysis of online scams and software culture. |
| `helloadrien.dev` | LIVE_CANDIDATE | **accepted** | `personal_site` | `programming` | Dense Recurse-alumni site exposes data, AI, web, DevOps, electronics, security, game, and creative projects plus detailed technical presentations. |
