# Daily corpus maintenance

Generated: 2026-10-10T16:14:49.928235+00:00

Checked 1000 of 7033 active URLs: 997 reachable, 0 missing, 3 indeterminate; 63 redirected.

82 unreviewed discoveries; 0 retirement candidates; 0 quarantined candidates.

0 previously queued links excluded by discovery policy reviewed-host-and-navigation-v2. New discovery is restricted to each source's reviewed destination hosts and excludes obvious roots, navigation and account/comment controls. New hosts and ambiguous routes require explicit source review.

Review `corpus/maintenance/proposals.json` and its bound history in `state.json`. This PR changes evidence only. New admissions, retirement, rebuild and runtime promotion require a separate reviewed corpus change. HTTP 200 does not establish relevance or safety. Publication age is not a removal reason.

Retirement needs GET-confirmed 404/410 on at least three distinct UTC days spanning 48 hours, with the newest observation within 36 hours. Authentication, throttling, network errors and server errors break the missing streak. Missing bursts quarantine affected host proposals.

Cumulative latest observations: 7033 of 7033 active URLs checked; 5836 reachable, 43 missing, 1154 indeterminate, 0 unchecked. Operational states: 516 retry, 681 suspect, 0 retirement candidates. 3144 URLs are due now. These are persisted observations, not a current full sweep.

## URLs needing review

Showing 100 of 1197 latest missing or indeterminate results. Full records are in `proposals.json` under `health_summary.issues`. Missing days count the latest consecutive GET-confirmed streak; readiness still requires the full timing policy.

| URL | Latest UTC observation | State | Failure class | Result | Final URL | Missing days | Proposal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| http://fastandeasyhacking.com/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://info.iet.unipi.it/~luigi/netmap | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://intrigue.io/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://lucideus.com/pdf/stw.pdf | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://mig.mozilla.org/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://suricata-ids.org/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://torstatus.blutmagie.de/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://w3af.org/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://www.alienvault.com/open-threat-exchange/dashboard | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | server&#95;error | indeterminate / 503 | https://cybersecurity.att.com/open-threat-exchange/dashboard | 0 | await evidence |
| http://www.fail2ban.org/wiki/index.php/Main&#95;Page | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/fail2ban/fail2banwiki/index.php/Main&#95;Page | 3 | await evidence |
| http://www.leakedin.com/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 3 | await evidence |
| http://www.ntop.org/products/traffic-analysis/ntop | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/traffic-analysis/ntop | 3 | await evidence |
| http://www.openvas.org/openvas-nvt-feed.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.openvas.org/openvas-nvt-feed.html | 3 | await evidence |
| http://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 0 | await evidence |
| http://www.securiteam.com/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.fortra.com/product-lines/beyond-security | 0 | await evidence |
| http://www.securityfocus.com/bid | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://www.securityfocus.com/bid | 0 | await evidence |
| http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 3 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 3 | await evidence |
| https://aibuilds.net/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | server&#95;error | indeterminate / 530 | https://aibuilds.net/ | 0 | await evidence |
| https://androidtamer.com/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://atcommands.org/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | server&#95;error | indeterminate / 502 | https://atcommands.org/ | 0 | await evidence |
| https://codisec.com/veles | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://cyware.com/community/ctix-feeds | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.cyware.com/community/ctix-feeds | 3 | await evidence |
| https://digi.ninja/projects/cewl.php | 2026-10-10T16:14:49.928235+00:00 | RETRY | access&#95;control | indeterminate / 403 | https://digi.ninja/projects/cewl.php | 0 | await evidence |
| https://eprint.iacr.org/2019/459 | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2019/459 | 0 | await evidence |
| https://eprint.iacr.org/2020/014.pdf | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2020/014.pdf | 0 | await evidence |
| https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 0 | await evidence |
| https://geti2p.net/ | 2026-10-10T16:14:49.928235+00:00 | RETRY | connection&#95;error | indeterminate / ConnectionError |  | 0 | await evidence |
| https://github.com/MisterBianco/BoopSuite | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/MisterBianco/BoopSuite | 3 | await evidence |
| https://github.com/Mr-Un1k0d3r/UniByAv | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/Mr-Un1k0d3r/UniByAv | 3 | await evidence |
| https://github.com/bkimminich/juice-shop | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/bkimminich/juice-shop | 3 | await evidence |
| https://github.com/curiefense/curiefense | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/curiefense/curiefense | 3 | await evidence |
| https://github.com/dtag-dev-sec/t-pot-autoinstall | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/dtag-dev-sec/t-pot-autoinstall | 3 | await evidence |
| https://github.com/jery0843/torforge | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/jery0843/torforge | 3 | await evidence |
| https://github.com/marcinguy/scanmycode-ce | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/marcinguy/scanmycode-ce | 3 | await evidence |
| https://github.com/rozgo/anevicon | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/rozgo/anevicon | 3 | await evidence |
| https://github.com/securingsam/krackdetector | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/securingsam/krackdetector | 3 | await evidence |
| https://github.com/tenzir/vast | 2026-10-10T16:14:49.928235+00:00 | RETRY | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| https://hexway.io/hive | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hexway.io/hive | 3 | await evidence |
| https://hpi-vdb.de/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | connection&#95;error | indeterminate / ConnectionError |  | 0 | await evidence |
| https://hub.docker.com/r/webgoat/webgoat-8.0 | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hub.docker.com/r/webgoat/webgoat-8.0 | 3 | await evidence |
| https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 3 | await evidence |
| https://immunityinc.com/products/debugger | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://immunityinc.com/products/debugger | 3 | await evidence |
| https://inteltechniques.com/buscador | 2026-10-08T17:53:28.629162+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://inteltechniques.com/buscador | 3 | await evidence |
| https://labs.mwrinfosecurity.com/tools/wepwnise | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://nostarch.com/xbox.htm | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://nostarch.com/xbox | 0 | await evidence |
| https://packettotal.com/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://proxmark3.com/ | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | tls&#95;error | indeterminate / SSLError |  | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/better-know-a-data-source/process-creation | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/process-creation | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/better-know-a-data-source/process-integrity-levels | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/process-integrity-levels | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/bitsadmin | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/bitsadmin | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/black-hat-detecting-the-unknown-and-disclosing-a-new-attack-technique | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/black-hat-detecting-the-unknown-and-disclosing-a-new-attack-technique | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/breathing-life-detection-capability | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/breathing-life-detection-capability | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/brute-force-attacks | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/brute-force-attacks | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/bypassing-application-whitelisting | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/bypassing-application-whitelisting | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/child-processes | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/child-processes | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/chromeloader | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/chromeloader | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cloud-attack-techniques | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cloud-threat-detection | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/product-insights/cloud-threat-detection | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cloud-threat-detection-engine | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/product-insights/cloud-threat-detection-engine | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/code-signing-certificates | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/code-signing-certificates | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/combing-through-endpoint-data-to-detect-threats | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/combing-through-endpoint-data-to-detect-threats | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/computer-worms | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/computer-worms | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/conditional-access-policies | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/conditional-access-policies | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/context-in-security-alert-triage | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/context-in-security-alert-triage | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cor&#95;profiler-for-persistence | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cor&#95;profiler-for-persistence | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/credential-access | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/crypters-and-loaders | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cryptomining-enabled-by-native-windows-tools | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cryptomining-enabled-by-native-windows-tools | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cybersecurity-metrics | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cybersecurity-metrics | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/defense-evasion-and-phishing-emails | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/defense-evasion-and-phishing-emails | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/defense-evasion-why-is-it-so-prominent-how-can-you-detect-it | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/dependabot-configurator | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/dependabot-configurator | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detect-repeat-infections | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detect-repeat-infections | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-all-the-things-with-limited-data | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-all-the-things-with-limited-data | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-and-mitigating-ransomware | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-and-mitigating-ransomware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-anomalies-with-surveyor | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-anomalies-with-surveyor | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-application-shimming | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-application-shimming | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-attacks-leveraging-the-net-framework | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-attacks-leveraging-the-net-framework | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-credential-access | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-credential-access | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-cve-2015-1130-on-mac-os-x-endpoints | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-cve-2015-1130-on-mac-os-x-endpoints | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-eggshell-surveillance-tool | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-eggshell-surveillance-tool | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-insider-threats-you-dont-need-a-silver-bullet | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-insider-threats-you-dont-need-a-silver-bullet | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-internet-explorer-zero-day | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-msxsl-attacks | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-persistence-techniques | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-post-exploitation-top-questions | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-potentially-unwanted-programs | 2026-10-07T17:49:58.918830+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-potentially-unwanted-programs | 0 | await evidence |

## Discovery queue

Showing 82 of 82 unreviewed discoveries. Full records are in `proposals.json` under `new_unreviewed`.

| URL | Source | Discovered UTC |
| --- | --- | --- |
| https://0xdf.gitlab.io/2026/10/03/htb-reactor.html | 0xdf-v1 | 2026-10-04T15:48:48.696657+00:00 |
| https://0xdf.gitlab.io/2026/10/10/htb-devhub.html | 0xdf-v1 | 2026-10-10T16:14:49.928235+00:00 |
| https://blog.trailofbits.com/2026/10/02/sequencehash-multihashing-for-the-rest-of-us | trailofbits-v1 | 2026-10-02T16:39:01.810641+00:00 |
| https://dfir.ch/posts | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/posts/today&#95;i&#95;learned&#95;python&#95;start&#95;files | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/botconf&#95;2026 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/brucon&#95;2026 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;berlin&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;chisinau&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;frankfurt&#95;2026 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;kent&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;munich&#95;2024 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;munich&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;transylvania&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/deepsec&#95;2024 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/euskalhack&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/first&#95;amsterdam&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/first&#95;paris&#95;2026 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/firstcon&#95;2023 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/firstcon&#95;2024 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/firstcon&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/hack.lu&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/hack.lu&#95;gist&#95;2024 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/hack.lu&#95;rootkits&#95;2024 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/securityfest&#95;2024 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/securityfest&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/swisscyberstorm&#95;2021 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/swisscyberstorm&#95;2022 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/troopers&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/x33fcon&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/tweets | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/tweets/azure | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/tweets/dfir | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/tweets/pingcastle | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/tweets/threathunting | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/tweets/varia | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://hacktricks.wiki/en/linux-hardening/containers-namespaces/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/interesting-files-permissions/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/interesting-files-permissions/suid-sgid-and-acl-triage.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/linux-basics/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/linux-basics/shell-startup-aliases-and-history.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/main-system-information/filesystem-links-and-file-descriptors.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/main-system-information/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/main-system-information/kernel-lpe-cves/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/main-system-information/kernel-vulnerability-assessment.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/main-system-information/suse-session-and-disk-service-escalation.html | hacktricks-en-v1 | 2026-10-09T17:27:12.548718+00:00 |
| https://hacktricks.wiki/en/linux-hardening/network-information/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/network-information/traffic-capture-and-firewall-egress.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/post-exploitation/cloud-instance-metadata.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/post-exploitation/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/post-exploitation/trojanized-system-daemons-and-reverse-proxies.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/processes-crontab-systemd-dbus/cron-and-systemd-timers.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/processes-crontab-systemd-dbus/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/processes-crontab-systemd-dbus/process-enumeration-and-service-paths.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/software-information/databases-and-secret-material.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/software-information/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/software-information/local-web-and-auth-services.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/user-information/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/user-information/user-and-session-triage.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://labs.watchtowr.com/death-by-a-thousand-papercuts-papercut-pre-auth-rce-chain-and-patch-bypasses-wt-2026-0141-0144-cve-2026-82077-cve-2026-82078-cve-2026-81578 | watchtowr-v1 | 2026-10-10T16:14:49.928235+00:00 |
| https://labs.watchtowr.com/you-wont-hear-about-these-even-in-myths-atlassian-jira-confluence-and-more-pre-auth-arbitrary-file-read-cve-2026-21589 | watchtowr-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://portswigger.net/bappstore/8532da5bf4b24516be32f54c5fc394b5 | portswigger-sitemap-v1 | 2026-10-08T17:53:28.629162+00:00 |
| https://portswigger.net/burp/documentation/dast/user-guide/reference/issue-management-rules | portswigger-sitemap-v1 | 2026-10-09T17:27:12.548718+00:00 |
| https://portswigger.net/burp/releases/dast-2026-10 | portswigger-sitemap-v1 | 2026-10-08T17:53:28.629162+00:00 |
| https://portswigger.net/burp/releases/professional-community-2026-9-1 | portswigger-sitemap-v1 | 2026-10-07T17:49:58.918830+00:00 |
| https://portswigger.net/burp/releases/professional-community-2026-9-2 | portswigger-sitemap-v1 | 2026-10-09T17:27:12.548718+00:00 |
| https://portswigger.net/research/smashing-the-token-limit | portswigger-sitemap-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://portswigger.net/research/the-model-isnt-cooperating | portswigger-sitemap-v1 | 2026-10-07T17:49:58.918830+00:00 |
| https://projectzero.google/2026/10/emergency-patching.html | projectzero-archive-v1 | 2026-10-07T17:49:58.918830+00:00 |
| https://pwn.college/dojo/pwnteras~f25dff24 | experience-pwndojos-v1 | 2026-10-03T15:08:59.797643+00:00 |
| https://research.checkpoint.com/2026/5th-october-threat-intelligence-report | check-point-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://unit42.paloaltonetworks.com/blinder-tunnel-targets-critical-infrastructure | unit42-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://unit42.paloaltonetworks.com/web3-cloud-supply-chain-attacks | unit42-v1 | 2026-10-08T17:53:28.629162+00:00 |
| https://www.hexacorn.com/blog/2026/10/02/etwcheckcoverage-api | hexacorn-v1 | 2026-10-03T15:08:59.797643+00:00 |
| https://www.hexacorn.com/blog/2026/10/03/the-boring-state-of-stalled-timelines | hexacorn-v1 | 2026-10-04T15:48:48.696657+00:00 |
| https://www.hexacorn.com/blog/2026/10/09/solving-practical-problems-with-ai-part-1-jpeg-files-renaming-using-exif-data | hexacorn-v1 | 2026-10-10T16:14:49.928235+00:00 |
| https://www.malware-traffic-analysis.net/2026/09/29/index.html | malwaretraffic-v1 | 2026-10-04T15:48:48.696657+00:00 |
| https://www.malware-traffic-analysis.net/2026/09/30/index.html | malwaretraffic-v1 | 2026-10-04T15:48:48.696657+00:00 |
| https://www.malware-traffic-analysis.net/2026/10/02/index.html | malwaretraffic-v1 | 2026-10-05T18:42:43.229910+00:00 |
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
