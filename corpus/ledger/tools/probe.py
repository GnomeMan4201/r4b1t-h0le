"""Manual shadow probe windows and offline evidence verification; no append API."""
import argparse
import hashlib
import os
import tempfile
from pathlib import Path
from corpus.ledger.consumers.probe_windows import build_window,proposals,verify_window,PROBE
from corpus.ledger.consumers.head_probe import observe,PublicTargetGuard,RateLimiter
from corpus.ledger.tools.shadow import load_export,read_canonical,write_canonical
from corpus.ledger.tools.files import contained
from corpus.ledger.sequencer import shadow_path
from corpus.ledger.verifier import verify_bundle
from corpus.ledger.schema.serialization import serialize,sorted_collection

ROOT=Path(__file__).resolve().parents[3]
FILES=('corpus/ledger/consumers/probe_windows.py','corpus/ledger/consumers/head_probe.py','corpus/ledger/consumers/PROBE_WINDOWS_V1.md','corpus/ledger/tools/probe.py','tools/maintain_corpus.py','pool_sweep.py','requirements-pool-sweep.txt')


def producer_files():
    return {path:contained(ROOT,path).read_bytes() for path in FILES}


def collect(boundary,resource_ids,samples,output):
    output=shadow_path(output)
    if output.exists(): raise ValueError('fresh immutable probe destination required')
    if isinstance(samples,bool) or not isinstance(samples,int) or not 1<=samples<=10 or not isinstance(resource_ids,list) or not resource_ids or len(set(resource_ids))!=len(resource_ids) or len(resource_ids)*samples>100: raise ValueError('explicit unique resource selection and bounded samples required')
    bundle,artifacts=load_export(boundary);verify_bundle(bundle,artifacts)
    resources={r['resource_id']:r for r in bundle['projection']['resources']}
    targets=[]
    for rid in resource_ids:
        resource=resources.get(rid)
        if not resource or resource['absorbed_into'] is not None: raise ValueError('canonical existing resource required')
        targets.append((rid,resource['url']))
    inputs=producer_files()
    manifest={'schema':'r4b1t-shadow-producer-manifest-v1','name':'shadow-head','version':PROBE,'files':sorted_collection([{'path':path,'digest':'sha256:'+hashlib.sha256(raw).hexdigest()} for path,raw in inputs.items()])}
    output.parent.mkdir(parents=True,exist_ok=True)
    reservation=output.parent/('.'+output.name+'.publish-lock')
    with reservation.open('x'): pass
    try:
        guard,limiter=PublicTargetGuard(),RateLimiter()
        rows=[observe(rid,target,guard,limiter) for rid,target in targets for _ in range(samples)]
        window=build_window(bundle['projection'],rows,manifest);submitted=proposals(window)
        with tempfile.TemporaryDirectory(prefix='.'+output.name+'-',dir=output.parent) as temp:
            stage=Path(temp)/'complete';stage.mkdir()
            for path,raw in inputs.items():
                dest=contained(stage/'producer_files',path);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
            write_canonical(stage/'window.json',window);write_canonical(stage/'proposals.json',submitted)
            if output.exists(): raise ValueError('immutable destination already exists')
            os.rename(stage,output)
        return {'status':'SHADOW_PROPOSALS_ONLY','observations':len(rows),'proposals':len(submitted),'source_head':bundle['event_head']}
    finally: reservation.unlink()


def verify_exports(before_dir,after_dir,window_dir):
    before,artifacts=load_export(before_dir);verify_bundle(before,artifacts)
    after,after_artifacts=load_export(after_dir);verify_bundle(after,after_artifacts,expected_genesis=before['genesis_hash'])
    prefix=len(before['events'])
    if after['events'][:prefix]!=before['events']: raise ValueError('source export is not committed prefix')
    window=read_canonical(Path(window_dir)/'window.json')
    submitted=read_canonical(Path(window_dir)/'proposals.json')
    if submitted!=proposals(window): raise ValueError('proposals do not match evidence')
    inputs={item['path']:contained(Path(window_dir)/'producer_files',item['path']).read_bytes() for item in window['producer_manifest']['files']}
    return verify_window(before['events'],window,after['events'][prefix:],inputs)


def main():
    parser=argparse.ArgumentParser(description='Explicit shadow-only probes; no public authority')
    commands=parser.add_subparsers(dest='command',required=True)
    run=commands.add_parser('collect');run.add_argument('--boundary-export',required=True);run.add_argument('--resources',required=True);run.add_argument('--samples',type=int,default=1);run.add_argument('--out',required=True)
    verify=commands.add_parser('verify');verify.add_argument('--before',required=True);verify.add_argument('--after',required=True);verify.add_argument('--window',required=True)
    args=parser.parse_args()
    result=collect(args.boundary_export,read_canonical(args.resources),args.samples,args.out) if args.command=='collect' else verify_exports(args.before,args.after,args.window)
    print(serialize(result))

if __name__=='__main__': main()
