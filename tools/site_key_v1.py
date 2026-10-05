"""Pinned site-key/v1 implementation for independent selection-v3 re-execution."""

from __future__ import annotations

import ipaddress
import json
from urllib.parse import urlsplit

SITE_KEY_VERSION = "site-key/v1"


class SiteKeyError(ValueError):
    pass


def _to_ascii_label(label: str) -> str:
    try:
        return label.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise SiteKeyError(f"SITE_KEY_HOST_INVALID: {label}") from exc


def normalize_host(host: str) -> str:
    value = str(host or "").strip().rstrip(".")
    if not value:
        raise SiteKeyError("SITE_KEY_HOST_INVALID")

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
    return ".".join(_to_ascii_label(label) for label in labels)


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
        if rule["kind"] == "at-path-owner" and (len(owner) < 2 or not owner.startswith("@")):
            return None
        if rule["case"] == "lower":
            owner = owner.lower()
        return f"{host}/{owner}"
    return None


def site_key(url: str, psl, overrides) -> str:
    try:
        parsed = urlsplit(str(url))
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
