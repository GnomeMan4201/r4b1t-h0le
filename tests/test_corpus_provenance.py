from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from tools.corpus_provenance import (
    COMPILED_SCHEMA,
    PROVENANCE_SCHEMA,
    compile_provenance,
    verify_compiled,
)


class CorpusProvenanceTests(unittest.TestCase):
    def source(self, source_id: str = "catalog-pentest-v1") -> dict[str, str]:
        return {
            "id": source_id,
            "url": "https://example.org/catalog",
            "kind": "curated_catalog",
        }

    def record(self) -> dict[str, object]:
        return {
            "url": "https://example.org/research/kernel-bugs",
            "resource_type": {
                "value": "research",
                "basis": {
                    "kind": "source_assertion",
                    "source_id": "catalog-pentest-v1",
                },
            },
            "scope_assertions": [
                {
                    "scope": "cybersecurity",
                    "source_id": "catalog-pentest-v1",
                }
            ],
        }

    def document(self) -> dict[str, object]:
        return {
            "schema": PROVENANCE_SCHEMA,
            "corpus": "r4b1t-cybersecurity-v1",
            "sources": [self.source()],
            "records": [self.record()],
        }

    def test_schema_constants_are_versioned(self) -> None:
        self.assertEqual(PROVENANCE_SCHEMA, "r4b1t-corpus-provenance-v1")
        self.assertEqual(COMPILED_SCHEMA, "r4b1t-corpus-provenance-compiled-v1")

        root = Path(__file__).resolve().parents[1]
        schema = json.loads(
            (root / "schemas" / "corpus-provenance-v1.schema.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(schema["properties"]["schema"]["const"], PROVENANCE_SCHEMA)

    def test_source_assertions_project_to_one_typed_eligibility_record(self) -> None:
        compiled = compile_provenance(self.document())
        self.assertTrue(compiled["artifactDigest"].startswith("sha256:"))
        self.assertEqual(len(compiled["records"]), 1)
        self.assertEqual(len(compiled["eligibilityInput"]["records"]), 1)

        projected = compiled["eligibilityInput"]["records"][0]
        self.assertEqual(projected["url"], "https://example.org/research/kernel-bugs")
        self.assertEqual(projected["resource_type"], "research")
        self.assertTrue(projected["source"].startswith("provenance:sha256:"))
        self.assertEqual(verify_compiled(compiled), compiled)

    def test_structural_type_rule_does_not_replace_cybersecurity_scope_assertion(self) -> None:
        document = {
            "schema": PROVENANCE_SCHEMA,
            "corpus": "r4b1t-cybersecurity-v1",
            "sources": [self.source()],
            "records": [
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
                            "source_id": "catalog-pentest-v1",
                        }
                    ],
                }
            ],
        }
        compiled = compile_provenance(document)
        self.assertEqual(
            compiled["eligibilityInput"]["records"][0]["resource_type"],
            "repository",
        )

        document["records"][0]["scope_assertions"] = []
        with self.assertRaisesRegex(ValueError, "cybersecurity scope"):
            compile_provenance(document)

    def test_structural_rule_must_match_url_shape_and_type(self) -> None:
        document = self.document()
        document["records"] = [
            {
                "url": "https://example.org/not-github",
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
                        "source_id": "catalog-pentest-v1",
                    }
                ],
            }
        ]
        with self.assertRaisesRegex(ValueError, "structural rule"):
            compile_provenance(document)

    def test_repository_structural_rule_rejects_reserved_github_surfaces(self) -> None:
        document = {
            "schema": PROVENANCE_SCHEMA,
            "corpus": "r4b1t-cybersecurity-v1",
            "sources": [self.source()],
            "records": [
                {
                    "url": "https://github.com/topics/security",
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
                            "source_id": "catalog-pentest-v1",
                        }
                    ],
                }
            ],
        }
        with self.assertRaisesRegex(ValueError, "structural rule"):
            compile_provenance(document)

    def test_unknown_source_reference_fails_closed(self) -> None:
        document = self.document()
        document["records"][0]["scope_assertions"][0]["source_id"] = "missing-source"
        with self.assertRaisesRegex(ValueError, "unknown source"):
            compile_provenance(document)

    def test_duplicate_source_ids_are_rejected(self) -> None:
        document = self.document()
        document["sources"].append(copy.deepcopy(document["sources"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate source"):
            compile_provenance(document)

    def test_multiple_scope_assertions_do_not_duplicate_or_weight_resource(self) -> None:
        document = self.document()
        document["sources"].append(
            {
                "id": "manual-review-1",
                "url": "https://example.org/review",
                "kind": "manual_review",
            }
        )
        document["records"][0]["scope_assertions"].append(
            {
                "scope": "cybersecurity",
                "source_id": "manual-review-1",
            }
        )
        compiled = compile_provenance(document)
        self.assertEqual(len(compiled["eligibilityInput"]["records"]), 1)

        forbidden = {"score", "weight", "rank", "probability", "popularity"}
        def walk(value: object) -> None:
            if isinstance(value, dict):
                self.assertTrue(forbidden.isdisjoint(value))
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(compiled)

    def test_compilation_is_deterministic_across_source_record_and_assertion_order(self) -> None:
        document = self.document()
        document["sources"].append(
            {
                "id": "manual-review-1",
                "url": "https://example.org/review",
                "kind": "manual_review",
            }
        )
        document["records"][0]["scope_assertions"].append(
            {
                "scope": "cybersecurity",
                "source_id": "manual-review-1",
            }
        )
        second = {
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
                    "source_id": "catalog-pentest-v1",
                }
            ],
        }
        document["records"].append(second)

        reversed_document = copy.deepcopy(document)
        reversed_document["sources"].reverse()
        reversed_document["records"].reverse()
        for record in reversed_document["records"]:
            record["scope_assertions"].reverse()

        self.assertEqual(
            compile_provenance(document),
            compile_provenance(reversed_document),
        )


if __name__ == "__main__":
    unittest.main()
