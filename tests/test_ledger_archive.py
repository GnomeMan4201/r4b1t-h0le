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
        self.assertEqual(records(self.writer.events())[0]['archive_url'],'https://archive.example/a')
        self.writer.submit(proposal('ARCHIVE_TARGET_REPLACED',self.rid,{'archive_url':'https://archive.example/b','evidence_digest':D}))
        self.writer.submit(proposal('ARCHIVE_TARGET_GONE',self.rid,{'archive_url':'https://archive.example/b','evidence_digest':D}))
        self.assertIsNone(records(self.writer.events())[0]['archive_url'])
        self.assertEqual(self.writer.snapshot()['resources'][0]['eligibility'],'CANDIDATE')
        self.assertIsNone(self.writer.snapshot()['resources'][0]['availability'])

    def test_window_emission_binds_target_and_suppressed_probes(self):
        from corpus.ledger.consumers.archive_windows import build_window,proposals,verify_window
        from corpus.ledger.tools.archive import producer_files,producer_manifest
        from corpus.ledger.consumers.archive_windows import PROBE
        target='https://archive.example/a'
        payload={'probe_version':PROBE,'observed_url':target,'final_url':target,'status':200,'headers_digest':D,'started_at':T,'finished_at':T}
        rows=[{'type':'ARCHIVE_RESOLVED','resource_id':self.rid,'timestamp':T,'archive_url':target,'basis':'synthetic declared association'}, {'type':'ARCHIVE_PROBE','resource_id':self.rid,'payload':payload}]
        before=self.writer.events();window=build_window(before,rows,producer_manifest())
        committed=self.writer.submit_many(proposals(before,window),expected_head=before[-1]['hash'])
        self.assertEqual([e['type'] for e in committed],['ARCHIVE_RESOLVED','ARCHIVE_PROBE_SUCCEEDED','PROBE_HEARTBEAT'])
        self.assertEqual(verify_window(before,window,committed,producer_files())['status'],'VERIFIED_SHADOW_ARCHIVE_WINDOW')
        next_window=build_window(self.writer.events(),[rows[-1]],producer_manifest())
        self.assertEqual([p['type'] for p in proposals(self.writer.events(),next_window)],['PROBE_HEARTBEAT'])
