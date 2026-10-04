"""Small deterministic chain for isolated replay tests, not a public release."""
import tempfile
from pathlib import Path
from corpus.ledger.sequencer import Sequencer
from corpus.ledger.schema.serialization import serialize
from tests.test_ledger_engine import genesis, proposal


def reference():
    with tempfile.TemporaryDirectory() as directory:
        writer=Sequencer(Path(directory)/'corpus/ledger/shadow/reference.sqlite3')
        writer.submit(genesis())
        a,b=[writer.submit(proposal())['resource_id'] for _ in range(2)]
        writer.submit(proposal('MARKED_ACTIVE',a,{'reason':'reference explicit transition','evidence_digest':'sha256:'+'0'*64}))
        writer.submit(proposal('RESOURCE_MERGED',a,{'first':a,'second':b,'survivor':a,'evidence_digest':'sha256:'+'0'*64}))
        return writer.events()

if __name__=='__main__':
    for event in reference(): print(serialize(event))
