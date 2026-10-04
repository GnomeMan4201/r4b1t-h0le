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
