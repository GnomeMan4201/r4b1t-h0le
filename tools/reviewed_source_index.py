#!/usr/bin/env python3
"""Collect non-authoritative link indexes; compile exact reviewed admissions offline."""

from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree

try:
    from tools.compile_eligibility import RESOURCE_TYPES, sha256_identifier
    from tools.corpus_provenance import PROVENANCE_SCHEMA, compile_provenance
except ModuleNotFoundError:
    from compile_eligibility import RESOURCE_TYPES, sha256_identifier
    from corpus_provenance import PROVENANCE_SCHEMA, compile_provenance

INDEX_SCHEMA = "r4b1t-source-link-index-v1"
EXTRACTORS = {"html-anchors-v1", "feed-entries-v1", "sitemap-urls-v1"}
REVIEW_SCHEMA = "r4b1t-reviewed-source-index-v1"
FAMILIES = {"independent_research", "publisher_research", "academic_research",
            "hacker_publications", "practical_learning", "defensive_resources",
            "osint", "tools_and_documentation", "datasets_and_feeds"}


def index_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _http_url(value: str) -> bool:
    try:
        parts = urlsplit(value)
        _ = parts.port
        return (parts.scheme in {"http", "https"} and bool(parts.hostname)
                and parts.username is None and parts.password is None)
    except ValueError:
        return False


class _Anchors(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.base: str | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "base" and self.base is None:
            self.base = next((value for key, value in attrs if key == "href" and value), None)
        if tag == "a":
            for key, value in attrs:
                if key == "href" and value:
                    self.links.append(value)


class _NoDTDTreeBuilder(ElementTree.TreeBuilder):
    def doctype(self, name, pubid, system):
        # Parser-level rejection also covers UTF-16 and other XML encodings.
        raise ValueError("XML declarations are unsupported")


def _xml_links(raw: bytes, extractor: str) -> list[str]:
    parser = ElementTree.XMLParser(target=_NoDTDTreeBuilder())
    root = ElementTree.fromstring(raw, parser=parser)
    root_tag = _local_tag(root.tag)
    if extractor == "sitemap-urls-v1":
        if root_tag == "sitemapindex":
            raise ValueError("sitemap index requires separate explicit captures")
        if root_tag != "urlset":
            raise ValueError("expected sitemap urlset")
        return [node.text.strip() for row in root if _local_tag(row.tag) == "url"
                for node in row if _local_tag(node.tag) == "loc" and node.text]
    if root_tag == "rss":
        return [node.text.strip() for channel in root if _local_tag(channel.tag) == "channel"
                for row in channel if _local_tag(row.tag) == "item"
                for node in row if _local_tag(node.tag) == "link" and node.text]
    if root_tag == "feed":
        return [node.get("href", "") for row in root if _local_tag(row.tag) == "entry"
                for node in row if _local_tag(node.tag) == "link"
                and node.get("rel", "alternate") == "alternate"
                and node.get("type", "text/html") in {"text/html", "application/xhtml+xml"}]
    raise ValueError("expected RSS or Atom feed")


def _local_tag(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def collect_index(raw: bytes, *, source_url: str, final_url: str, extractor: str) -> dict[str, Any]:
    if not _http_url(source_url) or not _http_url(final_url):
        raise ValueError("source and final URLs must be credential-free HTTP(S)")
    if extractor not in EXTRACTORS:
        raise ValueError("unsupported index extractor")
    if extractor == "html-anchors-v1":
        parser = _Anchors()
        parser.feed(raw.decode("utf-8"))
        links = parser.links
        base = urljoin(final_url, parser.base) if parser.base else final_url
        if not _http_url(base):
            raise ValueError("HTML base must be credential-free HTTP(S)")
    else:
        links = _xml_links(raw, extractor)
    if extractor == "html-anchors-v1":
        urls = {urljoin(base, link.strip()) for link in links if link.strip()}
    else:
        # XML v1 accepts absolute locations only; ignoring xml:base is never
        # permission to invent an identity for a relative feed/sitemap URL.
        urls = {link.strip() for link in links if link.strip()}
    return {
        "schema": INDEX_SCHEMA,
        "selection_authority": False,
        "source_url": source_url,
        "final_url": final_url,
        "response_digest": sha256_identifier(raw),
        "extractor": extractor,
        "urls": sorted(url for url in urls if _http_url(url)),
    }


def _keys(value: Any, expected: set[str], label: str) -> None:
    if not isinstance(value, dict) or set(value) != expected:
        raise ValueError(f"{label} has unsupported or missing fields")


def _text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be nonempty text")
    return value


def compile_review(review: dict[str, Any], snapshot: bytes) -> dict[str, Any]:
    """Explicit review owns type/scope; collection alone grants neither claim."""
    _keys(review, {"schema", "source_id", "corpus", "snapshot_path", "snapshot_digest",
                  "scope", "family", "rationale", "admissions"}, "review")
    if review["schema"] != REVIEW_SCHEMA or review["scope"] != "cybersecurity":
        raise ValueError("unsupported review schema or scope")
    source_id = _text(review["source_id"], "source id")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._:-]{0,127}", source_id):
        raise ValueError("invalid source id")
    _text(review["corpus"], "corpus")
    _text(review["rationale"], "review rationale")
    if not isinstance(review["family"], str) or review["family"] not in FAMILIES:
        raise ValueError("unsupported source family")
    path = Path(_text(review["snapshot_path"], "snapshot path"))
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("snapshot path must be repository-relative")
    digest = sha256_identifier(snapshot)
    if digest != review["snapshot_digest"]:
        raise ValueError("reviewed index snapshot digest mismatch")
    index = json.loads(snapshot)
    _keys(index, {"schema", "selection_authority", "source_url", "final_url",
                  "response_digest", "extractor", "urls"}, "collected index")
    if index["schema"] != INDEX_SCHEMA or index["selection_authority"] is not False:
        raise ValueError("collected index must remain non-authoritative")
    if index["extractor"] not in EXTRACTORS:
        raise ValueError("unsupported index extractor")
    for field in ("source_url", "final_url"):
        if not isinstance(index[field], str) or not _http_url(index[field]):
            raise ValueError("index source URLs must be credential-free HTTP(S)")
    if not isinstance(index["response_digest"], str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", index["response_digest"]):
        raise ValueError("invalid response digest")
    urls = index["urls"]
    if not isinstance(urls, list) or any(not isinstance(url, str) or not _http_url(url) for url in urls):
        raise ValueError("invalid collected URLs")
    if urls != sorted(set(urls)):
        raise ValueError("collected URLs must be sorted and unique")
    admissions = review["admissions"]
    if not isinstance(admissions, list) or not admissions:
        raise ValueError("review requires explicit admissions")
    collected = set(urls)
    admitted: set[str] = set()
    records = []
    for row in admissions:
        _keys(row, {"url", "resource_type"}, "admission")
        url = _text(row["url"], "admission URL")
        if url not in collected:
            raise ValueError(f"admission URL not in collected index: {url}")
        if url in admitted:
            raise ValueError(f"duplicate admission: {url}")
        if not isinstance(row["resource_type"], str) or row["resource_type"] not in RESOURCE_TYPES:
            raise ValueError("unsupported admission resource type")
        admitted.add(url)
        records.append({
            "url": url,
            "resource_type": {"value": row["resource_type"], "basis": {"kind": "source_assertion", "source_id": source_id}},
            "scope_assertions": [{"scope": "cybersecurity", "source_id": source_id}],
        })
    provenance = {
        "schema": PROVENANCE_SCHEMA, "corpus": review["corpus"],
        "sources": [{"id": source_id, "url": index["source_url"], "kind": "manual_review",
                     "revision": digest, "path": review["snapshot_path"], "sha256": digest}],
        "records": sorted(records, key=lambda row: row["url"]),
    }
    compile_provenance(provenance)
    return {"provenance": provenance,
            "counts": {"collected": len(collected), "admitted": len(admitted), "unreviewed": len(collected - admitted)},
            "unreviewed": sorted(collected - admitted)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        review = json.loads(args.review.read_bytes())
        root = args.root.resolve()
        snapshot_path = (root / review["snapshot_path"]).resolve()
        if not snapshot_path.is_relative_to(root):
            raise ValueError("snapshot path escapes repository")
        compiled = compile_review(review, snapshot_path.read_bytes())
        args.out_dir.mkdir(parents=True, exist_ok=True)
        for name, value in compiled.items():
            (args.out_dir / f"{name}.json").write_bytes(index_bytes(value))
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"error: {exc}")
        return 2
    print(json.dumps(compiled["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
