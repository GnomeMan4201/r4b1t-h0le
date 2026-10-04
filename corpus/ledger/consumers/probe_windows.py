"""Pure observation-window producer. Never selection or projection authority."""
from corpus.ledger.schema.events import keys,sha,text,integer,validate_payload
from corpus.ledger.schema.identity import create_seq
from corpus.ledger.schema.serialization import serialize,digest,sorted_collection
from corpus.ledger.projection import replay

POLICY='shadow-explicit-window-v1'
PROBE='r4b1t-shadow-head-v1'
SCHEMA='r4b1t-shadow-probe-window-v1'


def manifest(value):
    keys(value,('schema','name','version','files'))
    if value['schema']!='r4b1t-shadow-producer-manifest-v1' or value['name']!='shadow-head' or value['version']!=PROBE: raise ValueError('unsupported producer manifest')
    files=value['files']
    if not isinstance(files,list) or not files or files!=sorted_collection(files): raise ValueError('canonical producer files required')
    paths=[]
    for item in files:
        keys(item,('path','digest'));text(item['path']);sha(item['digest'])
        if item['path'].startswith('/') or '..' in item['path'].split('/') or '\\' in item['path']: raise ValueError('relative producer file path required')
        paths.append(item['path'])
    if len(set(paths))!=len(paths): raise ValueError('duplicate producer path')


def kind(payload):
    if 'status' in payload and 200<=payload['status']<300: return 'PROBE_SUCCEEDED'
    return 'PROBE_FAILED'


def ordered(rows):
    if not isinstance(rows,list) or not 1<=len(rows)<=100: raise ValueError('bounded observation window required')
    seen=set();ends={}
    for row in rows:
        keys(row,('resource_id','payload'));create_seq(row['resource_id']);p=row['payload']
        validate_payload(kind(p),p)
        if p['probe_version']!=PROBE or 'body_digest' in p or 'body_bytes' in p: raise ValueError('HEAD-only producer version required')
        if 'status' in p:
            integer(p['status'],100)
            if p['status']>599 or 'final_url' not in p or 'headers_digest' not in p: raise ValueError('complete HTTP HEAD evidence required')
        elif 'reason' not in p: raise ValueError('transport failure reason required')
        raw=serialize(row)
        if raw in seen: raise ValueError('duplicate observation')
        seen.add(raw)
    result=sorted(rows,key=lambda r:(create_seq(r['resource_id']),r['payload']['started_at'],r['payload']['finished_at'],serialize(r).encode('utf-8')))
    for row in result:
        rid,p=row['resource_id'],row['payload']
        if rid in ends and p['started_at']<ends[rid]: raise ValueError('overlapping resource observations')
        ends[rid]=p['finished_at']
    return result


def build_window(projected,rows,producer_manifest):
    manifest(producer_manifest);sha(projected['event_head'])
    resources={r['resource_id']:r for r in projected['resources']}
    result=ordered(rows)
    for row in result:
        resource=resources.get(row['resource_id'])
        if not resource or resource['absorbed_into'] is not None or row['payload']['observed_url'] not in resource['urls']: raise ValueError('canonical resource and confirmed URL required')
    return {'schema':SCHEMA,'policy_version':POLICY,'source_head':projected['event_head'],'producer_manifest':producer_manifest,'observations':result}


def proposals(window):
    keys(window,('schema','policy_version','source_head','producer_manifest','observations'))
    if window['schema']!=SCHEMA or window['policy_version']!=POLICY: raise ValueError('unsupported probe window')
    sha(window['source_head']);manifest(window['producer_manifest']);rows=ordered(window['observations'])
    if rows!=window['observations']: raise ValueError('noncanonical observation order')
    result=[]
    for rid in sorted({r['resource_id'] for r in rows},key=create_seq):
        subset=[row for row in rows if row['resource_id']==rid];previous=None
        for row in subset:
            p=row['payload'];signature=(p.get('status'),p.get('final_url'),p.get('reason'))
            if signature!=previous:
                result.append({'type':kind(p),'resource_id':rid,'timestamp':p['finished_at'],'payload':p})
            previous=signature
        evidence=dict(window,observations=subset)
        result.append({'type':'PROBE_HEARTBEAT','resource_id':rid,'timestamp':subset[-1]['payload']['finished_at'],'payload':{'policy_version':POLICY,'started_at':subset[0]['payload']['started_at'],'finished_at':subset[-1]['payload']['finished_at'],'observation_count':len(subset),'evidence_digest':digest('heartbeat',evidence)}})
    return result


def verify_window(before_events,window,committed,producer_files):
    before=replay(before_events)
    if build_window(before,window['observations'],window['producer_manifest'])!=window: raise ValueError('window source binding mismatch')
    import hashlib
    for item in window['producer_manifest']['files']:
        if 'sha256:'+hashlib.sha256(producer_files[item['path']]).hexdigest()!=item['digest']: raise ValueError('producer code commitment mismatch')
    expected=proposals(window)
    if len(expected)!=len(committed): raise ValueError('probe recording count mismatch')
    after=replay(before_events+committed)
    for actual,proposal in zip(committed,expected):
        if {key:actual[key] for key in proposal}!=proposal: raise ValueError('probe proposal differs from committed transaction')
    return {'status':'VERIFIED_SHADOW_PROBE_WINDOW','event_count':len(committed),'source_head':before['event_head'],'event_head':after['event_head'],'evidence_boundary':'Window inclusion, code commitments and deterministic emission only; no remote truth, GET reachability, public authority or inferred state transitions.'}
