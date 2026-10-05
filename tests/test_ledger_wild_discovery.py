import copy
import tempfile
import unittest
from pathlib import Path

from corpus.ledger.sequencer import Sequencer
from tests.test_ledger_engine import genesis, T

DECLARATION='2026-10-05T19:38:29.000Z'
D='sha256:'+'1'*64

def accepted(url='https://wild.example/resource'):
    return {
        'schema':'r4b1t-wild-accepted/v1',
        'campaign_manifest_sha256':D,
        'classification_sha256':'sha256:'+'2'*64,
        'site_key':'wild.example',
        'url':url,
        'resource_type':'personal_site',
        'primary_subject':'programming',
        'subjects':['programming','web_culture'],
        'reason':'Human-reviewed independent technical site with durable exploratory value.',
        'observation':{
            'origin_key':'wild.example','url':url,'raw_url':url,'final_url':url,'hops':[],
            'status':'LIVE_CANDIDATE','http_status':200,'observed_at':1791228131,'attempt':1,
            'probe_sha256':'sha256:'+'3'*64,'probe_hash_scope':'FULL','probe_hashed_bytes':1234,
            'archive_status':'FOUND','archive_url':'https://archive.example/wild','archive_timestamp':'20261005000000',
            'title':'Wild'
        },
        'quota_lead':{
            'lead_source_key':'lead.example','lead_source_url':'https://lead.example/',
            'lead_final_url':'https://lead.example/','lead_page_sha256':'sha256:'+'4'*64,
            'lead_hash_scope':'FULL','lead_hashed_bytes':100,'lead_observed_at':1791228100,'anchor':'wild'
        },
        'lead_edges':[]
    }

def evidence_manifest():
    return {
        'schema':'r4b1t-shadow-wild-evidence-manifest-v1',
        'artifact_sha256':'sha256:'+'5'*64,
        'accepted_export':{'path':'accepted.jsonl','digest':'sha256:'+'6'*64},
        'campaign_manifest':{'path':'campaign-manifest.json','digest':D},
        'classification':{'path':'classification.json','digest':'sha256:'+'2'*64},
        'review':{'path':'review.csv','digest':'sha256:'+'7'*64},
        'quality_tags':{'path':'quality-tags.csv','digest':'sha256:'+'8'*64},
    }

class WildDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.writer=Sequencer(Path(self.temp.name)/'corpus/ledger/shadow/test.sqlite3')
        self.writer.submit(genesis())

    def test_reviewed_wild_record_creates_candidate_only_and_keeps_rich_data_out_of_projection(self):
        from corpus.ledger.consumers.wild_discovery import build_window,proposals,verify_window,ELIGIBILITY_REASON
        from corpus.ledger.tools.wild_discovery import producer_files,producer_manifest
        before=self.writer.events();record=accepted()
        window=build_window(before,[record],DECLARATION,producer_manifest(),evidence_manifest())
        submitted=proposals(before,window)
        self.assertEqual(len(submitted),1)
        self.assertEqual(submitted[0]['type'],'RESOURCE_CREATED')
        self.assertNotIn('resource_id',submitted[0])
        self.assertEqual(submitted[0]['payload']['metadata']['resource_type'],'personal_site')
        self.assertEqual(submitted[0]['payload']['metadata']['eligibility_reason'],ELIGIBILITY_REASON)
        self.assertNotIn('primary_subject',submitted[0]['payload']['metadata'])
        self.assertNotIn('subjects',submitted[0]['payload']['metadata'])
        self.assertNotIn('reason',submitted[0]['payload']['metadata'])
        committed=self.writer.submit_many(submitted,expected_head=before[-1]['hash'])
        resource=self.writer.snapshot()['resources'][0]
        self.assertEqual(resource['eligibility'],'CANDIDATE')
        self.assertIsNone(resource['availability'])
        self.assertEqual(set(resource['metadata']),{'resource_type','eligibility_reason','provenance'})
        fake_evidence={
            'accepted.jsonl':b'a','campaign-manifest.json':b'b','classification.json':b'c',
            'review.csv':b'd','quality-tags.csv':b'e'
        }
        # verify_window binds supplied evidence bytes; use a manifest that matches them.
        import hashlib
        bound=copy.deepcopy(evidence_manifest())
        for key,name in [('accepted_export','accepted.jsonl'),('campaign_manifest','campaign-manifest.json'),
                         ('classification','classification.json'),('review','review.csv'),('quality_tags','quality-tags.csv')]:
            bound[key]['digest']='sha256:'+hashlib.sha256(fake_evidence[name]).hexdigest()
        record['campaign_manifest_sha256']=bound['campaign_manifest']['digest']
        record['classification_sha256']=bound['classification']['digest']
        verified_writer=Sequencer(Path(self.temp.name)/'corpus/ledger/shadow/verified.sqlite3')
        verified_writer.submit(genesis())
        verified_before=verified_writer.events()
        window=build_window(verified_before,[record],DECLARATION,producer_manifest(),bound)
        committed=verified_writer.submit_many(proposals(verified_before,window),expected_head=verified_before[-1]['hash'])
        self.assertEqual(verify_window(verified_before,window,committed,producer_files(),fake_evidence)['status'],
                         'VERIFIED_SHADOW_WILD_DISCOVERY_WINDOW')

    def test_full_reviewed_record_and_evidence_are_commitment_bound(self):
        from corpus.ledger.consumers.wild_discovery import build_window,proposals,verify_window
        from corpus.ledger.tools.wild_discovery import producer_files,producer_manifest
        import hashlib
        before=self.writer.events()
        evidence={name:value for name,value in {
            'accepted.jsonl':b'a','campaign-manifest.json':b'b','classification.json':b'c',
            'review.csv':b'd','quality-tags.csv':b'e'}.items()}
        bound=evidence_manifest()
        for key,name in [('accepted_export','accepted.jsonl'),('campaign_manifest','campaign-manifest.json'),
                         ('classification','classification.json'),('review','review.csv'),('quality_tags','quality-tags.csv')]:
            bound[key]['digest']='sha256:'+hashlib.sha256(evidence[name]).hexdigest()
        record=accepted();record['campaign_manifest_sha256']=bound['campaign_manifest']['digest'];record['classification_sha256']=bound['classification']['digest']
        window=build_window(before,[record],DECLARATION,producer_manifest(),bound)
        committed=self.writer.submit_many(proposals(before,window),expected_head=before[-1]['hash'])
        for mutate in [
            lambda w: w['records'][0].__setitem__('reason','changed human reason'),
            lambda w: w['records'][0].__setitem__('subjects',['programming']),
            lambda w: w['records'][0]['observation'].__setitem__('probe_sha256','sha256:'+'9'*64),
            lambda w: w['evidence']['review'].__setitem__('digest','sha256:'+'9'*64),
        ]:
            bad=copy.deepcopy(window);mutate(bad)
            with self.subTest(bad=bad),self.assertRaises(ValueError):
                verify_window(before,bad,committed,producer_files(),evidence)
        changed=dict(evidence);changed['review.csv']=b'changed'
        with self.assertRaises(ValueError): verify_window(before,window,committed,producer_files(),changed)
        producer=producer_files();first=next(iter(producer));producer[first]+=b'changed'
        with self.assertRaises(ValueError): verify_window(before,window,committed,producer,evidence)

    def test_record_binding_and_order_fail_closed(self):
        from corpus.ledger.consumers.wild_discovery import build_window
        from corpus.ledger.tools.wild_discovery import producer_manifest
        one=accepted('https://a.example/');two=accepted('https://b.example/')
        one['site_key']='a.example';two['site_key']='b.example'
        for r in (one,two):
            r['campaign_manifest_sha256']=evidence_manifest()['campaign_manifest']['digest']
            r['classification_sha256']=evidence_manifest()['classification']['digest']
        before=self.writer.events()
        with self.assertRaises(ValueError): build_window(before,[two,one],DECLARATION,producer_manifest(),evidence_manifest())
        bad=copy.deepcopy(one);bad['campaign_manifest_sha256']='sha256:'+'0'*64
        with self.assertRaises(ValueError): build_window(before,[bad],DECLARATION,producer_manifest(),evidence_manifest())
        bad=copy.deepcopy(one);bad['classification_sha256']='sha256:'+'0'*64
        with self.assertRaises(ValueError): build_window(before,[bad],DECLARATION,producer_manifest(),evidence_manifest())
        bad=copy.deepcopy(one);bad['subjects']=['web_culture']
        with self.assertRaises(ValueError): build_window(before,[bad],DECLARATION,producer_manifest(),evidence_manifest())

    def test_actual_reviewed_export_maps_exactly_30_records(self):
        from corpus.ledger.consumers.wild_discovery import build_window,proposals
        from corpus.ledger.tools.wild_discovery import load_records,producer_manifest,evidence_manifest as real_evidence
        from tests.test_ledger_genesis import ROOT
        records=load_records(ROOT/'corpus/wild/reviews/wild-50-v061-campaign-accepted.jsonl')
        self.assertEqual(len(records),30)
        window=build_window(self.writer.events(),records,DECLARATION,producer_manifest(),real_evidence())
        submitted=proposals(self.writer.events(),window)
        self.assertEqual(len(submitted),30)
        self.assertEqual(len({r['payload']['url'] for r in submitted}),30)
        self.assertTrue(all(r['payload']['metadata']['eligibility_reason'] for r in submitted))

    def test_wild_consumer_is_structurally_pure(self):
        from corpus.ledger.tools.check_purity import check_package,check_source
        from tests.test_ledger_genesis import ROOT
        path=ROOT/'corpus/ledger/consumers/wild_discovery.py'
        self.assertIn(str(path),check_package(ROOT))
        for forbidden in ['import time','import socket','import os','import random','import requests']:
            with self.subTest(forbidden=forbidden),self.assertRaises(ValueError):
                check_source(path.read_text()+'\n'+forbidden,'corpus.ledger.consumers.wild_discovery')


class WildDiscoveryFilesTests(unittest.TestCase):
    def test_canonical_reviewed_export_prepares_appends_and_verifies_offline_window(self):
        from corpus.ledger.tools.wild_discovery import prepare,verify_exports
        from corpus.ledger.tools.shadow import export,read_canonical
        from corpus.ledger.genesis import snapshot,import_proposals
        from tests.test_ledger_genesis import ROOT,COMMIT

        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'corpus/ledger/shadow'
            payload,artifacts=snapshot(ROOT,COMMIT)
            writer=Sequencer(root/'ledger.sqlite3')
            writer.submit_many(import_proposals(payload,artifacts,T)[:2])
            before=root/'before'
            export(writer,artifacts,before)

            original=writer.events()
            window_dir=root/'wild-window'
            result=prepare(before,DECLARATION,window_dir)
            self.assertEqual(result['status'],'SHADOW_WILD_DISCOVERY_PROPOSALS_ONLY')
            self.assertEqual(result['records'],30)
            self.assertEqual(writer.events(),original)
            self.assertEqual(len(read_canonical(window_dir/'proposals.json')),30)
            self.assertTrue((window_dir/'evidence_files/corpus/wild/reviews/wild-50-v061-campaign-accepted.jsonl').is_file())

            with self.assertRaises(ValueError):
                prepare(before,DECLARATION,window_dir)

            submitted=read_canonical(window_dir/'proposals.json')
            writer.submit_many(submitted,expected_head=result['source_head'])
            after=root/'after'
            export(writer,artifacts,after)
            verified=verify_exports(before,after,window_dir)
            self.assertEqual(verified['status'],'VERIFIED_SHADOW_WILD_DISCOVERY_WINDOW')
            self.assertEqual(verified['event_count'],30)

            created=writer.snapshot()['resources'][-30:]
            self.assertTrue(all(row['eligibility']=='CANDIDATE' for row in created))
            self.assertTrue(all(row['availability'] is None for row in created))

            review=window_dir/'evidence_files/corpus/wild/reviews/wild-50-v061-review.csv'
            review.write_bytes(review.read_bytes()+b'changed')
            with self.assertRaises(ValueError):
                verify_exports(before,after,window_dir)


if __name__=='__main__':
    unittest.main()
