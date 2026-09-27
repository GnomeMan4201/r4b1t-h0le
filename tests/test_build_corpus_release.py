from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from tools.build_corpus_release import (
    RELEASE_SCHEMA,
    RESOURCES_SCHEMA,
    build_release,
    write_release,
)
from tools.compile_eligibility import (
    OUTPUT_SCHEMA,
    PROTOCOL_POLICY,
    RULESET,
    sha256_identifier,
)
from tools.corpus_provenance import COMPILED_SCHEMA


class CorpusReleaseTests(unittest.TestCase):
    def compiled_provenance(self) -> dict[str, object]:
        semantic_records = [
            {
                "url": "https://a.example/docs",
                "resource_type": {
                    "value": "reference",
                    "basis": {
                        "kind": "source_assertion",
                        "source_id": "catalog-1",
                    },
                },
                "scope_assertions": [
                    {
                        "scope": "cybersecurity",
                        "source_id": "catalog-1",
                    }
                ],
            },
            {
                "url": "https://b.example/tool",
                "resource_type": {
                    "value": "security_tool",
                    "basis": {
                        "kind": "source_assertion",
                        "source_id": "catalog-1",
                    },
                },
                "scope_assertions": [
                    {
                        "scope": "cybersecurity",
                        "source_id": "catalog-1",
                    }
                ],
            },
        ]
        records = [
            {
                "record_id": sha256_identifier(record),
                **copy.deepcopy(record),
            }
            for record in semantic_records
        ]
        records.sort(key=lambda record: record["record_id"])

        payload = {
            "schema": COMPILED_SCHEMA,
            "corpus": "r4b1t-cybersecurity-v1",
            "sources": [
                {
                    "id": "catalog-1",
                    "url": "https://example.org/catalog",
                    "kind": "curated_catalog",
                }
            ],
            "records": records,
        }
        artifact_digest = sha256_identifier(payload)
        eligibility_records = [
            {
                "url": record["url"],
                "resource_type": record["resource_type"]["value"],
                "source": f"provenance:{record['record_id']}",
            }
            for record in records
        ]
        eligibility_records.sort(
            key=lambda record: (
                record["url"],
                record["resource_type"],
                record["source"],
            )
        )
        return {
            **payload,
            "artifactDigest": artifact_digest,
            "eligibilityInput": {
                "schema": "r4b1t-eligibility-input-v1",
                "source": f"provenance:{artifact_digest}",
                "records": eligibility_records,
            },
        }

    def eligibility_output(
        self,
        compiled: dict[str, object],
    ) -> dict[str, object]:
        source_by_url = {
            record["url"]: f"provenance:{record['record_id']}"
            for record in compiled["records"]
        }
        eligible = [
            {
                "ruleset": RULESET,
                "inputUrl": "https://b.example/tool",
                "canonicalUrl": "https://b.example/tool",
                "resourceType": "security_tool",
                "decision": "ELIGIBLE",
                "reason": "CONCRETE_SECURITY_TOOL",
                "source": source_by_url["https://b.example/tool"],
            },
            {
                "ruleset": RULESET,
                "inputUrl": "https://a.example/docs",
                "canonicalUrl": "https://a.example/docs",
                "resourceType": "reference",
                "decision": "ELIGIBLE",
                "reason": "CONCRETE_TECHNICAL_DOCUMENT",
                "source": source_by_url["https://a.example/docs"],
            },
        ]
        excluded = [
            {
                "ruleset": RULESET,
                "inputUrl": "http://hidden.onion/",
                "canonicalUrl": None,
                "resourceType": "reference",
                "decision": "EXCLUDED",
                "reason": "PROTOCOL_POLICY_ONION_EXCLUDED",
                "source": source_by_url["https://a.example/docs"],
            }
        ]
        deterministic_payload = {
            "schema": OUTPUT_SCHEMA,
            "ruleset": RULESET,
            "protocolPolicy": PROTOCOL_POLICY,
            "eligible": eligible,
            "excluded": excluded,
        }
        manifest = {
            "schema": "r4b1t-eligibility-manifest-v1",
            "ruleset": RULESET,
            "protocolPolicy": dict(PROTOCOL_POLICY),
            "inputDigest": "sha256:" + "d" * 64,
            "outputDigest": sha256_identifier(deterministic_payload),
            "counts": {
                "raw": 3,
                "eligible": 2,
                "excluded": 1,
                "duplicates": 0,
            },
        }
        return {
            "schema": OUTPUT_SCHEMA,
            "manifest": manifest,
            "eligible": eligible,
            "excluded": excluded,
        }

    def aggregate_summary(self, compiled: dict[str, object]) -> dict[str, object]:
        return {
            "schema": "r4b1t-corpus-provenance-aggregate-v1",
            "corpus": "r4b1t-cybersecurity-v1",
            "inputArtifactDigests": ["sha256:" + "e" * 64],
            "aggregateArtifactDigest": compiled["artifactDigest"],
            "counts": {
                "inputDocuments": 1,
                "rawRecords": 2,
                "uniqueRecords": 2,
                "mergedDuplicates": 0,
                "sources": 1,
            },
        }

    def build(self) -> dict[str, object]:
        compiled = self.compiled_provenance()
        return build_release(
            compiled,
            self.aggregate_summary(compiled),
            self.eligibility_output(compiled),
            release_id="typed-candidate-v0.1",
        )

    def test_contract_identifiers_and_candidate_authority_are_fixed(self) -> None:
        release = self.build()
        self.assertEqual(RELEASE_SCHEMA, "r4b1t-corpus-release-v1")
        self.assertEqual(RESOURCES_SCHEMA, "r4b1t-corpus-resources-v1")
        self.assertEqual(release["manifest"]["status"], "candidate")
        self.assertFalse(release["manifest"]["selection_authority"])

    def test_release_uses_only_canonical_eligible_records_in_lexical_order(self) -> None:
        release = self.build()
        self.assertEqual(
            release["urls"],
            "https://a.example/docs\nhttps://b.example/tool\n",
        )
        self.assertNotIn("onion", release["urls"])
        self.assertEqual(
            [item["url"] for item in release["resources"]["resources"]],
            ["https://a.example/docs", "https://b.example/tool"],
        )

    def test_resource_metadata_preserves_type_provenance_and_eligibility_reason(self) -> None:
        compiled = self.compiled_provenance()
        output = self.eligibility_output(compiled)
        release = build_release(
            compiled,
            self.aggregate_summary(compiled),
            output,
            release_id="typed-candidate-v0.1",
        )
        first = release["resources"]["resources"][0]
        expected = next(
            record
            for record in output["eligible"]
            if record["canonicalUrl"] == "https://a.example/docs"
        )
        self.assertEqual(first["resource_type"], "reference")
        self.assertEqual(first["provenance"], expected["source"])
        self.assertEqual(
            first["eligibility_reason"],
            "CONCRETE_TECHNICAL_DOCUMENT",
        )

    def test_manifest_binds_exact_release_bytes_and_counts(self) -> None:
        release = self.build()
        resources_bytes = (
            json.dumps(
                release["resources"],
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n"
        ).encode("utf-8")
        self.assertEqual(
            release["manifest"]["urls_digest"],
            "sha256:" + hashlib.sha256(release["urls"].encode("utf-8")).hexdigest(),
        )
        self.assertEqual(
            release["manifest"]["resources_digest"],
            "sha256:" + hashlib.sha256(resources_bytes).hexdigest(),
        )
        self.assertEqual(
            release["manifest"]["counts"],
            {
                "resources": 2,
                "unique_hosts": 2,
                "resource_types": {
                    "reference": 1,
                    "security_tool": 1,
                },
            },
        )

    def test_release_is_deterministic_when_eligible_input_order_changes(self) -> None:
        compiled = self.compiled_provenance()
        output = self.eligibility_output(compiled)
        reversed_output = copy.deepcopy(output)
        reversed_output["eligible"].reverse()

        payload = {
            "schema": OUTPUT_SCHEMA,
            "ruleset": RULESET,
            "protocolPolicy": PROTOCOL_POLICY,
            "eligible": reversed_output["eligible"],
            "excluded": reversed_output["excluded"],
        }
        reversed_output["manifest"]["outputDigest"] = sha256_identifier(payload)

        left = build_release(
            compiled,
            self.aggregate_summary(compiled),
            output,
            release_id="typed-candidate-v0.1",
        )
        right = build_release(
            compiled,
            self.aggregate_summary(compiled),
            reversed_output,
            release_id="typed-candidate-v0.1",
        )
        self.assertEqual(left["urls"], right["urls"])
        self.assertEqual(left["resources"], right["resources"])
        self.assertEqual(
            left["manifest"]["urls_digest"],
            right["manifest"]["urls_digest"],
        )
        self.assertEqual(
            left["manifest"]["resources_digest"],
            right["manifest"]["resources_digest"],
        )

    def test_aggregate_digest_mismatch_fails_closed(self) -> None:
        compiled = self.compiled_provenance()
        summary = self.aggregate_summary(compiled)
        summary["aggregateArtifactDigest"] = "sha256:" + "0" * 64
        with self.assertRaisesRegex(ValueError, "aggregate artifact digest"):
            build_release(
                compiled,
                summary,
                self.eligibility_output(compiled),
                release_id="typed-candidate-v0.1",
            )

    def test_eligible_provenance_reference_must_exist_in_compiled_artifact(self) -> None:
        compiled = self.compiled_provenance()
        output = self.eligibility_output(compiled)
        output["eligible"][0]["source"] = "provenance:sha256:" + "0" * 64
        payload = {
            "schema": OUTPUT_SCHEMA,
            "ruleset": RULESET,
            "protocolPolicy": PROTOCOL_POLICY,
            "eligible": output["eligible"],
            "excluded": output["excluded"],
        }
        output["manifest"]["outputDigest"] = sha256_identifier(payload)
        with self.assertRaisesRegex(ValueError, "unknown provenance"):
            build_release(
                compiled,
                self.aggregate_summary(compiled),
                output,
                release_id="typed-candidate-v0.1",
            )

    def test_output_contains_no_ranking_or_selection_weight(self) -> None:
        release = self.build()
        forbidden = {
            "score",
            "rank",
            "weight",
            "probability",
            "popularity",
            "recommendation",
        }

        def walk(value: object) -> None:
            if isinstance(value, dict):
                self.assertTrue(forbidden.isdisjoint(value.keys()))
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(release)

    def test_writer_emits_exact_three_release_files(self) -> None:
        release = self.build()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_release(release, root)
            self.assertEqual(
                sorted(path.name for path in root.iterdir()),
                ["manifest.json", "resources.json", "urls.txt"],
            )
            self.assertEqual(
                (root / "urls.txt").read_text(encoding="utf-8"),
                release["urls"],
            )


if __name__ == "__main__":
    unittest.main()
