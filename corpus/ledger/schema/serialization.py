"""Ledger restrictions over the shared CJ-1 authority, not a new JSON serializer."""
import hashlib
import json
import re
from tools.cj1 import cj1_serialize

VERSION = 'r4b1t-cj1-ledger-v1'
GENESIS_PREV = 'sha256:' + '0' * 64
DOMAINS = ('event', 'projection', 'policy', 'manifest', 'heartbeat')


def timestamp(value):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z', value):
        raise ValueError('fixed UTC millisecond timestamp required')
    year, month, day, hour, minute, second = (int(value[a:b]) for a, b in ((0,4),(5,7),(8,10),(11,13),(14,16),(17,19)))
    days = (31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31,30,31,30,31,31,30,31,30,31)
    if year < 1 or not 1 <= month <= 12 or not 1 <= day <= days[month-1] or hour > 23 or minute > 59 or second > 59:
        raise ValueError('invalid timestamp date')
    return value


def serialize(value):
    return cj1_serialize(value)


def parse(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate key')
            result[key] = value
        return result
    value = json.loads(raw, object_pairs_hook=pairs)
    if serialize(value) != raw:
        raise ValueError('noncanonical CJ-1 ledger bytes')
    return value


def sorted_collection(values):
    encoded = [(serialize(value).encode('utf-8'), value) for value in values]
    keys = [key for key, _ in encoded]
    if len(set(keys)) != len(keys):
        raise ValueError('duplicate semantic collection member')
    return [value for _, value in sorted(encoded, key=lambda pair: pair[0])]


def framing(domain, value):
    if domain not in DOMAINS:
        raise ValueError('unknown hash domain')
    # Fixed ASCII tag, NUL delimiter, then CJ-1 UTF-8. Tag cannot contain NUL.
    return ('r4b1t:' + domain + ':v1').encode('ascii') + b'\0' + serialize(value).encode('utf-8')


def digest(domain, value):
    return 'sha256:' + hashlib.sha256(framing(domain, value)).hexdigest()
