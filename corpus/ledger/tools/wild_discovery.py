"""Frozen reviewed WILD evidence adapter for Corpus Ledger shadow discovery."""
import hashlib
from pathlib import Path

from corpus.ledger.consumers.wild_discovery import FILES,MANIFEST,VERSION,EVIDENCE_SCHEMA
from corpus.ledger.schema.serialization import parse,sorted_collection
from corpus.ledger.tools.files import contained

ROOT=Path(__file__).resolve().parents[3]
ARTIFACT_SHA256='sha256:3dd3f572897203789c93ae5e75fbd2e1f4c0b41720a72e3ebf9fcb27e1cf8a89'
ACCEPTED='corpus/wild/reviews/wild-50-v061-campaign-accepted.jsonl'
CAMPAIGN='corpus/wild/evidence/wild-50-v061/campaign-manifest.json'
CLASSIFICATION='corpus/classification/resource-classification-v2.0.json'
REVIEW='corpus/wild/reviews/wild-50-v061-review.csv'
QUALITY='corpus/wild/reviews/wild-50-v061-quality-tags.csv'
EVIDENCE_PATHS=(ACCEPTED,CAMPAIGN,CLASSIFICATION,REVIEW,QUALITY)


def producer_files():
    return {path:contained(ROOT,path).read_bytes() for path in FILES}


def producer_manifest(inputs=None):
    if inputs is None: inputs=producer_files()
    return {
        'schema':MANIFEST,
        'version':VERSION,
        'files':sorted_collection([
            {'path':path,'digest':'sha256:'+hashlib.sha256(raw).hexdigest()}
            for path,raw in inputs.items()
        ]),
    }


def evidence_files():
    return {path:contained(ROOT,path).read_bytes() for path in EVIDENCE_PATHS}


def evidence_manifest(inputs=None):
    if inputs is None: inputs=evidence_files()
    if set(inputs)!=set(EVIDENCE_PATHS): raise ValueError('exact canonical WILD evidence inventory required')
    def item(path):
        return {'path':path,'digest':'sha256:'+hashlib.sha256(inputs[path]).hexdigest()}
    return {
        'schema':EVIDENCE_SCHEMA,
        'artifact_sha256':ARTIFACT_SHA256,
        'accepted_export':item(ACCEPTED),
        'campaign_manifest':item(CAMPAIGN),
        'classification':item(CLASSIFICATION),
        'review':item(REVIEW),
        'quality_tags':item(QUALITY),
    }


def load_records(path=ACCEPTED):
    target=contained(ROOT,path) if isinstance(path,str) else Path(path)
    raw=target.read_text('utf-8')
    if not raw.endswith('\n'): raise ValueError('canonical WILD JSONL requires final LF')
    rows=[parse(line) for line in raw[:-1].split('\n')]
    if not rows: raise ValueError('reviewed WILD export must not be empty')
    return rows
