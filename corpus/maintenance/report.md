# Daily corpus maintenance

Generated: 2026-10-29T17:26:45.181627+00:00

Checked 1000 of 7033 active URLs: 988 reachable, 0 missing, 12 indeterminate; 205 redirected.

381 unreviewed discoveries; 0 retirement candidates; 0 quarantined candidates.

0 previously queued links excluded by discovery policy reviewed-host-and-navigation-v2. New discovery is restricted to each source's reviewed destination hosts and excludes obvious roots, navigation and account/comment controls. New hosts and ambiguous routes require explicit source review.

Review `corpus/maintenance/proposals.json` and its bound history in `state.json`. This PR changes evidence only. New admissions, retirement, rebuild and runtime promotion require a separate reviewed corpus change. HTTP 200 does not establish relevance or safety. Publication age is not a removal reason.

Retirement needs GET-confirmed 404/410 on at least three distinct UTC days spanning 48 hours, with the newest observation within 36 hours. Authentication, throttling, network errors and server errors break the missing streak. Missing bursts quarantine affected host proposals.

Cumulative latest observations: 7033 of 7033 active URLs checked; 5846 reachable, 43 missing, 1144 indeterminate, 0 unchecked. Operational states: 14 retry, 1173 suspect, 0 retirement candidates. 1811 URLs are due now. These are persisted observations, not a current full sweep.

## URLs needing review

Showing 100 of 1187 latest missing or indeterminate results. Full records are in `proposals.json` under `health_summary.issues`. Missing days count the latest consecutive GET-confirmed streak; readiness still requires the full timing policy.

| URL | Latest UTC observation | State | Failure class | Result | Final URL | Missing days | Proposal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| http://fastandeasyhacking.com/ | 2026-10-25T14:57:40.255421+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://info.iet.unipi.it/~luigi/netmap | 2026-10-25T14:57:40.255421+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://intrigue.io/ | 2026-10-25T14:57:40.255421+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://lucideus.com/pdf/stw.pdf | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://mig.mozilla.org/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://suricata-ids.org/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://torstatus.blutmagie.de/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://w3af.org/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://www.alienvault.com/open-threat-exchange/dashboard | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | server&#95;error | indeterminate / 503 | https://cybersecurity.att.com/open-threat-exchange/dashboard | 0 | await evidence |
| http://www.fail2ban.org/wiki/index.php/Main&#95;Page | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/fail2ban/fail2banwiki/index.php/Main&#95;Page | 5 | await evidence |
| http://www.leakedin.com/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 5 | await evidence |
| http://www.ntop.org/products/traffic-analysis/ntop | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/traffic-analysis/ntop | 5 | await evidence |
| http://www.openvas.org/openvas-nvt-feed.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.openvas.org/openvas-nvt-feed.html | 5 | await evidence |
| http://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 0 | await evidence |
| http://www.pentest-standard.org/ | 2026-10-24T14:34:27.721601+00:00 | RETRY | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://www.securiteam.com/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.fortra.com/product-lines/beyond-security | 0 | await evidence |
| http://www.securityfocus.com/bid | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://www.securityfocus.com/bid | 0 | await evidence |
| http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 5 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 5 | await evidence |
| https://aibuilds.net/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | server&#95;error | indeterminate / 530 | https://aibuilds.net/ | 0 | await evidence |
| https://androidtamer.com/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://atcommands.org/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | server&#95;error | indeterminate / 502 | https://atcommands.org/ | 0 | await evidence |
| https://codisec.com/veles | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://cyware.com/community/ctix-feeds | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.cyware.com/community/ctix-feeds | 5 | await evidence |
| https://digi.ninja/projects/cewl.php | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://digi.ninja/projects/cewl.php | 0 | await evidence |
| https://eprint.iacr.org/2019/459 | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2019/459 | 0 | await evidence |
| https://eprint.iacr.org/2020/014.pdf | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2020/014.pdf | 0 | await evidence |
| https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 0 | await evidence |
| https://github.com/MisterBianco/BoopSuite | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/MisterBianco/BoopSuite | 5 | await evidence |
| https://github.com/Mr-Un1k0d3r/UniByAv | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/Mr-Un1k0d3r/UniByAv | 5 | await evidence |
| https://github.com/bkimminich/juice-shop | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/bkimminich/juice-shop | 5 | await evidence |
| https://github.com/curiefense/curiefense | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/curiefense/curiefense | 5 | await evidence |
| https://github.com/dtag-dev-sec/t-pot-autoinstall | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/dtag-dev-sec/t-pot-autoinstall | 5 | await evidence |
| https://github.com/jery0843/torforge | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/jery0843/torforge | 5 | await evidence |
| https://github.com/marcinguy/scanmycode-ce | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/marcinguy/scanmycode-ce | 5 | await evidence |
| https://github.com/rozgo/anevicon | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/rozgo/anevicon | 5 | await evidence |
| https://github.com/securingsam/krackdetector | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/securingsam/krackdetector | 5 | await evidence |
| https://hexway.io/hive | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hexway.io/hive | 5 | await evidence |
| https://hpi-vdb.de/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | connection&#95;error | indeterminate / ConnectionError |  | 0 | await evidence |
| https://hub.docker.com/r/webgoat/webgoat-8.0 | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hub.docker.com/r/webgoat/webgoat-8.0 | 5 | await evidence |
| https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 5 | await evidence |
| https://immunityinc.com/products/debugger | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://immunityinc.com/products/debugger | 5 | await evidence |
| https://inteltechniques.com/buscador | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://inteltechniques.com/buscador | 5 | await evidence |
| https://labs.mwrinfosecurity.com/tools/wepwnise | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://lolbas-project.github.io/lolbas/Scripts/CL&#95;LoadAssembly | 2026-10-28T17:11:00.710040+00:00 | RETRY | server&#95;error | indeterminate / 503 | https://lolbas-project.github.io/lolbas/Scripts/CL&#95;LoadAssembly/ | 0 | await evidence |
| https://nostarch.com/xbox.htm | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://nostarch.com/xbox | 0 | await evidence |
| https://packettotal.com/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://proxmark3.com/ | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | tls&#95;error | indeterminate / SSLError |  | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/context-in-security-alert-triage | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/context-in-security-alert-triage | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cor&#95;profiler-for-persistence | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cor&#95;profiler-for-persistence | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/credential-access | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/crypters-and-loaders | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cryptomining-enabled-by-native-windows-tools | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cryptomining-enabled-by-native-windows-tools | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/cybersecurity-metrics | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/cybersecurity-metrics | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/defense-evasion-and-phishing-emails | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/defense-evasion-and-phishing-emails | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/defense-evasion-why-is-it-so-prominent-how-can-you-detect-it | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/dependabot-configurator | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/dependabot-configurator | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detect-repeat-infections | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detect-repeat-infections | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-all-the-things-with-limited-data | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-all-the-things-with-limited-data | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-and-mitigating-ransomware | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-and-mitigating-ransomware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-anomalies-with-surveyor | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-anomalies-with-surveyor | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-application-shimming | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-application-shimming | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-attacks-leveraging-the-net-framework | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-attacks-leveraging-the-net-framework | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-credential-access | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-credential-access | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-cve-2015-1130-on-mac-os-x-endpoints | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-cve-2015-1130-on-mac-os-x-endpoints | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-eggshell-surveillance-tool | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-eggshell-surveillance-tool | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-insider-threats-you-dont-need-a-silver-bullet | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-insider-threats-you-dont-need-a-silver-bullet | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-internet-explorer-zero-day | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-msxsl-attacks | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-persistence-techniques | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-post-exploitation-top-questions | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-potentially-unwanted-programs | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-potentially-unwanted-programs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-ransomware | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-ransomware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-remote-access-trojan | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-remote-access-trojan | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-sharepoint-attacks-via-worker-process-activity | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-sharepoint-attacks-via-worker-process-activity | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-snake-malware | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-targeted-crimeware-within-30-minutes-of-activating-red-canary | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detecting-targeted-crimeware-within-30-minutes-of-activating-red-canary | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detecting-wmi | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detection-engineering-storytelling | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/product-insights/detection-engineering-storytelling | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/detection-profile-silent-periodic-activity | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/detection-profile-silent-periodic-activity | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/ebpf-for-security | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/ebpf-for-security | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/ebpf-malware | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/ebpf-malware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/email-forwarding-rules | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/email-forwarding-rules | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/email-payroll-diversion-attack | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/email-payroll-diversion-attack | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/entra-id-ai-workflows | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/entra-id-ai-workflows | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/entra-id-ai-workflows-assistive-agents | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/entra-id-ai-workflows-assistive-agents | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/entra-id-ai-workflows-teams | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/entra-id-ai-workflows-teams | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/entra-id-oauth-attacks | 2026-10-26T17:24:00.806277+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/entra-id-oauth-attacks | 0 | await evidence |

## Discovery queue

Showing 100 of 381 unreviewed discoveries. Full records are in `proposals.json` under `new_unreviewed`.

| URL | Source | Discovered UTC |
| --- | --- | --- |
| https://0xdf.gitlab.io/2026/10/03/htb-reactor.html | 0xdf-v1 | 2026-10-04T15:48:48.696657+00:00 |
| https://0xdf.gitlab.io/2026/10/10/htb-devhub.html | 0xdf-v1 | 2026-10-10T16:14:49.928235+00:00 |
| https://0xdf.gitlab.io/2026/10/17/htb-eloquia.html | 0xdf-v1 | 2026-10-18T14:35:44.764963+00:00 |
| https://0xdf.gitlab.io/2026/10/24/htb-checkpoint.html | 0xdf-v1 | 2026-10-25T14:57:40.255421+00:00 |
| https://arxiv.org/IgnoreMe | strange-guriarxiv-v1 | 2026-10-21T15:58:14.038396+00:00 |
| https://arxiv.org/submit | strange-guriarxiv-v1 | 2026-10-21T15:58:14.038396+00:00 |
| https://blog.doyensec.com/2017/03/02/training-burp.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2017/08/03/electron-framework-security.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2017/11/15/osx-spotlight.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2017/11/27/we-are-hiring.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2018/05/17/graphql-security-overview.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2018/05/24/electron-win-protocol-handler-bug-bypass.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2018/07/19/instrumenting-electron-app.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2018/11/05/burp-rest-api-v2.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/01/24/electronegativity.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/04/03/subverting-electron-apps-via-insecure-preload.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/04/24/rubyzip-bug.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/06/11/electronegativity-1.3.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/07/03/electron-security-workshop.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/07/22/jackson-gadgets.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/08/01/common-crypto-bugs.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/08/22/modern-password-managers-flag-secure.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2019/11/05/internship-at-doyensec.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/02/03/heap-exploit.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/02/19/solokeys-audit.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/02/24/electron-updater-update-signature-bypass.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/03/02/gravitational-audit.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/03/16/vscode&#95;codeexec.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/03/26/graphql-scanner.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/04/08/libressl-fuzzer.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/04/30/polymorphic-images-for-xss.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/05/14/asn1fuzz.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/06/11/inql-scanner-v2.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/08/20/playframework-csrf-bypass.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/09/09/fuzzilli-jerryscript.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/11/19/inql-scanner-v3.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/12/10/novel-abuses-wifi-direct-mobile-file-transfers.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2020/12/17/psychology-of-remote-work.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2021/02/16/electron-apis-misuse.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2021/03/11/regexploit.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2021/05/20/graphql-csrf.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/02/16/h1jack-the-game.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/04/26/vbox-fuzzing.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/06/09/apache-pinot-sqli-rce.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/07/21/dependency-confusion.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/08/24/intern-experience.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/09/06/electrong-launch.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/09/27/electron-api-default-permissions.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/10/06/semgrep-codeql.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/10/11/ebpf-bypass-security-monitoring.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/10/18/cloudsectidbit-dataimport.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/10/27/jupytervscode.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/11/09/recruiting-security-researchers.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/11/15/learning-ajp.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2022/12/13/safeurl.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/01/10/imagemagick-security-policy-evaluator.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/01/24/tampering-unrestricted-user-attributes-aws-cognito.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/02/14/pesd-extension-public-release.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/02/28/new-vector-for-dirty-arbitrary-file-write-2-rce.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/03/16/ssrf-remediation-bypass.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/03/21/windows-installer.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/03/28/wallet-info.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/05/04/testing-ztp-platforms-a-primer.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/06/01/r2pickledec.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/06/06/logistics.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/06/13/messing-around-with-aws-batch-for-privilege-escalations.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/07/18/streamlining-websocket-pentesting-with-wsrepl.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/07/26/huawei-theme-arbitrary-code-exec.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/08/17/inql-v5.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/08/31/introducing-session-hijacking-visual-exploitation.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/09/25/clientside-javascript-instrumentation.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2023/11/03/Office-Document-Poisoning.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/01/23/k8s-scheduling-secure-design.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/01/30/poiex-release.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/02/17/server-side-prototype-pollution-Gadgets-scanner.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/03/14/supplychain.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/03/22/summer-internship-2023.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/05/02/products-security-audit-vs-bugbounty.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/06/20/compromised-idp.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/07/02/cspt2csrf.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/07/11/database-race-conditions.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/07/18/custom-actions.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/09/19/phishing-case-study.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/10/02/class-pollution-ruby.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/12/03/cspt-with-eval-villain.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2024/12/16/unsafe-unpacking.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/01/07/ksmbd-1.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/01/09/cspt-file-upload.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/01/30/oauth-common-vulnerabilities.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/02/11/exploitable-iot.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/02/27/exploitable-sshd.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/03/18/exploitable-gitlab.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/03/27/cspt-resources.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/05/08/scim-hunting.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/08/19/trivial-exploit-on-C-random.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/09/02/ksmbd-2.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/09/25/yet-another-random-story.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/10/08/ksmbd-3.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2025/12/02/inql-v610.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |
| https://blog.doyensec.com/2026/01/22/frida-instrumentation.html | doyensec-archive-v1 | 2026-10-27T16:40:55.546665+00:00 |

## Source collection issues

| Source | Result |
| --- | --- |
| elastic-v1 | ValueError |
| sector035-v1 | 403 |
| strange-windytanposts-v1 | 429 |
| usenix-security24-v1 | 403 |
| usenix-security25-v1 | 403 |
| usenix-woot24-v1 | 403 |
