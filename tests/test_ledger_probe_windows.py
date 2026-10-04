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
