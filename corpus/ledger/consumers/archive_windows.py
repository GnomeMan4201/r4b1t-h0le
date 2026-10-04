"""Pure explicit archive evidence consumer; never projection or selection authority."""
from corpus.ledger.projection import resolve,replay
from corpus.ledger.schema.events import keys,url,text,validate_payload
from corpus.ledger.schema.serialization import serialize,parse,digest,timestamp
from corpus.ledger.schema.identity import create_seq

POLICY='shadow-archive-explicit-window-v1'
PROBE='r4b1t-shadow-archive-head-v1'
TARGETS=('ARCHIVE_RESOLVED','ARCHIVE_TARGET_REPLACED','ARCHIVE_TARGET_GONE')


def target_change(record,kind,target):
    current=record['archive_url']
    if kind=='ARCHIVE_RESOLVED' and current is not None: raise ValueError('target already resolved')
    if kind=='ARCHIVE_TARGET_REPLACED' and (current is None or current==target): raise ValueError('replacement requires different current target')
    if kind=='ARCHIVE_TARGET_GONE' and current!=target: raise ValueError('loss must name current target')
    record['archive_url']=None if kind=='ARCHIVE_TARGET_GONE' else target
    record['last_probe']=None


def records(events):
    projected=replay(events);result={}
    for observation in events:
        kind=observation['type'];p=observation['payload']
        if kind not in TARGETS+('ARCHIVE_PROBE_SUCCEEDED','ARCHIVE_PROBE_FAILED') and not (kind=='PROBE_HEARTBEAT' and p['policy_version']==POLICY): continue
        rid=observation['resource_id']
        record=result.setdefault(rid,{'resource_id':rid,'canonical_resource_id':resolve(projected,rid),'archive_url':None,'last_probe':None,'boundary':None})
        if record['boundary'] is not None and observation['timestamp']<record['boundary']: raise ValueError('archive chronology reversed')
        if kind in TARGETS:
            target_change(record,kind,p['archive_url']);record['boundary']=observation['timestamp']
        elif kind=='PROBE_HEARTBEAT': record['boundary']=max(record['boundary'] or '',p['finished_at'])
        else:
            if record['archive_url'] is None or p['observed_url']!=record['archive_url']: raise ValueError('probe must name current archive target')
            if record['boundary'] is not None and p['started_at']<record['boundary']: raise ValueError('archive probe precedes boundary')
            record['last_probe']=parse(serialize(p));record['boundary']=p['finished_at']
    return [result[rid] for rid in sorted(result,key=create_seq)]

SCHEMA='r4b1t-shadow-archive-window-v1'
FILES=('corpus/ledger/consumers/archive_windows.py','corpus/ledger/consumers/ARCHIVE_WINDOWS_V1.md','corpus/ledger/tools/archive.py','corpus/ledger/consumers/head_probe.py','tools/maintain_corpus.py','pool_sweep.py','requirements-pool-sweep.txt','corpus/ledger/tools/history.py','corpus/ledger/sequencer.py','.github/workflows/ledger-shadow-daily.yml')


def manifest(value):
    from corpus.ledger.schema.serialization import sorted_collection
    from corpus.ledger.schema.events import sha
    keys(value,('schema','version','files'))
    if value['schema']!='r4b1t-shadow-archive-producer-v1' or value['version']!=PROBE or not isinstance(value['files'],list) or value['files']!=sorted_collection(value['files']): raise ValueError('unsupported archive producer manifest')
    paths=[]
    for item in value['files']:
        keys(item,('path','digest'));sha(item['digest']);paths.append(item['path'])
    if len(paths)!=len(FILES) or set(paths)!=set(FILES): raise ValueError('complete archive producer inventory required')


def probe_kind(p):
    validate_payload('ARCHIVE_PROBE_SUCCEEDED',p)
    if p['probe_version']!=PROBE or 'body_digest' in p or 'body_bytes' in p: raise ValueError('versioned HEAD archive evidence required')
    if 'status' in p:
        if not 100<=p['status']<=599 or 'final_url' not in p or 'headers_digest' not in p: raise ValueError('complete HTTP archive HEAD evidence required')
        return 'ARCHIVE_PROBE_SUCCEEDED' if 200<=p['status']<300 else 'ARCHIVE_PROBE_FAILED'
    if 'reason' not in p: raise ValueError('archive transport failure reason required')
    return 'ARCHIVE_PROBE_FAILED'


def outcome(p): return (p.get('status'),p.get('final_url'),p.get('reason'))


def operation_state(events,rows):
    projected=replay(events);known={r['resource_id'] for r in projected['resources']}
    state={r['resource_id']:r for r in records(events)}
    if not isinstance(rows,list) or not 1<=len(rows)<=100: raise ValueError('bounded ordered archive operations required')
    seen=set()
    for row in rows:
        kind=row['type'];rid=row['resource_id']
        if rid not in known: raise ValueError('existing stable identity required')
        if serialize(row) in seen: raise ValueError('duplicate archive operation')
        seen.add(serialize(row))
        record=state.setdefault(rid,{'resource_id':rid,'canonical_resource_id':resolve(projected,rid),'archive_url':None,'last_probe':None,'boundary':None})
        if kind in TARGETS:
            keys(row,('type','resource_id','timestamp','archive_url','basis'));timestamp(row['timestamp']);url(row['archive_url']);text(row['basis'])
            start=row['timestamp']
            if record['boundary'] is not None and start<record['boundary']: raise ValueError('archive operation precedes committed boundary')
            target_change(record,kind,row['archive_url']);record['boundary']=start
            yield row,None,start
        elif kind=='ARCHIVE_PROBE':
            keys(row,('type','resource_id','payload'));p=row['payload'];probe_kind(p)
            if record['archive_url'] is None or p['observed_url']!=record['archive_url']: raise ValueError('probe must name current target')
            if record['boundary'] is not None and p['started_at']<record['boundary']: raise ValueError('archive probe precedes committed boundary')
            previous=record['last_probe'] if record['last_probe'] and record['last_probe']['probe_version']==PROBE else None
            changed=previous is None or outcome(previous)!=outcome(p)
            record['last_probe']=p;record['boundary']=p['finished_at']
            yield row,changed,p['finished_at']
        else: raise ValueError('unknown archive operation')


def build_window(events,operations,producer_manifest):
    manifest(producer_manifest);list(operation_state(events,operations))
    return parse(serialize({'schema':SCHEMA,'policy_version':POLICY,'source_head':events[-1]['hash'],'producer_manifest':producer_manifest,'operations':operations}))


def proposals(events,window):
    keys(window,('schema','policy_version','source_head','producer_manifest','operations'))
    if window['schema']!=SCHEMA or window['policy_version']!=POLICY or window['source_head']!=replay(events)['event_head']: raise ValueError('unsupported or stale archive window')
    manifest(window['producer_manifest']);result=[];probes={};ends={}
    for index,(row,changed,end) in enumerate(operation_state(events,window['operations'])):
        rid=row['resource_id'];ends[rid]=end
        if row['type'] in TARGETS:
            result.append({'type':row['type'],'resource_id':rid,'timestamp':end,'payload':{'archive_url':row['archive_url'],'evidence_digest':digest('heartbeat',{'window':window,'operation_index':index})}})
        else:
            p=row['payload'];probes.setdefault(rid,[]).append(p)
            if changed: result.append({'type':probe_kind(p),'resource_id':rid,'timestamp':end,'payload':p})
    for rid in sorted(probes,key=create_seq):
        rows=probes[rid]
        result.append({'type':'PROBE_HEARTBEAT','resource_id':rid,'timestamp':ends[rid],'payload':{'policy_version':POLICY,'started_at':rows[0]['started_at'],'finished_at':rows[-1]['finished_at'],'observation_count':len(rows),'evidence_digest':digest('heartbeat',{'window':window,'resource_id':rid})}})
    return parse(serialize(result))


def verify_window(events,window,committed,producer_files):
    import hashlib
    if build_window(events,window['operations'],window['producer_manifest'])!=window: raise ValueError('archive source binding mismatch')
    for item in window['producer_manifest']['files']:
        if 'sha256:'+hashlib.sha256(producer_files[item['path']]).hexdigest()!=item['digest']: raise ValueError('archive code commitment mismatch')
    expected=proposals(events,window)
    if len(expected)!=len(committed): raise ValueError('archive recording count mismatch')
    for actual,wanted in zip(committed,expected):
        if {key:actual[key] for key in wanted}!=wanted: raise ValueError('archive committed transaction differs')
    projected=replay(events+committed);records(events+committed)
    return {'status':'VERIFIED_SHADOW_ARCHIVE_WINDOW','event_count':len(committed),'event_head':projected['event_head'],'evidence_boundary':'Declared archive association, inclusion, code commitments and deterministic emission only; no remote truth, current reachability, inferred state or public authority.'}
