import concurrent.futures
import copy
import tempfile
import unittest
from pathlib import Path

from corpus.ledger.sequencer import Sequencer
from corpus.ledger.projection import replay, resolve
from corpus.ledger.schema.serialization import digest, serialize, GENESIS_PREV, VERSION, sorted_collection
from corpus.ledger.schema.events import event_hash

T = '2026-10-04T00:00:00.000Z'
D = GENESIS_PREV

def genesis():
    return dict(timestamp=T, type='GENESIS_BOUNDARY', payload={
        'serialization':VERSION,'importer_version':'r4b1t-legacy-import-v1','import_input_digest':D,
        'source_commit':'9'*40,'artifacts':[{'path':'resources.json','digest':D}],
        'legacy_corpora':[{'path':'urls.txt','digest':D}],
        'authority':{k:k for k in ('promotion_path','urls_path','resources_path','manifest_path','registry_path','profile_id','terrain_index_path','release_id')}})

def proposal(kind='RESOURCE_CREATED', resource_id=None, payload=None):
    result = dict(timestamp=T, type=kind, payload=payload if payload is not None else {'url':'https://example.org/','metadata':{}})
    if resource_id is not None: result['resource_id'] = resource_id
    return result

class EngineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'corpus/ledger/shadow/test.sqlite3'
        self.writer = Sequencer(self.path)
        self.writer.submit(genesis())

    def test_only_sequencer_assigns_authority_fields(self):
        for field, value in [('seq',2),('prev',D),('hash',D),('resource_id','r4b1t:r:000000000000002')]:
            with self.assertRaises(ValueError): self.writer.submit(dict(proposal(), **{field:value}))
        first = self.writer.submit(proposal())
        self.assertEqual(first['resource_id'],'r4b1t:r:000000000000002')
        self.assertEqual(first['prev'],self.writer.events()[0]['hash'])
        self.assertEqual(first['seq'],2)

    def test_explicit_axes_and_no_probe_activation(self):
        rid = self.writer.submit(proposal())['resource_id']
        self.writer.submit(proposal('PROBE_SUCCEEDED',rid, {'probe_version':'p1','observed_url':'https://example.org/','started_at':T,'finished_at':T}))
        state = replay(self.writer.events())
        self.assertEqual(state['resources'][0]['eligibility'],'CANDIDATE')
        self.assertIsNone(state['resources'][0]['availability'])
        for kind in ['MARKED_ACTIVE','AVAILABILITY_LIVE','MARKED_SUSPECT','AVAILABILITY_INTERMITTENT','MARKED_RETIRED','AVAILABILITY_GONE']:
            self.writer.submit(proposal(kind,rid,{'reason':'explicit','evidence_digest':D}))
        record = replay(self.writer.events())['resources'][0]
        self.assertEqual(record['eligibility'],'RETIRED'); self.assertEqual(record['availability'],'GONE')

    def test_merge_survivor_resolution_and_absorbed_identity_references(self):
        ids = [self.writer.submit(proposal())['resource_id'] for _ in range(3)]
        with self.assertRaises(ValueError): self.writer.submit(proposal('RESOURCE_MERGED', ids[1], {'first':ids[1],'second':ids[2],'survivor':ids[2],'evidence_digest':D}))
        self.writer.submit(proposal('RESOURCE_MERGED', ids[1], {'first':ids[1],'second':ids[2],'survivor':ids[1],'evidence_digest':D}))
        self.writer.submit(proposal('RESOURCE_MERGED', ids[0], {'first':ids[0],'second':ids[1],'survivor':ids[0],'evidence_digest':D}))
        state = replay(self.writer.events())
        for rid in ids: self.assertEqual(resolve(state,rid),ids[0])
        self.writer.submit(proposal('MARKED_ACTIVE', ids[2],{'reason':'explicit','evidence_digest':D}))
        self.assertEqual(replay(self.writer.events())['resources'][0]['eligibility'],'ACTIVE')
        self.assertEqual(len(state['resources']),3)

    def test_concurrent_writers_and_atomic_batch_rollback(self):
        def write(_): return Sequencer(self.path).submit(proposal())
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            result = list(pool.map(write,range(18)))
        self.assertEqual(sorted(e['seq'] for e in result),list(range(2,20)))
        before = serialize(self.writer.events())
        with self.assertRaises(ValueError): self.writer.submit_many([proposal(),proposal('UNKNOWN',payload={})])
        self.assertEqual(serialize(self.writer.events()),before)
        self.assertEqual(replay(self.writer.events())['event_count'],19)

    def test_negative_chain_and_missing_identity(self):
        self.writer.submit(proposal())
        for field,value in [('seq',99),('prev','sha256:'+'1'*64),('hash','sha256:'+'2'*64),('type','UNKNOWN')]:
            log = copy.deepcopy(self.writer.events());log[1][field]=value
            if field != 'hash': log[1]['hash']=event_hash(log[1])
            with self.assertRaises(ValueError): replay(log)
        with self.assertRaises(ValueError): resolve(replay(self.writer.events()),'r4b1t:r:000000000009999')
        with self.assertRaises(ValueError): Sequencer(Path(self.temp.name)/'production.sqlite3')

    def test_independent_processes_share_one_order(self):
        import subprocess
        import sys
        script = 'import sys; from corpus.ledger.sequencer import Sequencer; from tests.test_ledger_engine import proposal; print(Sequencer(sys.argv[1]).submit(proposal())["seq"])'
        processes = [subprocess.Popen([sys.executable,'-c',script,str(self.path)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(4)]
        sequences = []
        for process in processes:
            out,err=process.communicate(timeout=15)
            self.assertEqual(process.returncode,0,err); sequences.append(int(out))
        self.assertEqual(sorted(sequences),[2,3,4,5])
        self.assertEqual(replay(self.writer.events())['event_count'],5)

    def test_sql_order_column_cannot_disagree_with_committed_seq(self):
        import sqlite3
        self.writer.submit(proposal())
        with sqlite3.connect(self.path) as db: db.execute('UPDATE events SET seq=99 WHERE seq=2')
        with self.assertRaises(ValueError): self.writer.submit(proposal())

    def test_absorbed_resolution_cannot_be_removed(self):
        a,b=[self.writer.submit(proposal())['resource_id'] for _ in range(2)]
        self.writer.submit(proposal('RESOURCE_MERGED',a,{'first':a,'second':b,'survivor':a,'evidence_digest':D}))
        projected=replay(self.writer.events()); projected['resolutions']=[]
        with self.assertRaises(ValueError): resolve(projected,b)
