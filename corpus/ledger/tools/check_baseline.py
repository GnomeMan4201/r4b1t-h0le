"""Reproduce the pinned shadow bootstrap, then verify its frozen commitments."""
import argparse
from pathlib import Path
from corpus.ledger.tools.shadow import main,read_canonical,load_export
from corpus.ledger.verifier import verify_bundle
from corpus.ledger.schema.serialization import serialize


def check(root,output):
    root=Path(root).resolve();output=Path(output).resolve()
    expected=read_canonical(root/'corpus/ledger/shadow/bootstrap-v1.json')
    bundle_dir=output/'corpus/ledger/shadow/baseline'
    main(['bootstrap','--root',str(root),'--source-commit',expected['source_commit'],'--timestamp',expected['timestamp'],'--store',str(output/'corpus/ledger/shadow/baseline.sqlite3'),'--out',str(bundle_dir)])
    actual,artifacts=load_export(bundle_dir)
    verify_bundle(actual,artifacts,expected['event_head'],expected['genesis_hash'])
    for field in ('projection_hash','event_count','serialization','schema'):
        if actual[field]!=expected[field]: raise ValueError('baseline mismatch: '+field)
    for field in ('artifacts','authority','import_input_digest','importer_version','source_commit'):
        if actual['events'][0]['payload'][field]!=expected[field]: raise ValueError('baseline input mismatch: '+field)
    print(serialize({'status':'REPRODUCED_SHADOW_BOOTSTRAP','event_count':actual['event_count'],'projection_hash':actual['projection_hash']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',default='.');parser.add_argument('--out',required=True);args=parser.parse_args();check(args.root,args.out)
