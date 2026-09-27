from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from tools.build_runtime_corpus import (
    RUNTIME_SCHEMA,
    build_runtime_corpus,
    write_runtime_corpus,
)
from tools.compile_eligibility import compile_document
from tools.corpus_provenance import PROVENANCE_SCHEMA, compile_provenance


class RuntimeCorpusShadowTests(unittest.TestCase):
    def provenance(self) -> dict[str, object]:
        return {
            "schema": PROVENANCE_SCHEMA,
            "corpus": "r4b1t-cybersecurity-v1",
            "sources": [
                {
                    "id": "catalog-test",
                    "url": "https://example.org/catalog",
                    "kind": "curated_catalog",
                }
            ],
            "records": [
                {
                    "url": "https://security.example/tool",
                    "resource_type": {
                        "value": "security_tool",
                        "basis": {
                            "kind": "source_assertion",
                            "source_id": "catalog-test",
                        },
                    },
                    "scope_assertions": [
                        {
                            "scope": "cybersecurity",
                            "source_id": "catalog-test",
                        }
                    ],
                },
                {
                    "url": "https://github.com/projectdiscovery/nuclei",
                    "resource_type": {
                        "value": "repository",
                        "basis": {
                            "kind": "structural_rule",
                            "rule_id": "github-repository-v1",
                        },
                    },
                    "scope_assertions": [
                        {
                            "scope": "cybersecurity",
                            "source_id": "catalog-test",
                        }
                    ],
                },
                {
                    "url": "http://exampleexampleexampleexampleexampleexample.onion/data",
                    "resource_type": {
                        "value": "dataset",
                        "basis": {
                            "kind": "source_assertion",
                            "source_id": "catalog-test",
                        },
                    },
                    "scope_assertions": [
                        {
                            "scope": "cybersecurity",
                            "source_id": "catalog-test",
                        }
                    ],
                },
            ],
        }

    def compiled_inputs(self) -> tuple[dict[str, object], list[dict[str, object]], dict[str, object]]:
        compiled = compile_provenance(self.provenance())
        eligibility = compile_document(compiled["eligibilityInput"])
        return compiled, eligibility["eligible"], eligibility["manifest"]

    def test_schema_identifier_is_versioned(self) -> None:
        self.assertEqual(RUNTIME_SCHEMA, "r4b1t-runtime-corpus-shadow-v1")
        root = Path(__file__).resolve().parents[1]
        schema = json.loads(
            (root / "schemas" / "runtime-corpus-shadow-v1.schema.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(schema["properties"]["schema"]["const"], RUNTIME_SCHEMA)

    def test_build_contains_only_final_eligible_canonical_urls(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        runtime = build_runtime_corpus(compiled, eligible, manifest)

        self.assertEqual(runtime["count"], 2)
        self.assertEqual(
            [record["url"] for record in runtime["records"]],
            [
                "https://github.com/projectdiscovery/nuclei",
                "https://security.example/tool",
            ],
        )
        self.assertNotIn(".onion", runtime["urlText"])
        self.assertEqual(
            runtime["urlText"],
            "https://github.com/projectdiscovery/nuclei\n"
            "https://security.example/tool\n",
        )

    def test_url_pool_digest_binds_exact_text_bytes(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        runtime = build_runtime_corpus(compiled, eligible, manifest)
        expected = "sha256:" + hashlib.sha256(
            runtime["urlText"].encode("utf-8")
        ).hexdigest()
        self.assertEqual(runtime["document"]["urlPoolDigest"], expected)

    def test_build_is_deterministic_across_eligible_input_order(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        left = build_runtime_corpus(compiled, eligible, manifest)
        right = build_runtime_corpus(compiled, list(reversed(eligible)), manifest)
        self.assertEqual(left, right)

    def test_unknown_provenance_source_fails_closed(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        broken = copy.deepcopy(eligible)
        broken[0]["source"] = "provenance:sha256:" + "f" * 64
        with self.assertRaisesRegex(ValueError, "unknown provenance"):
            build_runtime_corpus(compiled, broken, manifest)

    def test_resource_type_mismatch_fails_closed(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        broken = copy.deepcopy(eligible)
        broken[0]["resourceType"] = "reference"
        with self.assertRaisesRegex(ValueError, "resource type"):
            build_runtime_corpus(compiled, broken, manifest)

    def test_duplicate_canonical_url_fails_closed(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        broken = copy.deepcopy(eligible)
        broken.append(copy.deepcopy(broken[0]))
        broken_manifest = copy.deepcopy(manifest)
        broken_manifest["counts"]["eligible"] += 1
        with self.assertRaisesRegex(ValueError, "duplicate canonical URL"):
            build_runtime_corpus(compiled, broken, broken_manifest)

    def test_manifest_count_must_match_eligible_records(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        broken = copy.deepcopy(manifest)
        broken["counts"]["eligible"] += 1
        with self.assertRaisesRegex(ValueError, "eligible count"):
            build_runtime_corpus(compiled, eligible, broken)

    def test_output_has_no_selection_weight_or_ranking_authority(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        runtime = build_runtime_corpus(compiled, eligible, manifest)
        forbidden = {
            "score",
            "rank",
            "weight",
            "probability",
            "popularity",
            "recommendation",
            "personalization",
        }

        def walk(value: object) -> None:
            if isinstance(value, dict):
                self.assertTrue(forbidden.isdisjoint(value.keys()))
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(runtime["document"])

    def test_writer_emits_exact_runtime_shadow_files(self) -> None:
        compiled, eligible, manifest = self.compiled_inputs()
        runtime = build_runtime_corpus(compiled, eligible, manifest)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_runtime_corpus(runtime, root)
            self.assertEqual(
                sorted(path.name for path in root.iterdir()),
                ["typed-runtime-v1.json", "typed-urls-v1.txt"],
            )
            self.assertEqual(
                (root / "typed-urls-v1.txt").read_text(encoding="utf-8"),
                runtime["urlText"],
            )
            self.assertEqual(
                json.loads(
                    (root / "typed-runtime-v1.json").read_text(encoding="utf-8")
                ),
                runtime["document"],
            )


if __name__ == "__main__":
    unittest.main()
