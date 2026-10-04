#!/usr/bin/env python3
"""Independent re-executor for r4b1t-trail/v0.3 local ROLL provenance.

This module intentionally does not import or execute the JavaScript runtime.
It re-implements the frozen local sampler and eligibility rules from repository
bytes so a recorded ROLL can be checked independently.

It proves derivation from the declared release, constraint, seed, sampler
interval, and repeat guard. It does not prove fair seed generation, wall-clock
ordering, human viewing, or non-cherry-picking.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from tools import cj1 as shared_cj1
except ModuleNotFoundError:
    import cj1 as shared_cj1
from urllib.parse import urlsplit

FORMAT = "r4b1t-trail/v0.3"
TRANSACTION = "r4b1t-selection-transaction/v2"
TERRAIN_SCHEMA = "r4b1t-terrain-index-v1"
REGISTRY_SCHEMA = "r4b1t-eligibility-profiles-v1"
SAMPLER_ALGORITHM = "uniform-with-repeat-guard-v1"
PRNG = "mulberry32-v1"
ROUTE_PREFIX = "r4b1t-route/v0.1\n"
SHA_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
CJ_KEY_RE = re.compile(r"^[A-Za-z0-9_]+$")
SAFE_INTEGER = 9_007_199_254_740_991
MASK32 = 0xFFFFFFFF
TWO32 = 1 << 32


class ReexecutionError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        self.code = code
        self.detail = detail
        super().__init__(code + (": " + detail if detail else ""))


def fail(code: str, detail: str = "") -> None:
    raise ReexecutionError(code, detail)


def exact_keys(value: Any, expected: set[str], label: str) -> None:
    if not isinstance(value, dict) or set(value) != expected:
        fail("SHAPE_INVALID", f"{label} keys")


def safe_int(value: Any, label: str, minimum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        fail("SHAPE_INVALID", f"{label} must be an integer")
    if abs(value) > SAFE_INTEGER:
        fail("CANONICAL_PROFILE_VIOLATION", f"{label} outside safe-integer range")
    if minimum is not None and value < minimum:
        fail("SHAPE_INVALID", f"{label} below minimum")
    return value


def valid_sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SHA_RE.fullmatch(value):
        fail("SHAPE_INVALID", f"{label} must be a sha256 identifier")
    return value


def valid_url(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        fail("SHAPE_INVALID", f"{label} must be a non-empty canonical URL string")
    try:
        parsed = urlsplit(value)
    except ValueError:
        fail("SHAPE_INVALID", f"{label} is not a URL")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        fail("SHAPE_INVALID", f"{label} must use HTTP or HTTPS")
    if parsed.username is not None or parsed.password is not None:
        fail("SHAPE_INVALID", f"{label} contains credentials")
    return value


def cj1_check(value: Any, label: str = "value") -> None:
    try:
        shared_cj1.cj1_check(value, label)
    except shared_cj1.CanonicalProfileError as error:
        fail("CANONICAL_PROFILE_VIOLATION", str(error))


def cj1_serialize(value: Any) -> str:
    cj1_check(value)
    return shared_cj1.cj1_serialize(value)


def digest_bytes(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def route_id(url: str) -> str:
    return "sha256:" + hashlib.sha256((ROUTE_PREFIX + url).encode("utf-8")).hexdigest()


def seed_to_uint32(seed: str) -> int:
    """FNV-1a folding used by trail-manifest.js before Mulberry32."""
    h = 2_166_136_261
    for byte in str(seed).encode("utf-8"):
        h ^= byte
        h = (h * 16_777_619) & MASK32
    return h


class Mulberry32:
    def __init__(self, seed: str) -> None:
        self.state = seed_to_uint32(seed)

    def next_uint32(self) -> int:
        self.state = (self.state + 0x6D2B79F5) & MASK32
        mixed = self.state
        mixed = ((mixed ^ (mixed >> 15)) * (mixed | 1)) & MASK32
        mixed ^= (mixed + (((mixed ^ (mixed >> 7)) * (mixed | 61)) & MASK32)) & MASK32
        mixed &= MASK32
        return (mixed ^ (mixed >> 14)) & MASK32

    def pool_index(self, pool_size: int) -> int:
        if pool_size < 1:
            fail("EMPTY_ELIGIBLE_POOL")
        # Equivalent to Math.floor((uint32 / 2^32) * pool_size), without floats.
        return (self.next_uint32() * pool_size) // TWO32


@dataclass(frozen=True)
class Release:
    release_id: str
    directory: Path
    manifest: dict[str, Any]
    urls: list[str]


@dataclass(frozen=True)
class TerrainIndex:
    digest: str
    document: dict[str, Any]
    status: str
    profile_id: str


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        fail("FILE_UNAVAILABLE", f"{label}: {exc}")
    try:
        value = json.loads(raw.decode("utf-8", "strict"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail("JSON_INVALID", f"{label}: {exc}")
    if not isinstance(value, dict):
        fail("SHAPE_INVALID", f"{label} must be an object")
    return value


def _parse_urls(raw: bytes) -> list[str]:
    try:
        text = raw.decode("utf-8", "strict")
    except UnicodeDecodeError:
        fail("CORPUS_INVALID", "urls.txt is not UTF-8")
    urls: list[str] = []
    for line in text.splitlines():
        value = line.strip()
        if not value:
            continue
        urls.append(valid_url(value, "corpus URL"))
    if not urls:
        fail("CORPUS_INVALID", "release contains no usable routes")
    return urls


def find_release(root: Path, corpus_revision: str) -> Release:
    releases = root / "corpus" / "releases"
    if not releases.is_dir():
        fail("RELEASE_UNAVAILABLE", str(releases))

    matches: list[tuple[Path, dict[str, Any]]] = []
    for manifest_path in sorted(releases.glob("*/manifest.json")):
        manifest = _read_json(manifest_path, str(manifest_path.relative_to(root)))
        if manifest.get("urls_digest") == corpus_revision:
            matches.append((manifest_path.parent, manifest))

    if not matches:
        fail("RELEASE_UNAVAILABLE", corpus_revision)
    if len(matches) > 1:
        ids = ",".join(str(m.get("release_id")) for _, m in matches)
        fail("RELEASE_AMBIGUOUS", ids)

    directory, manifest = matches[0]
    release_id = manifest.get("release_id")
    if not isinstance(release_id, str) or not release_id:
        fail("RELEASE_INVALID", "release_id")
    valid_sha(manifest.get("urls_digest"), "release urls_digest")
    resources_digest = valid_sha(manifest.get("resources_digest"), "release resources_digest")

    urls_path = directory / "urls.txt"
    try:
        url_bytes = urls_path.read_bytes()
    except OSError as exc:
        fail("FILE_UNAVAILABLE", f"{urls_path}: {exc}")
    if digest_bytes(url_bytes) != corpus_revision:
        fail("CORPUS_DIGEST_MISMATCH", release_id)
    urls = _parse_urls(url_bytes)

    resources_path = directory / "resources.json"
    try:
        resource_bytes = resources_path.read_bytes()
    except OSError as exc:
        fail("FILE_UNAVAILABLE", f"{resources_path}: {exc}")
    if digest_bytes(resource_bytes) != resources_digest:
        fail("RESOURCES_DIGEST_MISMATCH", release_id)

    counts = manifest.get("counts")
    if isinstance(counts, dict) and isinstance(counts.get("resources"), int):
        if counts["resources"] != len(urls):
            fail("RELEASE_INVALID", "manifest resource count does not match urls.txt")

    return Release(release_id, directory, manifest, urls)


def load_authoritative_terrain(
    root: Path,
    release: Release,
    declared_digest: str,
) -> TerrainIndex:
    registry_path = root / "corpus" / "runtime" / "eligibility-profiles-v1.json"
    registry = _read_json(registry_path, "eligibility profile registry")
    if registry.get("schema") != REGISTRY_SCHEMA or not isinstance(registry.get("profiles"), list):
        fail("REGISTRY_INVALID")

    resources_digest = release.manifest["resources_digest"]
    candidates = []
    for profile in registry["profiles"]:
        if not isinstance(profile, dict):
            continue
        binding = profile.get("release")
        terrain = profile.get("terrain_index")
        if (
            isinstance(binding, dict)
            and binding.get("release_id") == release.release_id
            and binding.get("urls_digest") == release.manifest["urls_digest"]
            and binding.get("resources_digest") == resources_digest
            and isinstance(terrain, dict)
            and terrain.get("digest") == declared_digest
        ):
            candidates.append(profile)

    if not candidates:
        fail("TERRAIN_MAP_NOT_AUTHORITATIVE", declared_digest)
    if len(candidates) != 1:
        fail("REGISTRY_INVALID", "duplicate terrain binding")

    profile = candidates[0]
    status = profile.get("status")
    if status not in {"active", "superseded"}:
        fail("TERRAIN_MAP_NOT_AUTHORITATIVE", f"unsupported profile status {status!r}")

    terrain_meta = profile["terrain_index"]
    if terrain_meta.get("schema") != TERRAIN_SCHEMA:
        fail("TERRAIN_INDEX_INVALID", "schema")
    rel = terrain_meta.get("path")
    if not isinstance(rel, str) or not rel:
        fail("TERRAIN_INDEX_INVALID", "path")

    path = (root / rel).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        fail("TERRAIN_INDEX_INVALID", "path escapes repository")

    try:
        raw = path.read_bytes()
    except OSError as exc:
        fail("FILE_UNAVAILABLE", f"{rel}: {exc}")
    if digest_bytes(raw) != declared_digest:
        fail("TERRAIN_INDEX_DIGEST_MISMATCH", rel)

    try:
        text = raw.decode("utf-8", "strict")
        doc = json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail("TERRAIN_INDEX_INVALID", str(exc))
    if not isinstance(doc, dict):
        fail("TERRAIN_INDEX_INVALID", "document")
    if cj1_serialize(doc) + "\n" != text:
        fail("TERRAIN_INDEX_NOT_CANONICAL")

    exact_keys(doc, {"schema", "release", "vocabulary", "terrains"}, "terrain index")
    if doc["schema"] != TERRAIN_SCHEMA or doc["vocabulary"] != "resource-type-identity-v1":
        fail("TERRAIN_INDEX_INVALID", "schema/vocabulary")
    binding = doc["release"]
    exact_keys(binding, {"release_id", "urls_digest", "resources_digest"}, "terrain release")
    if (
        binding["release_id"] != release.release_id
        or binding["urls_digest"] != release.manifest["urls_digest"]
        or binding["resources_digest"] != resources_digest
    ):
        fail("TERRAIN_INDEX_BINDING_MISMATCH")
    if not isinstance(doc["terrains"], list) or not doc["terrains"]:
        fail("TERRAIN_INDEX_INVALID", "terrains")

    return TerrainIndex(
        declared_digest,
        doc,
        "AUTHORITATIVE_ACTIVE" if status == "active" else "AUTHORITATIVE_SUPERSEDED",
        str(profile.get("profile_id") or ""),
    )


def eligible_pool(
    release: Release,
    constraint: dict[str, Any],
    terrain_cache: dict[str, TerrainIndex],
    root: Path,
) -> tuple[list[str], TerrainIndex | None]:
    exact_keys(constraint, {"terrain", "terrainIndex", "protocolPolicy"}, "ROLL constraint")
    terrain = constraint.get("terrain")
    if not isinstance(terrain, str) or not terrain:
        fail("CONSTRAINT_INVALID", "terrain")

    policy = constraint.get("protocolPolicy")
    exact_keys(policy, {"version", "excludeOnion"}, "protocol policy")
    if policy.get("version") != 1 or not isinstance(policy.get("excludeOnion"), bool):
        fail("CONSTRAINT_INVALID", "protocolPolicy")

    bound_index: TerrainIndex | None = None
    if terrain == "ALL":
        if constraint.get("terrainIndex") is not None:
            fail("CONSTRAINT_INVALID", "ALL terrain must not bind an index")
        pool = list(release.urls)
    else:
        terrain_ref = constraint.get("terrainIndex")
        exact_keys(terrain_ref, {"schema", "digest"}, "terrainIndex")
        if terrain_ref.get("schema") != TERRAIN_SCHEMA:
            fail("CONSTRAINT_INVALID", "terrain index schema")
        digest = valid_sha(terrain_ref.get("digest"), "terrain index digest")
        bound_index = terrain_cache.get(digest)
        if bound_index is None:
            bound_index = load_authoritative_terrain(root, release, digest)
            terrain_cache[digest] = bound_index

        matches = [
            item for item in bound_index.document["terrains"]
            if isinstance(item, dict) and item.get("id") == terrain
        ]
        if len(matches) != 1:
            fail("TERRAIN_UNKNOWN", terrain)
        entry = matches[0]
        members = entry.get("members")
        if not isinstance(members, list) or not members:
            fail("TERRAIN_INDEX_INVALID", f"{terrain} members")
        pool = []
        previous = -1
        for member in members:
            member = safe_int(member, f"{terrain} member", 0)
            if member <= previous or member >= len(release.urls):
                fail("TERRAIN_INDEX_INVALID", f"{terrain} member order/range")
            previous = member
            pool.append(release.urls[member])
        if entry.get("count") != len(pool):
            fail("TERRAIN_INDEX_INVALID", f"{terrain} count")

    if policy["excludeOnion"]:
        pool = [url for url in pool if ".onion" not in url]
    if not pool:
        fail("EMPTY_ELIGIBLE_POOL", terrain)
    return pool, bound_index


def verify_route(route: Any, label: str) -> str:
    exact_keys(route, {"route_id", "url"}, label)
    url = valid_url(route.get("url"), f"{label} URL")
    if route.get("route_id") != route_id(url):
        fail("ROUTE_ID_MISMATCH", label)
    return url


def verify_integrity(envelope: Any) -> dict[str, Any]:
    exact_keys(envelope, {"trail_id", "manifest"}, "envelope")
    valid_sha(envelope.get("trail_id"), "trail_id")
    manifest = envelope.get("manifest")
    exact_keys(manifest, {"format", "created_at", "corpus_revision", "steps", "parent"}, "manifest")
    if manifest.get("format") != FORMAT:
        fail("FORMAT_UNSUPPORTED", str(manifest.get("format")))
    valid_sha(manifest.get("corpus_revision"), "corpus_revision")
    if not isinstance(manifest.get("created_at"), str) or not manifest["created_at"]:
        fail("SHAPE_INVALID", "created_at")
    if not isinstance(manifest.get("steps"), list):
        fail("SHAPE_INVALID", "steps")
    parent = manifest.get("parent")
    if parent is not None:
        exact_keys(parent, {"trail_id", "fork_at"}, "parent")
        valid_sha(parent.get("trail_id"), "parent trail_id")
        safe_int(parent.get("fork_at"), "parent fork_at", 0)

    expected_id = "sha256:" + hashlib.sha256(cj1_serialize(manifest).encode("utf-8")).hexdigest()
    if envelope["trail_id"] != expected_id:
        fail("TRAIL_ID_MISMATCH")

    for offset, step in enumerate(manifest["steps"], start=1):
        if not isinstance(step, dict) or step.get("index") != offset:
            fail("STEP_INDEX_INVALID", str(offset))
        kind = step.get("kind")
        if kind == "ROLL":
            exact_keys(step, {"index", "kind", "route", "transaction"}, f"ROLL step {offset}")
        elif kind == "SELECT":
            exact_keys(step, {"index", "kind", "route"}, f"SELECT step {offset}")
        elif kind == "BRANCH":
            exact_keys(step, {"index", "kind", "route", "navigation"}, f"BRANCH step {offset}")
            nav = step.get("navigation")
            exact_keys(nav, {"from_step", "branch_label"}, f"BRANCH navigation {offset}")
            source = safe_int(nav.get("from_step"), "BRANCH from_step", 1)
            if source >= offset or not isinstance(nav.get("branch_label"), str) or not nav["branch_label"].strip():
                fail("SHAPE_INVALID", f"BRANCH navigation {offset}")
        elif kind == "IMPORTED":
            exact_keys(step, {"index", "kind", "route", "source"}, f"IMPORTED step {offset}")
            source = step.get("source")
            exact_keys(source, {"format", "trail_id", "step_index"}, f"IMPORTED source {offset}")
            valid_sha(source.get("trail_id"), "imported trail_id")
            safe_int(source.get("step_index"), "imported step_index", 1)
        else:
            fail("STEP_KIND_UNSUPPORTED", f"{offset}:{kind}")
        verify_route(step.get("route"), f"step {offset} route")
    return manifest


def validate_roll_transaction(
    transaction: Any,
    step_url: str,
    corpus_revision: str,
) -> tuple[str, dict[str, Any], dict[str, Any]]:
    exact_keys(
        transaction,
        {
            "transaction_version", "sequence", "action", "constraint",
            "corpus_revision", "eligible_count", "sampler", "route",
        },
        "ROLL transaction",
    )
    if transaction.get("transaction_version") != TRANSACTION or transaction.get("action") != "ROLL":
        fail("TRANSACTION_INVALID", "version/action")
    safe_int(transaction.get("sequence"), "transaction sequence", 1)
    if transaction.get("corpus_revision") != corpus_revision:
        fail("TRANSACTION_INVALID", "corpus revision")
    safe_int(transaction.get("eligible_count"), "eligible_count", 1)

    route = transaction.get("route")
    exact_keys(route, {"url"}, "transaction route")
    if valid_url(route.get("url"), "transaction route URL") != step_url:
        fail("TRANSACTION_ROUTE_MISMATCH")

    sampler = transaction.get("sampler")
    exact_keys(
        sampler,
        {"algorithm", "prng", "seed", "draw_start", "draw_count", "repeat_guard"},
        "sampler",
    )
    if sampler.get("algorithm") != SAMPLER_ALGORITHM or sampler.get("prng") != PRNG:
        fail("SAMPLER_UNSUPPORTED")
    seed = sampler.get("seed")
    if not isinstance(seed, str) or not seed:
        fail("SAMPLER_INVALID", "seed")
    safe_int(sampler.get("draw_start"), "draw_start", 0)
    safe_int(sampler.get("draw_count"), "draw_count", 1)

    guard = sampler.get("repeat_guard")
    exact_keys(guard, {"reference", "max_draws"}, "repeat_guard")
    if guard.get("reference") is not None:
        valid_url(guard.get("reference"), "repeat_guard reference")
    if guard.get("max_draws") != 30:
        fail("SAMPLER_UNSUPPORTED", "repeat_guard max_draws")

    constraint = transaction.get("constraint")
    if not isinstance(constraint, dict):
        fail("CONSTRAINT_INVALID")
    return seed, sampler, constraint


def reexecute(envelope: Any, root: Path) -> dict[str, Any]:
    root = root.resolve()
    manifest = verify_integrity(envelope)
    release = find_release(root, manifest["corpus_revision"])

    sequence = 0
    cursor = 0
    seed: str | None = None
    previous_roll_url: str | None = None
    prng: Mulberry32 | None = None
    terrain_cache: dict[str, TerrainIndex] = {}
    roll_results: list[dict[str, Any]] = []

    for step in manifest["steps"]:
        if step["kind"] != "ROLL":
            continue
        sequence += 1
        step_url = step["route"]["url"]
        tx = step["transaction"]
        tx_seed, sampler, constraint = validate_roll_transaction(
            tx, step_url, manifest["corpus_revision"]
        )

        if tx["sequence"] != sequence:
            fail("ROLL_CONTINUITY_MISMATCH", f"step {step['index']} sequence")
        if sampler["draw_start"] != cursor:
            fail("ROLL_CONTINUITY_MISMATCH", f"step {step['index']} draw_start")
        if sampler["repeat_guard"]["reference"] != previous_roll_url:
            fail("ROLL_CONTINUITY_MISMATCH", f"step {step['index']} repeat guard")

        if seed is None:
            seed = tx_seed
            prng = Mulberry32(seed)
        elif tx_seed != seed:
            fail("ROLL_CONTINUITY_MISMATCH", f"step {step['index']} seed")
        assert prng is not None

        pool, terrain_index = eligible_pool(release, constraint, terrain_cache, root)
        if tx["eligible_count"] != len(pool):
            fail(
                "ELIGIBLE_COUNT_MISMATCH",
                f"step {step['index']}: declared {tx['eligible_count']}, actual {len(pool)}",
            )

        reference = previous_roll_url
        selected = None
        consumed = 0
        while consumed < 30:
            selected = pool[prng.pool_index(len(pool))]
            consumed += 1
            if reference is None or selected != reference:
                break

        if sampler["draw_count"] != consumed:
            fail(
                "DRAW_COUNT_MISMATCH",
                f"step {step['index']}: declared {sampler['draw_count']}, actual {consumed}",
            )
        if selected != step_url:
            fail(
                "ROUTE_REEXECUTION_MISMATCH",
                f"step {step['index']}: expected {selected!r}, recorded {step_url!r}",
            )

        cursor += consumed
        previous_roll_url = step_url
        roll_results.append(
            {
                "step": step["index"],
                "sequence": sequence,
                "url": step_url,
                "terrain": constraint["terrain"],
                "eligible_count": len(pool),
                "draw_start": sampler["draw_start"],
                "draw_count": consumed,
                "terrain_authority": terrain_index.status if terrain_index else "NOT_APPLICABLE_ALL",
            }
        )

    return {
        "status": "PROVENANCE_REEXECUTED",
        "trail_id": envelope["trail_id"],
        "format": FORMAT,
        "corpus_revision": manifest["corpus_revision"],
        "release_id": release.release_id,
        "roll_steps": len(roll_results),
        "seed_state_bits": 32,
        "rolls": roll_results,
        "claims": {
            "route_derivation": "PROVEN",
            "seed_fairness": "NOT_ESTABLISHED",
            "non_cherry_picking": "NOT_ESTABLISHED",
            "wall_clock_order": "NOT_ESTABLISHED",
            "human_viewing": "NOT_ESTABLISHED",
        },
    }


def _load_input(path: str) -> Any:
    try:
        raw = sys.stdin.buffer.read() if path == "-" else Path(path).read_bytes()
    except OSError as exc:
        fail("FILE_UNAVAILABLE", str(exc))
    try:
        return json.loads(raw.decode("utf-8", "strict"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail("JSON_INVALID", str(exc))


def default_root() -> Path:
    return Path(__file__).resolve().parent.parent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Independently re-execute local ROLL provenance in a r4b1t trail v0.3 artifact."
    )
    parser.add_argument("trail", help="Trail JSON path, or - for stdin")
    parser.add_argument("--root", default=str(default_root()), help="r4b1t repository root")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args(argv)

    try:
        envelope = _load_input(args.trail)
        result = reexecute(envelope, Path(args.root))
    except ReexecutionError as exc:
        if args.json:
            print(json.dumps({"status": "REEXECUTION_FAILED", "code": exc.code, "detail": exc.detail}, sort_keys=True))
        else:
            print(f"REEXECUTION FAILED [{exc.code}]" + (f": {exc.detail}" if exc.detail else ""), file=sys.stderr)
        return 1
    except Exception as exc:  # fail closed without a traceback in normal CLI use
        if args.json:
            print(json.dumps({"status": "REEXECUTION_FAILED", "code": "INTERNAL_ERROR", "detail": str(exc)}, sort_keys=True))
        else:
            print(f"REEXECUTION FAILED [INTERNAL_ERROR]: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    else:
        print(f"PROVENANCE REEXECUTED: {result['roll_steps']} ROLL step(s)")
        print(f"release: {result['release_id']}")
        print(f"corpus:  {result['corpus_revision']}")
        for roll in result["rolls"]:
            print(
                f"step {roll['step']}: {roll['url']} "
                f"[{roll['terrain']}; {roll['eligible_count']} eligible; "
                f"draws {roll['draw_start']}+{roll['draw_count']}]"
            )
        print("bounded claims: route derivation PROVEN; seed fairness / non-cherry-picking / wall-clock order NOT ESTABLISHED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
