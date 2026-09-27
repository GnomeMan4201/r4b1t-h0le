"""Typed provenance compiler for the R4B1T cybersecurity corpus.

This layer records what a resource is and explicit evidence that it belongs in
cybersecurity scope. It does not decide final eligibility and has no selection
authority.
"""

from __future__ import annotations

import copy
import re
from typing import Any
from urllib.parse import urlsplit

try:
    from tools.compile_eligibility import (
        INPUT_SCHEMA,
        RESOURCE_TYPES,
        canonical_json,
        sha256_identifier,
    )
except ModuleNotFoundError:
    from compile_eligibility import (
        INPUT_SCHEMA,
        RESOURCE_TYPES,
        canonical_json,
        sha256_identifier,
    )

PROVENANCE_SCHEMA = "r4b1t-corpus-provenance-v1"
COMPILED_SCHEMA = "r4b1t-corpus-provenance-compiled-v1"

SOURCE_KINDS = {
    "curated_catalog",
    "manual_review",
    "publisher_assertion",
}

STRUCTURAL_RULES = {
    "github-repository-v1",
    "github-wiki-v1",
    "github-release-v1",
}

_GITHUB_RESERVED_FIRST = {
    "collections",
    "explore",
    "features",
    "login",
    "marketplace",
    "search",
    "settings",
    "signup",
    "topics",
}

_SOURCE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._:-]{0,127}$")


def _exact_keys(value: dict[str, Any], allowed: set[str], label: str) -> None:
    unknown = set(value) - allowed
    if unknown:
        raise ValueError(f"{label} contains unsupported fields: {sorted(unknown)}")


def _nonempty_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string")
    return value.strip()


def _validate_source_url(value: Any) -> str:
    url = _nonempty_string(value, "source URL")
    try:
        parsed = urlsplit(url)
        _ = parsed.port
    except ValueError as exc:
        raise ValueError("source URL is invalid") from exc
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("source URL must use HTTP or HTTPS and contain a hostname")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("source URL must not contain credentials")
    return url


def _normalize_sources(sources: Any) -> tuple[list[dict[str, str]], set[str]]:
    if not isinstance(sources, list):
        raise ValueError("provenance sources must be an array")

    normalized: list[dict[str, str]] = []
    source_ids: set[str] = set()
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ValueError(f"source {index} must be an object")
        _exact_keys(source, {"id", "url", "kind", "revision", "path", "sha256"}, f"source {index}")
        source_id = _nonempty_string(source.get("id"), f"source {index} id")
        if not _SOURCE_ID_RE.fullmatch(source_id):
            raise ValueError(f"source {index} id is invalid")
        if source_id in source_ids:
            raise ValueError(f"duplicate source id: {source_id}")
        source_ids.add(source_id)

        kind = source.get("kind")
        if kind not in SOURCE_KINDS:
            raise ValueError(f"source {index} kind is unsupported")

        normalized_source = {
            "id": source_id,
            "url": _validate_source_url(source.get("url")),
            "kind": kind,
        }

        evidence_keys = {"revision", "path", "sha256"}
        present_evidence = evidence_keys.intersection(source)
        if present_evidence and present_evidence != evidence_keys:
            raise ValueError(
                f"source {index} pinned evidence must include revision, path, and sha256 together"
            )
        if present_evidence:
            revision = _nonempty_string(
                source.get("revision"),
                f"source {index} revision",
            )
            source_path = _nonempty_string(
                source.get("path"),
                f"source {index} path",
            )
            source_sha256 = _nonempty_string(
                source.get("sha256"),
                f"source {index} sha256",
            )
            if not re.fullmatch(r"sha256:[0-9a-f]{64}", source_sha256):
                raise ValueError(f"source {index} sha256 must be a sha256 identifier")
            normalized_source.update(
                {
                    "revision": revision,
                    "path": source_path,
                    "sha256": source_sha256,
                }
            )

        normalized.append(normalized_source)

    normalized.sort(key=lambda source: source["id"])
    return normalized, source_ids


def _github_segments(url: str) -> list[str] | None:
    try:
        parsed = urlsplit(url)
        _ = parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() not in {"http", "https"}:
        return None
    if (parsed.hostname or "").rstrip(".").lower() != "github.com":
        return None
    if parsed.username is not None or parsed.password is not None:
        return None
    return [segment for segment in parsed.path.split("/") if segment]


def _validate_structural_rule(url: str, resource_type: str, rule_id: str) -> None:
    segments = _github_segments(url)
    if (
        segments is not None
        and segments
        and segments[0].lower() in _GITHUB_RESERVED_FIRST
    ):
        segments = None
    valid = False
    if rule_id == "github-repository-v1":
        valid = resource_type == "repository" and segments is not None and len(segments) == 2
    elif rule_id == "github-wiki-v1":
        valid = (
            resource_type == "documentation"
            and segments is not None
            and len(segments) >= 4
            and segments[2].lower() == "wiki"
        )
    elif rule_id == "github-release-v1":
        valid = (
            resource_type == "software_release"
            and segments is not None
            and len(segments) >= 5
            and segments[2].lower() == "releases"
            and segments[3].lower() == "tag"
        )
    else:
        raise ValueError(f"unsupported structural rule: {rule_id}")

    if not valid:
        raise ValueError(
            f"structural rule {rule_id} does not match URL shape and resource type"
        )


def _normalize_type_claim(
    claim: Any,
    *,
    url: str,
    source_ids: set[str],
    record_index: int,
) -> dict[str, Any]:
    if not isinstance(claim, dict):
        raise ValueError(f"record {record_index} resource_type must be an object")
    _exact_keys(claim, {"value", "basis"}, f"record {record_index} resource_type")

    resource_type = claim.get("value")
    if resource_type not in RESOURCE_TYPES:
        raise ValueError(f"record {record_index} resource type is unsupported")

    basis = claim.get("basis")
    if not isinstance(basis, dict):
        raise ValueError(f"record {record_index} type basis must be an object")

    kind = basis.get("kind")
    if kind == "source_assertion":
        _exact_keys(basis, {"kind", "source_id"}, f"record {record_index} type basis")
        source_id = _nonempty_string(
            basis.get("source_id"),
            f"record {record_index} type source id",
        )
        if source_id not in source_ids:
            raise ValueError(f"record {record_index} references unknown source: {source_id}")
        normalized_basis = {"kind": "source_assertion", "source_id": source_id}
    elif kind == "structural_rule":
        _exact_keys(basis, {"kind", "rule_id"}, f"record {record_index} type basis")
        rule_id = _nonempty_string(
            basis.get("rule_id"),
            f"record {record_index} structural rule id",
        )
        if rule_id not in STRUCTURAL_RULES:
            raise ValueError(f"unsupported structural rule: {rule_id}")
        _validate_structural_rule(url, resource_type, rule_id)
        normalized_basis = {"kind": "structural_rule", "rule_id": rule_id}
    else:
        raise ValueError(f"record {record_index} type basis is unsupported")

    return {"value": resource_type, "basis": normalized_basis}


def _normalize_scope_assertions(
    assertions: Any,
    *,
    source_ids: set[str],
    record_index: int,
) -> list[dict[str, str]]:
    if not isinstance(assertions, list) or not assertions:
        raise ValueError(f"record {record_index} requires explicit cybersecurity scope")

    normalized: dict[tuple[str, str], dict[str, str]] = {}
    for assertion_index, assertion in enumerate(assertions):
        if not isinstance(assertion, dict):
            raise ValueError(
                f"record {record_index} scope assertion {assertion_index} must be an object"
            )
        _exact_keys(
            assertion,
            {"scope", "source_id"},
            f"record {record_index} scope assertion {assertion_index}",
        )
        if assertion.get("scope") != "cybersecurity":
            raise ValueError(
                f"record {record_index} scope assertion must explicitly be cybersecurity"
            )
        source_id = _nonempty_string(
            assertion.get("source_id"),
            f"record {record_index} scope source id",
        )
        if source_id not in source_ids:
            raise ValueError(f"record {record_index} references unknown source: {source_id}")
        key = ("cybersecurity", source_id)
        normalized[key] = {"scope": "cybersecurity", "source_id": source_id}

    return [normalized[key] for key in sorted(normalized)]


def _normalize_record(
    record: Any,
    *,
    source_ids: set[str],
    record_index: int,
) -> dict[str, Any]:
    if not isinstance(record, dict):
        raise ValueError(f"record {record_index} must be an object")
    _exact_keys(
        record,
        {"url", "resource_type", "scope_assertions"},
        f"record {record_index}",
    )
    url = _nonempty_string(record.get("url"), f"record {record_index} URL")
    resource_type = _normalize_type_claim(
        record.get("resource_type"),
        url=url,
        source_ids=source_ids,
        record_index=record_index,
    )
    scope_assertions = _normalize_scope_assertions(
        record.get("scope_assertions"),
        source_ids=source_ids,
        record_index=record_index,
    )
    return {
        "url": url,
        "resource_type": resource_type,
        "scope_assertions": scope_assertions,
    }


def _normalize_document(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise ValueError("provenance document must be an object")
    _exact_keys(document, {"schema", "corpus", "sources", "records"}, "provenance document")
    if document.get("schema") != PROVENANCE_SCHEMA:
        raise ValueError("unsupported provenance schema")

    corpus = _nonempty_string(document.get("corpus"), "corpus id")
    sources, source_ids = _normalize_sources(document.get("sources"))

    records_value = document.get("records")
    if not isinstance(records_value, list):
        raise ValueError("provenance records must be an array")

    normalized_records = [
        _normalize_record(record, source_ids=source_ids, record_index=index)
        for index, record in enumerate(records_value)
    ]

    exact_urls: set[str] = set()
    for record in normalized_records:
        if record["url"] in exact_urls:
            raise ValueError(f"duplicate provenance URL: {record['url']}")
        exact_urls.add(record["url"])

    normalized_records.sort(key=canonical_json)
    return {
        "schema": PROVENANCE_SCHEMA,
        "corpus": corpus,
        "sources": sources,
        "records": normalized_records,
    }


def _record_envelope(record: dict[str, Any]) -> dict[str, Any]:
    record_id = sha256_identifier(record)
    return {
        "record_id": record_id,
        "url": record["url"],
        "resource_type": copy.deepcopy(record["resource_type"]),
        "scope_assertions": copy.deepcopy(record["scope_assertions"]),
    }


def compile_provenance(document: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize_document(document)
    compiled_records = [_record_envelope(record) for record in normalized["records"]]
    compiled_records.sort(key=lambda record: record["record_id"])

    artifact_payload = {
        "schema": COMPILED_SCHEMA,
        "corpus": normalized["corpus"],
        "sources": copy.deepcopy(normalized["sources"]),
        "records": compiled_records,
    }
    artifact_digest = sha256_identifier(artifact_payload)

    eligibility_records = [
        {
            "url": record["url"],
            "resource_type": record["resource_type"]["value"],
            "source": f"provenance:{record['record_id']}",
        }
        for record in compiled_records
    ]
    eligibility_records.sort(
        key=lambda record: (
            record["url"],
            record["resource_type"],
            record["source"],
        )
    )

    return {
        **artifact_payload,
        "artifactDigest": artifact_digest,
        "eligibilityInput": {
            "schema": INPUT_SCHEMA,
            "source": f"provenance:{artifact_digest}",
            "records": eligibility_records,
        },
    }


def verify_compiled(compiled: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(compiled, dict):
        raise ValueError("compiled provenance must be an object")
    required = {
        "schema",
        "corpus",
        "sources",
        "records",
        "artifactDigest",
        "eligibilityInput",
    }
    if set(compiled) != required:
        raise ValueError("compiled provenance shape is invalid")
    if compiled.get("schema") != COMPILED_SCHEMA:
        raise ValueError("compiled provenance schema is unsupported")

    sources = compiled.get("sources")
    records = compiled.get("records")
    if not isinstance(sources, list) or not isinstance(records, list):
        raise ValueError("compiled provenance collections are invalid")

    source_ids = {source.get("id") for source in sources if isinstance(source, dict)}
    if len(source_ids) != len(sources) or None in source_ids:
        raise ValueError("compiled provenance source registry is invalid")

    for record in records:
        if not isinstance(record, dict) or set(record) != {
            "record_id",
            "url",
            "resource_type",
            "scope_assertions",
        }:
            raise ValueError("compiled provenance record shape is invalid")
        semantic_record = {
            "url": record["url"],
            "resource_type": record["resource_type"],
            "scope_assertions": record["scope_assertions"],
        }
        if record["record_id"] != sha256_identifier(semantic_record):
            raise ValueError("provenance record id mismatch")

    artifact_payload = {
        "schema": compiled["schema"],
        "corpus": compiled["corpus"],
        "sources": compiled["sources"],
        "records": compiled["records"],
    }
    expected_artifact = sha256_identifier(artifact_payload)
    if compiled.get("artifactDigest") != expected_artifact:
        raise ValueError("provenance artifact digest mismatch")

    expected_eligibility_records = [
        {
            "url": record["url"],
            "resource_type": record["resource_type"]["value"],
            "source": f"provenance:{record['record_id']}",
        }
        for record in records
    ]
    expected_eligibility_records.sort(
        key=lambda record: (record["url"], record["resource_type"], record["source"])
    )
    expected_eligibility = {
        "schema": INPUT_SCHEMA,
        "source": f"provenance:{expected_artifact}",
        "records": expected_eligibility_records,
    }
    if compiled.get("eligibilityInput") != expected_eligibility:
        raise ValueError("provenance eligibility projection mismatch")

    return compiled
