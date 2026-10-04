import copy
import tempfile
import unittest
from pathlib import Path
from corpus.ledger.genesis import snapshot, import_proposals
from corpus.ledger.sequencer import Sequencer
from corpus.ledger.schema.serialization import serialize
from corpus.ledger.schema.events import event_hash
from corpus.ledger.tools.shadow import export, load_export, write_canonical
from tests.test_ledger_genesis import ROOT,COMMIT,T

class ShadowFilesTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'corpus/ledger/shadow'
        self.payload,self.artifacts=snapshot(ROOT,COMMIT)
        self.writer=Sequencer(self.root/'ledger.sqlite3')
        self.writer.submit_many(import_proposals(self.payload,self.artifacts,T)[:2])

    def test_existing_export_never_overwritten(self):
        target=self.root/'bundle-v1';export(self.writer,self.artifacts,target)
        original=(target/'events.jsonl').read_bytes()
        with self.assertRaises(ValueError): export(self.writer,self.artifacts,target)
        self.assertEqual((target/'events.jsonl').read_bytes(),original)

    def test_artifact_reads_reject_traversal_and_symlinks(self):
        target=self.root/'bundle-v1';export(self.writer,self.artifacts,target)
        raw=(target/'events.jsonl').read_text();events=[__import__('json').loads(x) for x in raw.splitlines()]
        secret=Path(self.temp.name)/'outside';secret.write_text('private')
        for name in [str(secret),'../../../../outside']:
            bad=copy.deepcopy(events);bad[0]['payload']['artifacts'][0]['path']=name;bad[0]['hash']=event_hash(bad[0])
            (target/'events.jsonl').write_text(''.join(serialize(e)+'\n' for e in bad))
            with self.assertRaises(ValueError): load_export(target)
        (target/'events.jsonl').write_text(raw)
        victim=target/'artifacts'/self.payload['artifacts'][0]['path'];victim.unlink();victim.symlink_to(secret)
        with self.assertRaises(ValueError): load_export(target)

    def test_local_snapshot_cannot_follow_promotion_outside_root(self):
        from unittest.mock import patch
        real=Path.read_bytes
        promotion_path=ROOT/'corpus/runtime/active-v1.json'
        def read(path):
            if path==promotion_path:
                import json
                promotion=json.loads(real(path));promotion['active']['url']='/etc/passwd'
                return json.dumps(promotion).encode()
            return real(path)
        with patch.object(Path,'read_bytes',read),self.assertRaises(ValueError): snapshot(ROOT,COMMIT)

    def test_failed_export_leaves_no_partial_destination_and_can_retry(self):
        from unittest.mock import patch
        target=self.root/'bundle-v1'
        with patch('corpus.ledger.tools.shadow.os.rename',side_effect=OSError('injected publication failure')):
            from corpus.ledger.tools.shadow import ExportError
            with self.assertRaises(ExportError): export(self.writer,self.artifacts,target)
        self.assertFalse(target.exists())
        self.assertEqual(len(self.writer.events()),2)
        export(self.writer,self.artifacts,target)
        self.assertEqual(len(load_export(target)[0]['events']),2)

    def test_reserved_export_is_rejected(self):
        self.root.mkdir(parents=True,exist_ok=True)
        (self.root/'.bundle-v1.publish-lock').touch()
        with self.assertRaises(ValueError): export(self.writer,self.artifacts,self.root/'bundle-v1')

    def test_post_commit_publication_conflict_is_reported_as_committed(self):
        from corpus.ledger.tools.shadow import ExportError, publish_committed
        target=self.root/'bundle-v1'
        (self.root/'.bundle-v1.publish-lock').touch()
        with self.assertRaises(ExportError): publish_committed(self.writer,self.artifacts,target)
        self.assertEqual(len(self.writer.events()),2)
