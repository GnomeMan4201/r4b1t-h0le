# Daily corpus maintenance

Generated: 2026-10-03T15:08:59.797643+00:00

Checked 1000 of 7033 active URLs: 998 reachable, 0 missing, 2 indeterminate.

4 unreviewed discoveries; 0 retirement candidates; 0 quarantined candidates.

0 previously queued links excluded by discovery policy reviewed-host-and-navigation-v2. New discovery is restricted to each source's reviewed destination hosts and excludes obvious roots, navigation and account/comment controls. New hosts and ambiguous routes require explicit source review.

Review `corpus/maintenance/proposals.json` and its bound history in `state.json`. This PR changes evidence only. New admissions, retirement, rebuild and runtime promotion require a separate reviewed corpus change. HTTP 200 does not establish relevance or safety. Publication age is not a removal reason.

Retirement needs GET-confirmed 404/410 on at least three distinct UTC days spanning 48 hours, with the newest observation within 36 hours. Authentication, throttling, network errors and server errors break the missing streak. Missing bursts quarantine affected host proposals.

Cumulative latest observations: 4400 of 7033 active URLs checked; 4341 reachable, 32 missing, 27 indeterminate, 2633 unchecked. 2660 URLs are due now. These are persisted observations, not a current full sweep.

## URLs needing review

Showing 59 of 59 latest missing or indeterminate results. Full records are in `proposals.json` under `health_summary.issues`. Missing days count the latest consecutive GET-confirmed streak; readiness still requires the full timing policy.

| URL | Latest UTC observation | Result | Final URL | Missing days | Proposal |
| --- | --- | --- | --- | --- | --- |
| http://fastandeasyhacking.com/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://info.iet.unipi.it/~luigi/netmap | 2026-10-02T00:34:23.313124+00:00 | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://intrigue.io/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://lucideus.com/pdf/stw.pdf | 2026-10-02T00:34:23.313124+00:00 | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://mig.mozilla.org/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://shell-storm.org/shellcode | 2026-10-02T00:34:23.313124+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://suricata-ids.org/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://torstatus.blutmagie.de/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://w3af.org/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://www.alienvault.com/open-threat-exchange/dashboard | 2026-10-02T00:34:23.313124+00:00 | indeterminate / 503 | https://cybersecurity.att.com/open-threat-exchange/dashboard | 0 | await evidence |
| http://www.arachni-scanner.com/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / 502 | https://ecsypno.com/pages/arachni-web-application-security-scanner-framework | 0 | await evidence |
| http://www.fail2ban.org/wiki/index.php/Main&#95;Page | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://github.com/fail2ban/fail2banwiki/index.php/Main&#95;Page | 1 | await evidence |
| http://www.leakedin.com/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://www.malwaredomains.com/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 1 | await evidence |
| http://www.ntop.org/products/traffic-analysis/ntop | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.ntop.org/products/traffic-analysis/ntop | 1 | await evidence |
| http://www.openvas.org/openvas-nvt-feed.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.openvas.org/openvas-nvt-feed.html | 1 | await evidence |
| http://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 2026-10-02T00:34:23.313124+00:00 | indeterminate / 403 | https://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 0 | await evidence |
| http://www.securiteam.com/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / 403 | https://www.fortra.com/product-lines/beyond-security | 0 | await evidence |
| http://www.securityfocus.com/bid | 2026-10-02T00:34:23.313124+00:00 | indeterminate / 500 | https://www.securityfocus.com/bid | 0 | await evidence |
| http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 1 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 2026-10-02T00:34:23.313124+00:00 | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 1 | await evidence |
| https://aibuilds.net/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / 530 | https://aibuilds.net/ | 0 | await evidence |
| https://androidtamer.com/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://atcommands.org/ | 2026-10-02T00:34:23.313124+00:00 | indeterminate / 502 | https://atcommands.org/ | 0 | await evidence |
| https://codisec.com/veles | 2026-10-02T00:45:56.491732+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://cyware.com/community/ctix-feeds | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://www.cyware.com/community/ctix-feeds | 1 | await evidence |
| https://eprint.iacr.org/2019/459 | 2026-10-02T00:45:56.491732+00:00 | indeterminate / 403 | https://eprint.iacr.org/2019/459 | 0 | await evidence |
| https://eprint.iacr.org/2020/014.pdf | 2026-10-02T00:45:56.491732+00:00 | indeterminate / 403 | https://eprint.iacr.org/2020/014.pdf | 0 | await evidence |
| https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 2026-10-02T00:45:56.491732+00:00 | indeterminate / 500 | https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 0 | await evidence |
| https://github.com/MisterBianco/BoopSuite | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/MisterBianco/BoopSuite | 1 | await evidence |
| https://github.com/Mr-Un1k0d3r/UniByAv | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/Mr-Un1k0d3r/UniByAv | 1 | await evidence |
| https://github.com/bkimminich/juice-shop | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/bkimminich/juice-shop | 1 | await evidence |
| https://github.com/curiefense/curiefense | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/curiefense/curiefense | 1 | await evidence |
| https://github.com/dtag-dev-sec/t-pot-autoinstall | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/dtag-dev-sec/t-pot-autoinstall | 1 | await evidence |
| https://github.com/jery0843/torforge | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/jery0843/torforge | 1 | await evidence |
| https://github.com/marcinguy/scanmycode-ce | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/marcinguy/scanmycode-ce | 1 | await evidence |
| https://github.com/rozgo/anevicon | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/rozgo/anevicon | 1 | await evidence |
| https://github.com/securingsam/krackdetector | 2026-10-02T00:45:56.491732+00:00 | missing / 404 | https://github.com/securingsam/krackdetector | 1 | await evidence |
| https://hexway.io/hive | 2026-10-02T16:39:01.810641+00:00 | missing / 404 | https://hexway.io/hive | 1 | await evidence |
| https://hpi-vdb.de/ | 2026-10-02T16:39:01.810641+00:00 | indeterminate / ConnectionError |  | 0 | await evidence |
| https://hub.docker.com/r/webgoat/webgoat-8.0 | 2026-10-02T16:39:01.810641+00:00 | missing / 404 | https://hub.docker.com/r/webgoat/webgoat-8.0 | 1 | await evidence |
| https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 2026-10-02T16:39:01.810641+00:00 | missing / 404 | https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 1 | await evidence |
| https://immunityinc.com/products/debugger | 2026-10-02T16:39:01.810641+00:00 | missing / 404 | https://immunityinc.com/products/debugger | 1 | await evidence |
| https://inteltechniques.com/buscador | 2026-10-02T16:39:01.810641+00:00 | missing / 404 | https://inteltechniques.com/buscador | 1 | await evidence |
| https://labs.mwrinfosecurity.com/tools/wepwnise | 2026-10-02T16:39:01.810641+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://nostarch.com/xbox.htm | 2026-10-03T15:08:59.797643+00:00 | indeterminate / 403 | https://nostarch.com/xbox | 0 | await evidence |
| https://packettotal.com/ | 2026-10-03T15:08:59.797643+00:00 | indeterminate / TargetGuardError |  | 0 | await evidence |

## Discovery queue

Showing 4 of 4 unreviewed discoveries. Full records are in `proposals.json` under `new_unreviewed`.

| URL | Source | Discovered UTC |
| --- | --- | --- |
| https://blog.trailofbits.com/2026/10/02/sequencehash-multihashing-for-the-rest-of-us | trailofbits-v1 | 2026-10-02T16:39:01.810641+00:00 |
| https://pwn.college/dojo/pwnteras~f25dff24 | experience-pwndojos-v1 | 2026-10-03T15:08:59.797643+00:00 |
| https://www.hexacorn.com/blog/2026/10/02/etwcheckcoverage-api | hexacorn-v1 | 2026-10-03T15:08:59.797643+00:00 |
| https://www.stark4n6.com/2026/10/forensics-startme-updates-october-2026.html | stark4n6-v1 | 2026-10-03T15:08:59.797643+00:00 |

## Source collection issues

| Source | Result |
| --- | --- |
| elastic-v1 | ValueError |
| sector035-v1 | 403 |
| strange-windytanposts-v1 | 429 |
| usenix-security24-v1 | 403 |
| usenix-security25-v1 | 403 |
| usenix-woot24-v1 | 403 |
