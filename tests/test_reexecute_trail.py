import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("reexecute_trail", ROOT / "tools" / "reexecute_trail.py")
reexec = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
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
            [3451365934, 1226674830, 3986881728, 3492077554, 3699580490],
        )


if __name__ == "__main__":
    unittest.main()
