"""Shared Python implementation of the existing CJ-1 profile; see cj1.js."""
from __future__ import annotations
import json
import re
from typing import Any

SAFE_INTEGER = 9_007_199_254_740_991
CJ_KEY_RE = re.compile(r"^[A-Za-z0-9_]+$")

class CanonicalProfileError(ValueError):
    pass

def _valid_unicode(value: str) -> bool:
    try:
        value.encode("utf-8", "strict")
        return not any(0xD800 <= ord(ch) <= 0xDFFF for ch in value)
    except UnicodeEncodeError:
        return False


def cj1_check(value: Any, label: str = "value") -> None:
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int) and not isinstance(value, bool):
        if abs(value) > SAFE_INTEGER:
            raise CanonicalProfileError(f"{label}: unsafe integer")
        return
    if isinstance(value, float):
        raise CanonicalProfileError(f"{label}: fractions/exponents are not allowed")
    if isinstance(value, str):
        if not _valid_unicode(value):
            raise CanonicalProfileError(f"{label}: invalid Unicode")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            cj1_check(item, f"{label}[{index}]")
        return
    if isinstance(value, dict):
        for key in value:
            if not isinstance(key, str) or not CJ_KEY_RE.fullmatch(key):
                raise CanonicalProfileError(f"{label}: invalid object key")
        for key, item in value.items():
            cj1_check(item, f"{label}.{key}")
        return
    raise CanonicalProfileError(f"{label}: unsupported value")


def cj1_serialize(value: Any) -> str:
    cj1_check(value)
    # CJ-1 restricts keys to ASCII, so Python's sort order equals JS UTF-16.
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )

