#!/usr/bin/env python3
"""Build deterministic runtime-shadow corpus artifacts from typed eligibility.

This tool produces deployable corpus bytes but grants them no runtime selection
authority. Production ROLL and Blind Descent remain bound to urls.txt.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

try:
    from tools.compile_eligibility import RULESET
    from tools.corpus_provenance import verify_compiled
except ModuleNotFoundError:
    from compile_eligibility import RULESET
    from corpus_provenance import verify_compiled

RUNTIME_SCHEMA = "r4b1t-runtime-corpus-shadow-v1"
_ELIGIBILITY_MANIFEST_SCHEMA = "r4b1t-eligibility-manifest-v1"
_SHA256_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


def _sha256_bytes_identifier(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def _digest(value: Any, label: str) -> str:
    if not isinstance(value, str) or not _SHA256_RE.fullmatch(value):
        raise ValueError(f"{label} must be a sha256 identifier")
    return value


def _canonical_http_url(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError("eligible canonical URL must be a non-empty string")
    try:
        parts = urlsplit(value)
        _ = parts.port
    except ValueError as exc:
        raise ValueError("eligible canonical URL is invalid") from exc
    if parts.scheme.lower() not in {"http", "https"} or not parts.hostname:
        raise ValueError("eligible canonical URL must use HTTP or HTTPS")
    if parts.username is not None or parts.password is not None:
        raise ValueError("eligible canonical URL must not contain credentials")
    return value


def _validate_eligibility_manifest(
    manifest: Any,
    *,
    eligible_count: int,
) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise ValueError("eligibility manifest must be an object")
    if manifest.get("schema") != _ELIGIBILITY_MANIFEST_SCHEMA:
        raise ValueError("unsupported eligibility manifest schema")
    if manifest.get("ruleset") != RULESET:
        raise ValueError("runtime shadow requires eligibility-v1")

    counts = manifest.get("counts")
    if not isinstance(counts, dict):
        raise ValueError("eligibility manifest counts are invalid")
    declared_eligible = counts.get("eligible")
    if (
        not isinstance(declared_eligible, int)
        or isinstance(declared_eligible, bool)
        or declared_eligible != eligible_count
    ):
        raise ValueError("eligibility manifest eligible count does not match eligible records")

    _digest(manifest.get("inputDigest"), "eligibility input digest")
    _digest(manifest.get("outputDigest"), "eligibility output digest")
    return manifest


def build_runtime_corpus(
    compiled_provenance: dict[str, Any],
    eligible_records: list[dict[str, Any]],
    eligibility_manifest: dict[str, Any],
) -> dict[str, Any]:
    compiled = verify_compiled(compiled_provenance)

    if not isinstance(eligible_records, list):
        raise ValueError("eligible records must be an array")
    manifest = _validate_eligibility_manifest(
        eligibility_manifest,
        eligible_count=len(eligible_records),
    )

    provenance_by_source: dict[str, dict[str, Any]] = {}
    for record in compiled["records"]:
        provenance_by_source[f"provenance:{record['record_id']}"] = record

    runtime_records: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for index, eligible in enumerate(eligible_records):
        if not isinstance(eligible, dict):
            raise ValueError(f"eligible record {index} must be an object")
        if eligible.get("decision") != "ELIGIBLE":
            raise ValueError(f"eligible record {index} decision is not ELIGIBLE")
        if eligible.get("ruleset") != RULESET:
            raise ValueError(f"eligible record {index} ruleset is unsupported")

        url = _canonical_http_url(eligible.get("canonicalUrl"))
        if url in seen_urls:
            raise ValueError(f"duplicate canonical URL in runtime pool: {url}")
        seen_urls.add(url)

        source = eligible.get("source")
        if not isinstance(source, str) or source not in provenance_by_source:
            raise ValueError(f"eligible record {index} references unknown provenance")
        provenance_record = provenance_by_source[source]

        resource_type = eligible.get("resourceType")
        if resource_type != provenance_record["resource_type"]["value"]:
            raise ValueError(
                f"eligible record {index} resource type does not match provenance"
            )

        runtime_records.append(
            {
                "url": url,
                "resource_type": resource_type,
                "source": source,
            }
        )

    runtime_records.sort(
        key=lambda record: (
            record["url"],
            record["resource_type"],
            record["source"],
        )
    )
    url_text = "".join(record["url"] + "\n" for record in runtime_records)
    url_pool_digest = _sha256_bytes_identifier(url_text.encode("utf-8"))

    document = {
        "schema": RUNTIME_SCHEMA,
        "corpus": compiled["corpus"],
        "ruleset": RULESET,
        "provenanceArtifactDigest": _digest(
            compiled["artifactDigest"],
            "provenance artifact digest",
        ),
        "eligibilityInputDigest": _digest(
            manifest["inputDigest"],
            "eligibility input digest",
        ),
        "eligibilityOutputDigest": _digest(
            manifest["outputDigest"],
            "eligibility output digest",
        ),
        "urlPoolDigest": url_pool_digest,
        "count": len(runtime_records),
        "records": runtime_records,
    }

    return {
        "document": document,
        "urlText": url_text,
    }


def _pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def write_runtime_corpus(runtime: dict[str, Any], out_dir: Path) -> None:
    if not isinstance(runtime, dict):
        raise ValueError("runtime corpus build must be an object")
    document = runtime.get("document")
    url_text = runtime.get("urlText")
    if not isinstance(document, dict) or document.get("schema") != RUNTIME_SCHEMA:
        raise ValueError("runtime corpus document is invalid")
    if not isinstance(url_text, str):
        raise ValueError("runtime URL text is invalid")
    if document.get("urlPoolDigest") != _sha256_bytes_identifier(url_text.encode("utf-8")):
        raise ValueError("runtime URL pool digest mismatch")

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "typed-urls-v1.txt").write_text(url_text, encoding="utf-8")
    (out_dir / "typed-runtime-v1.json").write_text(
        _pretty_json(document),
        encoding="utf-8",
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compiled", type=Path, required=True)
    parser.add_argument("--eligible", type=Path, required=True)
    parser.add_argument("--eligibility-manifest", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        compiled = json.loads(args.compiled.read_text(encoding="utf-8"))
        eligible = json.loads(args.eligible.read_text(encoding="utf-8"))
        manifest = json.loads(args.eligibility_manifest.read_text(encoding="utf-8"))
        runtime = build_runtime_corpus(compiled, eligible, manifest)
        write_runtime_corpus(runtime, args.out_dir)
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(f"error: {exc}")
        return 2

    print(
        json.dumps(
            {
                "count": runtime["document"]["count"],
                "urlPoolDigest": runtime["document"]["urlPoolDigest"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
