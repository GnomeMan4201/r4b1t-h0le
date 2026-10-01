#!/usr/bin/env python3
"""Capture a public archive/feed/sitemap as a non-authoritative URL-only index.

No crawling, classification, admission, or runtime promotion takes place here.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree.ElementTree import ParseError

try:
    from tools.reviewed_source_index import EXTRACTORS, collect_index, index_bytes
except ModuleNotFoundError:
    from reviewed_source_index import EXTRACTORS, collect_index, index_bytes

MAX_BYTES = 20_000_000


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--extractor", choices=sorted(EXTRACTORS), required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        # Validate before requesting; the collector repeats validation after redirects.
        collect_index(b"", source_url=args.url, final_url=args.url, extractor="html-anchors-v1")
        request = Request(args.url, headers={"User-Agent": "R4B1T-source-index/1.0 (+https://github.com/GnomeMan4201/r4b1t-h0le)"})
        with urlopen(request, timeout=20) as response:
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError("source exceeds 20 MB capture limit")
            index = collect_index(raw, source_url=args.url, final_url=response.url, extractor=args.extractor)
        if not index["urls"]:
            raise ValueError("source returned no candidate URLs")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(index_bytes(index))
    except (OSError, ValueError, ParseError) as exc:
        print(f"error: {exc}")
        return 2
    print(f"collected {len(index['urls'])} URLs; none admitted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
