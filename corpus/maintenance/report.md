# Daily corpus maintenance

Generated: 2026-10-24T14:34:27.721601+00:00

Checked 1000 of 7033 active URLs: 966 reachable, 0 missing, 34 indeterminate; 76 redirected.

222 unreviewed discoveries; 12 retirement candidates; 17 quarantined candidates.

0 previously queued links excluded by discovery policy reviewed-host-and-navigation-v2. New discovery is restricted to each source's reviewed destination hosts and excludes obvious roots, navigation and account/comment controls. New hosts and ambiguous routes require explicit source review.

Review `corpus/maintenance/proposals.json` and its bound history in `state.json`. This PR changes evidence only. New admissions, retirement, rebuild and runtime promotion require a separate reviewed corpus change. HTTP 200 does not establish relevance or safety. Publication age is not a removal reason.

Retirement needs GET-confirmed 404/410 on at least three distinct UTC days spanning 48 hours, with the newest observation within 36 hours. Authentication, throttling, network errors and server errors break the missing streak. Missing bursts quarantine affected host proposals.

Cumulative latest observations: 7033 of 7033 active URLs checked; 5685 reachable, 43 missing, 1305 indeterminate, 0 unchecked. Operational states: 288 retry, 1031 suspect, 29 retirement candidates. 82 URLs are due now. These are persisted observations, not a current full sweep.

## URLs needing review

Showing 100 of 1348 latest missing or indeterminate results. Full records are in `proposals.json` under `health_summary.issues`. Missing days count the latest consecutive GET-confirmed streak; readiness still requires the full timing policy.

| URL | Latest UTC observation | State | Failure class | Result | Final URL | Missing days | Proposal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| http://fastandeasyhacking.com/ | 2026-10-18T14:35:44.764963+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://info.iet.unipi.it/~luigi/netmap | 2026-10-18T14:35:44.764963+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://intrigue.io/ | 2026-10-18T14:35:44.764963+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://lucideus.com/pdf/stw.pdf | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://mig.mozilla.org/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://suricata-ids.org/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://torstatus.blutmagie.de/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://w3af.org/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://www.alienvault.com/open-threat-exchange/dashboard | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | server&#95;error | indeterminate / 503 | https://cybersecurity.att.com/open-threat-exchange/dashboard | 0 | await evidence |
| http://www.fail2ban.org/wiki/index.php/Main&#95;Page | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/fail2ban/fail2banwiki/index.php/Main&#95;Page | 5 | await evidence |
| http://www.leakedin.com/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 5 | await evidence |
| http://www.ntop.org/products/traffic-analysis/ntop | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/traffic-analysis/ntop | 5 | await evidence |
| http://www.openvas.org/openvas-nvt-feed.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.openvas.org/openvas-nvt-feed.html | 5 | await evidence |
| http://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 0 | await evidence |
| http://www.pentest-standard.org/ | 2026-10-24T14:34:27.721601+00:00 | RETRY | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://www.securiteam.com/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.fortra.com/product-lines/beyond-security | 0 | await evidence |
| http://www.securityfocus.com/bid | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://www.securityfocus.com/bid | 0 | await evidence |
| http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 5 | quarantined |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 5 | quarantined |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 5 | quarantined |
| https://aibuilds.net/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | server&#95;error | indeterminate / 530 | https://aibuilds.net/ | 0 | await evidence |
| https://androidtamer.com/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://atcommands.org/ | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | server&#95;error | indeterminate / 502 | https://atcommands.org/ | 0 | await evidence |
| https://codisec.com/veles | 2026-10-21T15:58:14.038396+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://cyware.com/community/ctix-feeds | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://www.cyware.com/community/ctix-feeds | 5 | retirement candidate |
| https://digi.ninja/projects/cewl.php | 2026-10-23T15:45:30.611365+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://digi.ninja/projects/cewl.php | 0 | await evidence |
| https://eprint.iacr.org/2019/459 | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2019/459 | 0 | await evidence |
| https://eprint.iacr.org/2020/014.pdf | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2020/014.pdf | 0 | await evidence |
| https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 0 | await evidence |
| https://github.com/MisterBianco/BoopSuite | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/MisterBianco/BoopSuite | 5 | quarantined |
| https://github.com/Mr-Un1k0d3r/UniByAv | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/Mr-Un1k0d3r/UniByAv | 5 | quarantined |
| https://github.com/bkimminich/juice-shop | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/bkimminich/juice-shop | 5 | quarantined |
| https://github.com/curiefense/curiefense | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/curiefense/curiefense | 5 | quarantined |
| https://github.com/dtag-dev-sec/t-pot-autoinstall | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/dtag-dev-sec/t-pot-autoinstall | 5 | quarantined |
| https://github.com/jery0843/torforge | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/jery0843/torforge | 5 | quarantined |
| https://github.com/marcinguy/scanmycode-ce | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/marcinguy/scanmycode-ce | 5 | quarantined |
| https://github.com/rozgo/anevicon | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/rozgo/anevicon | 5 | quarantined |
| https://github.com/securingsam/krackdetector | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://github.com/securingsam/krackdetector | 5 | quarantined |
| https://hexway.io/hive | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://hexway.io/hive | 5 | retirement candidate |
| https://hpi-vdb.de/ | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | connection&#95;error | indeterminate / ConnectionError |  | 0 | await evidence |
| https://hub.docker.com/r/webgoat/webgoat-8.0 | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://hub.docker.com/r/webgoat/webgoat-8.0 | 5 | retirement candidate |
| https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 5 | retirement candidate |
| https://immunityinc.com/products/debugger | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://immunityinc.com/products/debugger | 5 | retirement candidate |
| https://inteltechniques.com/buscador | 2026-10-23T15:45:30.611365+00:00 | RETIRE&#95;CANDIDATE | http&#95;missing | missing / 404 | https://inteltechniques.com/buscador | 5 | retirement candidate |
| https://labs.mwrinfosecurity.com/tools/wepwnise | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://nostarch.com/xbox.htm | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://nostarch.com/xbox | 0 | await evidence |
| https://packettotal.com/ | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://proxmark3.com/ | 2026-10-22T15:53:37.650796+00:00 | SUSPECT | tls&#95;error | indeterminate / SSLError |  | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/2021-threat-detection-report | 2026-10-21T15:58:14.038396+00:00 | RETRY | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/2021-threat-detection-report-preview | 2026-10-21T15:58:14.038396+00:00 | RETRY | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/better-know-a-data-source/better-know-a-data-source-network-telemetry | 2026-10-23T15:45:30.611365+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/better-know-a-data-source-network-telemetry | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/better-know-a-data-source/logon-sessions | 2026-10-23T15:45:30.611365+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/logon-sessions | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/better-know-a-data-source/process-command-line | 2026-10-23T15:45:30.611365+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/process-command-line | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/context-in-security-alert-triage | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/context-in-security-alert-triage | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cor&#95;profiler-for-persistence | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cor&#95;profiler-for-persistence | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/credential-access | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/crypters-and-loaders | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cryptomining-enabled-by-native-windows-tools | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cryptomining-enabled-by-native-windows-tools | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cybersecurity-metrics | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cybersecurity-metrics | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/defense-evasion-and-phishing-emails | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/defense-evasion-and-phishing-emails | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/defense-evasion-why-is-it-so-prominent-how-can-you-detect-it | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/dependabot-configurator | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/dependabot-configurator | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detect-repeat-infections | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detect-repeat-infections | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-all-the-things-with-limited-data | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-all-the-things-with-limited-data | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-and-mitigating-ransomware | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-and-mitigating-ransomware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-anomalies-with-surveyor | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-anomalies-with-surveyor | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-application-shimming | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-application-shimming | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-attacks-leveraging-the-net-framework | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-attacks-leveraging-the-net-framework | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-credential-access | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-credential-access | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-cve-2015-1130-on-mac-os-x-endpoints | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-cve-2015-1130-on-mac-os-x-endpoints | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-eggshell-surveillance-tool | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-eggshell-surveillance-tool | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-insider-threats-you-dont-need-a-silver-bullet | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-insider-threats-you-dont-need-a-silver-bullet | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-internet-explorer-zero-day | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-msxsl-attacks | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-persistence-techniques | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-post-exploitation-top-questions | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-potentially-unwanted-programs | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-potentially-unwanted-programs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-ransomware | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-ransomware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-remote-access-trojan | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-remote-access-trojan | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-sharepoint-attacks-via-worker-process-activity | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-sharepoint-attacks-via-worker-process-activity | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-snake-malware | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-targeted-crimeware-within-30-minutes-of-activating-red-canary | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-targeted-crimeware-within-30-minutes-of-activating-red-canary | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-wmi | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detection-engineering-storytelling | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/product-insights/detection-engineering-storytelling | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detection-profile-silent-periodic-activity | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detection-profile-silent-periodic-activity | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/ebpf-for-security | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/ebpf-for-security | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/ebpf-malware | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/ebpf-malware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/email-forwarding-rules | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/email-forwarding-rules | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/email-payroll-diversion-attack | 2026-10-22T15:53:37.650796+00:00 | RETRY | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/email-payroll-diversion-attack | 0 | await evidence |

## Discovery queue

Showing 100 of 222 unreviewed discoveries. Full records are in `proposals.json` under `new_unreviewed`.

| URL | Source | Discovered UTC |
| --- | --- | --- |
| https://0xdf.gitlab.io/2026/10/03/htb-reactor.html | 0xdf-v1 | 2026-10-04T15:48:48.696657+00:00 |
| https://0xdf.gitlab.io/2026/10/10/htb-devhub.html | 0xdf-v1 | 2026-10-10T16:14:49.928235+00:00 |
| https://0xdf.gitlab.io/2026/10/17/htb-eloquia.html | 0xdf-v1 | 2026-10-18T14:35:44.764963+00:00 |
| https://arxiv.org/IgnoreMe | strange-guriarxiv-v1 | 2026-10-21T15:58:14.038396+00:00 |
| https://arxiv.org/submit | strange-guriarxiv-v1 | 2026-10-21T15:58:14.038396+00:00 |
| https://blog.doyensec.com/2026/10/13/Sfape.html | doyensec-archive-v1 | 2026-10-13T18:19:42.780102+00:00 |
| https://blog.nviso.eu/2026/10/16/keystrokes-in-disguise-forensic-analysis-of-a-digispark-hid-device | nviso-v1 | 2026-10-17T14:13:30.822619+00:00 |
| https://blog.nviso.eu/2026/10/20/verborgene-tastenanschlage-forensische-analyse-eines-digispark-hid-gerats | nviso-v1 | 2026-10-20T15:39:49.676853+00:00 |
| https://blog.nviso.eu/2026/10/23/php2shell-operational-guidance | nviso-v1 | 2026-10-23T15:45:30.611365+00:00 |
| https://blog.trailofbits.com/2026/10/02/sequencehash-multihashing-for-the-rest-of-us | trailofbits-v1 | 2026-10-02T16:39:01.810641+00:00 |
| https://blog.trailofbits.com/2026/10/14/package-managers-have-an-integrity-problem | trailofbits-v1 | 2026-10-14T15:50:11.825371+00:00 |
| https://blog.trailofbits.com/2026/10/21/your-ai-agent-fixed-the-bug-but-what-else-did-it-change | trailofbits-v1 | 2026-10-22T15:53:37.650796+00:00 |
| https://blog.trailofbits.com/authors/anish-naik-marcelo-morales | trailofbits-v1 | 2026-10-22T15:53:37.650796+00:00 |
| https://dfir.ch/posts | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/posts/field&#95;note&#95;attacker&#95;workflow | dfirch-v1 | 2026-10-24T14:34:27.721601+00:00 |
| https://dfir.ch/posts/field&#95;notes&#95;etherrat | dfirch-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://dfir.ch/posts/today&#95;i&#95;learned&#95;python&#95;start&#95;files | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/balccon2k26 | dfirch-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://dfir.ch/talks/botconf&#95;2026 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/brucon&#95;2026 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;berlin&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;chisinau&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;frankfurt&#95;2026 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;kent&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;munich&#95;2024 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;munich&#95;2025 | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
| https://dfir.ch/talks/bsides&#95;tallinn&#95;2026 | dfirch-v1 | 2026-10-15T15:36:17.720874+00:00 |
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
| https://hacktricks.wiki/en/AI/AI-Agent-Security-Methodology.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/AI/AI-Assisted-Source-Review-and-Vulnerability-Validation.html | hacktricks-en-v1 | 2026-10-19T17:29:30.168737+00:00 |
| https://hacktricks.wiki/en/AI/AI-LLM-Gateway-Security.html | hacktricks-en-v1 | 2026-10-22T15:53:37.650796+00:00 |
| https://hacktricks.wiki/en/AI/AI-Mechanistic-Interpretability-Adversarial-Attacks.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/AI/AI-Model-Tools-and-Platforms.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/freebsd-kernel-exploitation-vnet-jail-escape.html | hacktricks-en-v1 | 2026-10-14T15:50:11.825371+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/ios-exploiting/coregraphics-pdf-truetype-glyph-rasterizer-oob-write.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/ios-exploiting/ios-driver-embedded-queue-node-uaf.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/ios-exploiting/webkit-jsc-dfg-slow-path-register-spill.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/af-alg-concurrent-writer-scatterlist-oob.html | hacktricks-en-v1 | 2026-10-13T18:19:42.780102+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/android-binder-ipc-internals-kernel-vulnerability-research.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/android-binder-transaction-cleanup-uaf.html | hacktricks-en-v1 | 2026-10-14T15:50:11.825371+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/android-kernel-selinux-bypass.html | hacktricks-en-v1 | 2026-10-11T16:39:18.851560+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/net-sched-action-idr-uaf-cve-2026-53264.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/nftables-catchall-rollback-uaf.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/qualcomm-kgsl-vbo-bind-race-physical-uaf.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/linux-kernel-exploitation/usb-audio-descriptor-oob-kaslr-leak.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/virtualbox-vmsvga-cotable-uaf-escape.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/vm-escape-and-hypervisor-exploitation.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/vmware-hgfs-oob-read-aslr-bypass.html | hacktricks-en-v1 | 2026-10-14T15:50:11.825371+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/windows-kernel-exploitation/afd-rio-buffer-uaf.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/windows-kernel-exploitation/uasp-report-luns-cache-size-oob-write.html | hacktricks-en-v1 | 2026-10-17T14:13:30.822619+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/windows-kernel-exploitation/usb-midi-packet-size-pool-overflow.html | hacktricks-en-v1 | 2026-10-17T14:13:30.822619+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/windows-kernel-type-confusion-to-npfs-arbitrary-rw.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/binary-exploitation/windows-userland-heap-grooming.html | hacktricks-en-v1 | 2026-10-17T14:13:30.822619+00:00 |
| https://hacktricks.wiki/en/blockchain/blockchain-and-crypto-currencies/investment-terms.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/generic-hacking/expose-local-to-the-internet.html | hacktricks-en-v1 | 2026-10-23T15:45:30.611365+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/basic-forensic-methodology/android-forensics.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/external-recon-methodology/reconnaissance-and-threat-intelligence-apis.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/post-exploitation-collection-tools.html | hacktricks-en-v1 | 2026-10-22T15:53:37.650796+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/proof-assistant-formal-verification-security.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/rust-basics.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/arm-coresight-instruction-tracing.html | hacktricks-en-v1 | 2026-10-18T14:35:44.764963+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/fault&#95;injection&#95;attacks.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/i2c.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/index.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/jtag.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/radio.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/side&#95;channel&#95;analysis.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/spi.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/hardware-hacking/uart.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/fissure-the-rf-framework.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/flipper-zero/fz-125khz-rfid.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/flipper-zero/fz-ibutton.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/flipper-zero/fz-infrared.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/flipper-zero/fz-nfc.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/flipper-zero/fz-sub-ghz.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/flipper-zero/index.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/ibutton.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |

## Source collection issues

| Source | Result |
| --- | --- |
| elastic-v1 | ValueError |
| sector035-v1 | 403 |
| usenix-security24-v1 | 403 |
| usenix-security25-v1 | 403 |
| usenix-woot24-v1 | 403 |
