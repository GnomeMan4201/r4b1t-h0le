from __future__ import annotations

import inspect
import json
import tempfile
import unittest
from pathlib import Path

from tools.compile_eligibility import (
    INPUT_SCHEMA,
    OUTPUT_SCHEMA,
    PROTOCOL_POLICY,
    RULESET,
    canonicalize_url,
    compile_document,
    verify_output,
    write_output,
)


class EligibilityCompilerTests(unittest.TestCase):
    def document(self, records: list[dict[str, object]]) -> dict[str, object]:
        return {"schema": INPUT_SCHEMA, "source": "unit-fixture", "records": records}

    def test_contract_identifiers_are_versioned_and_protocol_policy_is_explicit(self) -> None:
        self.assertEqual(INPUT_SCHEMA, "r4b1t-eligibility-input-v1")
        self.assertEqual(OUTPUT_SCHEMA, "r4b1t-eligibility-output-v1")
        self.assertEqual(RULESET, "eligibility-v1")
        self.assertEqual(PROTOCOL_POLICY, {"version": "1", "excludeOnion": True})

    def test_json_schemas_publish_the_same_versioned_contract(self) -> None:
        root = Path(__file__).resolve().parents[1]
        input_schema = json.loads((root / "schemas" / "eligibility-input-v1.schema.json").read_text(encoding="utf-8"))
        output_schema = json.loads((root / "schemas" / "eligibility-output-v1.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(input_schema["properties"]["schema"]["const"], INPUT_SCHEMA)
        self.assertEqual(output_schema["properties"]["schema"]["const"], OUTPUT_SCHEMA)
        self.assertEqual(output_schema["$defs"]["manifest"]["properties"]["ruleset"]["const"], RULESET)
        reason_enum = set(output_schema["$defs"]["reason"]["enum"])
        self.assertIn("CANONICAL_DUPLICATE", reason_enum)
        self.assertIn("CONFLICTING_RESOURCE_METADATA", reason_enum)

    def test_canonicalization_removes_only_defined_noise(self) -> None:
        self.assertEqual(
            canonicalize_url("HTTPS://GitHub.COM:443/projectdiscovery/nuclei/?utm_source=x&view=full#readme"),
            "https://github.com/projectdiscovery/nuclei?view=full",
        )
        self.assertEqual(canonicalize_url("https://BÜCHER.example./docs/?id=123"), "https://xn--bcher-kva.example/docs?id=123")

    def test_generic_host_roots_are_not_selectable_resources(self) -> None:
        output = compile_document(self.document([{"url": "https://github.com/"}, {"url": "https://slideshare.net/"}]))
        self.assertEqual(output["eligible"], [])
        self.assertEqual([record["reason"] for record in output["excluded"]], ["GENERIC_HOST_ROOT", "GENERIC_HOST_ROOT"])

    def test_repository_root_is_an_eligible_atomic_resource(self) -> None:
        output = compile_document(self.document([{"url": "https://github.com/projectdiscovery/nuclei"}]))
        record = output["eligible"][0]
        self.assertEqual(record["canonicalUrl"], "https://github.com/projectdiscovery/nuclei")
        self.assertEqual(record["resourceType"], "repository")
        self.assertEqual(record["reason"], "CONCRETE_REPOSITORY")

    def test_github_source_file_requires_explicit_standalone_artifact_classification(self) -> None:
        unqualified = compile_document(self.document([{"url": "https://github.com/owner/repo/blob/main/exploit.py"}]))
        self.assertEqual(unqualified["eligible"], [])
        self.assertEqual(unqualified["excluded"][0]["reason"], "RESOURCE_TYPE_UNQUALIFIED")
        qualified = compile_document(self.document([{"url": "https://github.com/owner/repo/blob/main/exploit.py", "resource_type": "source_file"}]))
        self.assertEqual(qualified["eligible"][0]["reason"], "STANDALONE_TECHNICAL_ARTIFACT")

    def test_repository_admin_file_is_excluded_even_if_mislabeled_as_source_file(self) -> None:
        output = compile_document(self.document([{"url": "https://github.com/owner/repo/blob/main/LICENSE", "resource_type": "source_file"}]))
        self.assertEqual(output["eligible"], [])
        self.assertEqual(output["excluded"][0]["reason"], "REPOSITORY_ADMIN_ARTIFACT")

    def test_issue_requires_explicit_substantive_classification(self) -> None:
        unqualified = compile_document(self.document([{"url": "https://github.com/owner/repo/issues/123"}]))
        self.assertEqual(unqualified["excluded"][0]["reason"], "ISSUE_RESOURCE_UNQUALIFIED")
        qualified = compile_document(self.document([{"url": "https://github.com/owner/repo/issues/123", "resource_type": "writeup"}]))
        self.assertEqual(qualified["eligible"][0]["reason"], "SUBSTANTIVE_ISSUE_RESOURCE")

    def test_pull_request_is_excluded_by_v1(self) -> None:
        output = compile_document(self.document([{"url": "https://github.com/owner/repo/pull/42", "resource_type": "writeup"}]))
        self.assertEqual(output["eligible"], [])
        self.assertEqual(output["excluded"][0]["reason"], "PULL_REQUEST_UNQUALIFIED")

    def test_protocol_policy_excludes_onion_and_unsupported_schemes(self) -> None:
        output = compile_document(self.document([
            {"url": "http://exampleexampleexampleexampleexampleexample.onion/a", "resource_type": "research"},
            {"url": "ftp://example.org/tool", "resource_type": "security_tool"},
        ]))
        self.assertEqual(output["eligible"], [])
        self.assertEqual({record["reason"] for record in output["excluded"]}, {"PROTOCOL_POLICY_ONION_EXCLUDED", "UNSUPPORTED_PROTOCOL"})

    def test_canonical_duplicates_create_one_selectable_resource(self) -> None:
        output = compile_document(self.document([
            {"url": "https://github.com/projectdiscovery/nuclei/"},
            {"url": "https://GITHUB.com:443/projectdiscovery/nuclei?utm_source=test"},
        ]))
        self.assertEqual(len(output["eligible"]), 1)
        self.assertEqual(output["manifest"]["counts"]["duplicates"], 1)
        self.assertEqual(output["manifest"]["counts"]["eligible"], 1)
        self.assertEqual(output["manifest"]["counts"]["excluded"], 1)
        self.assertEqual(output["excluded"][0]["reason"], "CANONICAL_DUPLICATE")

    def test_conflicting_metadata_for_one_canonical_resource_fails_closed(self) -> None:
        output = compile_document(self.document([
            {"url": "https://research.example.org/item", "resource_type": "research"},
            {"url": "https://research.example.org/item/", "resource_type": "security_tool"},
        ]))
        self.assertEqual(output["eligible"], [])
        self.assertEqual({record["reason"] for record in output["excluded"]}, {"CONFLICTING_RESOURCE_METADATA"})

    def test_output_and_digests_are_deterministic_across_input_record_order(self) -> None:
        records = [
            {"url": "https://github.com/projectdiscovery/nuclei"},
            {"url": "https://research.example.org/kernel", "resource_type": "research"},
            {"url": "https://github.com/"},
        ]
        left = compile_document(self.document(records))
        right = compile_document(self.document(list(reversed(records))))
        self.assertEqual(left, right)
        self.assertTrue(left["manifest"]["inputDigest"].startswith("sha256:"))
        self.assertTrue(left["manifest"]["outputDigest"].startswith("sha256:"))

    def test_output_contains_no_selection_weight_or_ranking_authority(self) -> None:
        output = compile_document(self.document([{"url": "https://github.com/projectdiscovery/nuclei"}]))
        forbidden = {"score", "weight", "rank", "probability", "interestingness"}
        def walk(value: object) -> None:
            if isinstance(value, dict):
                self.assertTrue(forbidden.isdisjoint(value.keys()))
                for child in value.values(): walk(child)
            elif isinstance(value, list):
                for child in value: walk(child)
        walk(output)

    def test_compiler_surface_has_no_history_or_session_inputs(self) -> None:
        parameter_names = set(inspect.signature(compile_document).parameters)
        self.assertTrue({"history", "session", "previous_roll", "trail"}.isdisjoint(parameter_names))

    def test_verifier_recomputes_output_digest_and_fails_closed_after_tampering(self) -> None:
        output = compile_document(self.document([{"url": "https://github.com/projectdiscovery/nuclei"}]))
        self.assertEqual(verify_output(output), output)
        output["eligible"][0]["canonicalUrl"] = "https://modified.example/replaced"
        with self.assertRaisesRegex(ValueError, "output digest"): verify_output(output)

    def test_writer_emits_three_deterministic_artifacts(self) -> None:
        output = compile_document(self.document([{"url": "https://github.com/projectdiscovery/nuclei"}, {"url": "https://github.com/"}]))
        with tempfile.TemporaryDirectory() as directory:
            out_dir = Path(directory)
            write_output(output, out_dir)
            self.assertEqual(sorted(path.name for path in out_dir.iterdir()), ["eligible.json", "excluded.json", "manifest.json"])
            manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest, output["manifest"])


if __name__ == "__main__":
    unittest.main()
