"""Pure shadow consumer for reviewed WILD intake records.

The full reviewed record and evidence manifest are commitment inputs. The ledger
projection receives only the URL, resource_type, a fixed candidate-only reason,
and versioned provenance. No live fetch, classification inference, or public
selection authority occurs here.
"""
import hashlib

from corpus.ledger.projection import replay
from corpus.ledger.schema.events import integer, keys, sha, text, url, validate_payload
from corpus.ledger.schema.serialization import digest, parse, serialize, sorted_collection, timestamp

VERSION='r4b1t-shadow-wild-discovery-v1'
SCHEMA='r4b1t-shadow-wild-discovery-window-v1'
MANIFEST='r4b1t-shadow-wild-discovery-producer-v1'
EVIDENCE_SCHEMA='r4b1t-shadow-wild-evidence-manifest-v1'
RECORD_SCHEMA='r4b1t-wild-accepted/v1'
ELIGIBILITY_REASON='Human-reviewed WILD discovery; shadow CANDIDATE only.'
FILES=(
    'corpus/ledger/consumers/WILD_DISCOVERY_WINDOWS_V1.md',
    'corpus/ledger/consumers/wild_discovery.py',
    'corpus/ledger/sequencer.py',
    'corpus/ledger/tools/shadow.py',
    'corpus/ledger/tools/wild_discovery.py',
)


def provenance_source(value):
    if not isinstance(value,str) or not value.startswith(VERSION+':'): return None
    parts=value.split(':')
    if len(parts)!=6: raise ValueError('versioned WILD provenance framing required')
    source=parts[1]+':'+parts[2];commitment=parts[3]+':'+parts[4]
    sha(source);sha(commitment)
    try: index=int(parts[5])
    except ValueError as error: raise ValueError('canonical WILD index required') from error
    if str(index)!=parts[5] or not 0<=index<100: raise ValueError('bounded canonical WILD index required')
    return source


def _manifest(value):
    keys(value,('schema','version','files'))
    if value['schema']!=MANIFEST or value['version']!=VERSION or not isinstance(value['files'],list) or value['files']!=sorted_collection(value['files']):
        raise ValueError('unsupported WILD producer manifest')
    paths=[]
    for item in value['files']:
        keys(item,('path','digest'));text(item['path']);sha(item['digest']);paths.append(item['path'])
        if item['path'].startswith('/') or '..' in item['path'].split('/'): raise ValueError('relative WILD producer path required')
    if len(paths)!=len(FILES) or set(paths)!=set(FILES): raise ValueError('exact WILD producer inventory required')


def _evidence(value):
    keys(value,('schema','artifact_sha256','accepted_export','campaign_manifest','classification','review','quality_tags'))
    if value['schema']!=EVIDENCE_SCHEMA: raise ValueError('unsupported WILD evidence manifest')
    sha(value['artifact_sha256'])
    paths=[]
    for field in ('accepted_export','campaign_manifest','classification','review','quality_tags'):
        item=value[field];keys(item,('path','digest'));text(item['path']);sha(item['digest'])
        if item['path'].startswith('/') or '..' in item['path'].split('/'): raise ValueError('relative WILD evidence path required')
        paths.append(item['path'])
    if len(set(paths))!=len(paths): raise ValueError('duplicate WILD evidence path')
    return paths


def _lead(value):
    keys(value,('lead_source_key','lead_source_url','lead_final_url','lead_page_sha256','lead_hash_scope','lead_hashed_bytes','lead_observed_at','anchor'))
    text(value['lead_source_key']);url(value['lead_source_url']);url(value['lead_final_url']);sha(value['lead_page_sha256'])
    if value['lead_hash_scope'] not in ('FULL','PREFIX'): raise ValueError('unsupported WILD lead hash scope')
    integer(value['lead_hashed_bytes']);integer(value['lead_observed_at'])
    if not isinstance(value['anchor'],str): raise ValueError('WILD lead anchor string required')


def _observation(value,site_key,record_url):
    keys(value,('origin_key','url','raw_url','final_url','hops','status','http_status','observed_at','attempt','probe_sha256','probe_hash_scope','probe_hashed_bytes','archive_status','archive_url','archive_timestamp','title'))
    if value['origin_key']!=site_key: raise ValueError('WILD observation/siteKey mismatch')
    for field in ('url','raw_url','final_url'): url(value[field])
    if value['final_url']!=record_url: raise ValueError('WILD accepted URL must equal observed final URL')
    if value['status'] not in ('LIVE_CANDIDATE','MANUAL_CHECK'): raise ValueError('reviewed WILD record must preserve reviewable intake state')
    integer(value['http_status'],100);integer(value['observed_at']);integer(value['attempt'],1)
    sha(value['probe_sha256'])
    if value['probe_hash_scope'] not in ('FULL','PREFIX'): raise ValueError('unsupported WILD probe hash scope')
    integer(value['probe_hashed_bytes'])
    if value['archive_status'] not in ('FOUND','NONE_FOUND','BLOCKED','ERROR'): raise ValueError('unsupported WILD archive status')
    if not isinstance(value['archive_url'],str) or not isinstance(value['archive_timestamp'],str) or not isinstance(value['title'],str):
        raise ValueError('WILD observation text fields required')
    if value['archive_status']=='FOUND':
        url(value['archive_url']);text(value['archive_timestamp'])
    if not isinstance(value['hops'],list): raise ValueError('ordered WILD redirect hops required')
    for hop in value['hops']:
        keys(hop,('site_key','status','url'));text(hop['site_key']);integer(hop['status'],100);url(hop['url'])


def _record(value,evidence):
    keys(value,('schema','campaign_manifest_sha256','classification_sha256','site_key','url','resource_type','primary_subject','subjects','reason','observation','quota_lead','lead_edges'))
    if value['schema']!=RECORD_SCHEMA: raise ValueError('unsupported reviewed WILD record')
    sha(value['campaign_manifest_sha256']);sha(value['classification_sha256'])
    if value['campaign_manifest_sha256']!=evidence['campaign_manifest']['digest']: raise ValueError('WILD record campaign binding mismatch')
    if value['classification_sha256']!=evidence['classification']['digest']: raise ValueError('WILD record classification binding mismatch')
    text(value['site_key']);url(value['url']);text(value['resource_type']);text(value['primary_subject']);text(value['reason'])
    subjects=value['subjects']
    if not isinstance(subjects,list) or not 1<=len(subjects)<=4 or subjects!=sorted_collection(subjects):
        raise ValueError('canonical WILD subject collection required')
    for subject in subjects: text(subject)
    if value['primary_subject'] not in subjects: raise ValueError('WILD primary subject must occur in subjects')
    _observation(value['observation'],value['site_key'],value['url'])
    _lead(value['quota_lead'])
    if not isinstance(value['lead_edges'],list): raise ValueError('ordered WILD lead edges required')
    for edge in value['lead_edges']: _lead(edge)


def build_window(events,records,declaration_timestamp,producer_manifest,evidence_manifest):
    projected=replay(events);timestamp(declaration_timestamp);_manifest(producer_manifest);_evidence(evidence_manifest)
    if not isinstance(records,list) or not 1<=len(records)<=100: raise ValueError('bounded reviewed WILD record array required')
    canonical=parse(serialize(records))
    if canonical!=records: raise ValueError('canonical reviewed WILD records required')
    if records!=sorted(records,key=lambda row: row['site_key'].encode('utf-8')): raise ValueError('reviewed WILD records must be siteKey byte sorted')
    known={value for resource in projected['resources'] for value in resource['urls']+resource['observed_urls']}
    for observation in projected['observations']:
        if observation['type'] in ('REDIRECT_OBSERVED','ALIAS_CANDIDATE','ALIAS_CONFIRMED'):
            known.update((observation['payload']['from_url'],observation['payload']['to_url']))
    seen_keys=set()
    for row in records:
        _record(row,evidence_manifest)
        if row['site_key'] in seen_keys: raise ValueError('duplicate reviewed WILD siteKey')
        if row['url'] in known: raise ValueError('reviewed WILD URL already recorded; explicit identity review required')
        seen_keys.add(row['site_key']);known.add(row['url'])
    return parse(serialize({
        'schema':SCHEMA,
        'adapter_version':VERSION,
        'source_head':projected['event_head'],
        'declaration_timestamp':declaration_timestamp,
        'producer_manifest':producer_manifest,
        'evidence':evidence_manifest,
        'records':records,
    }))


def proposals(events,window):
    keys(window,('schema','adapter_version','source_head','declaration_timestamp','producer_manifest','evidence','records'))
    if window['schema']!=SCHEMA or window['adapter_version']!=VERSION:
        raise ValueError('unsupported WILD discovery window')
    if build_window(events,window['records'],window['declaration_timestamp'],window['producer_manifest'],window['evidence'])!=window:
        raise ValueError('stale or noncanonical WILD discovery window')
    commitment=digest('manifest',window);result=[]
    for index,row in enumerate(window['records']):
        metadata={
            'resource_type':row['resource_type'],
            'eligibility_reason':ELIGIBILITY_REASON,
            'provenance':VERSION+':'+window['source_head']+':'+commitment+':'+str(index),
        }
        payload={'url':row['url'],'metadata':metadata};validate_payload('RESOURCE_CREATED',payload)
        result.append({'type':'RESOURCE_CREATED','timestamp':window['declaration_timestamp'],'payload':payload})
    return result


def verify_window(events,window,committed,producer_files,evidence_files):
    expected=proposals(events,window)
    if set(producer_files)!=set(FILES): raise ValueError('exact WILD producer bytes required')
    for item in window['producer_manifest']['files']:
        if 'sha256:'+hashlib.sha256(producer_files[item['path']]).hexdigest()!=item['digest']:
            raise ValueError('WILD producer commitment mismatch')
    evidence_paths=_evidence(window['evidence'])
    if set(evidence_files)!=set(evidence_paths): raise ValueError('exact WILD evidence bytes required')
    for field in ('accepted_export','campaign_manifest','classification','review','quality_tags'):
        item=window['evidence'][field]
        if 'sha256:'+hashlib.sha256(evidence_files[item['path']]).hexdigest()!=item['digest']:
            raise ValueError('WILD evidence commitment mismatch')
    if len(committed)!=len(expected): raise ValueError('WILD discovery recording count mismatch')
    for actual,wanted in zip(committed,expected):
        if {key:actual[key] for key in wanted}!=wanted: raise ValueError('committed WILD discovery differs from reviewed records')
    projected=replay(events+committed)
    return {
        'status':'VERIFIED_SHADOW_WILD_DISCOVERY_WINDOW',
        'event_count':len(committed),
        'event_head':projected['event_head'],
        'evidence_boundary':'Human-reviewed WILD records, evidence bytes and producer bytes are commitment-bound; projection receives CANDIDATE identity plus minimal metadata only. No remote truth, availability, public corpus membership, terrain authority or selection authority.',
    }
