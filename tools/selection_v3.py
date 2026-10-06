"""Integer-only selection transaction v3 reference implementation."""

from __future__ import annotations

import json
import math

TRANSACTION_VERSION = "r4b1t-selection-transaction/v3"
ALGORITHM = "site-weighted-two-stage-v1"
PRNG = "mulberry32-u32-v1"
MAX_SITE_DRAWS = 30
TWO32 = 1 << 32
WEIGHT_MODES = ("UNIFORM_SITE", "SQRT_DEPTH", "UNIFORM_URL")
MASK32 = 0xFFFFFFFF


class SelectionV3Error(ValueError):
    pass


def _utf8(value):
    return str(value).encode("utf-8")


def seed_to_uint32(seed: str) -> int:
    value = 2166136261
    for byte in str(seed).encode("utf-8"):
        value ^= byte
        value = (value * 16777619) & MASK32
    return value


def create_sampler(seed: str):
    state = seed_to_uint32(seed)

    def next_uint32():
        nonlocal state
        state = (state + 0x6D2B79F5) & MASK32
        mixed = state
        mixed = ((mixed ^ (mixed >> 15)) * (mixed | 1)) & MASK32
        product = ((mixed ^ (mixed >> 7)) * (mixed | 61)) & MASK32
        mixed = (mixed ^ ((mixed + product) & MASK32)) & MASK32
        return (mixed ^ (mixed >> 14)) & MASK32

    return next_uint32


def isqrt(value: int) -> int:
    if not isinstance(value, int) or value < 0:
        raise SelectionV3Error("SELECTION_V3_ISQRT_INVALID")
    return math.isqrt(value)


def site_weight(size: int, mode: str) -> int:
    if not isinstance(size, int) or size < 1:
        raise SelectionV3Error("SELECTION_V3_BUCKET_SIZE_INVALID")
    if mode == "UNIFORM_SITE":
        return 1
    if mode == "UNIFORM_URL":
        return size
    if mode == "SQRT_DEPTH":
        return isqrt(size << 32)
    raise SelectionV3Error(f"SELECTION_V3_WEIGHT_MODE_INVALID: {mode}")


def prepare_sites(urls, site_key, mode: str):
    if not isinstance(urls, (list, tuple)) or not urls:
        raise SelectionV3Error("SELECTION_V3_ELIGIBLE_URLS_REQUIRED")
    if not callable(site_key):
        raise SelectionV3Error("SELECTION_V3_SITE_KEY_REQUIRED")
    if mode not in WEIGHT_MODES:
        raise SelectionV3Error(f"SELECTION_V3_WEIGHT_MODE_INVALID: {mode}")

    by_key = {}
    for url in urls:
        key = site_key(url)
        if not isinstance(key, str) or not key:
            raise SelectionV3Error("SELECTION_V3_SITE_KEY_INVALID")
        by_key.setdefault(key, []).append(str(url))

    groups = []
    for key in sorted(by_key, key=_utf8):
        bucket = sorted(by_key[key], key=_utf8)
        groups.append(
            {
                "site_key": key,
                "urls": tuple(bucket),
                "weight": site_weight(len(bucket), mode),
            }
        )

    total = sum(group["weight"] for group in groups)
    if total <= 0 or total >= TWO32:
        raise SelectionV3Error(f"SELECTION_V3_TOTAL_WEIGHT_OUT_OF_RANGE: {total}")

    return {"mode": mode, "groups": tuple(groups), "total_weight": total}


def _assert_u32(value: int) -> int:
    if not isinstance(value, int) or value < 0 or value > MASK32:
        raise SelectionV3Error(f"SELECTION_V3_U32_INVALID: {value}")
    return value


def map_u32(value: int, total: int) -> int:
    _assert_u32(value)
    if not isinstance(total, int) or total <= 0 or total >= TWO32:
        raise SelectionV3Error("SELECTION_V3_MAP_TOTAL_INVALID")
    return (value * total) >> 32


def _resolve_site(prepared, u32: int):
    target = map_u32(u32, prepared["total_weight"])
    cumulative = 0
    index = len(prepared["groups"]) - 1
    for position, group in enumerate(prepared["groups"]):
        cumulative += group["weight"]
        if target < cumulative:
            index = position
            break
    return {
        "u32": u32,
        "target": target,
        "index": index,
        "group": prepared["groups"][index],
    }


def draw_site(prepared, next_uint32, repeat_guard_reference):
    if not prepared or not prepared.get("groups"):
        raise SelectionV3Error("SELECTION_V3_PREPARED_SITES_REQUIRED")
    if not callable(next_uint32):
        raise SelectionV3Error("SELECTION_V3_RNG_REQUIRED")

    if repeat_guard_reference is None:
        guard_mode = "none"
    elif len(prepared["groups"]) == 1:
        guard_mode = "single-site-bypass"
    else:
        guard_mode = "redraw"

    draws = 0
    selected = None
    exhausted = False

    while draws < MAX_SITE_DRAWS:
        selected = _resolve_site(prepared, _assert_u32(next_uint32()))
        draws += 1

        if guard_mode != "redraw" or selected["group"]["site_key"] != repeat_guard_reference:
            break
        if draws == MAX_SITE_DRAWS:
            exhausted = True
            break

    return {
        "selection": selected,
        "site_draw_count": draws,
        "repeat_guard": {
            "kind": "site-key",
            "reference": None if repeat_guard_reference is None else str(repeat_guard_reference),
            "max_site_draws": MAX_SITE_DRAWS,
            "mode": guard_mode,
            "exhausted": exhausted,
        },
    }


def _validate_options(
    *,
    eligible_urls,
    site_key,
    seed,
    draw_start,
    weight_mode,
    repeat_guard_reference,
    sequence,
    constraint,
    corpus_revision,
    psl_sha256,
    overrides_sha256,
):
    if not isinstance(draw_start, int) or draw_start < 0:
        raise SelectionV3Error("SELECTION_V3_DRAW_START_INVALID")
    if not isinstance(sequence, int) or sequence < 1:
        raise SelectionV3Error("SELECTION_V3_SEQUENCE_INVALID")
    if not isinstance(seed, str) or not seed:
        raise SelectionV3Error("SELECTION_V3_SEED_INVALID")
    for value, code in (
        (corpus_revision, "SELECTION_V3_CORPUS_REVISION_INVALID"),
        (psl_sha256, "SELECTION_V3_PSL_DIGEST_INVALID"),
        (overrides_sha256, "SELECTION_V3_OVERRIDE_DIGEST_INVALID"),
    ):
        if (
            not isinstance(value, str)
            or not value.startswith("sha256:")
            or len(value) != 71
            or any(ch not in "0123456789abcdef" for ch in value[7:])
        ):
            raise SelectionV3Error(code)


def select(
    *,
    eligible_urls,
    site_key,
    seed,
    draw_start,
    weight_mode,
    repeat_guard_reference,
    sequence,
    constraint,
    corpus_revision,
    psl_sha256,
    overrides_sha256,
):
    _validate_options(
        eligible_urls=eligible_urls,
        site_key=site_key,
        seed=seed,
        draw_start=draw_start,
        weight_mode=weight_mode,
        repeat_guard_reference=repeat_guard_reference,
        sequence=sequence,
        constraint=constraint,
        corpus_revision=corpus_revision,
        psl_sha256=psl_sha256,
        overrides_sha256=overrides_sha256,
    )

    prepared = prepare_sites(eligible_urls, site_key, weight_mode)
    sampler = create_sampler(seed)
    for _ in range(draw_start):
        sampler()

    site = draw_site(prepared, sampler, repeat_guard_reference)
    selected = site["selection"]
    bucket = selected["group"]["urls"]

    url_draw = _assert_u32(sampler())
    url_index = map_u32(url_draw, len(bucket))
    url = bucket[url_index]

    return {
        "transaction_version": TRANSACTION_VERSION,
        "sequence": sequence,
        "action": "ROLL",
        "constraint": constraint,
        "corpus_revision": corpus_revision,
        "grouping": {
            "algorithm": ALGORITHM,
            "site_key_version": "site-key/v1",
            "psl_sha256": psl_sha256,
            "overrides_sha256": overrides_sha256,
            "weight_mode": weight_mode,
        },
        "eligible_url_count": len(eligible_urls),
        "eligible_site_count": len(prepared["groups"]),
        "total_site_weight": prepared["total_weight"],
        "sampler": {
            "algorithm": ALGORITHM,
            "prng": PRNG,
            "seed": seed,
            "draw_start": draw_start,
            "draw_count": site["site_draw_count"] + 1,
            "site_draw_count": site["site_draw_count"],
            "url_draw_count": 1,
            "repeat_guard": site["repeat_guard"],
        },
        "selection": {
            "site_draw_u32": selected["u32"],
            "site_target": selected["target"],
            "site_index": selected["index"],
            "site_key": selected["group"]["site_key"],
            "site_weight": selected["group"]["weight"],
            "site_bucket_size": len(bucket),
            "url_draw_u32": url_draw,
            "url_index": url_index,
        },
        "route": {"url": url},
    }


def derive_repeat_guard_reference(previous_roll, site_key):
    if previous_roll is None:
        return None
    if not callable(site_key):
        raise SelectionV3Error("SELECTION_V3_SITE_KEY_REQUIRED")
    if previous_roll.get("action") not in (None, "ROLL"):
        raise SelectionV3Error("SELECTION_V3_PREVIOUS_ROLL_INVALID")
    route = previous_roll.get("route")
    if not isinstance(route, dict) or not isinstance(route.get("url"), str) or not route["url"]:
        raise SelectionV3Error("SELECTION_V3_PREVIOUS_ROLL_INVALID")
    return site_key(route["url"])


def canonical_json(value) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def verify_transaction(transaction, *, previous_roll_marker=False, previous_roll=None, **options):
    if previous_roll_marker:
        options["repeat_guard_reference"] = derive_repeat_guard_reference(
            previous_roll, options["site_key"]
        )
    expected = select(**options)
    if canonical_json(transaction) != canonical_json(expected):
        raise SelectionV3Error("SELECTION_V3_MISMATCH")
    return transaction
