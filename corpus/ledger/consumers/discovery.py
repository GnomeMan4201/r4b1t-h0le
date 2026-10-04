"""Pure recorded discovery consumer. Submissions are declarations, not web truth."""
import hashlib
from corpus.ledger.projection import replay
from corpus.ledger.schema.events import keys,sha,text,url,validate_payload
from corpus.ledger.schema.serialization import parse,serialize,digest,timestamp,sorted_collection

VERSION='r4b1t-shadow-recorded-discovery-v1'
SCHEMA='r4b1t-shadow-discovery-window-v1'
MANIFEST='r4b1t-shadow-discovery-producer-v1'
FILES=('corpus/ledger/consumers/discovery.py','corpus/ledger/consumers/DISCOVERY_WINDOWS_V1.md','corpus/ledger/tools/discovery.py','corpus/ledger/sequencer.py','corpus/ledger/tools/shadow.py')


def manifest(value):
    keys(value,('schema','version','files'))
    if value['schema']!=MANIFEST or value['version']!=VERSION or not isinstance(value['files'],list) or value['files']!=sorted_collection(value['files']): raise ValueError('unsupported discovery producer manifest')
    paths=[]
    for item in value['files']:
        keys(item,('path','digest'));sha(item['digest']);paths.append(item['path'])
    if len(paths)!=len(FILES) or set(paths)!=set(FILES): raise ValueError('exact discovery producer inventory required')


def build_window(events,submissions,producer_manifest):
    projected=replay(events);manifest(producer_manifest)
    if not isinstance(submissions,list) or not 1<=len(submissions)<=100: raise ValueError('bounded ordered discovery submissions required')
    known={value for resource in projected['resources'] for value in resource['urls']+resource['observed_urls']}
    for observation in projected['observations']:
        if observation['type'] in ('REDIRECT_OBSERVED','ALIAS_CANDIDATE','ALIAS_CONFIRMED'):
            known.update((observation['payload']['from_url'],observation['payload']['to_url']))
    for row in submissions:
        keys(row,('url','timestamp','basis','metadata'));url(row['url']);timestamp(row['timestamp']);text(row['basis'])
        if row['url'] in known: raise ValueError('duplicate or already recorded discovery URL; explicit identity review required')
        known.add(row['url'])
        keys(row['metadata'],(),('resource_type',))
        for value in row['metadata'].values(): text(value)
    return parse(serialize({'schema':SCHEMA,'adapter_version':VERSION,'source_head':projected['event_head'],'producer_manifest':producer_manifest,'submissions':submissions}))


def proposals(events,window):
    keys(window,('schema','adapter_version','source_head','producer_manifest','submissions'))
    if window['schema']!=SCHEMA or window['adapter_version']!=VERSION or build_window(events,window['submissions'],window['producer_manifest'])!=window: raise ValueError('unsupported or stale discovery window')
    commitment=digest('manifest',window);result=[]
    for index,row in enumerate(window['submissions']):
        metadata=dict(row['metadata'],provenance=VERSION+':'+commitment+':'+str(index))
        payload={'url':row['url'],'metadata':metadata};validate_payload('RESOURCE_CREATED',payload)
        result.append({'type':'RESOURCE_CREATED','timestamp':row['timestamp'],'payload':payload})
    return result


def verify_window(events,window,committed,producer_files):
    expected=proposals(events,window)
    if set(producer_files)!=set(FILES): raise ValueError('exact discovery producer bytes required')
    for item in window['producer_manifest']['files']:
        if 'sha256:'+hashlib.sha256(producer_files[item['path']]).hexdigest()!=item['digest']: raise ValueError('discovery producer commitment mismatch')
    if len(committed)!=len(expected): raise ValueError('discovery recording count mismatch')
    for actual,wanted in zip(committed,expected):
        if {key:actual[key] for key in wanted}!=wanted: raise ValueError('committed discovery differs from submissions')
    projected=replay(events+committed)
    return {'status':'VERIFIED_SHADOW_DISCOVERY_WINDOW','event_count':len(committed),'event_head':projected['event_head'],'evidence_boundary':'Recorded declarations, producer byte commitments and deterministic candidate creation only; no remote truth, classification correctness, external chronology, inferred identity or public selection authority.'}
