"""WILD intake v0.6.1 tests — run against the REAL R4B1T site-key/v1 authority.

    R4B1T_ROOT=/path/to/r4b1t-h0le python3 tests/test_wild.py

DNS and HTTP are mocked; nothing touches the network. Drift/dirty tests run
against a throwaway git repo built from the real authority files.
"""
import asyncio, csv, hashlib, json, os, shutil, socket, subprocess, sys, tempfile, time, types
from collections import defaultdict
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import wild1000 as w  # noqa: E402

ROOT = Path(os.environ.get("R4B1T_ROOT", HERE.parent.parent / "r4b1t-h0le")).resolve()
if not (ROOT / "tools/site_key_v1.py").exists():
    sys.exit(f"set R4B1T_ROOT to an r4b1t-h0le checkout (tried {ROOT})")
RELEASE = "experience-candidate-v0.4"

ok = True
def check(cond, msg):
    global ok
    print(("PASS " if cond else "FAIL ") + msg); ok &= bool(cond)

def dies(fn, label, needle=""):
    try:
        fn(); check(False, label + " (did not abort)")
    except SystemExit as e:
        check(needle in str(e), f"{label}" + (f"  [{str(e)[:90]}]" if needle not in str(e) else ""))

# ---------------------------------------------------------------- fake DNS
n = iter(range(10, 250))
PUBLIC = defaultdict(lambda: f"93.184.216.{next(n)}")
PRIVATE = {"evil.example": ["10.0.0.5"], "rebind.example": ["93.184.215.9", "127.0.0.1"]}
NX = {"nxdomain.example"}
async def fake_dns(host, port):
    host = host.rstrip(".").lower()
    if host in NX: raise socket.gaierror("NXDOMAIN")
    return PRIVATE.get(host) or [PUBLIC[host]]
w._getaddrinfo = fake_dns

# ---------------------------------------------------------------- fake web
TXT = "<p>plenty of visible text about something genuinely interesting here.</p>"
MiB = 1024 * 1024
LEAD_LINKS = [
    "/about", "https://toy.example/", "https://parked.example/", "https://gone.example/",
    "https://fractal.example/deep/page", "https://fractal.example/", "https://blank.example/",
    "https://canvas.example/", "https://moved.example/", "https://alsomoved.example/",
    "https://evil.example/", "https://rebind.example/", "https://ssrf-redir.example/",
    "https://port.example:8443/", "https://busy.example/", "https://forbidden.example/",
    "https://flaky.example/", "https://nxdomain.example/", "https://slow.example/",
    "https://huge.example/", "https://exact.example/", "https://bin.example/",
    "https://user:pw@creds.example/", "https://dots..example/", "https://example.com../a",
    "https://127.1/a", "https://www.trailing.example./", "https://badredir.example/",
    "https://dotredir.example/", "https://reldots.example/a/b", "https://github.com/Alice/one",
    "https://github.com/alice/two", "https://github.com/Bob/x", "https://github.com/carol/y",
    "https://r1.example/", "https://r2.example/", "https://r3.example/", "https://r4.example/",
]
PAGE2 = ["https://p2a.example/", "https://p2b.example/", "https://p2c.example/", "https://toy.example/from-page2"]
SITES = {
    "lists.example/": (200, "".join(f'<a href="{u}">x</a>' for u in LEAD_LINKS)),
    "lists.example/page2": (200, "".join(f'<a href="{u}">y</a>' for u in PAGE2)),
    "toy.example/": (200, "<title>Weird Toy</title>" + TXT),
    "parked.example/": (200, "<title>x</title><body>This domain is for sale! buy this domain</body>"),
    "gone.example/": (404, ""),
    "fractal.example/": (200, "<title>Fractals</title>" + TXT),
    "fractal.example/deep/page": (200, "<title>deep</title>" + TXT),
    "blank.example/": (200, "<body></body>"),
    "canvas.example/": (200, "<title>c</title><body><canvas></canvas></body>"),
    "moved.example/": (301, "https://dest.example/"),
    "alsomoved.example/": (301, "https://dest.example/"),
    "dest.example/": (200, "<title>Dest</title>" + TXT),
    "ssrf-redir.example/": (302, "http://169.254.169.254/latest/meta-data"),
    "busy.example/": (429, ""), "forbidden.example/": (403, ""), "flaky.example/": (503, ""),
    "slow.example/": ("timeout", ""),
    "huge.example/": (200, "<title>huge</title>" + "A" * (5 * MiB)),
    "exact.example/": (200, ("<title>exact</title>" + TXT).ljust(MiB, "B")),
    "bin.example/": ("bin", b"\0" * (10 * MiB)),
    "www.trailing.example/": (200, "<title>Trailing</title>" + TXT),
    "badredir.example/": (302, "https://evil..example/"),
    "dotredir.example/": (302, "https://dest2.example/a/../b"),
    "reldots.example/a/b": (302, "../c"),
    "reldots.example/c": (200, "<title>Rel</title>" + TXT),
    "github.com/Alice/one": (200, "<title>alice</title>" + TXT),
    "github.com/Bob/x": (200, "<title>bob</title>" + TXT),
    "github.com/carol/y": (302, "https://hub.example/"),
    **{f"r{i}.example/": (302, "https://hub.example/") for i in range(1, 5)},
    **{u[8:]: (200, "<title>p2</title>" + TXT) for u in PAGE2[:3]},
    "hub.example/": (200, "<title>Hub</title>" + TXT),
}
ARCH = {"toy.example": "FOUND", "canvas.example": 429, "dest.example": 500}
LOG = []
INFLIGHT, MAX_INFLIGHT = defaultdict(int), defaultdict(int)

def R(code, body=b"", headers=None):
    return httpx.Response(code, headers=headers or {}, stream=httpx.ByteStream(body))

async def handler(req: httpx.Request):
    host = req.headers["host"].split(":")[0].rstrip(".").lower()
    if host == "archive.org":
        th = httpx.URL(req.url.params["url"]).host.rstrip(".")
        a = ARCH.get(th, "NONE")
        if a == "FOUND":
            return R(200, json.dumps({"archived_snapshots": {"closest": {
                "available": True, "url": "https://web.archive.org/web/2020/x", "timestamp": "2020"}}}).encode())
        if a == "NONE":
            return R(200, b'{"archived_snapshots":{}}')
        return R(a)
    assert req.url.host == (await fake_dns(host, 443))[0], f"not pinned: {host} -> {req.url.host}"
    if req.url.scheme == "https":
        assert req.extensions.get("sni_hostname") == req.headers["host"].split(":")[0].rstrip(".")
    assert req.headers.get("accept-encoding") == "identity"
    t0 = time.monotonic()
    INFLIGHT[host] += 1
    MAX_INFLIGHT[host] = max(MAX_INFLIGHT[host], INFLIGHT[host])
    try:
        await asyncio.sleep(0.005)
        v = SITES.get(host + req.url.path)
        if v is None:
            return R(404)
        code, body = v
        if code == "timeout":
            raise httpx.ReadTimeout("slow", request=req)
        if code == "bin":
            return R(200, body, {"content-type": "application/octet-stream"})
        if code in (301, 302):
            return R(code, b"", {"location": body})
        return R(code, body.encode(), {"content-type": "text/html"})
    finally:
        INFLIGHT[host] -= 1
        LOG.append((host, req.url.host, t0, time.monotonic()))

_orig = httpx.AsyncClient
class Mock(_orig):
    def __init__(s, *a, **k):
        k["transport"] = httpx.MockTransport(handler); super().__init__(*a, **k)
w.httpx.AsyncClient = Mock

# ---------------------------------------------------------------- helpers
D = Path(tempfile.mkdtemp(prefix="wild-test-"))
FROZEN = D / "classification-v2.json"
draft = json.loads((HERE.parent / "classification-v2.draft.json").read_text())
FROZEN.write_text(json.dumps({**draft, "status": "frozen", "version": "resource-classification-v2.0-test"}))
(D / "leads.txt").write_text("https://lists.example/\nhttps://lists.example/page2\n")

def A(**k):
    d = dict(r4b1t_root=str(ROOT), allow_dirty_authority=False, vectors=None)
    d.update(k); return types.SimpleNamespace(**d)

def init(camp, **k):
    d = dict(campaign=str(camp), campaign_id="wild-test", release=RELEASE, expect_sitekeys=733,
             classification=str(FROZEN), campaign_target=1000, source_cap=None,
             pending_cap=None, max_attempts=3)
    d.update(k); w.cmd_campaign_init(A(**d))

def harvest(camp, leads=D / "leads.txt"):
    asyncio.run(w.cmd_harvest(A(campaign=str(camp), leads=str(leads), timeout=5, delay=0, max_bytes=4 * MiB)))

def verify(camp, **k):
    d = dict(campaign=str(camp), candidates=None, limit=0, concurrency=16, timeout=5, delay=0,
             max_bytes=MiB, retry_min_age=0)
    d.update(k); asyncio.run(w.cmd_verify(A(**d)))

def latest(camp):
    return w.latest_by_origin(w.load_jsonl(Path(camp) / "observations.jsonl"))

def write_review(camp, rows):
    with open(Path(camp) / "review.csv", "w", newline="") as fh:
        wr = csv.DictWriter(fh, fieldnames=w.REVIEW_COLS); wr.writeheader(); wr.writerows(rows)

# ================================================================ authority
auth = w.SiteKeyAuthority(str(ROOT))
check(auth.version == "site-key/v1" and auth.vectors_checked >= 25, f"real authority loaded ({auth.vectors_checked} vectors)")
check(not auth.dirty_files, f"real checkout authority is clean ({auth.dirty_files})")
fx = json.loads((ROOT / w.SiteKeyAuthority.VECTORS).read_text())
for mutate, label in [(lambda d: d.__setitem__("psl_sha256", "sha256:" + "0" * 64), "PSL hash mismatch aborts"),
                      (lambda d: d["rejections"].__setitem__(0, {"url": "https://ok.example/", "code": "SITE_KEY_HOST_NOT_ASCII"}), "rejection vector mismatch aborts"),
                      (lambda d: d.__setitem__("normalization", []), "empty vector set aborts")]:
    bad = json.loads(json.dumps(fx)); mutate(bad)
    (D / "bad.json").write_text(json.dumps(bad))
    dies(lambda: w.SiteKeyAuthority(str(ROOT), str(D / "bad.json")), label)
ext = w.SiteKeyAuthority(str(ROOT), str(ROOT / w.SiteKeyAuthority.VECTORS))
check(any(f.startswith("external-vectors:") for f in ext.dirty_files), "external vector file marks authority dirty")

def adm(u):
    try: return w.admit(auth, u)
    except w.Rejected as e: return e.code
check(adm("https://example.com../a") == "sitekey:SITE_KEY_URL_NOT_CANONICAL", "repeated-dot authority rejected BEFORE normalization")
check(adm("https://www.example.com./a") == ("https://www.example.com./a", "example.com"), "trailing dot admitted, URL bytes untouched")
check(adm("https://GitHub.com/Foo/x?utm_source=z&q=1#f") == ("https://GitHub.com/Foo/x?q=1", "github.com/foo"), "only fragment/tracking stripped")

# ================================================================ dirty authority + baseline drift (throwaway repo)
FAKE = D / "fake-root"
for rel in [w.SiteKeyAuthority.IMPL, w.SiteKeyAuthority.PSL, w.SiteKeyAuthority.OVERRIDES, w.SiteKeyAuthority.VECTORS]:
    (FAKE / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copy(ROOT / rel, FAKE / rel)
rd = FAKE / "corpus/releases/mini-v1"; rd.mkdir(parents=True)
urls = b"https://a.example/x\nhttps://b.example/y\nhttps://github.com/Zed/q\n"
res = b'{"release_id":"mini-v1","resources":[],"schema":"x"}'
(rd / "urls.txt").write_bytes(urls); (rd / "resources.json").write_bytes(res)
(rd / "manifest.json").write_text(json.dumps({"release_id": "mini-v1", "urls_digest": w.sha256_tag(urls),
                                              "resources_digest": w.sha256_tag(res)}))
g = lambda *a: subprocess.run(["git", "-C", str(FAKE), "-c", "user.email=t@t", "-c", "user.name=t", *a],
                              capture_output=True, check=True)
g("init", "-q"); g("add", "-A"); g("commit", "-qm", "base")
FC = D / "fake-camp"
init(FC, r4b1t_root=str(FAKE), release="mini-v1", expect_sitekeys=3)
fa = w.SiteKeyAuthority(str(FAKE))
check(w.Campaign(str(FC), fa).corpus_keys == {"a.example", "b.example", "github.com/zed"}, "mini campaign loads; baseline keys recomputed")
impl = FAKE / w.SiteKeyAuthority.IMPL
orig_impl = impl.read_bytes()
impl.write_bytes(orig_impl + b"\n# local tweak\n")
dies(lambda: w.SiteKeyAuthority(str(FAKE)), "dirty authority refused by default", "uncommitted")
da = w.SiteKeyAuthority(str(FAKE), allow_dirty=True)
check(da.manifest_block()["dirty"] and w.SiteKeyAuthority.IMPL in da.dirty_files, "--allow-dirty-authority records dirty files")
dies(lambda: w.Campaign(str(FC), da), "campaign refuses changed impl hash", "impl_sha256")
impl.write_bytes(orig_impl)
(rd / "urls.txt").write_bytes(urls + b"https://c.example/\n")
dies(lambda: w.Campaign(str(FC), w.SiteKeyAuthority(str(FAKE), allow_dirty=True)), "baseline urls drift refused", "urls_digest")
(rd / "urls.txt").write_bytes(urls)
cf = FC / "classification.json"; cbytes = cf.read_bytes()
cf.write_bytes(cbytes.replace(b'"food"', b'"food2"'))
dies(lambda: w.Campaign(str(FC), fa), "classification drift refused", "classification")
cf.write_bytes(cbytes)
mf = FC / "campaign-manifest.json"; mbytes = mf.read_bytes()
mf.write_text(json.dumps(json.loads(mbytes), indent=1))
dies(lambda: w.Campaign(str(FC), fa), "non-canonical (hand-edited) manifest refused", "canonical")
mf.write_bytes(mbytes)
dies(lambda: init(FC, r4b1t_root=str(FAKE), release="mini-v1", expect_sitekeys=3), "manifest is immutable", "immutable")
dies(lambda: init(D / "x", r4b1t_root=str(FAKE), release="mini-v1", expect_sitekeys=99), "expect-sitekeys mismatch refused", "expected 99")
dies(lambda: init(D / "y", r4b1t_root=str(FAKE), release="mini-v1", expect_sitekeys=3,
                  classification=str(HERE.parent / "classification-v2.draft.json")), "draft classification cannot bind a campaign", "frozen")

# ================================================================ classification rule fidelity (RED tests)
cls0 = w.Classification(FROZEN)
row = lambda **k: {"verdict": "y", "resource_type": "experiment", "primary_subject": "visual_art",
                   "subjects": "visual_art", "reason": "this reason is definitely long enough", **k}
check(cls0.problems(row()) == [], "valid row has no problems")
p = cls0.problems(row(subjects="programming"))
check(any("not in subjects" in x for x in p), f"reviewer's case: primary visual_art, subjects programming -> rejected {p}")
check(any("not in subjects" in x for x in cls0.problems(row(subjects=""))), "empty subjects cannot omit primary")
check(any("subjects > 4" in x for x in cls0.problems(row(subjects="visual_art|programming|mathematics|physics|history"))), "max_subjects counts primary")
check(any("duplicate" in x for x in cls0.problems(row(subjects="visual_art|visual_art"))), "duplicate subjects rejected")
check(any("reason" in x for x in cls0.problems(row(reason="too short"))), "min_reason_chars enforced")
check(any("resource_type" in x for x in cls0.problems(row(resource_type="Experiment"))), "ids are exact (case-sensitive)")
def variant(mut, name):
    d = json.loads(FROZEN.read_text()); mut(d); f = D / f"cls-{name}.json"; f.write_text(json.dumps(d)); return f
semi = w.Classification(variant(lambda d: d["rules"].__setitem__("subjects_delimiter", ";"), "semi"))
check(semi.problems(row(subjects="visual_art;programming")) == [] and
      any("subject=" in x for x in semi.problems(row(subjects="visual_art|programming"))), "subjects_delimiter is honoured, not hardcoded")
noprim = w.Classification(variant(lambda d: d["rules"].__setitem__("primary_subject_in_subjects", False), "noprim"))
check(noprim.problems(row(subjects="programming")) == [], "primary_subject_in_subjects=false is honoured")
for mut, label, needle in [
    (lambda d: d["rules"].__setitem__("primary_subject_counts_as_subject", True), "unknown rule key refused (fail-closed)", "not implemented"),
    (lambda d: d["rules"].pop("min_reason_chars"), "missing rule refused (no silent defaults)", "missing"),
    (lambda d: d["rules"].__setitem__("max_subjects", 4.0), "float-typed rule refused", "must be int"),
    (lambda d: d["rules"].__setitem__("primary_subject_in_subjects", 1), "int where bool expected refused", "must be bool"),
    (lambda d: d["rules"].__setitem__("subjects_delimiter", "_"), "identifier delimiter refused", "delimiter"),
    (lambda d: d["subjects"].append({"id": "Bad Id"}), "malformed subject id refused", "invalid subjects"),
    (lambda d: d["subjects"].append(dict(d["subjects"][0])), "duplicate subject id refused", "duplicate"),
]:
    f = variant(mut, label[:8].replace(" ", "_"))
    dies(lambda: w.Classification(f), label, needle)
draft2 = json.loads((HERE.parent / "classification-v2.draft.json").read_text())
check(set(draft2["rules"]) == set(w.Classification.RULES), "shipped draft declares exactly the implemented rules")
check("security" not in {x["id"] for x in draft2["subjects"]} and {"offensive_security", "defensive_security", "malware",
      "reverse_engineering", "forensics", "threat_intelligence", "privacy"} <= {x["id"] for x in draft2["subjects"]}, "security subject split in draft")

# ================================================================ main campaign on the real baseline
C = D / "camp"
init(C)
man = json.loads((C / "campaign-manifest.json").read_text())
rman = json.loads((ROOT / f"corpus/releases/{RELEASE}/manifest.json").read_text())
check(man["baseline"]["sitekey_count"] == 733 and man["baseline"]["url_count"] == 7033, "manifest baseline 7033 URLs / 733 siteKeys")
check(man["baseline"]["urls_sha256"] == rman["urls_digest"] and man["baseline"]["resources_sha256"] == rman["resources_digest"], "baseline digests = release manifest digests")
check(man["sitekey"]["psl_sha256"] == fx["psl_sha256"] and man["sitekey"]["dirty"] is False, "manifest binds clean authority")
check(man["policy"]["source_cap"] == 50 and man["policy"]["pending_cap"] == 100 and man["policy"]["quota_identity"] == "lead_source_key", "policy: integer caps 50/100 per lead_source_key")
def has_float(x): return isinstance(x, float) or (isinstance(x, dict) and any(map(has_float, x.values()))) or (isinstance(x, list) and any(map(has_float, x)))
check(not has_float(man), "manifest contains no floats")
dies(lambda: w.assert_no_floats({"policy": {"x": 0.05}}), "float in authority document refused", "float")
MSHA = w.sha256_tag((C / "campaign-manifest.json").read_bytes())

harvest(C)
leads = w.load_jsonl(C / "leads.jsonl")
cands = w.load_jsonl(C / "candidates.jsonl")
check(len(leads) == 2 and all(l["status"] == "HARVESTED" and l["lead_source_key"] == "lists.example" for l in leads), "both lead pages recorded with lead_source_key=lists.example")
check(all(l["lead_page_sha256"].startswith("sha256:") and l["lead_hash_scope"] == "FULL" and l["lead_hashed_bytes"] > 0 for l in leads), "lead page hash + scope + bytes recorded")
check(all(all(c.get(f) not in (None, "") for f in w.LEAD_FIELDS) and c["campaign_manifest_sha256"] == MSHA for c in cands), "every candidate carries full lead provenance + manifest hash")
check(len({c["lead_source_url"] for c in cands}) == 2, "candidates keep their distinct lead_source_url")

verify(C)
obs = latest(C)
S = {k: (o["status"], o["reason_code"]) for k, o in obs.items()}
exp = {
    "toy.example": ("LIVE_CANDIDATE", ""), "parked.example": ("REJECTED", "parked_or_placeholder"),
    "gone.example": ("REJECTED", "http_404"), "fractal.example": ("LIVE_CANDIDATE", ""),
    "blank.example": ("REJECTED", "empty_page"), "canvas.example": ("LIVE_CANDIDATE", ""),
    "evil.example": ("REJECTED", "unsafe:non_public_ip:10.0.0.5"),
    "rebind.example": ("REJECTED", "unsafe:non_public_ip:127.0.0.1"),
    "ssrf-redir.example": ("REJECTED", "unsafe:non_public_ip:169.254.169.254"),
    "port.example": ("REJECTED", "unsafe:port:8443"), "busy.example": ("RETRYABLE", "http_429"),
    "forbidden.example": ("MANUAL_CHECK", "http_403"), "flaky.example": ("RETRYABLE", "http_503"),
    "nxdomain.example": ("RETRYABLE", "dns_error"), "slow.example": ("RETRYABLE", "timeout"),
    "huge.example": ("LIVE_CANDIDATE", ""), "exact.example": ("LIVE_CANDIDATE", ""),
    "bin.example": ("LIVE_CANDIDATE", ""), "trailing.example": ("LIVE_CANDIDATE", ""),
    "badredir.example": ("REJECTED", "redirect_target:sitekey:SITE_KEY_URL_NOT_CANONICAL"),
    "dotredir.example": ("REJECTED", "redirect_target:sitekey:SITE_KEY_URL_NOT_CANONICAL"),
    "reldots.example": ("LIVE_CANDIDATE", ""), "github.com/alice": ("LIVE_CANDIDATE", ""),
    "github.com/bob": ("LIVE_CANDIDATE", ""), "p2a.example": ("LIVE_CANDIDATE", ""),
}
bad = {k: (S.get(k), v) for k, v in exp.items() if S.get(k) != v}
check(not bad, f"{len(exp)} probe outcomes as expected {bad if bad else ''}")
check(all(o["campaign_manifest_sha256"] == MSHA for o in obs.values()), "every observation bound to manifest hash")
check(all(o["lead_source_key"] == "lists.example" and o["lead_page_sha256"] for o in obs.values()), "observations carry lead provenance")
o = obs["toy.example"]
check(o["probe_hash_scope"] == "FULL" and obs["huge.example"]["probe_hash_scope"] == "PREFIX"
      and obs["exact.example"]["probe_hash_scope"] == "FULL" and obs["bin.example"]["probe_hashed_bytes"] == 65536, "FULL/PREFIX evidence")
hub = [(x["origin_key"], x["status"]) for x in obs.values() if x["site_key"] == "hub.example"]
check(len(hub) == 5 and sum(s == "LIVE_CANDIDATE" for _, s in hub) == 1, "5 redirects into one host -> 1 identity")
check(not any(ip.startswith(("10.", "127.", "169.254")) for _, ip, *_ in LOG), "no request ever sent to a non-public IP")
check(max(MAX_INFLIGHT.values()) == 1, "never >1 in-flight request per host, incl. redirect hops")
sk = json.loads((C / "skipped.json").read_text())
check(sk["campaign_manifest_sha256"] == MSHA and sk["counts"].get("sitekey:SITE_KEY_URL_NOT_CANONICAL", 0) >= 3, "v3-invalid candidates never probed; skip report bound")

# politeness on redirect hops
LOG.clear(); C2 = D / "camp-polite"; init(C2); harvest(C2); LOG.clear()
verify(C2, delay=0.05)
hs = sorted(t for h, _, t, _ in LOG if h == "hub.example")
check(len(hs) == 5 and min(b - a for a, b in zip(hs, hs[1:])) >= 0.05, "redirect-hop politeness delay enforced")

# ================================================================ review states + export
rows = w.load_review(C / "review.csv")
byk = {r["site_key"]: r for r in rows}
byk["toy.example"].update(verdict="y", resource_type="experiment", primary_subject="visual_art",
                          subjects="visual_art|programming", reason="hand-built browser toy, nothing else like it in the corpus")
byk["fractal.example"].update(verdict="accept", resource_type="visualisation", primary_subject="mathematics",
                              subjects="mathematics", reason="interactive Mandelbrot explorer, good entry point")
byk["canvas.example"].update(verdict="y", resource_type="experiment", primary_subject="visual_art", subjects="", reason="short")
byk["exact.example"].update(verdict="n", reason="filler")
write_review(C, list(byk.values()))
cls = w.Campaign(str(C), auth).classification
st = {k: w.review_state(byk[k], cls) for k in ("toy.example", "fractal.example", "canvas.example", "exact.example", "huge.example")}
check(st["toy.example"][0] == "CAMPAIGN_ACCEPTED", "valid classification + reason -> CAMPAIGN_ACCEPTED")
check(st["fractal.example"][0] == "REVIEW_ACCEPTED" and any("resource_type" in p for p in st["fractal.example"][1]), "unknown resource_type -> REVIEW_ACCEPTED only")
check(st["canvas.example"][0] == "REVIEW_ACCEPTED" and any("reason" in p for p in st["canvas.example"][1]), "too-short reason -> REVIEW_ACCEPTED only")
check(st["exact.example"][0] == "REVIEW_REJECTED" and st["huge.example"][0] == "UNREVIEWED", "reject / unreviewed states")
w.cmd_export(A(campaign=str(C)))
ex = w.load_jsonl(C / "campaign-accepted.jsonl")
check([r["site_key"] for r in ex] == ["toy.example"], "export contains only CAMPAIGN_ACCEPTED")
e0 = ex[0]
check(e0["campaign_manifest_sha256"] == MSHA and e0["classification_sha256"] == cls.sha256
      and e0["subjects"] == ["programming", "visual_art"] and e0["quota_lead"]["lead_source_key"] == "lists.example"
      and e0["observation"]["probe_sha256"].startswith("sha256:"), "export binds manifest, classification, lead + probe evidence")
edges = {e["lead_source_url"]: e["url"] for e in e0["lead_edges"]}
check(edges == {"https://lists.example/": "https://toy.example/", "https://lists.example/page2": "https://toy.example/from-page2"},
      f"export keeps every lead edge for a siteKey, not just the quota lead ({edges})")
check(all(e["lead_page_sha256"].startswith("sha256:") for e in e0["lead_edges"]), "each edge carries its lead page hash")
# review binding
rows_b = list(byk.values())
check(all(r["campaign_manifest_sha256"] == MSHA and r["classification_sha256"] == cls.sha256 and r["classification_version"] == cls.version
          for r in rows_b), "review rows carry manifest + classification binding")
foreign = dict(rows_b[0], campaign_manifest_sha256="sha256:" + "f" * 64)
write_review(C, rows_b + [foreign])
dies(lambda: w.cmd_export(A(campaign=str(C))), "foreign-bound review row refused by export", "binding")
dies(lambda: w.cmd_stats(A(campaign=str(C))), "foreign-bound review row refused by stats", "binding")
unbound = dict(rows_b[1], classification_sha256="")
write_review(C, rows_b[:1] + [unbound] + rows_b[2:])
dies(lambda: asyncio.run(w.cmd_verify(A(campaign=str(C), candidates=None, limit=0, concurrency=4, timeout=5, delay=0, max_bytes=MiB, retry_min_age=0))),
     "review row with missing binding refused by verify", "binding")

# v0.6.1 review-integrity gate: duplicate/empty identities and verdict typos fail closed.
dup = dict(rows_b[0])
write_review(C, rows_b + [dup])
dies(lambda: w.cmd_stats(A(campaign=str(C))), "duplicate review site_key refused by stats", "duplicate site_key")
dies(lambda: asyncio.run(w.cmd_verify(A(campaign=str(C), candidates=None, limit=0, concurrency=4, timeout=5, delay=0, max_bytes=MiB, retry_min_age=0))),
     "duplicate review site_key refused by verify", "duplicate site_key")
dies(lambda: w.cmd_export(A(campaign=str(C))), "duplicate review site_key refused by export", "duplicate site_key")
empty_key = dict(rows_b[0], site_key="")
write_review(C, [empty_key] + rows_b[1:])
dies(lambda: w.cmd_stats(A(campaign=str(C))), "empty review site_key refused", "empty site_key")
write_review(C, rows_b)
check(w.review_state(dict(rows_b[0], verdict="yes"), cls)[0] in ("REVIEW_ACCEPTED", "CAMPAIGN_ACCEPTED"),
      "explicit accept verdict recognized")
check(w.review_state(dict(rows_b[0], verdict="reject"), cls)[0] == "REVIEW_REJECTED",
      "explicit reject verdict recognized")
check(w.review_state(dict(rows_b[0], verdict="accpet"), cls)[0] == "REVIEW_INVALID",
      "unknown verdict typo becomes REVIEW_INVALID")
write_review(C, rows_b)
byk["fractal.example"]["resource_type"] = "visualization"; write_review(C, list(byk.values()))
w.cmd_export(A(campaign=str(C)))
ex1 = (C / "campaign-accepted.jsonl").read_bytes()
check([r["site_key"] for r in w.load_jsonl(C / "campaign-accepted.jsonl")] == ["fractal.example", "toy.example"], "fixing classification promotes to CAMPAIGN_ACCEPTED")
w.cmd_export(A(campaign=str(C)))
check((C / "campaign-accepted.jsonl").read_bytes() == ex1, "export is byte-deterministic")

# ================================================================ retries, determinism
for _ in range(3): verify(C)
obs = latest(C)
check((obs["busy.example"]["status"], obs["busy.example"]["reason_code"]) == ("REJECTED", "retry_exhausted:http_429"), "retry exhaustion")
check(obs["slow.example"]["lead_page_sha256"] != "", "retried observations keep lead provenance")
C3, C4 = D / "det1", D / "det2"
for c, conc in ((C3, 1), (C4, 16)):
    init(c); shutil.copy(C / "candidates.jsonl", c / "candidates.jsonl")
    # candidates are bound to C's manifest -> must be rejected for a different campaign
dies(lambda: verify(C3), "candidates bound to another campaign refused", "another manifest")
for c, conc in ((C3, 1), (C4, 16)):
    (c / "candidates.jsonl").unlink(); harvest(c); verify(c, concurrency=conc)
strip = lambda c: [{k: v for k, v in json.loads(l).items() if k not in ("observed_at", "campaign_manifest_sha256", "lead_observed_at")}
                   for l in open(c / "observations.jsonl")]
check(strip(C3) == strip(C4), "deterministic serialization (serial vs parallel)")

# ================================================================ quota by lead_source_key
Q = D / "quota"; init(Q, campaign_target=40)                 # cap 2, pipeline 4
harvest(Q); verify(Q)
o1 = w.load_jsonl(Q / "observations.jsonl")
check(len(o1) == 4, f"two lead pages of one site share ONE pipeline of 4 (probed {len(o1)})")
rows = w.load_review(Q / "review.csv")
for r in rows[:2]: r["verdict"] = "y"                     # accepted but unclassified
write_review(Q, rows)
verify(Q)
sk = json.loads((Q / "skipped.json").read_text())["counts"]
check(sk.get("source_cap_reached", 0) > 0, "REVIEW_ACCEPTED (even unclassified) consumes quota")
check(len(w.load_jsonl(Q / "observations.jsonl")) == len(o1), "no new probes once lists.example quota is full")

shutil.rmtree(D, ignore_errors=True)
print("\nALL PASS" if ok else "\nFAILURES")
sys.exit(0 if ok else 1)
