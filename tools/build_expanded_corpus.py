#!/usr/bin/env python3
"""Rebuild a reviewed expansion and descriptive diversity evidence entirely offline."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

try:
    from tools.aggregate_provenance import aggregate_provenance, write_aggregate
    from tools.build_corpus_release import build_release, write_release
    from tools.compile_eligibility import compile_document, sha256_identifier, write_output
    from tools.reviewed_source_index import compile_review, index_bytes
    from tools.source_catalog import compile_catalog
except ModuleNotFoundError:
    from aggregate_provenance import aggregate_provenance, write_aggregate
    from build_corpus_release import build_release, write_release
    from compile_eligibility import compile_document, sha256_identifier, write_output
    from reviewed_source_index import compile_review, index_bytes
    from source_catalog import compile_catalog

REGISTRY_SCHEMA = "r4b1t-expansion-registry-v1"


def _read(root: Path, relative: str) -> bytes:
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise ValueError("registry paths must be repository-relative")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("registry path escapes repository")
    return path.read_bytes()


def build_expansion(registry: dict[str, Any], root: Path) -> dict[str, Any]:
    if not isinstance(registry, dict) or set(registry) != {"schema", "release_id", "legacy_catalogs", "reviews"}:
        raise ValueError("expansion registry has unsupported or missing fields")
    if registry["schema"] != REGISTRY_SCHEMA:
        raise ValueError("unsupported expansion registry")
    documents = []
    source_rows = []
    source_ids = set()
    for field in ("legacy_catalogs", "reviews"):
        paths = registry[field]
        if not isinstance(paths, list) or any(not isinstance(path, str) for path in paths) or len(paths) != len(set(paths)):
            raise ValueError("registry paths must be unique string arrays")
        for path in sorted(paths):
            manifest = json.loads(_read(root, path))
            snapshot = _read(root, manifest["snapshot_path"])
            if field == "legacy_catalogs":
                result = compile_catalog(manifest, snapshot)
                source_id = manifest["catalog_id"]
                counts = {"collected": result["counts"]["candidates"], "admitted": result["counts"]["typed"], "unreviewed": result["counts"]["untyped"]}
                family = "legacy_catalog"
            else:
                result = compile_review(manifest, snapshot)
                source_id = manifest["source_id"]
                counts = result["counts"]
                family = manifest["family"]
            if source_id in source_ids:
                raise ValueError(f"duplicate registered source id: {source_id}")
            source_ids.add(source_id)
            documents.append(result["provenance"])
            source_rows.append({"source_id": source_id, "manifest": path, "family": family, **counts})
    aggregate = aggregate_provenance(documents)
    eligibility = compile_document(aggregate["eligibilityInput"])
    summary = {"schema": aggregate["schema"], "aggregateArtifactDigest": aggregate["compiled"]["artifactDigest"]}
    release = build_release(aggregate["compiled"], summary, eligibility, release_id=registry["release_id"])
    hosts = Counter((urlsplit(row["url"]).hostname or "").lower() for row in release["resources"]["resources"])
    total = len(release["resources"]["resources"])
    family_by_source = {row["source_id"]: row["family"] for row in source_rows}
    records = {f"provenance:{row['record_id']}": row for row in aggregate["compiled"]["records"]}
    family_counts: Counter[str] = Counter()
    for row in release["resources"]["resources"]:
        families = {family_by_source[a["source_id"]] for a in records[row["provenance"]]["scope_assertions"]}
        family_counts.update(families)
    report = {
        "schema": "r4b1t-corpus-diversity-report-v1", "release_id": registry["release_id"],
        "status": "candidate", "selection_authority": False,
        "registry_digest": sha256_identifier(index_bytes({**registry, "legacy_catalogs": sorted(registry["legacy_catalogs"]), "reviews": sorted(registry["reviews"])})),
        "urls_digest": release["manifest"]["urls_digest"],
        "counts": {**release["manifest"]["counts"], "sources": len(source_rows),
                   "github_urls": hosts["github.com"], "github_percent": round(100 * hosts["github.com"] / total, 2) if total else 0,
                   "excluded": len(eligibility["excluded"]), "merged_exact_duplicates": aggregate["counts"]["mergedDuplicates"]},
        "family_coverage": dict(sorted(family_counts.items())),
        "family_counting": "A resource may have evidence from multiple families; these counts are not selection weights.",
        "hosts": [{"host": host, "resources": hosts[host], "percent": round(100 * hosts[host] / total, 2)}
                  for host in sorted(hosts, key=lambda host: (-hosts[host], host))],
        "sources": sorted(source_rows, key=lambda row: row["source_id"]),
        "reachability": "Not asserted by an offline corpus build; separate time-bounded checks are required before promotion.",
    }
    return {"aggregate": aggregate, "eligibility": eligibility, "release": release, "report": report}


def report_markdown(report: dict[str, Any]) -> str:
    counts = report["counts"]
    lines = [f"# Corpus candidate: {report['release_id']}", "", "Candidate only; no runtime selection authority.", "",
             f"{counts['resources']:,} resources; {counts['unique_hosts']:,} unique hostnames; {counts['sources']} assertion sources.",
             f"GitHub: {counts['github_urls']:,} URLs ({counts['github_percent']}%).", "",
             "Hostnames are not registrable domains or independent publishers.", "",
             "## Resource types", "", "| Type | Resources |", "|---|---:|"]
    lines.extend(f"| {kind} | {count:,} |" for kind, count in counts["resource_types"].items())
    lines.extend(["", "## Largest hosts", "", "| Host | Resources | Share |", "|---|---:|---:|"])
    lines.extend(f"| {row['host']} | {row['resources']:,} | {row['percent']}% |" for row in report["hosts"][:15])
    lines.extend(["", "## Source families", "", "| Family | Resources with evidence |", "|---|---:|"])
    lines.extend(f"| {family} | {count:,} |" for family, count in report["family_coverage"].items())
    lines.extend(["", report["family_counting"], "", "## Assertion sources", "",
                  "| Source | Family | Collected | Admitted | Unreviewed |", "|---|---|---:|---:|---:|"])
    lines.extend(f"| {row['source_id']} | {row['family']} | {row['collected']:,} | {row['admitted']:,} | {row['unreviewed']:,} |" for row in report["sources"])
    lines.extend(["", report["reachability"], ""])
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        result = build_expansion(json.loads(args.registry.read_bytes()), args.root.resolve())
        write_aggregate(result["aggregate"], args.out_dir / "aggregate")
        write_output(result["eligibility"], args.out_dir / "eligibility")
        write_release(result["release"], args.out_dir / "release")
        (args.out_dir / "diversity.json").write_bytes(index_bytes(result["report"]))
        (args.out_dir / "diversity.md").write_text(report_markdown(result["report"]), encoding="utf-8")
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"error: {exc}")
        return 2
    print(json.dumps(result["report"]["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
