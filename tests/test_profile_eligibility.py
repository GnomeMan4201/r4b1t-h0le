from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools.profile_eligibility import (
    PROFILE_SCHEMA,
    profile_lines,
    render_markdown,
    write_profile,
)


class EligibilityProfileTests(unittest.TestCase):
    def fixture_lines(self) -> list[str]:
        return [
            "https://github.com/",
            "https://github.com/projectdiscovery/nuclei",
            "https://GITHUB.com:443/projectdiscovery/nuclei/?utm_source=test",
            "https://github.com/owner/repo/issues/123",
            "https://research.example.org/kernel",
            "http://exampleexampleexampleexampleexampleexample.onion/a",
        ]

    def test_profile_aggregates_real_compiler_decisions(self) -> None:
        profile = profile_lines(self.fixture_lines(), source="fixture.txt", sample_limit=3)

        self.assertEqual(profile["schema"], PROFILE_SCHEMA)
        self.assertEqual(profile["ruleset"], "eligibility-v1")
        self.assertEqual(profile["counts"]["raw"], 6)
        self.assertEqual(profile["counts"]["eligible"], 1)
        self.assertEqual(profile["counts"]["excluded"], 5)
        self.assertEqual(profile["counts"]["duplicates"], 1)

        self.assertEqual(
            profile["reasonCounts"],
            {
                "CANONICAL_DUPLICATE": 1,
                "GENERIC_HOST_ROOT": 1,
                "ISSUE_RESOURCE_UNQUALIFIED": 1,
                "PROTOCOL_POLICY_ONION_EXCLUDED": 1,
                "RESOURCE_TYPE_UNQUALIFIED": 1,
            },
        )

    def test_profile_is_semantically_deterministic_across_input_order(self) -> None:
        left = profile_lines(self.fixture_lines(), source="fixture.txt", sample_limit=2)
        right = profile_lines(list(reversed(self.fixture_lines())), source="fixture.txt", sample_limit=2)
        self.assertEqual(left, right)

    def test_profile_preserves_bounded_deterministic_examples(self) -> None:
        profile = profile_lines(
            [
                "https://z.example/a",
                "https://a.example/a",
                "https://m.example/a",
            ],
            source="fixture.txt",
            sample_limit=2,
        )
        self.assertEqual(
            profile["examplesByReason"]["RESOURCE_TYPE_UNQUALIFIED"],
            ["https://a.example/a", "https://m.example/a"],
        )

    def test_markdown_surfaces_decision_rates_reasons_and_top_hosts(self) -> None:
        profile = profile_lines(self.fixture_lines(), source="fixture.txt", sample_limit=2)
        markdown = render_markdown(profile)
        self.assertIn("# R4B1T Eligibility Corpus Audit", markdown)
        self.assertIn("Eligible:", markdown)
        self.assertIn("RESOURCE_TYPE_UNQUALIFIED", markdown)
        self.assertIn("github.com", markdown)
        self.assertNotIn("interesting", markdown.lower())

    def test_writer_emits_json_and_markdown_without_mutating_compiler_artifacts(self) -> None:
        profile = profile_lines(self.fixture_lines(), source="fixture.txt", sample_limit=2)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            json_path = root / "eligibility-profile.json"
            markdown_path = root / "eligibility-profile.md"
            write_profile(profile, json_path, markdown_path)

            self.assertEqual(json.loads(json_path.read_text(encoding="utf-8")), profile)
            self.assertEqual(markdown_path.read_text(encoding="utf-8"), render_markdown(profile))
            self.assertEqual(
                sorted(path.name for path in root.iterdir()),
                ["eligibility-profile.json", "eligibility-profile.md"],
            )


    def test_cli_runs_from_repository_root_like_corpus_quality_ci(self) -> None:
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            corpus = work / "urls.txt"
            output_json = work / "profile.json"
            output_markdown = work / "profile.md"
            corpus.write_text(
                "https://github.com/projectdiscovery/nuclei\nhttps://github.com/\n",
                encoding="utf-8",
            )
            completed = subprocess.run(
                [
                    sys.executable,
                    str(root / "tools" / "profile_eligibility.py"),
                    "--input",
                    str(corpus),
                    "--json",
                    str(output_json),
                    "--markdown",
                    str(output_markdown),
                ],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr + completed.stdout)
            self.assertTrue(output_json.is_file())
            self.assertTrue(output_markdown.is_file())


if __name__ == "__main__":
    unittest.main()
