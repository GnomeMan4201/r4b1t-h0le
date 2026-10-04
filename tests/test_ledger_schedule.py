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
