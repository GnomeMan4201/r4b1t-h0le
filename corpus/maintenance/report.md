# Daily corpus maintenance

Generated: 2026-10-17T14:13:30.822619+00:00

Checked 1000 of 7033 active URLs: 999 reachable, 0 missing, 1 indeterminate; 76 redirected.

181 unreviewed discoveries; 0 retirement candidates; 0 quarantined candidates.

0 previously queued links excluded by discovery policy reviewed-host-and-navigation-v2. New discovery is restricted to each source's reviewed destination hosts and excludes obvious roots, navigation and account/comment controls. New hosts and ambiguous routes require explicit source review.

Review `corpus/maintenance/proposals.json` and its bound history in `state.json`. This PR changes evidence only. New admissions, retirement, rebuild and runtime promotion require a separate reviewed corpus change. HTTP 200 does not establish relevance or safety. Publication age is not a removal reason.

Retirement needs GET-confirmed 404/410 on at least three distinct UTC days spanning 48 hours, with the newest observation within 36 hours. Authentication, throttling, network errors and server errors break the missing streak. Missing bursts quarantine affected host proposals.

Cumulative latest observations: 7033 of 7033 active URLs checked; 5960 reachable, 43 missing, 1030 indeterminate, 0 unchecked. Operational states: 3 retry, 1070 suspect, 0 retirement candidates. 154 URLs are due now. These are persisted observations, not a current full sweep.

## URLs needing review

Showing 100 of 1073 latest missing or indeterminate results. Full records are in `proposals.json` under `health_summary.issues`. Missing days count the latest consecutive GET-confirmed streak; readiness still requires the full timing policy.

| URL | Latest UTC observation | State | Failure class | Result | Final URL | Missing days | Proposal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| http://fastandeasyhacking.com/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://info.iet.unipi.it/~luigi/netmap | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://intrigue.io/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://lucideus.com/pdf/stw.pdf | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://mig.mozilla.org/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://suricata-ids.org/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://torstatus.blutmagie.de/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| http://w3af.org/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| http://www.alienvault.com/open-threat-exchange/dashboard | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | server&#95;error | indeterminate / 503 | https://cybersecurity.att.com/open-threat-exchange/dashboard | 0 | await evidence |
| http://www.fail2ban.org/wiki/index.php/Main&#95;Page | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/fail2ban/fail2banwiki/index.php/Main&#95;Page | 4 | await evidence |
| http://www.leakedin.com/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | timeout | indeterminate / ConnectTimeout |  | 0 | await evidence |
| http://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/packet-capture/pf&#95;ring/pf&#95;ring-zc-zero-copy | 4 | await evidence |
| http://www.ntop.org/products/traffic-analysis/ntop | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.ntop.org/products/traffic-analysis/ntop | 4 | await evidence |
| http://www.openvas.org/openvas-nvt-feed.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.openvas.org/openvas-nvt-feed.html | 4 | await evidence |
| http://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.packtpub.com/networking-and-servers/advanced-penetration-testing-highly-secured-environments-ultimate-security-gu | 0 | await evidence |
| http://www.securiteam.com/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://www.fortra.com/product-lines/beyond-security | 0 | await evidence |
| http://www.securityfocus.com/bid | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://www.securityfocus.com/bid | 0 | await evidence |
| http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | http://www.vulnerabilityassessment.co.uk/Penetration%20Test.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-047008023X.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0470395362.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0471237124.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764569597.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-0764578014.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118026470.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118204123.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118608577.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-111860864X.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118662091.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118787315.html | 4 | await evidence |
| http://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.wiley.com/WileyCDA/WileyTitle/productCd-1118958500.html | 4 | await evidence |
| http://www.wxhexeditor.org/ | 2026-10-17T14:13:30.822619+00:00 | RETRY | timeout | indeterminate / ReadTimeout |  | 0 | await evidence |
| https://aibuilds.net/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | server&#95;error | indeterminate / 530 | https://aibuilds.net/ | 0 | await evidence |
| https://androidtamer.com/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://atcommands.org/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | server&#95;error | indeterminate / 502 | https://atcommands.org/ | 0 | await evidence |
| https://codisec.com/veles | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://cyware.com/community/ctix-feeds | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://www.cyware.com/community/ctix-feeds | 4 | await evidence |
| https://digi.ninja/projects/cewl.php | 2026-10-16T15:22:57.187490+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://digi.ninja/projects/cewl.php | 0 | await evidence |
| https://eprint.iacr.org/2019/459 | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2019/459 | 0 | await evidence |
| https://eprint.iacr.org/2020/014.pdf | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://eprint.iacr.org/2020/014.pdf | 0 | await evidence |
| https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | server&#95;error | indeterminate / 500 | https://eternal-todo.com/tools/peepdf-pdf-analysis-tool | 0 | await evidence |
| https://github.com/MisterBianco/BoopSuite | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/MisterBianco/BoopSuite | 4 | await evidence |
| https://github.com/Mr-Un1k0d3r/UniByAv | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/Mr-Un1k0d3r/UniByAv | 4 | await evidence |
| https://github.com/bkimminich/juice-shop | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/bkimminich/juice-shop | 4 | await evidence |
| https://github.com/curiefense/curiefense | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/curiefense/curiefense | 4 | await evidence |
| https://github.com/dtag-dev-sec/t-pot-autoinstall | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/dtag-dev-sec/t-pot-autoinstall | 4 | await evidence |
| https://github.com/jery0843/torforge | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/jery0843/torforge | 4 | await evidence |
| https://github.com/marcinguy/scanmycode-ce | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/marcinguy/scanmycode-ce | 4 | await evidence |
| https://github.com/rozgo/anevicon | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/rozgo/anevicon | 4 | await evidence |
| https://github.com/securingsam/krackdetector | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://github.com/securingsam/krackdetector | 4 | await evidence |
| https://hexway.io/hive | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hexway.io/hive | 4 | await evidence |
| https://hpi-vdb.de/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | connection&#95;error | indeterminate / ConnectionError |  | 0 | await evidence |
| https://hub.docker.com/r/webgoat/webgoat-8.0 | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hub.docker.com/r/webgoat/webgoat-8.0 | 4 | await evidence |
| https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://hub.docker.com/r/wpscanteam/vulnerablewordpress | 4 | await evidence |
| https://immunityinc.com/products/debugger | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://immunityinc.com/products/debugger | 4 | await evidence |
| https://inteltechniques.com/buscador | 2026-10-15T15:36:17.720874+00:00 | SUSPECT | http&#95;missing | missing / 404 | https://inteltechniques.com/buscador | 4 | await evidence |
| https://labs.mwrinfosecurity.com/tools/wepwnise | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://nostarch.com/xbox.htm | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | access&#95;control | indeterminate / 403 | https://nostarch.com/xbox | 0 | await evidence |
| https://packettotal.com/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | target&#95;guard&#95;or&#95;dns | indeterminate / TargetGuardError |  | 0 | await evidence |
| https://proxmark3.com/ | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | tls&#95;error | indeterminate / SSLError |  | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/faq-2020-threat-detection-report | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/frameworkpos-and-the-adequate-persistent-threat | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/frameworkpos-and-the-adequate-persistent-threat | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/gatekeeper-bypass-vulnerabilities | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/gatekeeper-bypass-vulnerabilities | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/google-zip-domains | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/google-zip-domains | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/how-to-prevent-ransomware | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/how-to-prevent-ransomware | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/inbox-heist | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/inbox-heist | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/initial-access-techniques | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/initial-access-techniques | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/kens-guide-to-cybersecurity | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/kens-guide-to-cybersecurity | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/lateral-movement-and-cryptomining | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/lateral-movement-and-cryptomining | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/linux-vfs | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/linux-vfs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/mcp-ai-workflows | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/mcp-ai-workflows | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/microsoft-alerts | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/microsoft-alerts | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/microsoft-azure-entry | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/microsoft-azure-entry | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/microsoft-html-application-hta-abuse-part-deux | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/microsoft-html-application-hta-abuse-part-deux | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/mitre-sub-techniques | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/mitre-sub-techniques | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/process-masquerading | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/process-masquerading | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/ransomware-decyrptors | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/ransomware-decyrptors | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/retail-cybersecurity-threats | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/right-to-left-override | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/right-to-left-override | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/rocke-cryptominer | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/rocke-cryptominer | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/rogue-code-signing-keys-environment | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/rootkit-webinar | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/ropc-legacy-authentication | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/ropc-legacy-authentication | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/ryuk-ransomware-attack | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/ryuk-ransomware-attack | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/security-testing-using-mitre-attack | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/shai-hulud-worm | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/shai-hulud-worm | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/shutting-down-osx-shlayer | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/shutting-down-osx-shlayer | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/signed-mimikatz | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/signed-mimikatz | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/spearphishing-documents-with-executables | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/spearphishing-documents-with-executables | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/verclsid-exe-threat-detection | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/verclsid-exe-threat-detection | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/vscode-attack | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/vscode-attack | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/what-red-canary-detects-process-injection | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/product-insights/what-red-canary-detects-process-injection | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/windows-active-directory | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/windows-registry-attacks-threat-detection | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/windows-registry-attacks-threat-detection | 0 | await evidence |
| https://redcanary.com/blog/threat-detection/worms-dominate-2020-threat-detection-report | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-hunting/qa-threat-hunting-testing-visibility | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs | 0 | await evidence |
| https://redcanary.com/blog/threat-intelligence/atomic-odyssey-poseidon-stealers | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/atomic-odyssey-poseidon-stealers | 0 | await evidence |
| https://redcanary.com/blog/threat-intelligence/blackbyte-ransomware | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/blackbyte-ransomware | 0 | await evidence |
| https://redcanary.com/blog/threat-intelligence/blue-mockingbird-cryptominer | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/blue-mockingbird-cryptominer | 0 | await evidence |
| https://redcanary.com/blog/threat-intelligence/blue-mockingbird-detection | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/blue-mockingbird-detection | 0 | await evidence |
| https://redcanary.com/blog/threat-intelligence/charcoal-stork | 2026-10-14T15:50:11.825371+00:00 | SUSPECT | rate&#95;limited | indeterminate / 429 | https://www.zscaler.com/blogs/cybersecurity-best-practices/charcoal-stork | 0 | await evidence |

## Discovery queue

Showing 100 of 181 unreviewed discoveries. Full records are in `proposals.json` under `new_unreviewed`.

| URL | Source | Discovered UTC |
| --- | --- | --- |
| https://0xdf.gitlab.io/2026/10/03/htb-reactor.html | 0xdf-v1 | 2026-10-04T15:48:48.696657+00:00 |
| https://0xdf.gitlab.io/2026/10/10/htb-devhub.html | 0xdf-v1 | 2026-10-10T16:14:49.928235+00:00 |
| https://blog.doyensec.com/2026/10/13/Sfape.html | doyensec-archive-v1 | 2026-10-13T18:19:42.780102+00:00 |
| https://blog.nviso.eu/2026/10/16/keystrokes-in-disguise-forensic-analysis-of-a-digispark-hid-device | nviso-v1 | 2026-10-17T14:13:30.822619+00:00 |
| https://blog.trailofbits.com/2026/10/02/sequencehash-multihashing-for-the-rest-of-us | trailofbits-v1 | 2026-10-02T16:39:01.810641+00:00 |
| https://blog.trailofbits.com/2026/10/14/package-managers-have-an-integrity-problem | trailofbits-v1 | 2026-10-14T15:50:11.825371+00:00 |
| https://dfir.ch/posts | dfirch-v1 | 2026-10-06T17:12:32.184318+00:00 |
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
| https://hacktricks.wiki/en/generic-methodologies-and-resources/basic-forensic-methodology/android-forensics.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/external-recon-methodology/reconnaissance-and-threat-intelligence-apis.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/proof-assistant-formal-verification-security.html | hacktricks-en-v1 | 2026-10-12T20:18:23.653920+00:00 |
| https://hacktricks.wiki/en/generic-methodologies-and-resources/rust-basics.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
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
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/index.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/infrared.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/low-power-wide-area-network.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/maxiprox-mobile-cloner.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/pentesting-ble-bluetooth-low-energy.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/pentesting-rfid.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/proxmark-3.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/hardware-physical-access/radio-hacking/sub-ghz-rf.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/industrial-control-systems/index.html | hacktricks-en-v1 | 2026-10-15T15:36:17.720874+00:00 |
| https://hacktricks.wiki/en/linux-hardening/containers-namespaces/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/interesting-files-permissions/index.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |
| https://hacktricks.wiki/en/linux-hardening/interesting-files-permissions/suid-sgid-and-acl-triage.html | hacktricks-en-v1 | 2026-10-05T18:42:43.229910+00:00 |

## Source collection issues

| Source | Result |
| --- | --- |
| elastic-v1 | ValueError |
| sector035-v1 | 403 |
| strange-windytanposts-v1 | 429 |
| usenix-security24-v1 | 403 |
| usenix-security25-v1 | 403 |
| usenix-woot24-v1 | 403 |
