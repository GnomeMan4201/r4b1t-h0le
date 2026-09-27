from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from tools.corpus_provenance import compile_provenance
from tools.source_catalog import (
    COMPILED_SCHEMA,
    EXTRACTOR,
    MANIFEST_SCHEMA,
    compile_catalog,
    snapshot_digest,
    write_compiled,
)


class SourceCatalogTests(unittest.TestCase):
    def snapshot(self) -> str:
        return """# Awesome Security

[![badge](https://img.example/badge.svg)](https://ci.example/build)

## Tools

- [Nuclei](https://github.com/projectdiscovery/nuclei)
- [Nuclei duplicate](https://github.com/projectdiscovery/nuclei)
- [Vendor tool](https://security.example/tool)
- <https://github.com/owner/wiki-repo/wiki/Protocol>

### Research

- [Writeup](https://research.example/kernel)

```text
[not a real entry](https://github.com/ignored/code-example)
```
"""

    def manifest(self, snapshot: str | None = None) -> dict[str, object]:
        snapshot = self.snapshot() if snapshot is None else snapshot
        return {
            "schema": MANIFEST_SCHEMA,
            "catalog_id": "awesome-security-test",
            "corpus": "r4b1t-cybersecurity-v1",
            "source": {
                "url": "https://github.com/example/awesome-security",
                "revision": "0123456789abcdef",
                "path": "README.md",
                "sha256": snapshot_digest(snapshot),
            },
            "snapshot_path": "corpus/sources/awesome-security-test.md",
            "scope": "cybersecurity",
            "extractor": EXTRACTOR,
        }

    def test_contract_identifiers_are_versioned(self) -> None:
        self.assertEqual(MANIFEST_SCHEMA, "r4b1t-source-catalog-v1")
        self.assertEqual(COMPILED_SCHEMA, "r4b1t-source-catalog-compiled-v1")
        self.assertEqual(EXTRACTOR, "markdown-links-v1")

        root = Path(__file__).resolve().parents[1]
        schema = json.loads(
            (root / "schemas" / "source-catalog-v1.schema.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(schema["properties"]["schema"]["const"], MANIFEST_SCHEMA)

    def test_snapshot_digest_is_bound_and_mismatch_fails_closed(self) -> None:
        manifest = self.manifest()
        compiled = compile_catalog(manifest, self.snapshot())
        self.assertEqual(compiled["snapshotDigest"], manifest["source"]["sha256"])

        with self.assertRaisesRegex(ValueError, "snapshot digest"):
            compile_catalog(manifest, self.snapshot() + "\nchanged\n")

    def test_extractor_ignores_badges_code_images_and_pre_heading_links(self) -> None:
        compiled = compile_catalog(self.manifest(), self.snapshot())
        urls = [candidate["url"] for candidate in compiled["candidates"]]

        self.assertNotIn("https://ci.example/build", urls)
        self.assertNotIn("https://img.example/badge.svg", urls)
        self.assertNotIn("https://github.com/ignored/code-example", urls)
        self.assertIn("https://github.com/projectdiscovery/nuclei", urls)

    def test_duplicate_catalog_links_produce_one_candidate(self) -> None:
        compiled = compile_catalog(self.manifest(), self.snapshot())
        matches = [
            candidate
            for candidate in compiled["candidates"]
            if candidate["url"] == "https://github.com/projectdiscovery/nuclei"
        ]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["occurrences"], 2)

    def test_structurally_provable_resources_are_projected_to_typed_provenance(self) -> None:
        compiled = compile_catalog(self.manifest(), self.snapshot())
        provenance = compiled["provenance"]
        verified = compile_provenance(provenance)
        self.assertEqual(
            provenance["sources"],
            [
                {
                    "id": "awesome-security-test",
                    "url": "https://github.com/example/awesome-security",
                    "kind": "curated_catalog",
                    "revision": "0123456789abcdef",
                    "path": "README.md",
                    "sha256": self.manifest()["source"]["sha256"],
                }
            ],
        )

        by_url = {
            record["url"]: record
            for record in provenance["records"]
        }
        nuclei = by_url["https://github.com/projectdiscovery/nuclei"]
        self.assertEqual(nuclei["resource_type"]["value"], "repository")
        self.assertEqual(
            nuclei["resource_type"]["basis"],
            {
                "kind": "structural_rule",
                "rule_id": "github-repository-v1",
            },
        )
        self.assertEqual(
            nuclei["scope_assertions"],
            [
                {
                    "scope": "cybersecurity",
                    "source_id": "awesome-security-test",
                }
            ],
        )
        self.assertEqual(len(verified["eligibilityInput"]["records"]), len(provenance["records"]))

    def test_reviewed_heading_type_assertions_promote_non_structural_resources(self) -> None:
        manifest = self.manifest()
        manifest["type_assertions"] = [
            {"heading": "Tools", "resource_type": "security_tool"},
            {"heading": "Research", "resource_type": "research"},
        ]
        compiled = compile_catalog(manifest, self.snapshot())
        by_url = {
            record["url"]: record
            for record in compiled["provenance"]["records"]
        }

        vendor = by_url["https://security.example/tool"]
        self.assertEqual(vendor["resource_type"]["value"], "security_tool")
        self.assertEqual(
            vendor["resource_type"]["basis"],
            {
                "kind": "source_assertion",
                "source_id": "awesome-security-test",
            },
        )

        writeup = by_url["https://research.example/kernel"]
        self.assertEqual(writeup["resource_type"]["value"], "research")
        self.assertEqual(compiled["counts"]["typedSourceAssertion"], 2)
        self.assertEqual(compiled["counts"]["typedStructural"], 2)
        self.assertEqual(compiled["counts"]["untyped"], 0)

    def test_heading_assertions_do_not_type_unresolved_github_routes(self) -> None:
        snapshot = """# Awesome Security

## Tools

- [Vendor tool](https://security.example/tool)
- [GitHub profile](https://github.com/niftylettuce)
- [GitHub topic](https://github.com/topics/security)
- [GitHub README](https://github.com/owner/repo/blob/main/README.md)
"""
        manifest = self.manifest(snapshot)
        manifest["type_assertions"] = [
            {"heading": "Tools", "resource_type": "security_tool"},
        ]
        compiled = compile_catalog(manifest, snapshot)

        typed_urls = {
            record["url"]
            for record in compiled["provenance"]["records"]
        }
        untyped_urls = {
            record["url"]
            for record in compiled["untyped"]
        }

        self.assertIn("https://security.example/tool", typed_urls)
        self.assertIn("https://github.com/niftylettuce", untyped_urls)
        self.assertIn("https://github.com/topics/security", untyped_urls)
        self.assertIn(
            "https://github.com/owner/repo/blob/main/README.md",
            untyped_urls,
        )

    def test_heading_assertions_never_override_structural_type(self) -> None:
        manifest = self.manifest()
        manifest["type_assertions"] = [
            {"heading": "Tools", "resource_type": "reference"},
        ]
        compiled = compile_catalog(manifest, self.snapshot())
        by_url = {
            record["url"]: record
            for record in compiled["provenance"]["records"]
        }
        nuclei = by_url["https://github.com/projectdiscovery/nuclei"]
        self.assertEqual(nuclei["resource_type"]["value"], "repository")
        self.assertEqual(
            nuclei["resource_type"]["basis"]["kind"],
            "structural_rule",
        )
        vendor = by_url["https://security.example/tool"]
        self.assertEqual(vendor["resource_type"]["value"], "reference")

    def test_unknown_reviewed_heading_fails_closed(self) -> None:
        manifest = self.manifest()
        manifest["type_assertions"] = [
            {"heading": "tools", "resource_type": "security_tool"},
        ]
        with self.assertRaisesRegex(ValueError, "heading not found"):
            compile_catalog(manifest, self.snapshot())

    def test_conflicting_heading_type_assertions_fail_closed(self) -> None:
        manifest = self.manifest()
        manifest["type_assertions"] = [
            {"heading": "Tools", "resource_type": "security_tool"},
            {"heading": "Tools", "resource_type": "reference"},
        ]
        with self.assertRaisesRegex(ValueError, "conflicting heading"):
            compile_catalog(manifest, self.snapshot())

    def test_untyped_web_resources_remain_review_candidates(self) -> None:
        compiled = compile_catalog(self.manifest(), self.snapshot())
        untyped = {record["url"] for record in compiled["untyped"]}

        self.assertIn("https://security.example/tool", untyped)
        self.assertIn("https://research.example/kernel", untyped)
        self.assertNotIn(
            "https://security.example/tool",
            {record["url"] for record in compiled["provenance"]["records"]},
        )

    def test_evidence_preserves_heading_label_and_occurrence_count(self) -> None:
        compiled = compile_catalog(self.manifest(), self.snapshot())
        by_url = {record["url"]: record for record in compiled["candidates"]}
        record = by_url["https://research.example/kernel"]
        self.assertEqual(record["heading"], "Research")
        self.assertEqual(record["label"], "Writeup")
        self.assertEqual(record["occurrences"], 1)

    def test_output_has_no_selection_or_ranking_authority(self) -> None:
        compiled = compile_catalog(self.manifest(), self.snapshot())
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
                self.assertTrue(forbidden.isdisjoint(value.keys()))
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(compiled)

    def test_writer_emits_deterministic_review_artifacts(self) -> None:
        compiled = compile_catalog(self.manifest(), self.snapshot())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_compiled(compiled, root)
            self.assertEqual(
                sorted(path.name for path in root.iterdir()),
                [
                    "candidates.json",
                    "catalog.json",
                    "provenance.json",
                    "summary.json",
                    "untyped.json",
                ],
            )
            self.assertEqual(
                json.loads((root / "catalog.json").read_text(encoding="utf-8")),
                compiled["manifest"],
            )
            summary = json.loads(
                (root / "summary.json").read_text(encoding="utf-8")
            )
            self.assertEqual(summary["schema"], COMPILED_SCHEMA)
            self.assertEqual(summary["snapshotDigest"], compiled["snapshotDigest"])
            self.assertEqual(summary["counts"], compiled["counts"])


if __name__ == "__main__":
    unittest.main()
