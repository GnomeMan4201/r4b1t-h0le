# WILD 50 human review — v0.6.1

Date: 2026-10-05

This review is downstream of the authoritative WILD 50 observation run
`37362726635`. It does not change the observation states and does not write to the
public corpus or ledger.

## Review result

| review state | count |
| --- | ---: |
| CAMPAIGN_ACCEPTED | 30 |
| REVIEW_REJECTED | 11 |
| UNREVIEWED | 4 |
| REVIEW_INVALID | 0 |

The exact v0.6.1 `review_state()` implementation was run over all 45 rows after editing
the review sheet and returned the counts above with zero classification problems.

Accepted observation states remain:

- 28 × `LIVE_CANDIDATE`
- 2 × `MANUAL_CHECK`

Human acceptance did **not** promote either MANUAL_CHECK resource to LIVE.

Rejected observation states:

- 10 × `LIVE_CANDIDATE`
- 1 × `MANUAL_CHECK`

Unresolved:

- 3 × `LIVE_CANDIDATE`
- 1 × `MANUAL_CHECK`

## Acceptance bar

A live page was not automatically accepted. The review favored:

- a distinct reusable resource;
- unusual or genuinely independent-web character;
- technical, investigative, scientific, educational, artistic, or historical value;
- a reason to enter this site identity rather than a generic corporate/portfolio page.

Generic corporate marketing, ordinary professional portfolios, commodity tool
aggregators, and accidental deep links were rejected even when live.

Quality was not inferred from lead source.

## Accepted identities

```text
0xded.dev
0xedward.io
100daystooffload.com
100r.co
1thingaweek.com
2050.earth
24hoursofhappy.com
250kb.club
29a.ch
2chat.co
2earth.github.io
41j.com
44mb.club
4chansearch.com
8yd.no
aadinternals.com
aaqa.dev
aaronmassicotte.com
aaronstrick.com
aashvik.com
aavina.com
aawadia.dev
abandon.ie
aberle.photo
abhishe.com
abjectsubli.me
abmurrow.com
aboutdavid.me
afranca.com.br
helloadrien.dev
```

## Rejected identities

```text
24timezones.com
42crunch.com
60z.github.io
64b.it
96tilinfinity.com
99tools.net
a16z.com
aanandmadhav.com
aaronjeskie.com
abordage.dev
abouhanna.com
```

The rejection reason is recorded per row in
`corpus/wild/reviews/wild-50-v061-review.csv`.

## Unresolved identities

These remain intentionally unreviewed rather than being guessed:

| siteKey | observation state | review reason |
| --- | --- | --- |
| `1984.ninja` | LIVE_CANDIDATE | probe was live, but human inspection did not expose enough content to judge it |
| `23ro.de` | LIVE_CANDIDATE | current human inspection did not provide enough content for a defensible decision |
| `46692.dev` | MANUAL_CHECK | authoritative 403 and no reliable human-visible content basis |
| `aaronj.sh` | LIVE_CANDIDATE | current human inspection did not expose enough content to classify confidently |

None is labeled dead.

## Classification coverage of the 30 accepted rows

Resource types:

| resource_type | count |
| --- | ---: |
| personal_site | 20 |
| directory | 3 |
| interactive_tool | 3 |
| challenge | 1 |
| article | 1 |
| map | 1 |
| experiment | 1 |

Primary subjects:

| primary_subject | count |
| --- | ---: |
| web_culture | 5 |
| programming | 5 |
| osint | 3 |
| offensive_security | 2 |
| society_economics | 2 |
| music_sound | 2 |
| design_typography | 2 |
| electronics_radio | 2 |
| games_play | 2 |
| oceans | 1 |
| forensics | 1 |
| systems | 1 |
| visual_art | 1 |
| literature | 1 |

Every accepted row includes its primary subject in `subjects`, uses at most four
subjects, and has a human reason longer than the frozen minimum.

## Preregistered discovery-quality tags

Across all 45 candidates:

- 11 distinct descriptive tags represented;
- 33 candidates have at least two tags.

Across the 30 accepted candidates:

- 10 distinct tags represented;
- all 30 have at least two tags.

Accepted tag counts:

| quality tag | count |
| --- | ---: |
| personal/indie | 24 |
| technically useful | 17 |
| educational | 16 |
| artistic/creative | 10 |
| web culture | 9 |
| investigative/security | 7 |
| playful/game | 4 |
| weird/experimental | 2 |
| scientific/data | 2 |
| historical/archive | 2 |

These tags are descriptive only and have no selection or admission authority.

## Source distribution of human decisions

| lead_source_key | accept | reject | unresolved |
| --- | ---: | ---: | ---: |
| 512kb.club | 5 | 3 | 3 |
| 1mb.club | 5 | 2 | 1 |
| kickscondor.com | 4 | 1 | 0 |
| github.com/jivoi | 4 | 1 | 0 |
| personalsit.es | 8 | 2 | 0 |
| recurse.com | 2 | 0 | 0 |
| github.com/thedoubler | 1 | 0 | 0 |
| indieweb.org | 1 | 0 | 0 |
| github.com/eric-erki | 0 | 1 | 0 |
| github.com/tigergate | 0 | 1 | 0 |

No accepted source is close to the campaign cap of 50.

## Published review artifacts

- `corpus/wild/reviews/wild-50-v061-review.csv`
  - repository SHA-256:
    `1ba91065c6b518f3ec7ac5e9e922b1e23d985b6f531c890726b3814ceb049d6a`
- `corpus/wild/reviews/wild-50-v061-quality-tags.csv`
  - repository SHA-256:
    `e3ebad7281a4c47619a59955bee315bc7129b8a73fe55684a49c96f05ae12f79`
- `corpus/wild/reviews/wild-50-v061-campaign-accepted.jsonl`
  - SHA-256:
    `dfe9ca048436f8198c3e2eb6a1c50f0001b22324b4fae766d1e8b81f6a2a8d76`

The accepted export contains 30 records and preserves the original observation state,
probe evidence, archive evidence, quota lead, and harvested lead edges.

## Boundary

This is a human-review/export checkpoint only.

It does not:

- mutate `experience-candidate-v0.4`;
- add a URL to the public corpus;
- write a Corpus Ledger event;
- change Selection v3;
- change terrain authority.

The next implementation gate is translating the 30 accepted export records into
Corpus Ledger **shadow-mode** events with the frozen classification and intake provenance.
