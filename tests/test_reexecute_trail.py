import importlib.util
import json
import pathlib
import sys
import unittest
import hashlib

from tools import selection_v3, site_key_v1

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("reexecute_trail", ROOT / "tools" / "reexecute_trail.py")
reexec = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = reexec
SPEC.loader.exec_module(reexec)


class ReexecuteTrailUnitTests(unittest.TestCase):
    def test_seed_fold_is_pinned_to_32_bits(self):
        self.assertEqual(
            reexec.seed_to_uint32("00112233445566778899aabbccddeeff"),
            545826473,
        )
        self.assertLessEqual(reexec.seed_to_uint32("anything"), 0xFFFFFFFF)

    def test_cj1_serialization_matches_repository_profile(self):
        value = {
            "z": [None, True, False, "raw \u2028 text"],
            "a": {"n": 9007199254740991, "s": "quote\"slash\\line\n"},
        }
        self.assertEqual(
            reexec.cj1_serialize(value),
            '{"a":{"n":9007199254740991,"s":"quote\\\"slash\\\\line\\n"},"z":[null,true,false,"raw   text"]}',
        )

    def test_cj1_rejects_fraction_and_non_ascii_key(self):
        with self.assertRaises(reexec.ReexecutionError) as ctx:
            reexec.cj1_serialize({"value": 1.5})
        self.assertEqual(ctx.exception.code, "CANONICAL_PROFILE_VIOLATION")

        with self.assertRaises(reexec.ReexecutionError) as ctx:
            reexec.cj1_serialize({"é": 1})
        self.assertEqual(ctx.exception.code, "CANONICAL_PROFILE_VIOLATION")

    def test_active_release_and_terrain_binding_load_from_repository_bytes(self):
        promotion = json.loads((ROOT / "corpus/runtime/active-v1.json").read_text(encoding="utf-8"))
        release = reexec.find_release(ROOT, promotion["active"]["expected_digest"])
        self.assertEqual(release.release_id, promotion["active"]["release_id"])

        registry = json.loads((ROOT / "corpus/runtime/eligibility-profiles-v1.json").read_text(encoding="utf-8"))
        profile = next(p for p in registry["profiles"] if p["release"]["release_id"] == release.release_id)
        terrain = reexec.load_authoritative_terrain(ROOT, release, profile["terrain_index"]["digest"])
        self.assertEqual(terrain.status, "AUTHORITATIVE_ACTIVE")
        self.assertEqual(terrain.profile_id, profile["profile_id"])

    def test_mulberry32_word_sequence_is_stable(self):
        rng = reexec.Mulberry32("00112233445566778899aabbccddeeff")
        self.assertEqual(
            [rng.next_uint32() for _ in range(5)],
            [2933845282, 3421876258, 1779693272, 3789635584, 2525629530],
        )

    def _mixed_v2_v3_envelope(self):
        promotion = json.loads((ROOT / "corpus/runtime/active-v1.json").read_text(encoding="utf-8"))
        release = reexec.find_release(ROOT, promotion["active"]["expected_digest"])
        seed = "mixed-v2-v3"
        constraint = {
            "terrain": "ALL",
            "terrainIndex": None,
            "protocolPolicy": {"version": 1, "excludeOnion": False},
        }

        rng = reexec.Mulberry32(seed)
        first_url = release.urls[rng.pool_index(len(release.urls))]
        first_tx = {
            "transaction_version": "r4b1t-selection-transaction/v2",
            "sequence": 1,
            "action": "ROLL",
            "constraint": constraint,
            "corpus_revision": release.manifest["urls_digest"],
            "eligible_count": len(release.urls),
            "sampler": {
                "algorithm": "uniform-with-repeat-guard-v1",
                "prng": "mulberry32-v1",
                "seed": seed,
                "draw_start": 0,
                "draw_count": 1,
                "repeat_guard": {"reference": None, "max_draws": 30},
            },
            "route": {"url": first_url},
        }

        psl_bytes = (ROOT / "selection/site-key-v1/public_suffix_list_ascii_v1.dat").read_bytes()
        override_bytes = (ROOT / "selection/site-key-v1/platform-overrides.json").read_bytes()
        psl = site_key_v1.parse_psl(psl_bytes.decode("utf-8"))
        overrides = site_key_v1.parse_overrides(override_bytes.decode("utf-8"))
        key = lambda url: site_key_v1.site_key(url, psl, overrides)
        second_tx = selection_v3.select(
            eligible_urls=release.urls,
            site_key=key,
            seed=seed,
            draw_start=1,
            weight_mode="UNIFORM_SITE",
            repeat_guard_reference=key(first_url),
            sequence=2,
            constraint=constraint,
            corpus_revision=release.manifest["urls_digest"],
            psl_sha256=reexec.digest_bytes(psl_bytes),
            overrides_sha256=reexec.digest_bytes(override_bytes),
        )

        manifest = {
            "format": "r4b1t-trail/v0.3",
            "created_at": "2026-10-05T15:00:00.000Z",
            "corpus_revision": release.manifest["urls_digest"],
            "steps": [
                {
                    "index": 1,
                    "kind": "ROLL",
                    "route": {"route_id": reexec.route_id(first_url), "url": first_url},
                    "transaction": first_tx,
                },
                {
                    "index": 2,
                    "kind": "ROLL",
                    "route": {
                        "route_id": reexec.route_id(second_tx["route"]["url"]),
                        "url": second_tx["route"]["url"],
                    },
                    "transaction": second_tx,
                },
            ],
            "parent": None,
        }
        return {
            "trail_id": "sha256:" + hashlib.sha256(reexec.cj1_serialize(manifest).encode("utf-8")).hexdigest(),
            "manifest": manifest,
        }

    def test_reexecutor_accepts_mixed_v2_to_v3_roll_chain(self):
        result = reexec.reexecute(self._mixed_v2_v3_envelope(), ROOT)
        self.assertEqual(result["status"], "PROVENANCE_REEXECUTED")
        self.assertEqual(result["roll_steps"], 2)
        self.assertEqual(
            [roll["transaction_version"] for roll in result["rolls"]],
            ["r4b1t-selection-transaction/v2", "r4b1t-selection-transaction/v3"],
        )
        self.assertEqual(result["rolls"][1]["eligible_site_count"], 733)

    def test_reexecutor_rejects_tampered_v3_site_guard_reference(self):
        envelope = self._mixed_v2_v3_envelope()
        tx = envelope["manifest"]["steps"][1]["transaction"]
        tx["sampler"]["repeat_guard"]["reference"] = "tampered.example"
        envelope["trail_id"] = "sha256:" + hashlib.sha256(
            reexec.cj1_serialize(envelope["manifest"]).encode("utf-8")
        ).hexdigest()
        with self.assertRaises(reexec.ReexecutionError):
            reexec.reexecute(envelope, ROOT)


if __name__ == "__main__":
    unittest.main()
