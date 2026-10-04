"""Pure observation-window producer. Never selection or projection authority."""
from corpus.ledger.schema.events import keys,sha,text,integer,validate_payload
from corpus.ledger.schema.identity import create_seq
from corpus.ledger.schema.serialization import serialize,digest,sorted_collection
from corpus.ledger.projection import replay
from .schedule import DAILY,validate_policy

POLICY='shadow-explicit-window-v1'
PROBE='r4b1t-shadow-head-v1'
SCHEMA='r4b1t-shadow-probe-window-v1'
FILES=('corpus/ledger/consumers/probe_windows.py','corpus/ledger/consumers/head_probe.py','corpus/ledger/consumers/PROBE_WINDOWS_V1.md','corpus/ledger/tools/probe.py','tools/maintain_corpus.py','pool_sweep.py','requirements-pool-sweep.txt')

DAILY_FILES=FILES+('corpus/ledger/consumers/SCHEDULED_WINDOWS_V1.md','corpus/ledger/consumers/shadow-daily-v1.json','corpus/ledger/consumers/schedule.py','corpus/ledger/tools/history.py','corpus/ledger/sequencer.py','corpus/ledger/tools/shadow.py','.github/workflows/ledger-shadow-daily.yml')


def manifest(value,policy_version=POLICY):
    if policy_version not in (POLICY,DAILY): raise ValueError('unsupported emission policy')
    keys(value,('schema','name','version','files'))
    if value['schema']!='r4b1t-shadow-producer-manifest-v1' or value['name']!='shadow-head' or value['version']!=PROBE: raise ValueError('unsupported producer manifest')
    files=value['files']
    if not isinstance(files,list) or not files or files!=sorted_collection(files): raise ValueError('canonical producer files required')
    paths=[]
    for item in files:
        keys(item,('path','digest'));text(item['path']);sha(item['digest'])
        if item['path'].startswith('/') or '..' in item['path'].split('/') or '\\' in item['path']: raise ValueError('relative producer file path required')
        paths.append(item['path'])
    if len(set(paths))!=len(paths) or set(paths)!=set(FILES if policy_version==POLICY else DAILY_FILES): raise ValueError('complete versioned producer file inventory required')


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


def build_window(projected,rows,producer_manifest,policy_version=POLICY,emission_policy=None):
    manifest(producer_manifest,policy_version);sha(projected['event_head'])
    resources={r['resource_id']:r for r in projected['resources']}
    result=ordered(rows)
    resolution={r['absorbed_id']:r['survivor_id'] for r in projected['resolutions']}
    prior={}
    for item in projected['observations']:
        if item['type']=='PROBE_HEARTBEAT' and item['payload'].get('policy_version') in (POLICY,DAILY):
            rid=resolution.get(item['resource_id'],item['resource_id'])
            prior[rid]=max(prior.get(rid,''),item['payload']['finished_at'])
    for row in result:
        if row['payload']['started_at']<prior.get(row['resource_id'],''): raise ValueError('resource window precedes committed boundary')
        resource=resources.get(row['resource_id'])
        if not resource or resource['absorbed_into'] is not None or row['payload']['observed_url'] not in resource['urls']: raise ValueError('canonical resource and confirmed URL required')
    window={'schema':SCHEMA,'policy_version':policy_version,'source_head':projected['event_head'],'producer_manifest':producer_manifest,'observations':result}
    if policy_version==DAILY:
        validate_policy(emission_policy)
        window.update(schema='r4b1t-shadow-probe-window-v2',emission_policy=emission_policy,prior_outcomes=previous_outcomes(projected,{r['resource_id'] for r in result}))
    elif emission_policy is not None: raise ValueError('manual policy takes no scheduling artifact')
    return window


def signature(payload):
    return (payload.get('status'),payload.get('final_url'),payload.get('reason'))


def previous_outcomes(projected,ids):
    resolution={r['absorbed_id']:r['survivor_id'] for r in projected['resolutions']}
    previous={}
    for item in projected['observations']:
        if item['type'] in ('PROBE_SUCCEEDED','PROBE_FAILED') and item['payload'].get('probe_version')==PROBE:
            rid=resolution.get(item['resource_id'],item['resource_id'])
            if rid in ids: previous[rid]={'resource_id':rid,'payload':item['payload']}
    return sorted_collection(list(previous.values()))


def proposals(window):
    daily=window.get('policy_version')==DAILY
    required=('schema','policy_version','source_head','producer_manifest','observations')+(('emission_policy','prior_outcomes') if daily else ())
    keys(window,required)
    if window['schema']!=('r4b1t-shadow-probe-window-v2' if daily else SCHEMA) or window['policy_version'] not in (POLICY,DAILY): raise ValueError('unsupported probe window')
    if daily:
        validate_policy(window['emission_policy'])
        if not isinstance(window['prior_outcomes'],list) or sorted_collection(window['prior_outcomes'])!=window['prior_outcomes']: raise ValueError('canonical prior outcome collection required')
        ids=[]
        for item in window['prior_outcomes']:
            keys(item,('resource_id','payload'));create_seq(item['resource_id']);validate_payload(kind(item['payload']),item['payload']);ids.append(item['resource_id'])
            if item['payload']['probe_version']!=PROBE: raise ValueError('unsupported prior probe version')
        if len(ids)!=len(set(ids)): raise ValueError('duplicate prior identity')
    sha(window['source_head']);manifest(window['producer_manifest'],window['policy_version']);rows=ordered(window['observations'])
    if rows!=window['observations']: raise ValueError('noncanonical observation order')
    result=[]
    for rid in sorted({r['resource_id'] for r in rows},key=create_seq):
        subset=[row for row in rows if row['resource_id']==rid];previous=None
        if daily:
            for prior in window['prior_outcomes']:
                if prior['resource_id']==rid: previous=signature(prior['payload'])
        for row in subset:
            p=row['payload'];current=signature(p)
            if current!=previous:
                result.append({'type':kind(p),'resource_id':rid,'timestamp':p['finished_at'],'payload':p})
            previous=current
        evidence=dict(window,observations=subset)
        result.append({'type':'PROBE_HEARTBEAT','resource_id':rid,'timestamp':subset[-1]['payload']['finished_at'],'payload':{'policy_version':window['policy_version'],'started_at':subset[0]['payload']['started_at'],'finished_at':subset[-1]['payload']['finished_at'],'observation_count':len(subset),'evidence_digest':digest('heartbeat',evidence)}})
    return result


def check_emission(before,window,committed,producer_files):
    """Emission only: callers must independently derive/authenticate the prefix."""
    if build_window(before,window['observations'],window['producer_manifest'],policy_version=window['policy_version'],emission_policy=window.get('emission_policy'))!=window: raise ValueError('window source binding mismatch')
    import hashlib
    for item in window['producer_manifest']['files']:
        if 'sha256:'+hashlib.sha256(producer_files[item['path']]).hexdigest()!=item['digest']: raise ValueError('producer code commitment mismatch')
    expected=proposals(window)
    if len(expected)!=len(committed): raise ValueError('probe recording count mismatch')
    for actual,proposal in zip(committed,expected):
        if {key:actual[key] for key in proposal}!=proposal: raise ValueError('probe proposal differs from committed transaction')


def verify_window(before_events,window,committed,producer_files):
    before=replay(before_events)
    check_emission(before,window,committed,producer_files)
    after=replay(before_events+committed)
    return {'status':'VERIFIED_SHADOW_PROBE_WINDOW','event_count':len(committed),'source_head':before['event_head'],'event_head':after['event_head'],'evidence_boundary':'Window inclusion, code commitments and deterministic emission only; no remote truth, GET reachability, public authority or inferred state transitions.'}
