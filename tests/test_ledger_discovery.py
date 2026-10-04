import tempfile
import copy
import unittest
from pathlib import Path
from tests.test_ledger_engine import genesis, T
from corpus.ledger.sequencer import Sequencer


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.writer=Sequencer(Path(self.temp.name)/'corpus/ledger/shadow/test.sqlite3')
        self.writer.submit(genesis())

    def test_recorded_discovery_creates_candidates_only_with_sequencer_ids(self):
        from corpus.ledger.consumers.discovery import build_window,proposals,verify_window
        from corpus.ledger.tools.discovery import producer_files,producer_manifest
        before=self.writer.events()
        rows=[{'url':'https://example.org/new','timestamp':T,'basis':'Synthetic operator declaration; external history unknown','metadata':{'resource_type':'research'}}]
        window=build_window(before,rows,producer_manifest())
        submitted=proposals(before,window)
        self.assertEqual(len(submitted),1)
        self.assertEqual(submitted[0]['type'],'RESOURCE_CREATED')
        self.assertNotIn('resource_id',submitted[0])
        committed=self.writer.submit_many(submitted,expected_head=before[-1]['hash'])
        self.assertEqual(committed[0]['resource_id'],'r4b1t:r:000000000000002')
        resource=self.writer.snapshot()['resources'][0]
        self.assertEqual(resource['eligibility'],'CANDIDATE')
        self.assertIsNone(resource['availability'])
        self.assertEqual(resource['metadata']['resource_type'],'research')
        self.assertEqual(verify_window(before,window,committed,producer_files())['status'],'VERIFIED_SHADOW_DISCOVERY_WINDOW')

    def test_duplicate_and_recorded_lineage_urls_cannot_mint_new_identities(self):
        from corpus.ledger.consumers.discovery import build_window
        from corpus.ledger.tools.discovery import producer_manifest
        from tests.test_ledger_engine import proposal,D
        row={'url':'https://example.org/new','timestamp':T,'basis':'Explicit synthetic declaration','metadata':{}}
        with self.assertRaises(ValueError): build_window(self.writer.events(),[row,row],producer_manifest())
        original=self.writer.submit(proposal())['resource_id']
        self.writer.submit(proposal('REDIRECT_OBSERVED',original,{'from_url':'https://example.org/','to_url':row['url'],'evidence_digest':D}))
        with self.assertRaises(ValueError): build_window(self.writer.events(),[row],producer_manifest())
        with self.assertRaises(ValueError): build_window(self.writer.events(),[dict(row,url='https://example.org/')],producer_manifest())

    def test_discovery_append_requires_atomic_source_head_and_preserves_restore(self):
        from corpus.ledger.consumers.discovery import build_window,proposals
        from corpus.ledger.tools.discovery import producer_manifest
        from tests.test_ledger_engine import proposal
        before=self.writer.events();rows=[{'url':'https://example.org/new','timestamp':T,'basis':'Synthetic','metadata':{}}]
        submitted=proposals(before,build_window(before,rows,producer_manifest()))
        with self.assertRaises(ValueError): self.writer.submit_many(submitted)
        self.assertEqual(self.writer.events(),before)
        self.writer.submit(proposal())
        with self.assertRaises(ValueError): self.writer.submit_many(submitted,expected_head=before[-1]['hash'])
        current=self.writer.events()
        with self.assertRaises(ValueError): self.writer.submit_many(submitted,expected_head=current[-1]['hash'])
        self.assertEqual(self.writer.events(),current)
        refreshed=proposals(current,build_window(current,rows,producer_manifest()))
        self.writer.submit_many(refreshed,expected_head=current[-1]['hash'])
        restored=Sequencer(Path(self.temp.name)/'corpus/ledger/shadow/restored.sqlite3')
        restored.restore_committed(self.writer.events())
        self.assertEqual(restored.events(),self.writer.events())

    def test_discovery_verifier_rejects_tampering_dropped_duplicate_and_authority_inputs(self):
        from corpus.ledger.consumers.discovery import build_window,proposals,verify_window
        from corpus.ledger.tools.discovery import producer_files,producer_manifest
        before=self.writer.events();rows=[{'url':'https://example.org/new','timestamp':T,'basis':'Synthetic','metadata':{}}]
        window=build_window(before,rows,producer_manifest())
        submitted=proposals(before,window)
        committed=self.writer.submit_many(submitted,expected_head=before[-1]['hash'])
        for field,value in [('source_head','sha256:'+'0'*64),('adapter_version','unknown'),('schema','unknown')]:
            bad=dict(window,**{field:value})
            with self.subTest(field=field),self.assertRaises(ValueError): verify_window(before,bad,committed,producer_files())
        for field,value in [('url','https://other.example/'),('basis','changed'),('timestamp','2026-10-04T00:00:01.000Z')]:
            bad=copy.deepcopy(window);bad['submissions'][0][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError): verify_window(before,bad,committed,producer_files())
        for altered in [[],committed+committed]:
            with self.assertRaises(ValueError): verify_window(before,window,altered,producer_files())
        inputs=producer_files();first=next(iter(inputs));inputs[first]+=b'changed'
        with self.assertRaises(ValueError): verify_window(before,window,committed,inputs)
        inputs=producer_files();inputs['undeclared']=b''
        with self.assertRaises(ValueError): verify_window(before,window,committed,inputs)
        for extra in [{'resource_id':'r4b1t:r:000000000000999'},{'seq':99},{'hash':'sha256:'+'0'*64},{'initial_eligibility':'ACTIVE'}]:
            with self.subTest(extra=extra),self.assertRaises(ValueError): build_window(before,[dict(rows[0],**extra)],producer_manifest())
        for metadata in [{'provenance':'invented'},{'eligibility':'ACTIVE'},{'availability':'LIVE'}]:
            with self.assertRaises(ValueError): build_window(before,[dict(rows[0],metadata=metadata)],producer_manifest())
        for value in ['2026-10-04T00:00:00Z',1.5]:
            with self.assertRaises(ValueError): build_window(before,[dict(rows[0],timestamp=value)],producer_manifest())

    def test_discovery_is_structurally_pure_and_forbidden_dependencies_fail(self):
        from corpus.ledger.tools.check_purity import check_package,check_source
        from tests.test_ledger_genesis import ROOT
        path=ROOT/'corpus/ledger/consumers/discovery.py'
        self.assertIn(str(path),check_package(ROOT))
        for forbidden in ['import time','import socket','import os','import random','import requests']:
            with self.subTest(forbidden=forbidden),self.assertRaises(ValueError): check_source(path.read_text()+'\n'+forbidden,'corpus.ledger.consumers.discovery')

    def test_literal_discovery_vector_agrees_with_independent_node_bytes(self):
        from corpus.ledger.consumers.discovery import build_window,proposals
        from corpus.ledger.tools.shadow import read_canonical
        from corpus.ledger.schema.serialization import serialize,digest
        from tests.test_ledger_genesis import ROOT
        root=ROOT/'corpus/ledger/fixtures/discovery-recorded-v1'
        window=read_canonical(root/'window.json')
        self.assertEqual(build_window(self.writer.events(),window['submissions'],window['producer_manifest']),window)
        self.assertEqual(serialize(proposals(self.writer.events(),window))+'\n',(root/'proposals.json').read_text())
        self.assertEqual(digest('manifest',window),read_canonical(root/'commitments.json')['window_hash'])


class DiscoveryFilesTests(unittest.TestCase):
    def test_prepare_is_inert_and_offline_verification_binds_immutable_export(self):
        from corpus.ledger.tools.discovery import prepare,verify_exports
        from corpus.ledger.tools.shadow import export,read_canonical
        from corpus.ledger.genesis import snapshot,import_proposals
        from tests.test_ledger_genesis import ROOT,COMMIT
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'corpus/ledger/shadow'
            payload,artifacts=snapshot(ROOT,COMMIT);writer=Sequencer(root/'ledger.sqlite3')
            writer.submit_many(import_proposals(payload,artifacts,T)[:2])
            before=root/'before';export(writer,artifacts,before)
            original=writer.events();out=root/'recorded-window'
            rows=[{'url':'https://example.org/new-recorded-discovery','timestamp':T,'basis':'Synthetic test declaration; no external observation asserted','metadata':{}}]
            result=prepare(before,rows,out)
            self.assertEqual(result['status'],'SHADOW_DISCOVERY_PROPOSALS_ONLY')
            self.assertEqual(writer.events(),original)
            with self.assertRaises(ValueError): prepare(before,rows,out)
            with self.assertRaises(ValueError): prepare(before,rows,Path(directory)/'outside-shadow')
            submitted=read_canonical(out/'proposals.json')
            writer.submit_many(submitted,expected_head=result['source_head'])
            after=root/'after';export(writer,artifacts,after)
            self.assertEqual(verify_exports(before,after,out)['event_count'],1)
            self.assertEqual(writer.snapshot()['resources'][-1]['eligibility'],'CANDIDATE')
            (out/'undeclared').write_text('not committed')
            with self.assertRaises(ValueError): verify_exports(before,after,out)

    def test_preparation_freezes_one_producer_read(self):
        from unittest.mock import patch
        from corpus.ledger.tools.discovery import prepare,producer_files
        from corpus.ledger.tools.shadow import export,read_canonical
        from corpus.ledger.genesis import snapshot,import_proposals
        from tests.test_ledger_genesis import ROOT,COMMIT
        import hashlib
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'corpus/ledger/shadow'
            payload,artifacts=snapshot(ROOT,COMMIT);writer=Sequencer(root/'ledger.sqlite3')
            writer.submit_many(import_proposals(payload,artifacts,T)[:2])
            before=root/'before';export(writer,artifacts,before)
            captured=producer_files();changed=dict(captured)
            first=next(iter(changed));changed[first]+=b'changed between reads'
            out=root/'window';rows=[{'url':'https://recorded.example/synthetic','timestamp':T,'basis':'Synthetic','metadata':{}}]
            with patch('corpus.ledger.tools.discovery.producer_files',side_effect=[captured,changed]) as reader:
                prepare(before,rows,out)
            self.assertEqual(reader.call_count,1)
            for item in read_canonical(out/'window.json')['producer_manifest']['files']:
                self.assertEqual(item['digest'],'sha256:'+hashlib.sha256((out/'producer_files'/item['path']).read_bytes()).hexdigest())
