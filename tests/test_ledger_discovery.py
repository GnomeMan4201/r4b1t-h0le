import tempfile
import unittest
from pathlib import Path
from tests.test_ledger_engine import genesis, T
from corpus.ledger.sequencer import Sequencer


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.writer=Sequencer(Path(self.temp.name)/'corpus/ledger/shadow/test.sqlite3')
        self.writer.submit(genesis())

    def test_recorded_discovery_creates_candidates_only_with_sequencer_ids(self):
        from corpus.ledger.consumers.discovery import build_window,proposals,verify_window
        from corpus.ledger.tools.discovery import producer_files,producer_manifest
        before=self.writer.events()
        rows=[{'url':'https://example.org/new','timestamp':T,'basis':'Synthetic operator declaration; external history unknown','metadata':{'resource_type':'research'}}]
        window=build_window(before,rows,producer_manifest())
        submitted=proposals(before,window)
        self.assertEqual(len(submitted),1)
        self.assertEqual(submitted[0]['type'],'RESOURCE_CREATED')
        self.assertNotIn('resource_id',submitted[0])
        committed=self.writer.submit_many(submitted,expected_head=before[-1]['hash'])
        self.assertEqual(committed[0]['resource_id'],'r4b1t:r:000000000000002')
        resource=self.writer.snapshot()['resources'][0]
        self.assertEqual(resource['eligibility'],'CANDIDATE')
        self.assertIsNone(resource['availability'])
        self.assertEqual(resource['metadata']['resource_type'],'research')
        self.assertEqual(verify_window(before,window,committed,producer_files())['status'],'VERIFIED_SHADOW_DISCOVERY_WINDOW')
