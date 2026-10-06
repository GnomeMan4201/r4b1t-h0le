#!/usr/bin/env python3
"""Recompute Selection v3 site-distribution evidence from pinned corpus bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

try:
    from tools import selection_v3
    from tools import site_key_v1
except ModuleNotFoundError:
    import selection_v3
    import site_key_v1


def compute_report(urls, site_key):
    groups = {}
    for url in urls:
        key = site_key(url)
        groups.setdefault(key, 0)
        groups[key] += 1

    if not groups:
        raise ValueError("SELECTION_V3_METRICS_EMPTY")

    sizes = list(groups.values())
    modes = {}
    for mode in selection_v3.WEIGHT_MODES:
        weights = [selection_v3.site_weight(size, mode) for size in sizes]
        total = sum(weights)
        probabilities = [weight / total for weight in weights]
        if mode == "UNIFORM_SITE":
            effective = len(groups)
        else:
            entropy = -sum(p * math.log(p) for p in probabilities)
            effective = math.exp(entropy)
        modes[mode] = {
            "effective_sites": effective,
            "max_site_probability": max(probabilities),
            "total_weight": total,
        }

    return {
        "schema": "r4b1t-selection-v3-diversity-evidence/v1",
        "url_count": len(urls),
        "site_key_count": len(groups),
        "repeat_guard": "excluded-from-marginal-report",
        "modes": modes,
    }


def digest(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def build_report(root: Path, release_dir: Path):
    urls_path = release_dir / "urls.txt"
    psl_path = root / "selection/site-key-v1/public_suffix_list_ascii_v1.dat"
    overrides_path = root / "selection/site-key-v1/platform-overrides.json"

    urls = [
        line.strip()
        for line in urls_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    psl = site_key_v1.parse_psl(psl_path.read_text(encoding="utf-8"))
    overrides = site_key_v1.parse_overrides(overrides_path.read_text(encoding="utf-8"))
    key = lambda url: site_key_v1.site_key(url, psl, overrides)

    report = compute_report(urls, key)
    report["release"] = {
        "directory": str(release_dir.relative_to(root)),
        "urls_sha256": digest(urls_path),
    }
    report["site_key_authority"] = {
        "version": site_key_v1.SITE_KEY_VERSION,
        "psl_sha256": digest(psl_path),
        "overrides_sha256": digest(overrides_path),
    }
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Recompute Selection v3 diversity evidence from a corpus release."
    )
    parser.add_argument(
        "--release-dir",
        default="corpus/releases/experience-candidate-v0.4",
        help="Release directory containing urls.txt",
    )
    parser.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parent.parent),
        help="Repository root",
    )
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    release_dir = (root / args.release_dir).resolve()
    try:
        release_dir.relative_to(root)
    except ValueError as exc:
        raise SystemExit(f"release directory escapes repository root: {exc}")

    report = build_report(root, release_dir)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
