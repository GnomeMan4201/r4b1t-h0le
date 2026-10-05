import hashlib
import json
import unittest
from pathlib import Path

from tools import selection_v3
from tools import selection_v3_metrics
from tools import site_key_v1

ROOT = Path(__file__).resolve().parents[1]
PSL_SOURCE_PATH = ROOT / "selection/site-key-v1/public_suffix_list.dat"
PSL_PATH = ROOT / "selection/site-key-v1/public_suffix_list_ascii_v1.dat"
OVERRIDES_PATH = ROOT / "selection/site-key-v1/platform-overrides.json"
VECTORS_PATH = ROOT / "tests/fixtures/selection-v3-vectors.json"
CORPUS_PATH = ROOT / "corpus/releases/experience-candidate-v0.4/urls.txt"

PSL_SOURCE_TEXT = PSL_SOURCE_PATH.read_text(encoding="utf-8")
PSL_TEXT = PSL_PATH.read_text(encoding="utf-8")
OVERRIDES_TEXT = OVERRIDES_PATH.read_text(encoding="utf-8")
VECTORS = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))
PSL = site_key_v1.parse_psl(PSL_TEXT)
OVERRIDES = site_key_v1.parse_overrides(OVERRIDES_TEXT)


def site_key(url):
    return site_key_v1.site_key(url, PSL, OVERRIDES)


def options_for(vector):
    return {
        "eligible_urls": vector["urls"],
        "site_key": site_key,
        "seed": vector["seed"],
        "draw_start": vector["draw_start"],
        "weight_mode": vector["mode"],
        "repeat_guard_reference": vector["repeat_guard_reference"],
        "sequence": 1,
        "constraint": {
            "terrain": "ALL",
            "terrainIndex": None,
            "protocolPolicy": {"version": 1, "excludeOnion": False},
        },
        "corpus_revision": "sha256:" + ("1" * 64),
        "psl_sha256": VECTORS["psl_sha256"],
        "overrides_sha256": VECTORS["overrides_sha256"],
    }


class SiteKeyV1Tests(unittest.TestCase):
    def test_pinned_input_hashes(self):
        self.assertEqual(
            "sha256:" + hashlib.sha256(PSL_SOURCE_TEXT.encode("utf-8")).hexdigest(),
            VECTORS["psl_source_sha256"],
        )
        self.assertEqual(
            "sha256:" + hashlib.sha256(PSL_TEXT.encode("utf-8")).hexdigest(),
            VECTORS["psl_sha256"],
        )
        self.assertEqual(
            "sha256:" + hashlib.sha256(OVERRIDES_TEXT.encode("utf-8")).hexdigest(),
            VECTORS["overrides_sha256"],
        )

    def test_normalization_vectors(self):
        for vector in VECTORS["normalization"]:
            with self.subTest(vector=vector["url"]):
                self.assertEqual(site_key(vector["url"]), vector["site_key"])

    def test_raw_unicode_authorities_fail_closed(self):
        for vector in VECTORS["rejections"]:
            with self.subTest(vector=vector["url"]):
                with self.assertRaisesRegex(site_key_v1.SiteKeyError, vector["code"]):
                    site_key(vector["url"])

    def test_active_group_count(self):
        urls = [line.strip() for line in CORPUS_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
        self.assertEqual(len(urls), 7033)
        self.assertEqual(len(site_key_v1.canonical_groups(urls, PSL, OVERRIDES)), 733)


    def test_invalid_platform_owner_falls_back_to_registrable_domain(self):
        self.assertEqual(site_key('https://github.com/@bad/repo'), 'github.com')
        self.assertEqual(site_key('https://github.com/-bad/repo'), 'github.com')
        self.assertEqual(site_key('https://gitlab.com/@bad/repo'), 'gitlab.com')
        self.assertEqual(site_key('https://medium.com/not-an-at-user/post'), 'medium.com')

    def test_active_diversity_metrics_are_recomputable(self):
        urls = [line.strip() for line in CORPUS_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
        report = selection_v3_metrics.compute_report(urls, site_key)
        self.assertEqual(report["url_count"], 7033)
        self.assertEqual(report["site_key_count"], 733)
        self.assertEqual(report["modes"]["UNIFORM_SITE"]["effective_sites"], 733)
        self.assertAlmostEqual(report["modes"]["UNIFORM_SITE"]["max_site_probability"], 1 / 733, places=15)
        self.assertAlmostEqual(report["modes"]["SQRT_DEPTH"]["effective_sites"], 448.64033478088453, places=12)
        self.assertAlmostEqual(report["modes"]["SQRT_DEPTH"]["max_site_probability"], 0.027211505700766473, places=15)
        self.assertAlmostEqual(report["modes"]["UNIFORM_URL"]["effective_sites"], 33.4476072159403, places=12)
        self.assertAlmostEqual(report["modes"]["UNIFORM_URL"]["max_site_probability"], 0.1305275131522821, places=15)


class SelectionV3ParityTests(unittest.TestCase):
    def test_normative_vectors_byte_for_byte(self):
        for vector in VECTORS["vectors"]:
            with self.subTest(vector=vector["name"]):
                actual = selection_v3.select(**options_for(vector))
                self.assertEqual(actual, vector["expected_transaction"])
                self.assertEqual(
                    selection_v3.canonical_json(actual),
                    vector["expected_canonical_json"],
                )

    def test_v2_to_v3_guard_reference(self):
        previous_v2 = {
            "transaction_version": "r4b1t-selection-transaction/v2",
            "action": "ROLL",
            "route": {"url": "https://github.com/OpenAI/previous"},
        }
        self.assertEqual(
            selection_v3.derive_repeat_guard_reference(previous_v2, site_key),
            "github.com/openai",
        )
        self.assertIsNone(selection_v3.derive_repeat_guard_reference(None, site_key))


if __name__ == "__main__":
    unittest.main()
