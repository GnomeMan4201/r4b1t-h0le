#!/usr/bin/env python3
"""Full verifier for the isolated R4B1T Verifiable Chance experiment.

This verifier is independent of the JavaScript derivation implementation.
It verifies the pinned drand Quicknet BLS signature, release/terrain authority,
and the sha256-ctr-rejection/v1 route derivation.

The resulting claim is reproducibility. It does NOT establish that a user
committed to the declaration before the beacon round existed; without an
external pre-round witness, non-cherry-picking remains NOT_ESTABLISHED.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SAFE_INTEGER = 9_007_199_254_740_991
DECLARATION_SCHEMA = "r4b1t-public-roll-declaration/v1"
RECEIPT_SCHEMA = "r4b1t-public-roll-receipt/v1"
TERRAIN_SCHEMA = "r4b1t-terrain-index-v1"
SAMPLER = "sha256-ctr-rejection/v1"
DOMAIN = b"r4b1t-sha256-ctr-rejection/v1\x00"
ROUTE_PREFIX = b"r4b1t-route/v0.1\n"
SHA_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
HEX96_RE = re.compile(r"^[0-9a-f]{96}$")
KEY_RE = re.compile(r"^[A-Za-z0-9_]+$")
QUICKNET_DST = b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"


class VerificationError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        self.code = code
        self.detail = detail
        super().__init__(code + (": " + detail if detail else ""))


def fail(code: str, detail: str = "") -> None:
    raise VerificationError(code, detail)


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail("JSON_INVALID", f"{path}: {exc}")
    if not isinstance(value, dict):
        fail("SHAPE_INVALID", str(path))
    return value


def exact_keys(value: Any, expected: set[str], label: str) -> None:
    if not isinstance(value, dict) or set(value) != expected:
        fail("SHAPE_INVALID", f"{label} keys")


def check_cj1(value: Any, label: str = "$") -> None:
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int) and not isinstance(value, bool):
        if abs(value) > SAFE_INTEGER:
            fail("CANONICAL_PROFILE_VIOLATION", f"{label}: unsafe integer")
        return
    if isinstance(value, float):
        fail("CANONICAL_PROFILE_VIOLATION", f"{label}: floats forbidden")
    if isinstance(value, str):
        try:
            value.encode("utf-8", "strict")
        except UnicodeEncodeError:
            fail("CANONICAL_PROFILE_VIOLATION", f"{label}: invalid Unicode")
        if any(0xD800 <= ord(ch) <= 0xDFFF for ch in value):
            fail("CANONICAL_PROFILE_VIOLATION", f"{label}: lone surrogate")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            check_cj1(item, f"{label}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str) or not KEY_RE.fullmatch(key):
                fail("CANONICAL_PROFILE_VIOLATION", f"{label}: key {key!r}")
            check_cj1(item, f"{label}.{key}")
        return
    fail("CANONICAL_PROFILE_VIOLATION", f"{label}: unsupported type")


def canonical_json(value: Any) -> str:
    check_cj1(value)
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def sha_id(data: bytes) -> str:
    return "sha256:" + sha256(data).hex()


def raw_sha(value: Any, label: str) -> bytes:
    if not isinstance(value, str) or not SHA_RE.fullmatch(value):
        fail("SHAPE_INVALID", f"{label} must be sha256:<hex>")
    return bytes.fromhex(value[7:])


def route_id(url: str) -> str:
    return "sha256:" + sha256(ROUTE_PREFIX + url.encode("utf-8")).hex()


def parse_urls(raw: bytes) -> list[str]:
    try:
        text = raw.decode("utf-8", "strict")
    except UnicodeDecodeError:
        fail("CORPUS_INVALID", "urls.txt is not UTF-8")
    urls = [line.strip() for line in text.splitlines() if line.strip()]
    if not urls:
        fail("CORPUS_INVALID", "empty urls.txt")
    return urls


def pinned_quicknet(root: Path) -> dict[str, Any]:
    config = read_json(root / "experiments/verifiable-chance/quicknet-v1.json")
    exact_keys(
        config,
        {
            "schema", "beacon_id", "chain_hash", "public_key", "period",
            "genesis_time", "scheme_id", "dst", "api_base",
        },
        "quicknet config",
    )
    if (
        config["schema"] != "r4b1t-quicknet-config-v1"
        or config["beacon_id"] != "quicknet"
        or config["scheme_id"] != "bls-unchained-g1-rfc9380"
        or config["period"] != 3
        or not isinstance(config["chain_hash"], str)
        or not HEX64_RE.fullmatch(config["chain_hash"])
        or not isinstance(config["public_key"], str)
        or not re.fullmatch(r"[0-9a-f]{192}", config["public_key"])
        or config["dst"].encode("ascii") != QUICKNET_DST
    ):
        fail("QUICKNET_CONFIG_INVALID")
    return config


def verify_quicknet_beacon(config: dict[str, Any], beacon: dict[str, Any], expected_round: int) -> None:
    exact_keys(beacon, {"round", "randomness", "signature"}, "beacon")
    if (
        isinstance(beacon.get("round"), bool)
        or not isinstance(beacon.get("round"), int)
        or beacon["round"] != expected_round
        or beacon["round"] < 1
        or not isinstance(beacon.get("randomness"), str)
        or not HEX64_RE.fullmatch(beacon["randomness"])
        or not isinstance(beacon.get("signature"), str)
        or not HEX96_RE.fullmatch(beacon["signature"])
    ):
        fail("BEACON_INVALID")

    signature_bytes = bytes.fromhex(beacon["signature"])
    if sha256(signature_bytes).hex() != beacon["randomness"]:
        fail("BEACON_RANDOMNESS_MISMATCH")

    try:
        from py_ecc.bls.g2_primitives import subgroup_check
        from py_ecc.bls.hash_to_curve import hash_to_G1
        from py_ecc.bls.point_compression import decompress_G1, decompress_G2
        from py_ecc.fields import optimized_bls12_381_FQ12 as FQ12
        from py_ecc.optimized_bls12_381 import (
            G2,
            final_exponentiate,
            is_inf,
            neg,
            pairing,
        )
    except ImportError as exc:
        fail("BLS_VERIFIER_UNAVAILABLE", str(exc))

    try:
        signature = decompress_G1(int.from_bytes(signature_bytes, "big"))
        public_key_bytes = bytes.fromhex(config["public_key"])
        public_key = decompress_G2(
            (
                int.from_bytes(public_key_bytes[:48], "big"),
                int.from_bytes(public_key_bytes[48:], "big"),
            )
        )
        if is_inf(signature) or is_inf(public_key):
            fail("BEACON_SIGNATURE_INVALID", "point at infinity")
        if not subgroup_check(signature) or not subgroup_check(public_key):
            fail("BEACON_SIGNATURE_INVALID", "subgroup")
        round_message = sha256(beacon["round"].to_bytes(8, "big"))
        hashed = hash_to_G1(round_message, QUICKNET_DST, hashlib.sha256)
        product = pairing(G2, signature, final_exponentiate=False) * pairing(
            neg(public_key), hashed, final_exponentiate=False
        )
        if final_exponentiate(product) != FQ12.one():
            fail("BEACON_SIGNATURE_INVALID")
    except VerificationError:
        raise
    except Exception as exc:
        fail("BEACON_SIGNATURE_INVALID", str(exc))


def release_bytes(root: Path, binding: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    exact_keys(binding, {"release_id", "urls_digest", "resources_digest"}, "release binding")
    release_dir = root / "corpus" / "releases" / binding["release_id"]
    manifest = read_json(release_dir / "manifest.json")
    if (
        manifest.get("release_id") != binding["release_id"]
        or manifest.get("urls_digest") != binding["urls_digest"]
        or manifest.get("resources_digest") != binding["resources_digest"]
    ):
        fail("RELEASE_BINDING_MISMATCH")
    try:
        url_bytes = (release_dir / "urls.txt").read_bytes()
        resource_bytes = (release_dir / "resources.json").read_bytes()
    except OSError as exc:
        fail("FILE_UNAVAILABLE", str(exc))
    if sha_id(url_bytes) != binding["urls_digest"]:
        fail("CORPUS_DIGEST_MISMATCH")
    if sha_id(resource_bytes) != binding["resources_digest"]:
        fail("RESOURCES_DIGEST_MISMATCH")
    return manifest, parse_urls(url_bytes)


def terrain_index(
    root: Path, binding: dict[str, Any], terrain_ref: dict[str, Any]
) -> tuple[dict[str, Any], str]:
    exact_keys(terrain_ref, {"schema", "digest"}, "terrain_index")
    if terrain_ref["schema"] != TERRAIN_SCHEMA or not SHA_RE.fullmatch(terrain_ref["digest"]):
        fail("TERRAIN_INDEX_INVALID")
    registry = read_json(root / "corpus/runtime/eligibility-profiles-v1.json")
    if registry.get("schema") != "r4b1t-eligibility-profiles-v1":
        fail("REGISTRY_INVALID")
    profiles = []
    for profile in registry.get("profiles", []):
        release = profile.get("release") if isinstance(profile, dict) else None
        terrain = profile.get("terrain_index") if isinstance(profile, dict) else None
        if (
            isinstance(release, dict)
            and release.get("release_id") == binding["release_id"]
            and release.get("urls_digest") == binding["urls_digest"]
            and release.get("resources_digest") == binding["resources_digest"]
            and isinstance(terrain, dict)
            and terrain.get("schema") == TERRAIN_SCHEMA
            and terrain.get("digest") == terrain_ref["digest"]
            and profile.get("status") in {"active", "superseded"}
        ):
            profiles.append(profile)
    if len(profiles) != 1:
        fail("TERRAIN_MAP_NOT_AUTHORITATIVE")
    profile = profiles[0]
    rel = profile["terrain_index"].get("path")
    if not isinstance(rel, str) or not rel:
        fail("TERRAIN_INDEX_INVALID", "path")
    path = (root / rel).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        fail("TERRAIN_INDEX_INVALID", "path escape")
    raw = path.read_bytes()
    if sha_id(raw) != terrain_ref["digest"]:
        fail("TERRAIN_INDEX_DIGEST_MISMATCH")
    text = raw.decode("utf-8", "strict")
    index = json.loads(text)
    if canonical_json(index) + "\n" != text:
        fail("TERRAIN_INDEX_NOT_CANONICAL")
    release = index.get("release")
    if (
        not isinstance(release, dict)
        or release.get("release_id") != binding["release_id"]
        or release.get("urls_digest") != binding["urls_digest"]
        or release.get("resources_digest") != binding["resources_digest"]
    ):
        fail("TERRAIN_INDEX_BINDING_MISMATCH")
    authority = (
        "AUTHORITATIVE_ACTIVE"
        if profile["status"] == "active"
        else "AUTHORITATIVE_SUPERSEDED"
    )
    return index, authority


def eligible_pool(root: Path, declaration: dict[str, Any]) -> tuple[list[str], str | None]:
    _, urls = release_bytes(root, declaration["release"])
    constraint = declaration["constraint"]
    exact_keys(constraint, {"terrain", "terrain_index", "protocol_policy"}, "constraint")
    policy = constraint["protocol_policy"]
    exact_keys(policy, {"version", "exclude_onion"}, "protocol_policy")
    if policy["version"] != 1 or not isinstance(policy["exclude_onion"], bool):
        fail("CONSTRAINT_INVALID", "protocol_policy")

    authority = None
    if constraint["terrain"] == "ALL":
        if constraint["terrain_index"] is not None:
            fail("CONSTRAINT_INVALID", "ALL terrain_index")
        pool = list(urls)
    else:
        if not isinstance(constraint["terrain"], str) or not constraint["terrain"]:
            fail("CONSTRAINT_INVALID", "terrain")
        index, authority = terrain_index(root, declaration["release"], constraint["terrain_index"])
        matches = [
            entry
            for entry in index.get("terrains", [])
            if isinstance(entry, dict) and entry.get("id") == constraint["terrain"]
        ]
        if len(matches) != 1:
            fail("TERRAIN_UNKNOWN", str(constraint["terrain"]))
        entry = matches[0]
        members = entry.get("members")
        if not isinstance(members, list) or entry.get("count") != len(members):
            fail("TERRAIN_INDEX_INVALID", "members/count")
        pool = []
        previous = -1
        for member in members:
            if (
                isinstance(member, bool)
                or not isinstance(member, int)
                or member <= previous
                or member < 0
                or member >= len(urls)
            ):
                fail("TERRAIN_INDEX_INVALID", "member order/range")
            previous = member
            pool.append(urls[member])

    if policy["exclude_onion"]:
        pool = [url for url in pool if ".onion" not in url]
    if not pool:
        fail("EMPTY_ELIGIBLE_POOL")
    return pool, authority


def declaration_id(declaration: dict[str, Any]) -> str:
    return sha_id(canonical_json(declaration).encode("utf-8"))


def verify_declaration(root: Path, envelope: dict[str, Any]) -> dict[str, Any]:
    exact_keys(envelope, {"declaration_id", "declaration"}, "declaration envelope")
    raw_sha(envelope["declaration_id"], "declaration_id")
    declaration = envelope["declaration"]
    exact_keys(
        declaration,
        {"schema", "release", "constraint", "sampler", "beacon"},
        "declaration",
    )
    if declaration["schema"] != DECLARATION_SCHEMA:
        fail("DECLARATION_FORMAT_UNSUPPORTED")
    exact_keys(declaration["sampler"], {"algorithm"}, "sampler")
    if declaration["sampler"]["algorithm"] != SAMPLER:
        fail("SAMPLER_UNSUPPORTED")
    beacon_decl = declaration["beacon"]
    exact_keys(beacon_decl, {"network", "chain_hash", "round"}, "beacon declaration")
    quicknet = pinned_quicknet(root)
    if (
        beacon_decl["network"] != "quicknet"
        or beacon_decl["chain_hash"] != quicknet["chain_hash"]
        or isinstance(beacon_decl["round"], bool)
        or not isinstance(beacon_decl["round"], int)
        or beacon_decl["round"] < 1
    ):
        fail("BEACON_DECLARATION_INVALID")
    if declaration_id(declaration) != envelope["declaration_id"]:
        fail("DECLARATION_ID_MISMATCH")
    eligible_pool(root, declaration)
    return declaration


def derive_index(declaration_id_value: str, randomness_hex: str, pool_size: int) -> tuple[int, int, str]:
    if pool_size < 1:
        fail("EMPTY_ELIGIBLE_POOL")
    declaration_digest = raw_sha(declaration_id_value, "declaration_id")
    randomness = bytes.fromhex(randomness_hex)
    space = 1 << 256
    limit = space - (space % pool_size)
    counter = 0
    while counter <= SAFE_INTEGER:
        block = sha256(
            DOMAIN
            + declaration_digest
            + randomness
            + counter.to_bytes(8, "big")
        )
        value = int.from_bytes(block, "big")
        if value < limit:
            return counter, value % pool_size, block.hex()
        counter += 1
    fail("SAMPLER_EXHAUSTED")


def verify_receipt(root: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    exact_keys(receipt, {"schema", "declaration", "beacon", "selection", "witness"}, "receipt")
    if receipt["schema"] != RECEIPT_SCHEMA:
        fail("RECEIPT_FORMAT_UNSUPPORTED")
    if receipt["witness"] is not None:
        fail("WITNESS_UNSUPPORTED", "v1 prototype accepts null only")

    declaration = verify_declaration(root, receipt["declaration"])
    quicknet = pinned_quicknet(root)
    verify_quicknet_beacon(quicknet, receipt["beacon"], declaration["beacon"]["round"])
    pool, authority = eligible_pool(root, declaration)
    counter, index, block = derive_index(
        receipt["declaration"]["declaration_id"],
        receipt["beacon"]["randomness"],
        len(pool),
    )
    url = pool[index]
    expected_selection = {
        "sampler": SAMPLER,
        "eligible_count": len(pool),
        "counter": counter,
        "block": block,
        "index": index,
        "terrain_authority": authority,
        "route": {"route_id": route_id(url), "url": url},
    }
    if canonical_json(receipt["selection"]) != canonical_json(expected_selection):
        fail("SELECTION_REPRODUCTION_MISMATCH")

    return {
        "status": "PUBLIC_ROLL_VERIFIED",
        "declaration_id": receipt["declaration"]["declaration_id"],
        "release_id": declaration["release"]["release_id"],
        "round": receipt["beacon"]["round"],
        "route": expected_selection["route"],
        "claims": {
            "declaration_integrity": "PROVEN",
            "release_binding": "PROVEN",
            "beacon_randomness_binding": "PROVEN",
            "beacon_signature": "PROVEN",
            "route_derivation": "PROVEN",
            "non_cherry_picked": "NOT_ESTABLISHED",
        },
    }


def self_test(root: Path) -> dict[str, Any]:
    config = pinned_quicknet(root)
    beacon = read_json(
        root
        / "experiments"
        / "verifiable-chance"
        / "fixtures"
        / "quicknet-round-1000.json"
    )
    verify_quicknet_beacon(config, beacon, 1000)
    return {
        "status": "QUICKNET_VECTOR_VERIFIED",
        "round": 1000,
        "chain_hash": config["chain_hash"],
        "scheme_id": config["scheme_id"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    sub = parser.add_subparsers(dest="command", required=True)
    verify = sub.add_parser("verify")
    verify.add_argument("receipt")
    sub.add_parser("self-test")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    try:
        if args.command == "self-test":
            report = self_test(root)
        else:
            report = verify_receipt(root, read_json(Path(args.receipt)))
        print(json.dumps(report, sort_keys=True, separators=(",", ":")))
        return 0
    except VerificationError as exc:
        print(
            json.dumps(
                {
                    "status": "VERIFICATION_FAILED",
                    "code": exc.code,
                    "detail": exc.detail,
                },
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
