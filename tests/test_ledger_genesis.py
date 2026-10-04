import copy
import json
import tempfile
import unittest
from pathlib import Path
from corpus.ledger.genesis import snapshot, import_proposals, verify_boundary, IMPORTER_VERSION
from corpus.ledger.verifier import verify_bundle
from corpus.ledger.sequencer import Sequencer
from corpus.ledger.projection import replay
from corpus.ledger.schema.serialization import serialize, digest

ROOT=Path(__file__).resolve().parents[1]
T='2026-10-04T00:00:00.000Z'
COMMIT='947fb828cf5b8b6ce8f702ebfc08269bdfd48022'

class GenesisTests(unittest.TestCase):
    def setUp(self):
        self.payload,self.artifacts=snapshot(ROOT,COMMIT)

    def make_bundle(self,proposals):
        with tempfile.TemporaryDirectory() as directory:
            writer=Sequencer(Path(directory)/'corpus/ledger/shadow/test.sqlite3')
            events=writer.submit_many(proposals)
            projected=replay(events)
            return {'schema':'r4b1t-shadow-ledger-bundle-v1','events':events,'projection':projected,'projection_hash':digest('projection',projected),'event_head':events[-1]['hash'],'event_count':len(events),'genesis_hash':events[0]['hash'],'serialization':'r4b1t-cj1-ledger-v1'}

    def test_exact_current_authority_boundary(self):
        records=verify_boundary(self.payload,self.artifacts)
        self.assertEqual(len(records),7033)
        self.assertEqual(self.payload['importer_version'],IMPORTER_VERSION)
        self.assertEqual(self.payload['authority']['release_id'],'experience-candidate-v0.4')
        self.assertEqual(len(self.payload['import_record_hashes']),7033)
        self.assertTrue(any(x['path']=='urls.txt' for x in self.payload['legacy_corpora']))

    def test_deterministic_real_migration_and_unknown_history(self):
        first=import_proposals(self.payload,self.artifacts,T)
        second=import_proposals(copy.deepcopy(self.payload),dict(self.artifacts),T)
        self.assertEqual(serialize(first),serialize(second))
        a=self.make_bundle(first); b=self.make_bundle(second)
        self.assertEqual(serialize(a),serialize(b))
        self.assertEqual(len(a['events']),7034)
        self.assertTrue(all(r['eligibility']=='ACTIVE' and r['availability'] is None for r in a['projection']['resources']))
        self.assertFalse(a['projection']['observations'])
        result=verify_bundle(a,self.artifacts)
        self.assertEqual(result['projection_hash'],a['projection_hash'])

    def test_genesis_digest_and_authority_tamper_rejected(self):
        resources=self.payload['authority']['resources_path']
        changed=dict(self.artifacts);changed[resources]=changed[resources]+b' '
        with self.assertRaises(ValueError): verify_boundary(self.payload,changed)
        bad=copy.deepcopy(self.payload);bad['authority']['profile_id']='another-profile'
        with self.assertRaises(ValueError): verify_boundary(bad,self.artifacts)
        bad=copy.deepcopy(self.payload);bad['import_record_hashes'][0]='sha256:'+'0'*64
        with self.assertRaises(ValueError): verify_boundary(bad,self.artifacts)

    def test_fabricated_history_and_active_import_rejected(self):
        proposals=import_proposals(self.payload,self.artifacts,T)
        for change in [('started_at','1900-01-01T00:00:00.000Z'),('genesis_hash','sha256:'+'0'*64),('source_ordinal',70000)]:
            bad=copy.deepcopy(proposals[:2]);bad[1]['payload'][change[0]]=change[1]
            with self.assertRaises(ValueError): self.make_bundle(bad)
        bad=copy.deepcopy(proposals[:2]);bad[1]['payload']['metadata']['provenance']='invented'
        with self.assertRaises(ValueError): self.make_bundle(bad)

    def test_verifier_rejects_projection_chain_and_missing_commitments(self):
        bundle=self.make_bundle(import_proposals(self.payload,self.artifacts,T)[:3])
        for field in ['projection_hash','event_head','genesis_hash']:
            bad=copy.deepcopy(bundle);bad[field]='sha256:'+'0'*64
            with self.assertRaises(ValueError): verify_bundle(bad,self.artifacts)
        bad=copy.deepcopy(bundle);bad['projection']['resources'][0]['availability']='LIVE'
        with self.assertRaises(ValueError): verify_bundle(bad,self.artifacts)
        for name in [self.payload['authority']['promotion_path'],'urls.txt']:
            bad=dict(self.artifacts);del bad[name]
            with self.assertRaises(ValueError): verify_bundle(bundle,bad)

    def test_historical_inventory_cannot_be_removed(self):
        bad=copy.deepcopy(self.payload)
        keep={bad['authority'][k] for k in ('promotion_path','urls_path','resources_path','manifest_path','registry_path','terrain_index_path')}|{'urls.txt'}
        bad['artifacts']=[x for x in bad['artifacts'] if x['path'] in keep]
        bad['legacy_corpora']=[x for x in bad['legacy_corpora'] if x['path'] in keep]
        identity={k:bad[k] for k in ('importer_version','artifacts','legacy_corpora','authority','source_commit','import_record_hashes')}
        bad['import_input_digest']=digest('manifest',identity)
        artifacts={k:v for k,v in self.artifacts.items() if k in keep}
        with self.assertRaises(ValueError): verify_boundary(bad,artifacts)

    def test_bundle_count_requires_safe_integer_not_bool_or_float(self):
        bundle=self.make_bundle(import_proposals(self.payload,self.artifacts,T)[:1])
        for value in (True,1.0):
            with self.subTest(value=value),self.assertRaises(ValueError):
                verify_bundle(dict(bundle,event_count=value),self.artifacts)
