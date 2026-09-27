#!/usr/bin/env python3
"""Audit a flat R4B1T URL corpus against eligibility-v1 without changing ROLL.

The profiler feeds the current corpus through the deterministic compiler with no
invented resource metadata. Its output is diagnostic evidence: admission rate,
reason distribution, host concentration, and bounded examples for review.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

try:
    from tools.compile_eligibility import (
        INPUT_SCHEMA,
        RULESET,
        compile_document,
    )
except ModuleNotFoundError:
    from compile_eligibility import (
        INPUT_SCHEMA,
        RULESET,
        compile_document,
    )

PROFILE_SCHEMA = "r4b1t-eligibility-profile-v1"


def _host_for(record: dict[str, Any]) -> str:
    candidate = record.get("canonicalUrl") or record.get("inputUrl") or ""
    try:
        return (urlsplit(candidate).hostname or "[invalid]").rstrip(".").lower()
    except ValueError:
        return "[invalid]"


def profile_lines(
    lines: list[str],
    *,
    source: str,
    sample_limit: int = 8,
) -> dict[str, Any]:
    if not isinstance(source, str) or not source.strip():
        raise TypeError("profile source must be a non-empty string")
    if not isinstance(sample_limit, int) or isinstance(sample_limit, bool) or sample_limit < 0:
        raise TypeError("sample_limit must be a non-negative integer")

    urls = sorted(line.strip() for line in lines if line.strip())
    document = {
        "schema": INPUT_SCHEMA,
        "source": source.strip(),
        "records": [{"url": url} for url in urls],
    }
    compiled = compile_document(document)

    reason_counts = Counter(record["reason"] for record in compiled["excluded"])
    examples: dict[str, list[str]] = {}
    for reason in sorted(reason_counts):
        candidates = sorted(
            {record["inputUrl"] for record in compiled["excluded"] if record["reason"] == reason}
        )
        examples[reason] = candidates[:sample_limit]

    host_counts: dict[str, dict[str, int]] = defaultdict(
        lambda: {"raw": 0, "eligible": 0, "excluded": 0}
    )
    for record in compiled["eligible"]:
        host = _host_for(record)
        host_counts[host]["raw"] += 1
        host_counts[host]["eligible"] += 1
    for record in compiled["excluded"]:
        host = _host_for(record)
        host_counts[host]["raw"] += 1
        host_counts[host]["excluded"] += 1

    top_hosts = [
        {
            "host": host,
            "raw": counts["raw"],
            "eligible": counts["eligible"],
            "excluded": counts["excluded"],
        }
        for host, counts in sorted(
            host_counts.items(),
            key=lambda item: (-item[1]["raw"], item[0]),
        )[:50]
    ]

    counts = dict(compiled["manifest"]["counts"])
    counts["nonemptyLines"] = len(urls)
    counts["eligibleRate"] = round(
        counts["eligible"] / counts["raw"] if counts["raw"] else 0.0,
        8,
    )

    return {
        "schema": PROFILE_SCHEMA,
        "ruleset": RULESET,
        "source": source.strip(),
        "compilerInputDigest": compiled["manifest"]["inputDigest"],
        "compilerOutputDigest": compiled["manifest"]["outputDigest"],
        "counts": counts,
        "reasonCounts": dict(sorted(reason_counts.items())),
        "topHosts": top_hosts,
        "examplesByReason": examples,
    }


def render_markdown(profile: dict[str, Any]) -> str:
    counts = profile["counts"]
    reason_rows = "\n".join(
        f"| `{reason}` | {count} |"
        for reason, count in profile["reasonCounts"].items()
    ) or "| _none_ | 0 |"

    host_rows = "\n".join(
        f"| `{row['host']}` | {row['raw']} | {row['eligible']} | {row['excluded']} |"
        for row in profile["topHosts"][:25]
    ) or "| _none_ | 0 | 0 | 0 |"

    example_sections: list[str] = []
    for reason, examples in profile["examplesByReason"].items():
        rendered = "\n".join(f"- `{url}`" for url in examples) or "- _none_"
        example_sections.append(f"### {reason}\n\n{rendered}")
    examples_text = "\n\n".join(example_sections) or "_No exclusions._"

    return f"""# R4B1T Eligibility Corpus Audit

Ruleset: `{profile['ruleset']}`  
Source: `{profile['source']}`  
Compiler input: `{profile['compilerInputDigest']}`  
Compiler output: `{profile['compilerOutputDigest']}`

## Decision summary

- Raw records: **{counts['raw']}**
- Eligible: **{counts['eligible']}**
- Excluded: **{counts['excluded']}**
- Canonical duplicates: **{counts['duplicates']}**
- Eligible rate: **{counts['eligibleRate']:.4%}**

## Exclusion reasons

| Reason | Count |
|---|---:|
{reason_rows}

## Top hosts

| Host | Raw | Eligible | Excluded |
|---|---:|---:|---:|
{host_rows}

## Deterministic examples by exclusion reason

{examples_text}
"""


def write_profile(
    profile: dict[str, Any],
    json_path: Path,
    markdown_path: Path,
) -> None:
    for path in (json_path, markdown_path):
        path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(
        json.dumps(profile, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(render_markdown(profile), encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("urls.txt"))
    parser.add_argument("--json", type=Path, default=Path("eligibility-profile.json"))
    parser.add_argument("--markdown", type=Path, default=Path("eligibility-profile.md"))
    parser.add_argument("--sample-limit", type=int, default=8)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not args.input.is_file():
        print(f"error: corpus not found: {args.input}")
        return 2
    if args.sample_limit < 0:
        print("error: --sample-limit must be non-negative")
        return 2

    lines = args.input.read_text(encoding="utf-8", errors="replace").splitlines()
    try:
        profile = profile_lines(
            lines,
            source=str(args.input),
            sample_limit=args.sample_limit,
        )
    except (TypeError, ValueError) as exc:
        print(f"error: {exc}")
        return 2

    write_profile(profile, args.json, args.markdown)
    print(json.dumps(profile["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
