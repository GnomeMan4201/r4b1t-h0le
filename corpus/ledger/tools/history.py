"""Durable shadow history artifacts. Git fast-forward publication is the commit point."""
import argparse
import hashlib
import os
import shutil
import tempfile
from pathlib import Path
from corpus.ledger.consumers.schedule import plan,policy,validate_policy,DAILY
from corpus.ledger.consumers.probe_windows import build_window,proposals,check_emission
from corpus.ledger.consumers.head_probe import observe,PublicTargetGuard,RateLimiter
from corpus.ledger.tools.probe import producer_files
from corpus.ledger.tools.shadow import read_canonical,write_canonical
from corpus.ledger.tools.files import contained
from corpus.ledger.schema.serialization import serialize,parse,digest,timestamp
from corpus.ledger.schema.events import keys
from corpus.ledger.genesis import snapshot,import_proposals
from corpus.ledger.projection import replay,empty_state,apply_event,projection
from corpus.ledger.sequencer import Sequencer,shadow_path
from corpus.ledger.verifier import verify_bundle,BUNDLE_SCHEMA

ROOT=Path(__file__).resolve().parents[3]
SCHEMA='r4b1t-shadow-history-v1'


def raw_hash(raw): return 'sha256:'+hashlib.sha256(raw).hexdigest()


def put(root,path,raw):
    target=contained(root,path)
    if target.exists():
        if target.read_bytes()!=raw: raise ValueError('immutable history artifact differs')
    else:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    return {'path':path,'digest':raw_hash(raw)}


def put_json(root,path,value): return put(root,path,(serialize(value)+'\n').encode('utf-8'))


def read_chunk(root,item):
    keys(item,('path','digest'));raw=contained(root,item['path']).read_bytes()
    if raw_hash(raw)!=item['digest'] or not raw.endswith(b'\n'): raise ValueError('event chunk digest/format mismatch')
    return [parse(line) for line in raw.decode('utf-8')[:-1].split('\n')]


def checkpoint(projected,chunks,runs,cursor,day):
    return {'schema':SCHEMA,'genesis_hash':projected['genesis']['hash'],'event_head':projected['event_head'],'event_count':projected['event_count'],'projection_hash':digest('projection',projected),'chunks':chunks,'runs':runs,'cursor_create_seq':cursor,'last_run_day':day,'policy':policy(),'policy_hash':digest('policy',policy())}


def verify_history(root,expected_head=None):
    root=shadow_path(root);state=read_canonical(contained(root,'HEAD.json'))
    keys(state,('schema','genesis_hash','event_head','event_count','projection_hash','chunks','runs','cursor_create_seq','last_run_day','policy','policy_hash'))
    if state['schema']!=SCHEMA or not isinstance(state['chunks'],list) or not isinstance(state['runs'],list) or len(state['chunks'])!=len(state['runs'])+1: raise ValueError('invalid history checkpoint')
    validate_policy(state['policy'])
    if not state['chunks'] or state['chunks'][0]['path']!='chunks/genesis.jsonl': raise ValueError('fixed genesis chunk required')
    events=read_chunk(root,state['chunks'][0]);working=empty_state()
    for event in events: apply_event(working,event)
    declared={'HEAD.json',state['chunks'][0]['path']};cursor=0;last=None
    for recorded,chunk in zip(state['runs'],state['chunks'][1:]):
        keys(recorded,('day','path','digest'));day=recorded['day'];timestamp(day+'T00:00:00.000Z')
        if last is not None and day<=last: raise ValueError('run dates must advance without backfill')
        base='runs/'+day
        if recorded['path']!=base+'/run.json' or chunk['path']!=base+'/events.jsonl': raise ValueError('run path/order mismatch')
        raw=contained(root,recorded['path']).read_bytes()
        if raw_hash(raw)!=recorded['digest']: raise ValueError('run commitment mismatch')
        recorded_plan=read_canonical(contained(root,recorded['path']));before=projection(working)
        if recorded_plan!=plan(before,cursor,recorded_plan['budget'],day): raise ValueError('schedule plan/cursor mismatch')
        window=read_canonical(contained(root,base+'/window.json'))
        if window['policy_version']!=DAILY or {r['resource_id'] for r in window['observations']}!=set(recorded_plan['resource_ids']) or len(window['observations'])!=len(recorded_plan['resource_ids']) or any(r['payload']['started_at'][:10]!=day for r in window['observations']): raise ValueError('daily window coverage/date mismatch')
        manifest_hash=digest('manifest',window['producer_manifest']).split(':')[1]
        inputs={}
        for item in window['producer_manifest']['files']:
            path='producer_files/'+manifest_hash+'/'+item['path'];declared.add(path);inputs[item['path']]=contained(root,path).read_bytes()
        next_events=read_chunk(root,chunk)
        check_emission(before,window,next_events,inputs)
        for event in next_events: apply_event(working,event)
        events.extend(next_events);cursor=recorded_plan['cursor_create_seq'];last=day
        declared.update((recorded['path'],chunk['path'],base+'/window.json'))
    projected=projection(working)
    if serialize(state)!=serialize(checkpoint(projected,state['chunks'],state['runs'],cursor,last)): raise ValueError('checkpoint derivation mismatch')
    artifacts={}
    for item in projected['genesis']['payload']['artifacts']:
        path='genesis_artifacts/'+item['path'];declared.add(path);artifacts[item['path']]=contained(root,path).read_bytes()
    actual={str(path.relative_to(root)) for path in root.rglob('*') if path.is_file()}
    if actual!=declared: raise ValueError('undeclared or missing history files')
    bundle={'schema':BUNDLE_SCHEMA,'events':events,'projection':projected,'projection_hash':state['projection_hash'],'event_head':state['event_head'],'event_count':state['event_count'],'genesis_hash':state['genesis_hash'],'serialization':projected['genesis']['payload']['serialization']}
    verify_bundle(bundle,artifacts,expected_head)
    return {'state':state,'events':events,'projected':projected}


def initialize(output,authority_root):
    output=shadow_path(output)
    if output.exists(): raise ValueError('history initialization requires fresh destination; no reset')
    baseline=read_canonical(ROOT/'corpus/ledger/shadow/bootstrap-v1.json')
    payload,artifacts=snapshot(authority_root,baseline['source_commit'])
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as temp:
        stage=Path(temp)/'corpus/ledger/shadow/history';stage.mkdir(parents=True)
        writer=Sequencer(Path(temp)/'corpus/ledger/shadow/store.sqlite3')
        events=writer.submit_many(import_proposals(payload,artifacts,baseline['timestamp']))
        projected=writer.snapshot()
        if projected['event_head']!=baseline['event_head'] or digest('projection',projected)!=baseline['projection_hash']: raise ValueError('pinned bootstrap mismatch')
        for path,raw in artifacts.items(): put(stage,'genesis_artifacts/'+path,raw)
        chunk=put(stage,'chunks/genesis.jsonl',''.join(serialize(e)+'\n' for e in events).encode('utf-8'))
        write_canonical(stage/'HEAD.json',checkpoint(projected,[chunk],[],0,None));verify_history(stage)
        if output.exists(): raise ValueError('history destination appeared')
        os.rename(stage,output)
    return {'status':'STAGED_SHADOW_GENESIS','event_head':events[-1]['hash'],'event_count':len(events)}


def run(history,day,budget,output,observer=observe):
    before=verify_history(history);state=before['state'];timestamp(day+'T00:00:00.000Z')
    if state['last_run_day']==day: return {'status':'SKIPPED_COMPLETED_DATE','day':day,'event_head':state['event_head']}
    if state['last_run_day'] is not None and day<state['last_run_day']: raise ValueError('historical dates cannot be backfilled')
    planned=plan(before['projected'],state['cursor_create_seq'],budget,day)
    output=shadow_path(output)
    if output.exists(): raise ValueError('fresh staging destination required')
    inputs=producer_files(policy_version=DAILY)
    manifest={'schema':'r4b1t-shadow-producer-manifest-v1','name':'shadow-head','version':'r4b1t-shadow-head-v1','files':__import__('corpus.ledger.schema.serialization',fromlist=['sorted_collection']).sorted_collection([{'path':path,'digest':raw_hash(raw)} for path,raw in inputs.items()])}
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as temp:
        stage=Path(temp)/'corpus/ledger/shadow/history';shutil.copytree(history,stage)
        writer=Sequencer(Path(temp)/'corpus/ledger/shadow/store.sqlite3');writer.restore_committed(before['events'])
        guard,limiter=PublicTargetGuard(),RateLimiter();resources={r['resource_id']:r for r in before['projected']['resources']}
        rows=[observer(rid,resources[rid]['url'],guard,limiter) for rid in planned['resource_ids']]
        if any(row['payload']['started_at'][:10]!=day for row in rows): raise ValueError('observations must begin on declared run date')
        window=build_window(before['projected'],rows,manifest,policy_version=DAILY,emission_policy=policy())
        committed=writer.submit_many(proposals(window),expected_head=state['event_head'])
        manifest_hash=digest('manifest',manifest).split(':')[1]
        for path,raw in inputs.items(): put(stage,'producer_files/'+manifest_hash+'/'+path,raw)
        base='runs/'+day
        record=put_json(stage,base+'/run.json',planned);record['day']=day
        put_json(stage,base+'/window.json',window)
        chunk=put(stage,base+'/events.jsonl',''.join(serialize(e)+'\n' for e in committed).encode('utf-8'))
        write_canonical(stage/'HEAD.json',checkpoint(writer.snapshot(),state['chunks']+[chunk],state['runs']+[record],planned['cursor_create_seq'],day))
        after=verify_history(stage)
        if after['events'][:len(before['events'])]!=before['events']: raise ValueError('published prefix differs')
        for old in Path(history).rglob('*'):
            if old.is_file() and old.name!='HEAD.json' and old.read_bytes()!=contained(stage,str(old.relative_to(history))).read_bytes(): raise ValueError('old evidence rewritten')
        if output.exists(): raise ValueError('staging destination appeared')
        os.rename(stage,output)
    return {'status':'STAGED_SHADOW_RUN','day':day,'observations':len(rows),'appended_events':len(committed),'event_head':after['state']['event_head'],'projection_hash':after['state']['projection_hash']}


def main():
    parser=argparse.ArgumentParser(description='Isolated durable shadow artifacts; publication requires Git CAS')
    commands=parser.add_subparsers(dest='command',required=True)
    init=commands.add_parser('initialize');init.add_argument('--out',required=True);init.add_argument('--authority-root',required=True)
    check=commands.add_parser('verify');check.add_argument('--history',required=True);check.add_argument('--expected-head')
    append=commands.add_parser('run');append.add_argument('--history',required=True);append.add_argument('--day',required=True);append.add_argument('--budget',type=int,default=100);append.add_argument('--out',required=True)
    args=parser.parse_args()
    if args.command=='initialize': result=initialize(args.out,args.authority_root)
    elif args.command=='run': result=run(args.history,args.day,args.budget,args.out)
    else:
        checked=verify_history(args.history,args.expected_head);result={'status':'VERIFIED_SHADOW_HISTORY','event_head':checked['state']['event_head'],'event_count':checked['state']['event_count'],'projection_hash':checked['state']['projection_hash']}
    print(serialize(result))

if __name__=='__main__': main()
