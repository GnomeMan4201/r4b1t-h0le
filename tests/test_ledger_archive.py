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
        self.writer.submit_many([proposal('ARCHIVE_RESOLVED',self.rid,{'archive_url':'https://archive.example/a','evidence_digest':D})],expected_head=self.writer.events()[-1]['hash'])
        self.assertEqual(records(self.writer.events())[0]['archive_url'],'https://archive.example/a')
        self.writer.submit_many([proposal('ARCHIVE_TARGET_REPLACED',self.rid,{'archive_url':'https://archive.example/b','evidence_digest':D})],expected_head=self.writer.events()[-1]['hash'])
        self.writer.submit_many([proposal('ARCHIVE_TARGET_GONE',self.rid,{'archive_url':'https://archive.example/b','evidence_digest':D})],expected_head=self.writer.events()[-1]['hash'])
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

    def test_archive_only_batch_requires_atomic_source_head(self):
        p=proposal('ARCHIVE_RESOLVED',self.rid,{'archive_url':'https://archive.example/a','evidence_digest':D})
        before=self.writer.events()
        with self.assertRaises(ValueError): self.writer.submit_many([p])
        self.assertEqual(self.writer.events(),before)
        with self.assertRaises(ValueError): self.writer.submit_many([p],expected_head=D)
        self.assertEqual(self.writer.events(),before)

    def test_merge_retains_each_original_archive_target(self):
        from corpus.ledger.consumers.archive_windows import records
        second=self.writer.submit(proposal())['resource_id']
        for rid,target in [(self.rid,'https://archive.example/a'),(second,'https://archive.example/b')]:
            self.writer.submit_many([proposal('ARCHIVE_RESOLVED',rid,{'archive_url':target,'evidence_digest':D})],expected_head=self.writer.events()[-1]['hash'])
        self.writer.submit(proposal('RESOURCE_MERGED',self.rid,{'first':self.rid,'second':second,'survivor':self.rid,'evidence_digest':D}))
        result=records(self.writer.events())
        self.assertEqual([r['archive_url'] for r in result],['https://archive.example/a','https://archive.example/b'])
        self.assertEqual([r['canonical_resource_id'] for r in result],[self.rid,self.rid])

    def test_archive_negative_windows_and_recording_fail_closed(self):
        import copy
        from corpus.ledger.consumers.archive_windows import build_window,proposals,verify_window,PROBE
        from corpus.ledger.tools.archive import producer_manifest,producer_files
        target='https://archive.example/a';before=self.writer.events()
        resolved={'type':'ARCHIVE_RESOLVED','resource_id':self.rid,'timestamp':T,'archive_url':target,'basis':'synthetic association'}
        p={'probe_version':PROBE,'observed_url':target,'final_url':target,'status':500,'headers_digest':D,'started_at':T,'finished_at':T}
        probe={'type':'ARCHIVE_PROBE','resource_id':self.rid,'payload':p}
        for rows in [[dict(resolved,type='UNKNOWN')],[dict(resolved,type='ARCHIVE_TARGET_GONE')],[dict(resolved,type='ARCHIVE_TARGET_REPLACED')],[resolved,resolved],[probe],[resolved,dict(probe,payload=dict(p,observed_url='https://archive.example/other'))],[resolved,dict(probe,payload=dict(p,status=700))],[resolved,dict(probe,payload=dict(p,probe_version='unknown'))],[dict(resolved,resource_id='r4b1t:r:000000000009999')]]:
            with self.subTest(rows=rows),self.assertRaises(ValueError): build_window(before,rows,producer_manifest())
        window=build_window(before,[resolved,probe],producer_manifest())
        committed=self.writer.submit_many(proposals(before,window),expected_head=before[-1]['hash'])
        self.assertEqual([e['type'] for e in committed],['ARCHIVE_RESOLVED','ARCHIVE_PROBE_FAILED','PROBE_HEARTBEAT'])
        self.assertIsNone(self.writer.snapshot()['resources'][0]['availability'])
        for damaged in [committed[:-1],committed+committed[-1:]]:
            with self.assertRaises(ValueError): verify_window(before,window,damaged,producer_files())
        for field,value in [('source_head',D),('schema','unsupported'),('policy_version','unsupported')]:
            changed=copy.deepcopy(window);changed[field]=value
            with self.assertRaises(ValueError): verify_window(before,changed,committed,producer_files())
        changed=copy.deepcopy(window);changed['operations'][0]['archive_url']='https://archive.example/changed'
        with self.assertRaises(ValueError): verify_window(before,changed,committed,producer_files())
        changed=copy.deepcopy(window);changed['producer_manifest']['files'].pop()
        with self.assertRaises(ValueError): verify_window(before,changed,committed,producer_files())
        inputs=producer_files();inputs[next(iter(inputs))]=b'tampered'
        with self.assertRaises(ValueError): verify_window(before,window,committed,inputs)

class ArchiveHistoryTests(unittest.TestCase):
    def test_archive_window_extends_v1_history_without_advancing_daily_cursor(self):
        import shutil
        from corpus.ledger.tools.history import archive_run,verify_history,run
        from corpus.ledger.tools.shadow import write_canonical,read_canonical
        # Use the fixed published v1 witness if available; create the same pinned
        # genesis offline on CI. No real archive assertion is fabricated.
        from tests.test_ledger_genesis import ROOT
        from corpus.ledger.tools.history import initialize
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory)/'corpus/ledger/shadow/before';initialize(base,ROOT)
            before=verify_history(base)
            rid=before['projected']['resources'][0]['resource_id']
            operations=[{'type':'ARCHIVE_RESOLVED','resource_id':rid,'timestamp':T,'archive_url':'https://archive.example/test','basis':'synthetic explicit declaration'}]
            # Genesis timestamp is a boundary, not fabricated resource history.
            out=Path(directory)/'corpus/ledger/shadow/after'
            result=archive_run(base,'synthetic-1',operations,out)
            self.assertEqual(result['status'],'STAGED_SHADOW_ARCHIVE_WINDOW')
            after=verify_history(out)
            self.assertEqual(after['state']['event_count'],7035)
            self.assertEqual(after['state']['cursor_create_seq'],before['state']['cursor_create_seq'])
            self.assertEqual(after['state']['last_run_day'],before['state']['last_run_day'])
            self.assertEqual(after['projected']['resources'],before['projected']['resources'])
            self.assertEqual(after['events'][:7034],before['events'])
            for old in base.rglob('*'):
                if old.is_file() and old.name!='HEAD.json': self.assertEqual(old.read_bytes(),(out/old.relative_to(base)).read_bytes())
            with self.assertRaises(ValueError): archive_run(out,'synthetic-1',operations,Path(directory)/'corpus/ledger/shadow/duplicate')
            # A daily run following the new consumer must retain and verify it.
            def observer(rid,target,guard,limiter):
                return {'resource_id':rid,'payload':{'probe_version':'r4b1t-shadow-head-v1','observed_url':target,'final_url':target,'status':200,'headers_digest':D,'started_at':'2026-10-04T08:00:00.000Z','finished_at':'2026-10-04T08:00:01.000Z'}}
            daily=Path(directory)/'corpus/ledger/shadow/daily'
            run(out,'2026-10-04',1,daily,observer=observer)
            checked=verify_history(daily)
            self.assertEqual(checked['events'][:7035],after['events'])
            self.assertEqual(len(checked['state']['archives']),1)
