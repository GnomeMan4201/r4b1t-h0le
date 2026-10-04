"""Recorded discovery evidence and proposals only; the sequencer owns append."""
import hashlib
import argparse
import os
import tempfile
from pathlib import Path
from corpus.ledger.consumers.discovery import FILES,VERSION,MANIFEST,build_window,proposals,verify_window
from corpus.ledger.schema.serialization import sorted_collection,serialize
from corpus.ledger.tools.files import contained
from corpus.ledger.tools.shadow import load_export,read_canonical,write_canonical
from corpus.ledger.verifier import verify_bundle
from corpus.ledger.sequencer import shadow_path

ROOT=Path(__file__).resolve().parents[3]


def producer_files(): return {path:contained(ROOT,path).read_bytes() for path in FILES}


def producer_manifest(inputs=None):
    if inputs is None: inputs=producer_files()
    return {'schema':MANIFEST,'version':VERSION,'files':sorted_collection([{'path':path,'digest':'sha256:'+hashlib.sha256(raw).hexdigest()} for path,raw in inputs.items()])}


def prepare(boundary,submissions,output):
    output=shadow_path(output)
    if output.exists(): raise ValueError('fresh immutable discovery destination required')
    before,artifacts=load_export(boundary);verify_bundle(before,artifacts)
    inputs=producer_files();window=build_window(before['events'],submissions,producer_manifest(inputs))
    submitted=proposals(before['events'],window)
    output.parent.mkdir(parents=True,exist_ok=True)
    reservation=output.parent/('.'+output.name+'.publish-lock')
    with reservation.open('x'): pass
    try:
        with tempfile.TemporaryDirectory(prefix='.'+output.name+'-',dir=output.parent) as temp:
            stage=Path(temp)/'complete';stage.mkdir()
            for path,raw in inputs.items():
                destination=contained(stage/'producer_files',path);destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(raw)
            write_canonical(stage/'window.json',window);write_canonical(stage/'proposals.json',submitted)
            for item in window['producer_manifest']['files']:
                if 'sha256:'+hashlib.sha256(contained(stage,'producer_files/'+item['path']).read_bytes()).hexdigest()!=item['digest']: raise ValueError('staged discovery producer bytes differ')
            if output.exists(): raise ValueError('immutable discovery destination appeared')
            os.rename(stage,output)
    finally: reservation.unlink()
    return {'status':'SHADOW_DISCOVERY_PROPOSALS_ONLY','submissions':len(submissions),'source_head':before['event_head']}


def verify_exports(before_dir,after_dir,window_dir):
    before,artifacts=load_export(before_dir);verify_bundle(before,artifacts)
    after,after_artifacts=load_export(after_dir);verify_bundle(after,after_artifacts,expected_genesis=before['genesis_hash'])
    prefix=len(before['events'])
    if after['events'][:prefix]!=before['events']: raise ValueError('discovery source is not committed prefix')
    root=Path(window_dir);window=read_canonical(root/'window.json')
    if read_canonical(root/'proposals.json')!=proposals(before['events'],window): raise ValueError('discovery proposals differ from evidence')
    expected={'window.json','proposals.json'}|{'producer_files/'+path for path in FILES}
    if {str(path.relative_to(root)) for path in root.rglob('*') if path.is_file()}!=expected: raise ValueError('missing or undeclared discovery evidence files')
    inputs={path:contained(root,'producer_files/'+path).read_bytes() for path in FILES}
    return verify_window(before['events'],window,after['events'][prefix:],inputs)


def main():
    parser=argparse.ArgumentParser(description='Recorded declarations only; no network or public authority')
    commands=parser.add_subparsers(dest='command',required=True)
    record=commands.add_parser('prepare');record.add_argument('--boundary-export',required=True);record.add_argument('--submissions',required=True);record.add_argument('--out',required=True)
    verify=commands.add_parser('verify');verify.add_argument('--before',required=True);verify.add_argument('--after',required=True);verify.add_argument('--window',required=True)
    args=parser.parse_args()
    result=prepare(args.boundary_export,read_canonical(args.submissions),args.out) if args.command=='prepare' else verify_exports(args.before,args.after,args.window)
    print(serialize(result))

if __name__=='__main__': main()
