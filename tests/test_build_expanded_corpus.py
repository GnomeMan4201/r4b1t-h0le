from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from tools.build_expanded_corpus import build_expansion
from tools.compile_eligibility import sha256_identifier
from tools.reviewed_source_index import collect_index, index_bytes


class ExpandedCorpusTests(unittest.TestCase):
    def test_overlapping_sources_preserve_evidence_without_duplicate_routes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            index = collect_index(b'<a href="/research/a">A</a>', source_url="https://example.org/archive", final_url="https://example.org/archive", extractor="html-anchors-v1")
            snapshot = index_bytes(index)
            (root / "snapshot.json").write_bytes(snapshot)
            reviews = []
            for source_id in ["first", "second"]:
                review = {"schema": "r4b1t-reviewed-source-index-v1", "source_id": source_id,
                          "corpus": "r4b1t-cybersecurity-v1", "snapshot_path": "snapshot.json",
                          "snapshot_digest": sha256_identifier(snapshot), "scope": "cybersecurity",
                          "family": "independent_research", "rationale": "Reviewed technical research article.",
                          "admissions": [{"url": "https://example.org/research/a", "resource_type": "research"}]}
                (root / f"{source_id}.json").write_bytes(index_bytes(review))
                reviews.append(f"{source_id}.json")
            registry = {"schema": "r4b1t-expansion-registry-v1", "release_id": "expanded-test-v1",
                        "legacy_catalogs": [], "reviews": reviews}
            result = build_expansion(registry, root)
            self.assertEqual(result["release"]["urls"], "https://example.org/research/a\n")
            self.assertEqual(result["report"]["counts"]["resources"], 1)
            self.assertEqual(result["report"]["counts"]["sources"], 2)
            self.assertFalse(result["release"]["manifest"]["selection_authority"])
            registry["reviews"].reverse()
            self.assertEqual(result, build_expansion(registry, root))


if __name__ == "__main__":
    unittest.main()
