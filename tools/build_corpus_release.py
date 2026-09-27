#!/usr/bin/env python3
"""Build a portable, non-authoritative R4B1T typed corpus candidate release."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

try:
    from tools.compile_eligibility import (
        OUTPUT_SCHEMA,
        canonical_json,
        sha256_identifier,
        verify_output,
    )
    from tools.corpus_provenance import verify_compiled
except ModuleNotFoundError:
    from compile_eligibility import (
        OUTPUT_SCHEMA,
        canonical_json,
        sha256_identifier,
        verify_output,
    )
    from corpus_provenance import verify_compiled

RELEASE_SCHEMA = "r4b1t-corpus-release-v1"
RESOURCES_SCHEMA = "r4b1t-corpus-resources-v1"

_RELEASE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._:-]{0,127}$")


def _pretty_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ) + "\n"


def _validate_release_id(value: Any) -> str:
    if not isinstance(value, str) or not _RELEASE_ID_RE.fullmatch(value):
        raise ValueError("release id is invalid")
    return value


def _validate_aggregate_summary(
    summary: Any,
    *,
    compiled_digest: str,
) -> dict[str, Any]:
    if not isinstance(summary, dict):
        raise ValueError("aggregate summary must be an object")
    if summary.get("schema") != "r4b1t-corpus-provenance-aggregate-v1":
        raise ValueError("aggregate summary schema is unsupported")
    if summary.get("aggregateArtifactDigest") != compiled_digest:
        raise ValueError("aggregate artifact digest mismatch")
    return summary


def _verified_provenance_index(
    compiled: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    verified = verify_compiled(compiled)
    return {
        f"provenance:{record['record_id']}": record
        for record in verified["records"]
    }


def build_release(
    compiled_provenance: dict[str, Any],
    aggregate_summary: dict[str, Any],
    eligibility_output: dict[str, Any],
    *,
    release_id: str,
) -> dict[str, Any]:
    release_id = _validate_release_id(release_id)
    provenance_by_source = _verified_provenance_index(compiled_provenance)

    compiled_digest = compiled_provenance["artifactDigest"]
    _validate_aggregate_summary(
        aggregate_summary,
        compiled_digest=compiled_digest,
    )
    verified_eligibility = verify_output(eligibility_output)

    resources: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for decision in sorted(
        verified_eligibility["eligible"],
        key=lambda record: (
            record["canonicalUrl"] or "",
            record["resourceType"] or "",
            record["source"],
        ),
    ):
        canonical_url = decision.get("canonicalUrl")
        if not isinstance(canonical_url, str) or not canonical_url:
            raise ValueError("eligible decision lacks canonical URL")
        if canonical_url in seen_urls:
            raise ValueError(f"duplicate canonical eligible URL: {canonical_url}")
        seen_urls.add(canonical_url)

        source = decision.get("source")
        provenance_record = provenance_by_source.get(source)
        if provenance_record is None:
            raise ValueError(
                f"eligible decision references unknown provenance: {source}"
            )
        if decision.get("inputUrl") != provenance_record.get("url"):
            raise ValueError(
                f"eligible decision input URL does not match provenance: {canonical_url}"
            )
        if (
            decision.get("resourceType")
            != provenance_record["resource_type"]["value"]
        ):
            raise ValueError(
                f"eligible decision resource type does not match provenance: "
                f"{canonical_url}"
            )

        resources.append(
            {
                "url": canonical_url,
                "resource_type": decision["resourceType"],
                "provenance": source,
                "eligibility_reason": decision["reason"],
            }
        )

    urls_text = "".join(f"{resource['url']}\n" for resource in resources)
    resources_document = {
        "schema": RESOURCES_SCHEMA,
        "release_id": release_id,
        "resources": resources,
    }
    resources_text = _pretty_json(resources_document)

    hostnames = {
        (urlsplit(resource["url"]).hostname or "").rstrip(".").lower()
        for resource in resources
    }
    hostnames.discard("")
    type_counts = Counter(resource["resource_type"] for resource in resources)

    manifest = {
        "schema": RELEASE_SCHEMA,
        "release_id": release_id,
        "status": "candidate",
        "selection_authority": False,
        "aggregate_artifact_digest": compiled_digest,
        "eligibility_output_digest": verified_eligibility["manifest"][
            "outputDigest"
        ],
        "eligibility_ruleset": verified_eligibility["manifest"]["ruleset"],
        "protocol_policy": dict(
            verified_eligibility["manifest"]["protocolPolicy"]
        ),
        "urls_digest": sha256_identifier(urls_text.encode("utf-8")),
        "resources_digest": sha256_identifier(resources_text.encode("utf-8")),
        "counts": {
            "resources": len(resources),
            "unique_hosts": len(hostnames),
            "resource_types": {
                key: type_counts[key]
                for key in sorted(type_counts)
            },
        },
    }

    return {
        "urls": urls_text,
        "resources": resources_document,
        "manifest": manifest,
    }


def verify_release(release: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(release, dict) or set(release) != {
        "urls",
        "resources",
        "manifest",
    }:
        raise ValueError("release shape is invalid")

    manifest = release["manifest"]
    resources = release["resources"]
    urls_text = release["urls"]

    if not isinstance(manifest, dict) or manifest.get("schema") != RELEASE_SCHEMA:
        raise ValueError("release manifest schema is invalid")
    if manifest.get("status") != "candidate":
        raise ValueError("release status must remain candidate")
    if manifest.get("selection_authority") is not False:
        raise ValueError("candidate release has no selection authority")
    if not isinstance(resources, dict) or resources.get("schema") != RESOURCES_SCHEMA:
        raise ValueError("release resources schema is invalid")
    if resources.get("release_id") != manifest.get("release_id"):
        raise ValueError("release identifiers do not match")
    if not isinstance(urls_text, str):
        raise ValueError("release URLs must be text")

    resource_rows = resources.get("resources")
    if not isinstance(resource_rows, list):
        raise ValueError("release resources must be an array")
    expected_urls = "".join(f"{row['url']}\n" for row in resource_rows)
    if urls_text != expected_urls:
        raise ValueError("release URL bytes do not match resource order")

    resources_text = _pretty_json(resources)
    if manifest.get("urls_digest") != sha256_identifier(
        urls_text.encode("utf-8")
    ):
        raise ValueError("release URL digest mismatch")
    if manifest.get("resources_digest") != sha256_identifier(
        resources_text.encode("utf-8")
    ):
        raise ValueError("release resources digest mismatch")
    if manifest.get("counts", {}).get("resources") != len(resource_rows):
        raise ValueError("release resource count mismatch")

    return release


def write_release(
    release: dict[str, Any],
    out_dir: Path,
) -> None:
    verify_release(release)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "urls.txt").write_text(
        release["urls"],
        encoding="utf-8",
    )
    (out_dir / "resources.json").write_text(
        _pretty_json(release["resources"]),
        encoding="utf-8",
    )
    (out_dir / "manifest.json").write_text(
        _pretty_json(release["manifest"]),
        encoding="utf-8",
    )


def _load_eligibility_output(directory: Path) -> dict[str, Any]:
    manifest = json.loads(
        (directory / "manifest.json").read_text(encoding="utf-8")
    )
    eligible = json.loads(
        (directory / "eligible.json").read_text(encoding="utf-8")
    )
    excluded = json.loads(
        (directory / "excluded.json").read_text(encoding="utf-8")
    )
    return {
        "schema": OUTPUT_SCHEMA,
        "manifest": manifest,
        "eligible": eligible,
        "excluded": excluded,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aggregate-dir", type=Path, required=True)
    parser.add_argument("--eligibility-dir", type=Path, required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        compiled = json.loads(
            (args.aggregate_dir / "compiled.json").read_text(encoding="utf-8")
        )
        aggregate_summary = json.loads(
            (args.aggregate_dir / "summary.json").read_text(encoding="utf-8")
        )
        eligibility = _load_eligibility_output(args.eligibility_dir)
        release = build_release(
            compiled,
            aggregate_summary,
            eligibility,
            release_id=args.release_id,
        )
        write_release(release, args.out_dir)
    except (OSError, json.JSONDecodeError, TypeError, ValueError, KeyError) as exc:
        print(f"error: {exc}")
        return 2

    print(
        json.dumps(
            {
                "release_id": release["manifest"]["release_id"],
                "resources": release["manifest"]["counts"]["resources"],
                "unique_hosts": release["manifest"]["counts"]["unique_hosts"],
                "urls_digest": release["manifest"]["urls_digest"],
                "resources_digest": release["manifest"]["resources_digest"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
