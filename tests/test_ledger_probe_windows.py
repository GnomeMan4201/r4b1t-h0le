import copy
import unittest
from corpus.ledger.consumers.probe_windows import build_window, proposals, verify_window
from corpus.ledger.projection import replay
from corpus.ledger.tools.reference import reference

T='2026-10-04T06:10:00.000Z'
RID='r4b1t:r:000000000000002'
MANIFEST={'schema':'r4b1t-shadow-producer-manifest-v1','name':'shadow-head','version':'r4b1t-shadow-head-v1','files':[{'path':'fixture.py','digest':'sha256:'+'0'*64}]}

def observation(status=200,at=T):
    return {'resource_id':RID,'payload':{'probe_version':'r4b1t-shadow-head-v1','observed_url':'https://example.org/','final_url':'https://example.org/','status':status,'started_at':at,'finished_at':at,'headers_digest':'sha256:'+'0'*64}}

class ProbeWindowTests(unittest.TestCase):
    def setUp(self): self.projected=replay(reference())

    def test_repeated_success_is_bound_by_heartbeat_without_activation(self):
        rows=[observation(at='2026-10-04T06:10:01.000Z'),observation()]
        window=build_window(self.projected,rows,MANIFEST)
        result=proposals(window)
        self.assertEqual([p['type'] for p in result],['PROBE_SUCCEEDED','PROBE_HEARTBEAT'])
        self.assertEqual(result[-1]['payload']['observation_count'],2)
        self.assertFalse(any(p['type'].startswith(('MARKED_','AVAILABILITY_')) for p in result))
        self.assertEqual(build_window(self.projected,list(reversed(rows)),MANIFEST),window)

    def test_window_tamper_missing_heartbeat_and_wrong_code_fail_closed(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.sequencer import Sequencer
        witness=copy.deepcopy(MANIFEST);witness['files'][0]['digest']='sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        window=build_window(self.projected,[observation()],witness)
        with tempfile.TemporaryDirectory() as directory:
            writer=Sequencer(Path(directory)/'corpus/ledger/shadow/test.sqlite3')
            for e in reference(): writer.submit({k:v for k,v in e.items() if k not in ('schema','seq','prev','hash') and not (e['type']=='RESOURCE_CREATED' and k=='resource_id')})
            committed=writer.submit_many(proposals(window))
            self.assertEqual(verify_window(reference(),window,committed,{'fixture.py':b''})['status'],'VERIFIED_SHADOW_PROBE_WINDOW')
            for changed in (committed[:-1],list(reversed(committed))):
                with self.assertRaises(ValueError): verify_window(reference(),window,changed,{'fixture.py':b''})
            with self.assertRaises(ValueError): verify_window(reference(),window,committed,{'fixture.py':b'changed'})
            bad=copy.deepcopy(window);bad['observations'][0]['payload']['status']=500
            with self.assertRaises(ValueError): verify_window(reference(),bad,committed,{'fixture.py':b''})

    def test_invalid_windows_reject_identity_url_policy_duplicates_and_overlap(self):
        for change in ('absorbed','unknown','url','duplicates','overlap','body','version','status'):
            rows=[observation()]
            if change=='absorbed': rows[0]['resource_id']='r4b1t:r:000000000000003'
            if change=='unknown': rows[0]['resource_id']='r4b1t:r:000000000000099'
            if change=='url': rows[0]['payload']['observed_url']='https://unconfirmed.example/'
            if change=='duplicates': rows*=2
            if change=='overlap':
                rows[0]['payload']['finished_at']='2026-10-04T06:10:02.000Z';rows.append(observation(at='2026-10-04T06:10:01.000Z'))
            if change=='body': rows[0]['payload']['body_bytes']=1
            if change=='version': rows[0]['payload']['probe_version']='unknown'
            if change=='status': rows[0]['payload']['status']=600
            with self.subTest(change=change),self.assertRaises(ValueError): build_window(self.projected,rows,MANIFEST)
        good=build_window(self.projected,[observation()],MANIFEST)
        with self.assertRaises(ValueError): proposals(dict(good,policy_version='unknown'))

    def test_outcome_changes_emit_full_evidence_but_never_axis_changes(self):
        rows=[observation(),observation(500,'2026-10-04T06:10:01.000Z'),observation(500,'2026-10-04T06:10:02.000Z'),observation(200,'2026-10-04T06:10:03.000Z')]
        self.assertEqual([p['type'] for p in proposals(build_window(self.projected,rows,MANIFEST))],['PROBE_SUCCEEDED','PROBE_FAILED','PROBE_SUCCEEDED','PROBE_HEARTBEAT'])

    def test_real_observer_records_headers_and_time_without_body_fetch(self):
        from corpus.ledger.consumers.head_probe import observe
        from unittest.mock import Mock,patch
        response=Mock(status_code=200,headers={'Content-Type':'text/html'})
        with patch('corpus.ledger.consumers.head_probe.request',return_value=(response,'https://example.org/')) as transport:
            result=observe(RID,'https://example.org/',Mock(),Mock(),clock=iter([T,'2026-10-04T06:10:01.000Z']).__next__)
        self.assertEqual(result['payload']['status'],200)
        self.assertNotIn('body_bytes',result['payload'])
        self.assertEqual(result['payload']['finished_at'],'2026-10-04T06:10:01.000Z')
        response.close.assert_called_once();transport.assert_called_once()
        self.assertEqual(transport.call_args.args[0],'HEAD')

    def test_transport_error_is_evidence_not_retirement(self):
        from corpus.ledger.consumers.head_probe import observe
        from unittest.mock import Mock,patch
        from pool_sweep import TargetGuardError
        with patch('corpus.ledger.consumers.head_probe.request',side_effect=TargetGuardError('private target')):
            row=observe(RID,'https://example.org/',Mock(),Mock(),clock=lambda:T)
        self.assertEqual(row['payload']['reason'],'TargetGuardError')
        result=proposals(build_window(self.projected,[row],MANIFEST))
        self.assertEqual([p['type'] for p in result],['PROBE_FAILED','PROBE_HEARTBEAT'])
        self.assertNotIn('status',row['payload'])

    def test_operator_tool_produces_immutable_offline_evidence(self):
        from corpus.ledger.tools.probe import collect, verify_exports
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from tests.test_ledger_genesis import ROOT,COMMIT
        from corpus.ledger.genesis import snapshot,import_proposals
        from corpus.ledger.sequencer import Sequencer
        from corpus.ledger.tools.shadow import export
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'corpus/ledger/shadow'
            payload,artifacts=snapshot(ROOT,COMMIT);writer=Sequencer(root/'store.sqlite3')
            writer.submit_many(import_proposals(payload,artifacts,T)[:2]);export(writer,artifacts,root/'before')
            target=writer.snapshot()['resources'][0]['url']
            row=observation();row['payload']['observed_url']=target;row['payload']['final_url']=target
            with patch('corpus.ledger.tools.probe.observe',return_value=row): collect(root/'before',[RID],1,root/'window')
            from corpus.ledger.tools.shadow import read_canonical
            writer.submit_many(read_canonical(root/'window/proposals.json'));export(writer,artifacts,root/'after')
            self.assertEqual(verify_exports(root/'before',root/'after',root/'window')['status'],'VERIFIED_SHADOW_PROBE_WINDOW')
            with self.assertRaises(ValueError): collect(root/'before',[RID],1,root/'window')

    def test_sequencer_rejects_stale_window_head_without_append(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.sequencer import Sequencer
        from tests.test_ledger_engine import genesis,proposal
        with tempfile.TemporaryDirectory() as directory:
            writer=Sequencer(Path(directory)/'corpus/ledger/shadow/cas.sqlite3')
            head=writer.submit(genesis())['hash'];writer.submit(proposal())
            before=writer.events()
            with self.assertRaises(ValueError): writer.submit_many([proposal()],expected_head=head)
            self.assertEqual(writer.events(),before)
            self.assertEqual(len(writer.submit_many([proposal()],expected_head=before[-1]['hash'])),1)
