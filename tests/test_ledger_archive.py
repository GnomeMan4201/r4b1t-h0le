import tempfile
import unittest
from pathlib import Path
from corpus.ledger.sequencer import Sequencer
from corpus.ledger.projection import replay
from tests.test_ledger_engine import genesis,proposal,T,D

class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.writer=Sequencer(Path(self.temp.name)/'corpus/ledger/shadow/archive.sqlite3')
        self.writer.submit(genesis());self.rid=self.writer.submit(proposal())['resource_id']

    def test_explicit_target_lifecycle_never_changes_state_axes(self):
        from corpus.ledger.consumers.archive_windows import records
        self.writer.submit(proposal('ARCHIVE_RESOLVED',self.rid,{'archive_url':'https://archive.example/a','evidence_digest':D}))
        self.assertEqual(records(self.writer.snapshot())[0]['archive_url'],'https://archive.example/a')
        self.writer.submit(proposal('ARCHIVE_TARGET_REPLACED',self.rid,{'archive_url':'https://archive.example/b','evidence_digest':D}))
        self.writer.submit(proposal('ARCHIVE_TARGET_GONE',self.rid,{'archive_url':'https://archive.example/b','evidence_digest':D}))
        self.assertIsNone(records(self.writer.snapshot())[0]['archive_url'])
        self.assertEqual(self.writer.snapshot()['resources'][0]['eligibility'],'CANDIDATE')
        self.assertIsNone(self.writer.snapshot()['resources'][0]['availability'])
