"""Explicit archive operations: producer inputs and frozen code commitments only."""
from pathlib import Path
from corpus.ledger.consumers.archive_windows import FILES,PROBE
from corpus.ledger.tools.files import contained
from corpus.ledger.schema.serialization import sorted_collection
from corpus.ledger.tools.history import raw_hash
ROOT=Path(__file__).resolve().parents[3]


def producer_files(): return {path:contained(ROOT,path).read_bytes() for path in FILES}


def producer_manifest():
    return {'schema':'r4b1t-shadow-archive-producer-v1','version':PROBE,'files':sorted_collection([{'path':path,'digest':raw_hash(raw)} for path,raw in producer_files().items()])}
