#!/usr/bin/env python3
"""Aggregate independently valid R4B1T provenance documents deterministically.

Exact duplicate resource URLs merge only when their complete resource-type
claim agrees. Scope assertions are unioned as evidence, never converted into
selection weight. URL canonicalization remains downstream eligibility
authority.
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any

try:
    from tools.compile_eligibility import canonical_json
    from tools.corpus_provenance import (
        PROVENANCE_SCHEMA,
        compile_provenance,
    )
except ModuleNotFoundError:
    from compile_eligibility import canonical_json
    from corpus_provenance import (
        PROVENANCE_SCHEMA,
        compile_provenance,
    )

AGGREGATE_SCHEMA = "r4b1t-corpus-provenance-aggregate-v1"


def _pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _semantic_record(compiled_record: dict[str, Any]) -> dict[str, Any]:
    return {
        "url": compiled_record["url"],
        "resource_type": copy.deepcopy(compiled_record["resource_type"]),
        "scope_assertions": copy.deepcopy(compiled_record["scope_assertions"]),
    }


def _source_backed_type_ids(basis: dict[str, Any]) -> list[str] | None:
    kind = basis.get("kind")
    if kind == "source_assertion":
        return [basis["source_id"]]
    if kind == "source_assertions":
        return list(basis["source_ids"])
    return None


def _merge_type_claims(
    left: dict[str, Any],
    right: dict[str, Any],
    *,
    url: str,
) -> dict[str, Any]:
    if left["value"] != right["value"]:
        raise ValueError(f"conflicting resource type claim for URL: {url}")

    if canonical_json(left["basis"]) == canonical_json(right["basis"]):
        return copy.deepcopy(left)

    left_sources = _source_backed_type_ids(left["basis"])
    right_sources = _source_backed_type_ids(right["basis"])
    if left_sources is not None and right_sources is not None:
        source_ids = sorted(set(left_sources) | set(right_sources))
        basis: dict[str, Any]
        if len(source_ids) == 1:
            basis = {"kind": "source_assertion", "source_id": source_ids[0]}
        else:
            basis = {"kind": "source_assertions", "source_ids": source_ids}
        return {"value": left["value"], "basis": basis}

    raise ValueError(f"conflicting resource type claim for URL: {url}")


def _merge_scope_assertions(
    left: list[dict[str, str]],
    right: list[dict[str, str]],
) -> list[dict[str, str]]:
    by_key: dict[tuple[str, str], dict[str, str]] = {}
    for assertion in [*left, *right]:
        key = (assertion["scope"], assertion["source_id"])
        by_key[key] = {
            "scope": assertion["scope"],
            "source_id": assertion["source_id"],
        }
    return [by_key[key] for key in sorted(by_key)]


def aggregate_provenance(
    documents: list[dict[str, Any]],
) -> dict[str, Any]:
    if not isinstance(documents, list) or not documents:
        raise ValueError("provenance aggregation requires at least one input document")

    compiled_inputs = [compile_provenance(document) for document in documents]
    corpus_ids = {compiled["corpus"] for compiled in compiled_inputs}
    if len(corpus_ids) != 1:
        raise ValueError("all provenance inputs must name the same corpus")
    corpus = next(iter(corpus_ids))

    input_artifact_digests = sorted(
        compiled["artifactDigest"] for compiled in compiled_inputs
    )

    sources_by_id: dict[str, dict[str, Any]] = {}
    records_by_url: dict[str, dict[str, Any]] = {}
    raw_records = 0

    # Sort by already deterministic compiled artifact identity so caller order
    # cannot affect which equivalent object is encountered first.
    for compiled in sorted(
        compiled_inputs,
        key=lambda value: value["artifactDigest"],
    ):
        for source in compiled["sources"]:
            source_id = source["id"]
            existing_source = sources_by_id.get(source_id)
            if existing_source is None:
                sources_by_id[source_id] = copy.deepcopy(source)
            elif canonical_json(existing_source) != canonical_json(source):
                raise ValueError(
                    f"conflicting source registry identity: {source_id}"
                )

        for compiled_record in compiled["records"]:
            raw_records += 1
            record = _semantic_record(compiled_record)
            url = record["url"]
            existing_record = records_by_url.get(url)

            if existing_record is None:
                records_by_url[url] = record
                continue

            existing_record["resource_type"] = _merge_type_claims(
                existing_record["resource_type"],
                record["resource_type"],
                url=url,
            )

            existing_record["scope_assertions"] = _merge_scope_assertions(
                existing_record["scope_assertions"],
                record["scope_assertions"],
            )

    merged_sources = [
        sources_by_id[source_id]
        for source_id in sorted(sources_by_id)
    ]
    merged_records = sorted(
        records_by_url.values(),
        key=canonical_json,
    )

    provenance = {
        "schema": PROVENANCE_SCHEMA,
        "corpus": corpus,
        "sources": merged_sources,
        "records": merged_records,
    }
    compiled = compile_provenance(provenance)

    counts = {
        "inputDocuments": len(documents),
        "rawRecords": raw_records,
        "uniqueRecords": len(merged_records),
        "mergedDuplicates": raw_records - len(merged_records),
        "sources": len(merged_sources),
    }

    return {
        "schema": AGGREGATE_SCHEMA,
        "corpus": corpus,
        "inputArtifactDigests": input_artifact_digests,
        "provenance": provenance,
        "compiled": compiled,
        "eligibilityInput": copy.deepcopy(compiled["eligibilityInput"]),
        "counts": counts,
    }


def write_aggregate(
    aggregate: dict[str, Any],
    out_dir: Path,
) -> None:
    if not isinstance(aggregate, dict) or aggregate.get("schema") != AGGREGATE_SCHEMA:
        raise ValueError("unsupported provenance aggregate")

    compiled = aggregate.get("compiled")
    if not isinstance(compiled, dict) or not isinstance(
        compiled.get("artifactDigest"),
        str,
    ):
        raise ValueError("provenance aggregate compiled artifact is malformed")

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "provenance.json").write_text(
        _pretty_json(aggregate["provenance"]),
        encoding="utf-8",
    )
    (out_dir / "compiled.json").write_text(
        _pretty_json(compiled),
        encoding="utf-8",
    )
    (out_dir / "eligibility-input.json").write_text(
        _pretty_json(aggregate["eligibilityInput"]),
        encoding="utf-8",
    )
    (out_dir / "summary.json").write_text(
        _pretty_json(
            {
                "schema": AGGREGATE_SCHEMA,
                "corpus": aggregate["corpus"],
                "inputArtifactDigests": aggregate["inputArtifactDigests"],
                "aggregateArtifactDigest": compiled["artifactDigest"],
                "counts": aggregate["counts"],
            }
        ),
        encoding="utf-8",
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        nargs="+",
        required=True,
        help="one or more provenance JSON documents",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        required=True,
        help="directory for aggregate evidence",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        documents = [
            json.loads(path.read_text(encoding="utf-8"))
            for path in args.input
        ]
        aggregate = aggregate_provenance(documents)
        write_aggregate(aggregate, args.out_dir)
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(f"error: {exc}")
        return 2

    print(json.dumps(aggregate["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
