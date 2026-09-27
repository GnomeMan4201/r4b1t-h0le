#!/usr/bin/env python3
"""Compile a pinned curated Markdown catalog into typed provenance candidates.

The compiler is offline. Catalog membership may establish cybersecurity scope,
but automatic type promotion is limited to deterministic structural rules.
Untyped destinations remain explicit review candidates.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

try:
    from tools.compile_eligibility import sha256_identifier
    from tools.corpus_provenance import PROVENANCE_SCHEMA, compile_provenance
except ModuleNotFoundError:
    from compile_eligibility import sha256_identifier
    from corpus_provenance import PROVENANCE_SCHEMA, compile_provenance

MANIFEST_SCHEMA = "r4b1t-source-catalog-v1"
COMPILED_SCHEMA = "r4b1t-source-catalog-compiled-v1"
EXTRACTOR = "markdown-links-v1"

_CATALOG_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._:-]{0,127}$")
_HEADING_RE = re.compile(r"^(#{2,6})\s+(.+?)\s*#*\s*$")
_INLINE_LINK_RE = re.compile(
    r"""(?<!!)\[([^\]]+)\]\((https?://[^\s)]+)(?:\s+["'][^"']*["'])?\)"""
)
_AUTOLINK_RE = re.compile(r"<(https?://[^>\s]+)>")
_BACKTICK_FENCE = chr(96) * 3

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


def snapshot_digest(snapshot: str | bytes) -> str:
    raw = snapshot.encode("utf-8") if isinstance(snapshot, str) else bytes(snapshot)
    return sha256_identifier(raw)


def _snapshot_text(snapshot: str | bytes) -> str:
    if isinstance(snapshot, str):
        return snapshot
    try:
        return bytes(snapshot).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("catalog snapshot must be valid UTF-8") from exc


def _exact_keys(value: dict[str, Any], allowed: set[str], label: str) -> None:
    unknown = set(value) - allowed
    if unknown:
        raise ValueError(f"{label} contains unsupported fields: {sorted(unknown)}")


def _nonempty(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string")
    return value.strip()


def _public_http_url(value: Any, label: str) -> str:
    url = _nonempty(value, label)
    try:
        parts = urlsplit(url)
        _ = parts.port
    except ValueError as exc:
        raise ValueError(f"{label} is invalid") from exc
    if parts.scheme.lower() not in {"http", "https"} or not parts.hostname:
        raise ValueError(f"{label} must use HTTP or HTTPS and contain a hostname")
    if parts.username is not None or parts.password is not None:
        raise ValueError(f"{label} must not contain credentials")
    return url


def _normalize_manifest(manifest: Any) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise ValueError("catalog manifest must be an object")
    _exact_keys(
        manifest,
        {
            "schema",
            "catalog_id",
            "corpus",
            "source",
            "snapshot_path",
            "scope",
            "extractor",
        },
        "catalog manifest",
    )
    if manifest.get("schema") != MANIFEST_SCHEMA:
        raise ValueError("unsupported source catalog schema")

    catalog_id = _nonempty(manifest.get("catalog_id"), "catalog id")
    if not _CATALOG_ID_RE.fullmatch(catalog_id):
        raise ValueError("catalog id is invalid")

    corpus = _nonempty(manifest.get("corpus"), "corpus id")
    if manifest.get("scope") != "cybersecurity":
        raise ValueError("catalog scope must explicitly be cybersecurity")
    if manifest.get("extractor") != EXTRACTOR:
        raise ValueError("unsupported catalog extractor")

    snapshot_path = _nonempty(manifest.get("snapshot_path"), "snapshot path")
    path = Path(snapshot_path)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("snapshot path must be repository-relative")

    source = manifest.get("source")
    if not isinstance(source, dict):
        raise ValueError("catalog source must be an object")
    _exact_keys(source, {"url", "revision", "path", "sha256"}, "catalog source")
    source_url = _public_http_url(source.get("url"), "source URL")
    revision = _nonempty(source.get("revision"), "source revision")
    source_path = _nonempty(source.get("path"), "source path")
    expected_digest = _nonempty(source.get("sha256"), "source SHA-256")
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", expected_digest):
        raise ValueError("source SHA-256 must be a sha256 identifier")

    return {
        "schema": MANIFEST_SCHEMA,
        "catalog_id": catalog_id,
        "corpus": corpus,
        "source": {
            "url": source_url,
            "revision": revision,
            "path": source_path,
            "sha256": expected_digest,
        },
        "snapshot_path": snapshot_path,
        "scope": "cybersecurity",
        "extractor": EXTRACTOR,
    }


def _clean_heading(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def _extract_candidates(snapshot_text: str) -> list[dict[str, Any]]:
    by_url: dict[str, dict[str, Any]] = {}
    heading: str | None = None
    fence_marker: str | None = None

    for line_number, line in enumerate(snapshot_text.splitlines(), start=1):
        stripped = line.strip()

        if fence_marker is not None:
            if stripped.startswith(fence_marker):
                fence_marker = None
            continue

        if stripped.startswith(_BACKTICK_FENCE):
            fence_marker = _BACKTICK_FENCE
            continue
        if stripped.startswith("~~~"):
            fence_marker = "~~~"
            continue

        heading_match = _HEADING_RE.match(stripped)
        if heading_match:
            heading = _clean_heading(heading_match.group(2))
            continue

        if heading is None:
            continue

        found: list[tuple[int, str, str]] = []

        for match in _INLINE_LINK_RE.finditer(line):
            label = re.sub(r"\s+", " ", match.group(1).strip())
            if label.startswith("!") or "![" in label:
                continue
            found.append((match.start(), match.group(2), label or match.group(2)))

        for match in _AUTOLINK_RE.finditer(line):
            found.append((match.start(), match.group(1), match.group(1)))

        for _, url, label in sorted(found, key=lambda item: item[0]):
            try:
                _public_http_url(url, "catalog destination")
            except ValueError:
                continue

            current = by_url.get(url)
            if current is None:
                by_url[url] = {
                    "url": url,
                    "heading": heading,
                    "label": label,
                    "line": line_number,
                    "occurrences": 1,
                }
            else:
                current["occurrences"] += 1

    return [by_url[url] for url in sorted(by_url)]


def _structural_type(url: str) -> tuple[str, str] | None:
    try:
        parts = urlsplit(url)
        _ = parts.port
    except ValueError:
        return None
    if parts.scheme.lower() not in {"http", "https"}:
        return None
    if (parts.hostname or "").rstrip(".").lower() != "github.com":
        return None
    if parts.username is not None or parts.password is not None:
        return None

    segments = [segment for segment in parts.path.split("/") if segment]
    if len(segments) < 2 or segments[0].lower() in _GITHUB_RESERVED_FIRST:
        return None

    if len(segments) == 2:
        return "repository", "github-repository-v1"

    route = segments[2].lower()
    if route == "wiki" and len(segments) >= 4:
        return "documentation", "github-wiki-v1"
    if (
        route == "releases"
        and len(segments) >= 5
        and segments[3].lower() == "tag"
    ):
        return "software_release", "github-release-v1"
    return None


def compile_catalog(
    manifest: dict[str, Any],
    snapshot: str | bytes,
) -> dict[str, Any]:
    normalized_manifest = _normalize_manifest(manifest)
    actual_digest = snapshot_digest(snapshot)
    if actual_digest != normalized_manifest["source"]["sha256"]:
        raise ValueError(
            "catalog snapshot digest mismatch: "
            f"expected {normalized_manifest['source']['sha256']}, got {actual_digest}"
        )

    candidates = _extract_candidates(_snapshot_text(snapshot))
    catalog_id = normalized_manifest["catalog_id"]

    provenance_records: list[dict[str, Any]] = []
    untyped: list[dict[str, Any]] = []
    for candidate in candidates:
        structural = _structural_type(candidate["url"])
        if structural is None:
            untyped.append(
                {
                    **candidate,
                    "reason": "RESOURCE_TYPE_UNRESOLVED",
                    "source_id": catalog_id,
                }
            )
            continue

        resource_type, rule_id = structural
        provenance_records.append(
            {
                "url": candidate["url"],
                "resource_type": {
                    "value": resource_type,
                    "basis": {
                        "kind": "structural_rule",
                        "rule_id": rule_id,
                    },
                },
                "scope_assertions": [
                    {
                        "scope": "cybersecurity",
                        "source_id": catalog_id,
                    }
                ],
            }
        )

    provenance_records.sort(key=lambda record: record["url"])
    untyped.sort(key=lambda record: record["url"])

    provenance = {
        "schema": PROVENANCE_SCHEMA,
        "corpus": normalized_manifest["corpus"],
        "sources": [
            {
                "id": catalog_id,
                "url": normalized_manifest["source"]["url"],
                "kind": "curated_catalog",
                "revision": normalized_manifest["source"]["revision"],
                "path": normalized_manifest["source"]["path"],
                "sha256": normalized_manifest["source"]["sha256"],
            }
        ],
        "records": provenance_records,
    }

    compile_provenance(provenance)

    return {
        "schema": COMPILED_SCHEMA,
        "manifest": normalized_manifest,
        "snapshotDigest": actual_digest,
        "candidates": candidates,
        "provenance": provenance,
        "untyped": untyped,
        "counts": {
            "candidates": len(candidates),
            "typed": len(provenance_records),
            "untyped": len(untyped),
        },
    }


def _pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def write_compiled(compiled: dict[str, Any], out_dir: Path) -> None:
    if not isinstance(compiled, dict) or compiled.get("schema") != COMPILED_SCHEMA:
        raise ValueError("unsupported compiled source catalog")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "catalog.json").write_text(
        _pretty_json(compiled["manifest"]),
        encoding="utf-8",
    )
    (out_dir / "candidates.json").write_text(
        _pretty_json(compiled["candidates"]),
        encoding="utf-8",
    )
    (out_dir / "provenance.json").write_text(
        _pretty_json(compiled["provenance"]),
        encoding="utf-8",
    )
    (out_dir / "untyped.json").write_text(
        _pretty_json(compiled["untyped"]),
        encoding="utf-8",
    )
    (out_dir / "summary.json").write_text(
        _pretty_json(
            {
                "schema": COMPILED_SCHEMA,
                "snapshotDigest": compiled["snapshotDigest"],
                "counts": compiled["counts"],
            }
        ),
        encoding="utf-8",
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--out-dir", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        normalized = _normalize_manifest(manifest)
        snapshot_path = args.root / normalized["snapshot_path"]
        snapshot = snapshot_path.read_bytes()
        compiled = compile_catalog(normalized, snapshot)
        write_compiled(compiled, args.out_dir)
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(f"error: {exc}")
        return 2

    print(json.dumps(compiled["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
