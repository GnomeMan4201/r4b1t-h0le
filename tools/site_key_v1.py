"""Pinned site-key/v1 implementation for independent selection-v3 re-execution."""

from __future__ import annotations

import ipaddress
import json
import re
from urllib.parse import urlsplit

SITE_KEY_VERSION = "site-key/v1"


class SiteKeyError(ValueError):
    pass


def normalize_host(host: str) -> str:
    value = str(host or "").strip().rstrip(".")
    if not value:
        raise SiteKeyError("SITE_KEY_HOST_INVALID")

    if any(ord(ch) > 0x7F for ch in value):
        raise SiteKeyError("SITE_KEY_HOST_NOT_ASCII")

    if value.startswith("[") and value.endswith("]"):
        value = value[1:-1]

    try:
        address = ipaddress.ip_address(value)
        return f"[{address.compressed.lower()}]" if address.version == 6 else address.compressed
    except ValueError:
        pass

    labels = value.split(".")
    if any(not label for label in labels):
        raise SiteKeyError(f"SITE_KEY_HOST_INVALID: {value}")
    return value.lower()


def parse_psl(text: str):
    if not isinstance(text, str) or not text:
        raise SiteKeyError("SITE_KEY_PSL_INVALID")

    exact = set()
    wildcard = set()
    exception = set()

    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        target = exact
        if line.startswith("!"):
            target = exception
            line = line[1:]
        elif line.startswith("*."):
            target = wildcard
            line = line[2:]
        target.add(normalize_host(line))

    if not exact and not wildcard and not exception:
        raise SiteKeyError("SITE_KEY_PSL_EMPTY")

    return {
        "exact": frozenset(exact),
        "wildcard": frozenset(wildcard),
        "exception": frozenset(exception),
    }


def parse_overrides(value):
    parsed = json.loads(value) if isinstance(value, str) else value
    if (
        not isinstance(parsed, dict)
        or parsed.get("schema") != "r4b1t-site-key-overrides/v1"
        or not isinstance(parsed.get("rules"), list)
    ):
        raise SiteKeyError("SITE_KEY_OVERRIDES_INVALID")

    rules = []
    for rule in parsed["rules"]:
        if not isinstance(rule, dict) or not isinstance(rule.get("host"), str):
            raise SiteKeyError("SITE_KEY_OVERRIDE_INVALID")
        if rule.get("kind") not in {"path-owner", "at-path-owner"}:
            raise SiteKeyError(f"SITE_KEY_OVERRIDE_KIND_INVALID: {rule.get('kind')}")
        if rule.get("case") != "lower":
            raise SiteKeyError("SITE_KEY_OVERRIDE_CASE_INVALID")
        rules.append(
            {
                "host": normalize_host(rule["host"]),
                "kind": rule["kind"],
                "case": rule["case"],
            }
        )
    return {"schema": parsed["schema"], "rules": tuple(rules)}


def _is_ip_literal(host: str) -> bool:
    value = host[1:-1] if host.startswith("[") and host.endswith("]") else host
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def registrable_domain(host: str, psl) -> str:
    normalized = normalize_host(host)
    if _is_ip_literal(normalized):
        return normalized

    labels = normalized.split(".")
    if len(labels) < 2:
        return normalized
    if not psl or not all(name in psl for name in ("exact", "wildcard", "exception")):
        raise SiteKeyError("SITE_KEY_PSL_REQUIRED")

    public_suffix_labels = 1
    exception_suffix = None

    for index in range(len(labels)):
        suffix = ".".join(labels[index:])
        if suffix in psl["exception"]:
            exception_suffix = ".".join(labels[index + 1 :])
            break
        if suffix in psl["exact"]:
            public_suffix_labels = max(public_suffix_labels, len(labels) - index)
        if index + 1 < len(labels) and ".".join(labels[index + 1 :]) in psl["wildcard"]:
            public_suffix_labels = max(public_suffix_labels, len(labels) - index)

    if exception_suffix is not None:
        public_suffix_labels = len(exception_suffix.split(".")) if exception_suffix else 0

    if len(labels) <= public_suffix_labels:
        return normalized
    return ".".join(labels[len(labels) - public_suffix_labels - 1 :])


def valid_override_owner(host: str, kind: str, owner: str) -> bool:
    if host == "github.com" and kind == "path-owner":
        return re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", owner) is not None
    if host == "gitlab.com" and kind == "path-owner":
        return re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?", owner) is not None
    if host == "medium.com" and kind == "at-path-owner":
        return re.fullmatch(r"@[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?", owner) is not None
    return False


def _override_key(parsed, host: str, overrides):
    if not overrides:
        return None
    segments = [segment for segment in parsed.path.split("/") if segment]

    for rule in overrides.get("rules", ()):
        if rule["host"] != host:
            continue
        if not segments:
            return None
        owner = segments[0]
        if not valid_override_owner(host, rule["kind"], owner):
            return None
        if rule["case"] == "lower":
            owner = owner.lower()
        return f"{host}/{owner}"
    return None


def is_canonical_ipv4(host: str) -> bool:
    value = host[:-1] if host.endswith(".") else host
    parts = value.split(".")
    if len(parts) != 4:
        return False
    for part in parts:
        if re.fullmatch(r"(?:0|[1-9][0-9]{0,2})", part) is None:
            return False
        if int(part) > 255:
            return False
    return True


def is_legacy_ipv4_candidate(host: str) -> bool:
    value = host[:-1] if host.endswith(".") else host
    parts = value.split(".")
    return bool(parts) and all(
        re.fullmatch(r"[0-9]+", part) is not None
        or re.fullmatch(r"0x[0-9a-f]+", part, re.IGNORECASE) is not None
        for part in parts
    )


def validate_raw_url(raw: str) -> str:
    match = re.match(r"^https?://([^/?#]*)([^?#]*)", str(raw), re.IGNORECASE)
    if not match:
        raise SiteKeyError("SITE_KEY_URL_INVALID")

    authority = match.group(1)
    raw_path = match.group(2) or ""
    if any(ord(ch) > 0x7F for ch in authority):
        raise SiteKeyError("SITE_KEY_HOST_NOT_ASCII")
    if (
        any(ord(ch) <= 0x20 or ord(ch) == 0x7F for ch in authority)
        or any(ord(ch) <= 0x20 or ord(ch) == 0x7F for ch in raw_path)
        or "%" in authority
        or "\\" in authority
        or "\\" in raw_path
    ):
        raise SiteKeyError("SITE_KEY_URL_NOT_CANONICAL")

    if "@" not in authority:
        if authority.startswith("["):
            host_match = re.fullmatch(r"(\[[0-9A-Fa-f:.]+\])(?::[0-9]+)?", authority)
        else:
            host_match = re.fullmatch(r"([A-Za-z0-9._-]+)(?::[0-9]+)?", authority)
        if host_match is None:
            raise SiteKeyError("SITE_KEY_URL_NOT_CANONICAL")

        raw_host = host_match.group(1)
        if not raw_host.startswith("["):
            if ".." in raw_host:
                raise SiteKeyError("SITE_KEY_URL_NOT_CANONICAL")
            if is_legacy_ipv4_candidate(raw_host) and not is_canonical_ipv4(raw_host):
                raise SiteKeyError("SITE_KEY_URL_NOT_CANONICAL")

    for segment in raw_path.split("/"):
        dots = re.sub(r"%2e", ".", segment, flags=re.IGNORECASE)
        if dots in {".", ".."}:
            raise SiteKeyError("SITE_KEY_URL_NOT_CANONICAL")
    return str(raw)


def site_key(url: str, psl, overrides) -> str:
    raw = validate_raw_url(str(url))
    try:
        parsed = urlsplit(raw)
        _ = parsed.port
    except ValueError as exc:
        raise SiteKeyError("SITE_KEY_URL_INVALID") from exc

    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise SiteKeyError("SITE_KEY_PROTOCOL_INVALID")
    if parsed.username or parsed.password:
        raise SiteKeyError("SITE_KEY_CREDENTIALS_FORBIDDEN")

    host = normalize_host(parsed.hostname)
    override = _override_key(parsed, host, overrides)
    if override:
        return override
    return registrable_domain(host, psl)


def canonical_groups(urls, psl, overrides):
    if not isinstance(urls, (list, tuple)):
        raise SiteKeyError("SITE_KEY_URLS_REQUIRED")

    by_key = {}
    for url in urls:
        key = site_key(url, psl, overrides)
        by_key.setdefault(key, []).append(str(url))

    return [
        {"site_key": key, "urls": sorted(by_key[key], key=lambda value: value.encode("utf-8"))}
        for key in sorted(by_key, key=lambda value: value.encode("utf-8"))
    ]
