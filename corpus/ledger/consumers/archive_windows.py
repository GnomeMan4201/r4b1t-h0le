"""Pure explicit archive evidence consumer; never projection or selection authority."""
from corpus.ledger.projection import resolve
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


def records(projected):
    result={}
    for observation in projected['observations']:
        kind=observation['type'];p=observation['payload']
        if kind not in TARGETS+('ARCHIVE_PROBE_SUCCEEDED','ARCHIVE_PROBE_FAILED') and not (kind=='PROBE_HEARTBEAT' and p['policy_version']==POLICY): continue
        rid=observation['resource_id']
        record=result.setdefault(rid,{'resource_id':rid,'canonical_resource_id':resolve(projected,rid),'archive_url':None,'last_probe':None,'boundary':None})
        if record['boundary'] is not None and observation.get('timestamp','') and observation['timestamp']<record['boundary']: raise ValueError('archive chronology reversed')
        if kind in TARGETS: target_change(record,kind,p['archive_url'])
        elif kind=='PROBE_HEARTBEAT': record['boundary']=max(record['boundary'] or '',p['finished_at'])
        else:
            if record['archive_url'] is None or p['observed_url']!=record['archive_url']: raise ValueError('probe must name current archive target')
            if record['boundary'] is not None and p['started_at']<record['boundary']: raise ValueError('archive probe precedes boundary')
            record['last_probe']=parse(serialize(p));record['boundary']=p['finished_at']
    return [result[rid] for rid in sorted(result,key=create_seq)]
