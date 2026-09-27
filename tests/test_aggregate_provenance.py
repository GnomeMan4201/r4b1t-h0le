from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from tools.aggregate_provenance import (
    AGGREGATE_SCHEMA,
    aggregate_provenance,
    write_aggregate,
)
from tools.compile_eligibility import compile_document
from tools.corpus_provenance import PROVENANCE_SCHEMA


class ProvenanceAggregationTests(unittest.TestCase):
    def source(self, source_id: str) -> dict[str, str]:
        return {
            "id": source_id,
            "url": f"https://example.org/{source_id}",
            "kind": "curated_catalog",
            "revision": f"{source_id}-rev",
            "path": "README.md",
            "sha256": "sha256:" + ("a" if source_id.endswith("1") else "b") * 64,
        }

    def record(
        self,
        *,
        url: str = "https://github.com/projectdiscovery/nuclei",
        source_id: str = "catalog-1",
        resource_type: str = "repository",
        basis: dict[str, str] | None = None,
    ) -> dict[str, object]:
        if basis is None:
            basis = {
                "kind": "structural_rule",
                "rule_id": "github-repository-v1",
            }
        return {
            "url": url,
            "resource_type": {
                "value": resource_type,
                "basis": basis,
            },
            "scope_assertions": [
                {
                    "scope": "cybersecurity",
                    "source_id": source_id,
                }
            ],
        }

    def document(
        self,
        source_id: str,
        *,
        url: str = "https://github.com/projectdiscovery/nuclei",
        resource_type: str = "repository",
        basis: dict[str, str] | None = None,
    ) -> dict[str, object]:
        return {
            "schema": PROVENANCE_SCHEMA,
            "corpus": "r4b1t-cybersecurity-v1",
            "sources": [self.source(source_id)],
            "records": [
                self.record(
                    url=url,
                    source_id=source_id,
                    resource_type=resource_type,
                    basis=basis,
                )
            ],
        }

    def test_schema_is_versioned(self) -> None:
        self.assertEqual(
            AGGREGATE_SCHEMA,
            "r4b1t-corpus-provenance-aggregate-v1",
        )

    def test_duplicate_resource_merges_scope_evidence_without_duplicate_record(self) -> None:
        aggregate = aggregate_provenance(
            [
                self.document("catalog-1"),
                self.document("catalog-2"),
            ]
        )

        self.assertEqual(aggregate["counts"]["inputDocuments"], 2)
        self.assertEqual(aggregate["counts"]["rawRecords"], 2)
        self.assertEqual(aggregate["counts"]["uniqueRecords"], 1)
        self.assertEqual(aggregate["counts"]["mergedDuplicates"], 1)
        self.assertEqual(aggregate["counts"]["sources"], 2)

        record = aggregate["provenance"]["records"][0]
        self.assertEqual(
            record["scope_assertions"],
            [
                {"scope": "cybersecurity", "source_id": "catalog-1"},
                {"scope": "cybersecurity", "source_id": "catalog-2"},
            ],
        )
        self.assertEqual(len(aggregate["eligibilityInput"]["records"]), 1)

    def test_repeated_identical_source_registry_entry_is_stored_once(self) -> None:
        left = self.document("catalog-1")
        right = copy.deepcopy(left)
        right["records"] = [
            self.record(
                url="https://github.com/owner/second",
                source_id="catalog-1",
            )
        ]
        aggregate = aggregate_provenance([left, right])
        self.assertEqual(aggregate["counts"]["sources"], 1)
        self.assertEqual(len(aggregate["provenance"]["sources"]), 1)

    def test_conflicting_source_registry_identity_fails_closed(self) -> None:
        left = self.document("catalog-1")
        right = copy.deepcopy(left)
        right["sources"][0]["url"] = "https://different.example/catalog"
        with self.assertRaisesRegex(ValueError, "conflicting source"):
            aggregate_provenance([left, right])

    def test_agreeing_source_assertion_type_claims_merge_type_evidence(self) -> None:
        left = self.document(
            "catalog-1",
            url="https://security.example/tool",
            resource_type="security_tool",
            basis={
                "kind": "source_assertion",
                "source_id": "catalog-1",
            },
        )
        right = self.document(
            "catalog-2",
            url="https://security.example/tool",
            resource_type="security_tool",
            basis={
                "kind": "source_assertion",
                "source_id": "catalog-2",
            },
        )
        aggregate = aggregate_provenance([left, right])
        record = aggregate["provenance"]["records"][0]

        self.assertEqual(record["resource_type"]["value"], "security_tool")
        self.assertEqual(
            record["resource_type"]["basis"],
            {
                "kind": "source_assertions",
                "source_ids": ["catalog-1", "catalog-2"],
            },
        )
        self.assertEqual(len(aggregate["eligibilityInput"]["records"]), 1)

    def test_conflicting_resource_type_claim_fails_closed(self) -> None:
        left = self.document("catalog-1")
        right = self.document(
            "catalog-2",
            resource_type="security_tool",
            basis={
                "kind": "source_assertion",
                "source_id": "catalog-2",
            },
        )
        with self.assertRaisesRegex(ValueError, "conflicting resource type"):
            aggregate_provenance([left, right])

    def test_mixed_corpus_ids_fail_closed(self) -> None:
        left = self.document("catalog-1")
        right = self.document("catalog-2")
        right["corpus"] = "other-corpus"
        with self.assertRaisesRegex(ValueError, "same corpus"):
            aggregate_provenance([left, right])

    def test_aggregate_is_deterministic_across_document_order(self) -> None:
        docs = [
            self.document("catalog-1"),
            self.document(
                "catalog-2",
                url="https://github.com/owner/second",
            ),
        ]
        self.assertEqual(
            aggregate_provenance(docs),
            aggregate_provenance(list(reversed(docs))),
        )

    def test_downstream_eligibility_receives_no_duplicate_selection_weight(self) -> None:
        aggregate = aggregate_provenance(
            [
                self.document("catalog-1"),
                self.document("catalog-2"),
            ]
        )
        eligibility = compile_document(aggregate["eligibilityInput"])
        self.assertEqual(len(eligibility["eligible"]), 1)

        forbidden = {
            "score",
            "weight",
            "rank",
            "probability",
            "popularity",
            "recommendation",
        }

        def walk(value: object) -> None:
            if isinstance(value, dict):
                self.assertTrue(forbidden.isdisjoint(value))
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(aggregate)

    def test_writer_emits_aggregate_review_artifacts(self) -> None:
        aggregate = aggregate_provenance(
            [
                self.document("catalog-1"),
                self.document("catalog-2"),
            ]
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_aggregate(aggregate, root)
            self.assertEqual(
                sorted(path.name for path in root.iterdir()),
                [
                    "compiled.json",
                    "eligibility-input.json",
                    "provenance.json",
                    "summary.json",
                ],
            )
            summary = json.loads(
                (root / "summary.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                summary["aggregateArtifactDigest"],
                aggregate["compiled"]["artifactDigest"],
            )
            self.assertEqual(summary["counts"], aggregate["counts"])


if __name__ == "__main__":
    unittest.main()
