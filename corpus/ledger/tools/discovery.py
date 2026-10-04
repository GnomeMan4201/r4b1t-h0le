"""Recorded discovery evidence and proposals only; the sequencer owns append."""
import hashlib
from pathlib import Path
from corpus.ledger.consumers.discovery import FILES,VERSION,MANIFEST
from corpus.ledger.schema.serialization import sorted_collection
from corpus.ledger.tools.files import contained

ROOT=Path(__file__).resolve().parents[3]


def producer_files(): return {path:contained(ROOT,path).read_bytes() for path in FILES}


def producer_manifest():
    return {'schema':MANIFEST,'version':VERSION,'files':sorted_collection([{'path':path,'digest':'sha256:'+hashlib.sha256(raw).hexdigest()} for path,raw in producer_files().items()])}
