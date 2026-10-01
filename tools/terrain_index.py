#!/usr/bin/env python3
"""Build, check, and classify r4b1t terrain-index-v1 artifacts.

The terrain index is compiled deterministically from a corpus release's own
urls.txt and resources.json (TERRAIN_AUTHORITY_CONTRACT.md, ADR 0006). It is
authoritative only through corpus/runtime/eligibility-profiles-v1.json.

  build    --release <dir> --out <file>
  check    --release <dir> --index <file>          byte-identical regeneration (CI)
  classify --registry <file> --urls-digest <d> --index-digest <d>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import sys

SCHEMA = 'r4b1t-terrain-index-v1'
VOCABULARY = 'resource-type-identity-v1'
REGISTRY_SCHEMA = 'r4b1t-eligibility-profiles-v1'
TERRAIN_ID = re.compile(r'^[a-z][a-z0-9_]*$')
KEY = re.compile(r'^[A-Za-z0-9_]+$')
SAFE_INTEGER = 2 ** 53 - 1


class TerrainIndexError(Exception):
    def __init__(self, code: str, detail: str = ''):
        super().__init__(f'{code}: {detail}' if detail else code)
        self.code = code


def sha256_id(data: bytes) -> str:
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def cj1(value) -> str:
    """CJ-1 canonical JSON (docs/CANONICAL_JSON_CJ1.md)."""
    if value is None:
        return 'null'
    if value is True:
        return 'true'
    if value is False:
        return 'false'
    if isinstance(value, int):
        if abs(value) > SAFE_INTEGER:
            raise TerrainIndexError('CANONICAL_PROFILE_VIOLATION', 'unsafe integer')
        return str(value)
    if isinstance(value, float):
        raise TerrainIndexError('CANONICAL_PROFILE_VIOLATION', 'non-integer number')
    if isinstance(value, str):
        if any(0xD800 <= ord(ch) <= 0xDFFF for ch in value):
            raise TerrainIndexError('CANONICAL_PROFILE_VIOLATION', 'lone surrogate')
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return '[' + ','.join(cj1(item) for item in value) + ']'
    if isinstance(value, dict):
        for key in value:
            if not isinstance(key, str) or not KEY.match(key):
                raise TerrainIndexError('CANONICAL_PROFILE_VIOLATION', f'key {key!r}')
        return '{' + ','.join(json.dumps(k) + ':' + cj1(value[k]) for k in sorted(value)) + '}'
    raise TerrainIndexError('CANONICAL_PROFILE_VIOLATION', type(value).__name__)


def canonical_lines(data: bytes) -> list[str]:
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError as error:
        raise TerrainIndexError('RELEASE_NOT_CANONICAL', 'urls.txt is not UTF-8') from error
    if not text.endswith('\n') or text.endswith('\n\n') or '\r' in text:
        raise TerrainIndexError('RELEASE_NOT_CANONICAL', 'urls.txt must be LF-only with one trailing newline')
    lines = text[:-1].split('\n')
    for number, line in enumerate(lines, 1):
        if not line or line != line.strip() or not re.match(r'^https?://', line):
            raise TerrainIndexError('RELEASE_NOT_CANONICAL', f'line {number}')
    return lines


def build_document(release_dir: pathlib.Path) -> dict:
    manifest = json.loads((release_dir / 'manifest.json').read_text('utf-8'))
    urls_bytes = (release_dir / 'urls.txt').read_bytes()
    resources_bytes = (release_dir / 'resources.json').read_bytes()
    if sha256_id(urls_bytes) != manifest.get('urls_digest'):
        raise TerrainIndexError('RELEASE_DIGEST_MISMATCH', 'urls.txt')
    if sha256_id(resources_bytes) != manifest.get('resources_digest'):
        raise TerrainIndexError('RELEASE_DIGEST_MISMATCH', 'resources.json')
    urls = canonical_lines(urls_bytes)
    resources = json.loads(resources_bytes.decode('utf-8'))['resources']
    if [record['url'] for record in resources] != urls:
        raise TerrainIndexError('RESOURCE_ORDER_MISMATCH', 'resources.json order must equal urls.txt order')
    types = sorted({record['resource_type'] for record in resources})
    for terrain_id in types:
        if not isinstance(terrain_id, str) or not TERRAIN_ID.match(terrain_id) or terrain_id == 'all':
            raise TerrainIndexError('RESOURCE_TYPE_INVALID', repr(terrain_id))
    terrains = []
    for terrain_id in types:
        members = [i for i, record in enumerate(resources) if record['resource_type'] == terrain_id]
        if not members:
            raise TerrainIndexError('DRY_TERRAIN', terrain_id)
        terrains.append({
            'id': terrain_id,
            'label': terrain_id.replace('_', ' ').upper(),
            'rule': {'resource_type': [terrain_id]},
            'count': len(members),
            'members': members,
        })
    return {
        'schema': SCHEMA,
        'release': {
            'release_id': manifest['release_id'],
            'urls_digest': manifest['urls_digest'],
            'resources_digest': manifest['resources_digest'],
        },
        'vocabulary': VOCABULARY,
        'terrains': terrains,
    }


def build_bytes(release_dir: pathlib.Path) -> bytes:
    return (cj1(build_document(release_dir)) + '\n').encode('utf-8')


def classify(registry: dict, urls_digest: str, index_digest: str) -> str:
    if registry.get('schema') != REGISTRY_SCHEMA:
        raise TerrainIndexError('REGISTRY_INVALID', 'schema')
    profiles = [p for p in registry.get('profiles', []) if p['release']['urls_digest'] == urls_digest]
    if not profiles:
        return 'UNREGISTERED_RELEASE'
    for profile in profiles:
        if profile['terrain_index']['digest'] == index_digest:
            return 'AUTHORITATIVE_ACTIVE' if profile['status'] == 'active' else 'AUTHORITATIVE_SUPERSEDED'
    return 'UNREGISTERED_MAP'


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    p_build = sub.add_parser('build')
    p_build.add_argument('--release', required=True, type=pathlib.Path)
    p_build.add_argument('--out', required=True, type=pathlib.Path)
    p_check = sub.add_parser('check')
    p_check.add_argument('--release', required=True, type=pathlib.Path)
    p_check.add_argument('--index', required=True, type=pathlib.Path)
    p_classify = sub.add_parser('classify')
    p_classify.add_argument('--registry', required=True, type=pathlib.Path)
    p_classify.add_argument('--urls-digest', required=True)
    p_classify.add_argument('--index-digest', required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'build':
            data = build_bytes(args.release)
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_bytes(data)
            print(f'{args.out} {sha256_id(data)} ({len(data)} bytes)')
        elif args.command == 'check':
            expected = build_bytes(args.release)
            actual = args.index.read_bytes()
            if actual != expected:
                raise TerrainIndexError('INDEX_MISMATCH', f'{args.index} does not regenerate from {args.release}')
            print(f'TERRAIN INDEX VERIFIED {sha256_id(actual)}')
        else:
            registry = json.loads(args.registry.read_text('utf-8'))
            print(classify(registry, args.urls_digest, args.index_digest))
    except TerrainIndexError as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
