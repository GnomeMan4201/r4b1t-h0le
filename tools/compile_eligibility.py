#!/usr/bin/env python3
"""Deterministic eligibility compiler for the R4B1T H0L3 discovery corpus.

This module is deliberately offline and history-blind. It classifies explicit
resource records into an eligible set plus inspectable exclusions. It does not
sample, rank, score, personalize, fetch URLs, or mutate the source corpus.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

INPUT_SCHEMA = "r4b1t-eligibility-input-v1"
OUTPUT_SCHEMA = "r4b1t-eligibility-output-v1"
MANIFEST_SCHEMA = "r4b1t-eligibility-manifest-v1"
RULESET = "eligibility-v1"
PROTOCOL_POLICY = {"version": "1", "excludeOnion": True}

TRACKING_PARAMETERS = {
    "fbclid",
    "gclid",
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term",
}

GENERIC_HOST_ROOTS = {
    "github.com",
    "gitlab.com",
    "medium.com",
    "slideshare.net",
    "www.slideshare.net",
    "youtube.com",
    "www.youtube.com",
}

RESOURCE_TYPES = {
    "repository",
    "source_file",
    "security_tool",
    "documentation",
    "article",
    "writeup",
    "research",
    "paper",
    "advisory",
    "vulnerability_record",
    "software_release",
    "dataset",
    "threat_feed",
    "rule_collection",
    "corpus",
    "lab",
    "challenge",
    "training_resource",
    "reference",
    "other_explicit",
}

RESEARCH_TYPES = {
    "article",
    "writeup",
    "research",
    "paper",
    "advisory",
    "vulnerability_record",
}

ISSUE_TYPES = {"writeup", "research", "advisory", "vulnerability_record"}
DATA_TYPES = {"dataset", "threat_feed", "rule_collection", "corpus"}
LEARNING_TYPES = {"lab", "challenge", "training_resource"}

REPOSITORY_ADMIN_NAMES = {
    "code_of_conduct.md",
    "contributing.md",
    "license",
    "license.md",
}

GENERIC_GITHUB_FIRST_SEGMENTS = {
    "collections": "GENERIC_DISCOVERY_SURFACE",
    "explore": "GENERIC_DISCOVERY_SURFACE",
    "features": "GENERIC_DISCOVERY_SURFACE",
    "login": "AUTH_SURFACE",
    "marketplace": "GENERIC_DISCOVERY_SURFACE",
    "search": "SEARCH_SURFACE",
    "signup": "AUTH_SURFACE",
    "topics": "TAG_INDEX",
}


class EligibilityError(ValueError):
    """Expected classification failure with a stable reason code."""

    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def sha256_identifier(value: Any) -> str:
    if not isinstance(value, (bytes, bytearray)):
        value = canonical_json(value).encode("utf-8")
    return "sha256:" + hashlib.sha256(bytes(value)).hexdigest()


def _normalize_hostname(hostname: str) -> str:
    normalized = hostname.rstrip(".").lower()
    try:
        return normalized.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise EligibilityError("INVALID_URL", "hostname cannot be normalized") from exc


def _normalized_authority(parts: Any) -> tuple[str, str]:
    if parts.username is not None or parts.password is not None:
        raise EligibilityError("EMBEDDED_CREDENTIALS", "URL authority contains credentials")
    hostname = _normalize_hostname(parts.hostname or "")
    if not hostname:
        raise EligibilityError("INVALID_URL", "URL must contain a hostname")
    rendered_host = f"[{hostname}]" if ":" in hostname else hostname
    try:
        port = parts.port
    except ValueError as exc:
        raise EligibilityError("INVALID_URL", "URL contains an invalid port") from exc
    scheme = parts.scheme.lower()
    if port is not None and not (
        (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    ):
        rendered_host = f"{rendered_host}:{port}"
    return hostname, rendered_host


def _normalize_path(path: str) -> str:
    # v1 is deliberately conservative: do not percent-decode or infer host-specific
    # equivalence. Remove only literal dot segments and an unnecessary trailing slash.
    segments: list[str] = []
    for segment in path.split("/"):
        if segment in {"", "."}:
            continue
        if segment == "..":
            if segments:
                segments.pop()
            continue
        segments.append(segment)
    normalized = "/" + "/".join(segments)
    return normalized if normalized != "" else "/"


def canonicalize_url(raw_url: str) -> str:
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise EligibilityError("INVALID_URL", "URL must be a non-empty string")
    value = raw_url.strip()
    try:
        parts = urlsplit(value)
    except ValueError as exc:
        raise EligibilityError("INVALID_URL", "URL cannot be parsed") from exc

    scheme = parts.scheme.lower()
    if scheme not in {"http", "https"}:
        raise EligibilityError("UNSUPPORTED_PROTOCOL", "URL must use HTTP or HTTPS")

    hostname, authority = _normalized_authority(parts)
    if PROTOCOL_POLICY["excludeOnion"] and hostname.endswith(".onion"):
        raise EligibilityError(
            "PROTOCOL_POLICY_ONION_EXCLUDED",
            "onion resources are excluded by protocol policy v1",
        )

    path = _normalize_path(parts.path or "/")
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    query_items = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in TRACKING_PARAMETERS
    ]
    query = urlencode(query_items, doseq=True)
    return urlunsplit((scheme, authority, path, query, ""))


def _validate_document(document: dict[str, Any]) -> None:
    if not isinstance(document, dict):
        raise TypeError("eligibility input must be a JSON object")
    allowed_document_keys = {"schema", "source", "records"}
    unknown = set(document) - allowed_document_keys
    if unknown:
        raise TypeError(f"eligibility input contains unsupported fields: {sorted(unknown)}")
    if document.get("schema") != INPUT_SCHEMA:
        raise TypeError("unsupported eligibility input schema")
    if not isinstance(document.get("source"), str) or not document["source"].strip():
        raise TypeError("eligibility input source must be a non-empty string")
    if not isinstance(document.get("records"), list):
        raise TypeError("eligibility input records must be an array")
    for index, record in enumerate(document["records"]):
        if not isinstance(record, dict):
            raise TypeError(f"record {index} must be an object")
        allowed_record_keys = {"url", "source", "resource_type"}
        unknown_record = set(record) - allowed_record_keys
        if unknown_record:
            raise TypeError(f"record {index} contains unsupported fields: {sorted(unknown_record)}")
        if not isinstance(record.get("url"), str) or not record["url"].strip():
            raise TypeError(f"record {index} URL must be a non-empty string")
        if "source" in record and (
            not isinstance(record["source"], str) or not record["source"].strip()
        ):
            raise TypeError(f"record {index} source must be a non-empty string")
        if "resource_type" in record and record["resource_type"] not in RESOURCE_TYPES:
            raise TypeError(f"record {index} resource_type is unsupported")


def _source_for(record: dict[str, Any], document_source: str) -> str:
    return str(record.get("source") or document_source)


def _decision(
    *,
    input_url: str,
    canonical_url: str | None,
    resource_type: str | None,
    decision: str,
    reason: str,
    source: str,
) -> dict[str, Any]:
    return {
        "ruleset": RULESET,
        "inputUrl": input_url,
        "canonicalUrl": canonical_url,
        "resourceType": resource_type,
        "decision": decision,
        "reason": reason,
        "source": source,
    }


def _generic_surface_reason(host: str, path: str) -> str | None:
    segments = [segment for segment in path.split("/") if segment]
    if not segments:
        if host in GENERIC_HOST_ROOTS:
            return "GENERIC_HOST_ROOT"
        return None
    if host == "github.com":
        return GENERIC_GITHUB_FIRST_SEGMENTS.get(segments[0].lower())
    if host in {"youtube.com", "www.youtube.com"}:
        if segments[0].lower() in {"results", "feed", "signin"}:
            return "GENERIC_DISCOVERY_SURFACE" if segments[0].lower() == "feed" else (
                "SEARCH_SURFACE" if segments[0].lower() == "results" else "AUTH_SURFACE"
            )
    if host in {"slideshare.net", "www.slideshare.net"} and segments[0].lower() == "search":
        return "SEARCH_SURFACE"
    if host == "medium.com" and segments[0].lower() in {"search", "tag"}:
        return "SEARCH_SURFACE" if segments[0].lower() == "search" else "TAG_INDEX"
    return None


def _reason_for_explicit_type(resource_type: str) -> str:
    if resource_type == "repository":
        return "CONCRETE_REPOSITORY"
    if resource_type == "source_file":
        return "STANDALONE_TECHNICAL_ARTIFACT"
    if resource_type == "security_tool":
        return "CONCRETE_SECURITY_TOOL"
    if resource_type in {"documentation", "reference"}:
        return "CONCRETE_TECHNICAL_DOCUMENT"
    if resource_type in RESEARCH_TYPES:
        return "CONCRETE_RESEARCH_RESOURCE"
    if resource_type == "software_release":
        return "CONCRETE_SOFTWARE_RELEASE"
    if resource_type in DATA_TYPES:
        return "CONCRETE_DATA_RESOURCE"
    if resource_type in LEARNING_TYPES:
        return "CONCRETE_LEARNING_RESOURCE"
    if resource_type == "other_explicit":
        return "EXPLICIT_RESOURCE_CLASSIFICATION"
    raise TypeError("unsupported resource type")


def _classify_github(path: str, explicit_type: str | None) -> tuple[str, str, str]:
    segments = [segment for segment in path.split("/") if segment]
    if len(segments) < 2:
        return "EXCLUDED", explicit_type or "repository", "GENERIC_DIRECTORY"
    if len(segments) == 2:
        return "ELIGIBLE", "repository", "CONCRETE_REPOSITORY"

    route = segments[2].lower()
    if route == "blob":
        name = segments[-1].lower() if len(segments) >= 5 else ""
        if name in REPOSITORY_ADMIN_NAMES or (len(segments) >= 6 and segments[4].lower() == ".github"):
            return "EXCLUDED", explicit_type, "REPOSITORY_ADMIN_ARTIFACT"
        if explicit_type == "source_file":
            return "ELIGIBLE", "source_file", "STANDALONE_TECHNICAL_ARTIFACT"
        return "EXCLUDED", explicit_type, "RESOURCE_TYPE_UNQUALIFIED"

    if route == "issues" and len(segments) >= 4 and re.fullmatch(r"\d+", segments[3]):
        if explicit_type in ISSUE_TYPES:
            return "ELIGIBLE", explicit_type, "SUBSTANTIVE_ISSUE_RESOURCE"
        return "EXCLUDED", explicit_type, "ISSUE_RESOURCE_UNQUALIFIED"

    if route in {"pull", "pulls"}:
        return "EXCLUDED", explicit_type, "PULL_REQUEST_UNQUALIFIED"

    if route == "wiki" and len(segments) >= 4:
        return "ELIGIBLE", "documentation", "CONCRETE_TECHNICAL_DOCUMENT"

    if route == "releases" and len(segments) >= 5 and segments[3].lower() == "tag":
        return "ELIGIBLE", "software_release", "CONCRETE_SOFTWARE_RELEASE"

    if explicit_type is not None:
        return "ELIGIBLE", explicit_type, _reason_for_explicit_type(explicit_type)
    return "EXCLUDED", None, "RESOURCE_TYPE_UNQUALIFIED"


def _classify_record(record: dict[str, Any], document_source: str) -> dict[str, Any]:
    input_url = record["url"].strip()
    source = _source_for(record, document_source)
    explicit_type = record.get("resource_type")
    try:
        canonical_url = canonicalize_url(input_url)
    except EligibilityError as exc:
        return _decision(
            input_url=input_url,
            canonical_url=None,
            resource_type=explicit_type,
            decision="EXCLUDED",
            reason=exc.reason,
            source=source,
        )

    parts = urlsplit(canonical_url)
    host = _normalize_hostname(parts.hostname or "")
    generic_reason = _generic_surface_reason(host, parts.path)
    if generic_reason:
        return _decision(
            input_url=input_url,
            canonical_url=canonical_url,
            resource_type=explicit_type,
            decision="EXCLUDED",
            reason=generic_reason,
            source=source,
        )

    if host == "github.com":
        decision, resource_type, reason = _classify_github(parts.path, explicit_type)
    elif explicit_type is not None:
        decision, resource_type, reason = (
            "ELIGIBLE",
            explicit_type,
            _reason_for_explicit_type(explicit_type),
        )
    else:
        decision, resource_type, reason = "EXCLUDED", None, "RESOURCE_TYPE_UNQUALIFIED"

    return _decision(
        input_url=input_url,
        canonical_url=canonical_url,
        resource_type=resource_type,
        decision=decision,
        reason=reason,
        source=source,
    )


def _decision_sort_key(record: dict[str, Any]) -> tuple[str, str, str, str, str]:
    return (
        record.get("canonicalUrl") or "",
        record.get("inputUrl") or "",
        record.get("resourceType") or "",
        record.get("reason") or "",
        record.get("source") or "",
    )


def _canonical_input(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": document["schema"],
        "source": document["source"],
        "records": sorted(
            (copy.deepcopy(record) for record in document["records"]),
            key=lambda record: canonical_json(record),
        ),
    }


def compile_document(document: dict[str, Any]) -> dict[str, Any]:
    """Compile explicit resource records into deterministic eligibility evidence."""
    _validate_document(document)
    normalized_input = _canonical_input(document)
    decisions = [
        _classify_record(record, document["source"])
        for record in normalized_input["records"]
    ]
    decisions.sort(key=_decision_sort_key)

    grouped: dict[str, list[dict[str, Any]]] = {}
    without_canonical: list[dict[str, Any]] = []
    for record in decisions:
        canonical = record["canonicalUrl"]
        if canonical is None:
            without_canonical.append(record)
        else:
            grouped.setdefault(canonical, []).append(record)

    eligible: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = list(without_canonical)
    duplicates = 0
    for canonical in sorted(grouped):
        group = sorted(grouped[canonical], key=_decision_sort_key)
        eligible_group = [record for record in group if record["decision"] == "ELIGIBLE"]
        if not eligible_group:
            excluded.extend(group)
            continue

        classifications = {
            (record["resourceType"], record["reason"]) for record in eligible_group
        }
        if len(classifications) > 1:
            for record in group:
                conflict = dict(record)
                conflict["decision"] = "EXCLUDED"
                conflict["reason"] = "CONFLICTING_RESOURCE_METADATA"
                excluded.append(conflict)
            continue

        representative = eligible_group[0]
        eligible.append(representative)
        for record in group:
            if record is representative:
                continue
            duplicate = dict(record)
            duplicate["decision"] = "EXCLUDED"
            duplicate["reason"] = "CANONICAL_DUPLICATE"
            excluded.append(duplicate)
            duplicates += 1

    eligible.sort(key=_decision_sort_key)
    excluded.sort(key=_decision_sort_key)

    counts = {
        "raw": len(document["records"]),
        "eligible": len(eligible),
        "excluded": len(excluded),
        "duplicates": duplicates,
    }
    deterministic_payload = {
        "schema": OUTPUT_SCHEMA,
        "ruleset": RULESET,
        "protocolPolicy": PROTOCOL_POLICY,
        "eligible": eligible,
        "excluded": excluded,
    }
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "ruleset": RULESET,
        "protocolPolicy": dict(PROTOCOL_POLICY),
        "inputDigest": sha256_identifier(normalized_input),
        "outputDigest": sha256_identifier(deterministic_payload),
        "counts": counts,
    }
    return {
        "schema": OUTPUT_SCHEMA,
        "manifest": manifest,
        "eligible": eligible,
        "excluded": excluded,
    }


def verify_output(output: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(output, dict) or output.get("schema") != OUTPUT_SCHEMA:
        raise ValueError("unsupported eligibility output schema")
    manifest = output.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("schema") != MANIFEST_SCHEMA:
        raise ValueError("eligibility manifest is malformed")
    if manifest.get("ruleset") != RULESET or manifest.get("protocolPolicy") != PROTOCOL_POLICY:
        raise ValueError("eligibility manifest policy is unsupported")
    eligible = output.get("eligible")
    excluded = output.get("excluded")
    if not isinstance(eligible, list) or not isinstance(excluded, list):
        raise ValueError("eligibility output records are malformed")
    expected_counts = {
        "raw": len(eligible) + len(excluded),
        "eligible": len(eligible),
        "excluded": len(excluded),
        "duplicates": sum(1 for record in excluded if record.get("reason") == "CANONICAL_DUPLICATE"),
    }
    if manifest.get("counts") != expected_counts:
        raise ValueError("eligibility output counts do not match records")
    deterministic_payload = {
        "schema": OUTPUT_SCHEMA,
        "ruleset": RULESET,
        "protocolPolicy": PROTOCOL_POLICY,
        "eligible": eligible,
        "excluded": excluded,
    }
    expected_digest = sha256_identifier(deterministic_payload)
    if manifest.get("outputDigest") != expected_digest:
        raise ValueError("eligibility output digest mismatch")
    return output


def _pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def write_output(output: dict[str, Any], out_dir: Path) -> None:
    verify_output(output)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "eligible.json").write_text(_pretty_json(output["eligible"]), encoding="utf-8")
    (out_dir / "excluded.json").write_text(_pretty_json(output["excluded"]), encoding="utf-8")
    (out_dir / "manifest.json").write_text(_pretty_json(output["manifest"]), encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="eligibility input JSON document")
    parser.add_argument("--out-dir", type=Path, required=True, help="directory for compiled artifacts")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        document = json.loads(args.input.read_text(encoding="utf-8"))
        output = compile_document(document)
        write_output(output, args.out_dir)
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(f"error: {exc}")
        return 2
    print(_pretty_json(output["manifest"]), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
