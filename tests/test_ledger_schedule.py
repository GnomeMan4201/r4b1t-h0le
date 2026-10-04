import unittest
from corpus.ledger.consumers.schedule import plan
from corpus.ledger.projection import replay
from corpus.ledger.tools.reference import reference

class ScheduleTests(unittest.TestCase):
    def test_round_robin_is_numeric_bounded_and_blind_to_outcomes(self):
        projected=replay(reference())
        result=plan(projected,0,2,'2026-10-04')
        self.assertEqual(result['resource_ids'],['r4b1t:r:000000000000002'])
        self.assertEqual(result['cursor_create_seq'],2)
        projected['resources'][0]['eligibility']='SUSPECT'
        projected['resources'][0]['availability']='GONE'
        self.assertEqual(plan(projected,0,2,'2026-10-04'),result)
        with self.assertRaises(ValueError): plan(projected,0,101,'2026-10-04')

    def test_daily_unchanged_outcome_suppresses_full_probe_across_windows(self):
        from corpus.ledger.consumers.probe_windows import build_window,proposals,DAILY_FILES
        from corpus.ledger.consumers.schedule import DAILY,policy
        from corpus.ledger.schema.serialization import sorted_collection
        from tests.test_ledger_probe_windows import MANIFEST,observation,RID
        import copy
        projected=replay(reference());row=observation()
        projected['observations'].append({'type':'PROBE_SUCCEEDED','resource_id':RID,'payload':row['payload']})
        manifest=copy.deepcopy(MANIFEST);manifest['files']=sorted_collection([{'path':path,'digest':'sha256:'+'0'*64} for path in DAILY_FILES])
        window=build_window(projected,[row],manifest,policy_version=DAILY,emission_policy=policy())
        self.assertEqual([p['type'] for p in proposals(window)],['PROBE_HEARTBEAT'])
        changed=copy.deepcopy(window);changed['observations'][0]['payload']['status']=500
        self.assertEqual([p['type'] for p in proposals(changed)],['PROBE_FAILED','PROBE_HEARTBEAT'])
        bad=copy.deepcopy(window);bad['prior_outcomes']=[]
        from corpus.ledger.consumers.probe_windows import verify_window
        with self.assertRaises(ValueError): verify_window(reference(),bad,[],{})

    def test_cold_sequencer_restore_preserves_exact_order_and_refuses_reset(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.sequencer import Sequencer
        original=reference()
        with tempfile.TemporaryDirectory() as directory:
            writer=Sequencer(Path(directory)/'corpus/ledger/shadow/restore.sqlite3')
            writer.restore_committed(original)
            self.assertEqual(writer.events(),original)
            with self.assertRaises(ValueError): writer.restore_committed(original)
            self.assertEqual(writer.events(),original)

    def test_daily_heartbeat_requires_atomic_source_binding(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.sequencer import Sequencer
        from tests.test_ledger_engine import genesis,proposal
        with tempfile.TemporaryDirectory() as directory:
            writer=Sequencer(Path(directory)/'corpus/ledger/shadow/head.sqlite3')
            writer.submit(genesis());rid=writer.submit(proposal())['resource_id']
            proposed={'type':'PROBE_HEARTBEAT','resource_id':rid,'timestamp':'2026-10-04T08:00:00.000Z','payload':{'policy_version':'shadow-daily-window-v1','started_at':'2026-10-04T08:00:00.000Z','finished_at':'2026-10-04T08:00:00.000Z','evidence_digest':'sha256:'+'0'*64,'observation_count':1}}
            before=writer.events()
            with self.assertRaises(ValueError): writer.submit_many([proposed])
            self.assertEqual(writer.events(),before)
