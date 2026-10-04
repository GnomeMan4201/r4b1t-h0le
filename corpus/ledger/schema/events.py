"""Closed v1 event/payload registry. Producers supply observations, never authority fields."""
import re
import ipaddress
from urllib.parse import urlsplit
from .serialization import VERSION, GENESIS_PREV, serialize, digest, timestamp, sorted_collection
from .identity import create_seq, survivor

EVENT_SCHEMA = 'r4b1t-corpus-ledger-event-v1'
CREATES = ('RESOURCE_CREATED', 'LEGACY_RESOURCE_IMPORTED')
GLOBALS = ('GENESIS_BOUNDARY', 'BATCH_REVOKED', 'POLICY_BOUND', 'RELEASE_BOUND')
TYPES = GLOBALS + CREATES + ('URL_OBSERVED', 'REDIRECT_OBSERVED', 'ALIAS_CANDIDATE', 'ALIAS_CONFIRMED', 'RESOURCE_MERGED', 'PROBE_SUCCEEDED', 'PROBE_FAILED', 'PROBE_HEARTBEAT', 'MARKED_ACTIVE', 'MARKED_SUSPECT', 'MARKED_RETIRED', 'AVAILABILITY_LIVE', 'AVAILABILITY_INTERMITTENT', 'AVAILABILITY_ARCHIVED_ONLY', 'AVAILABILITY_GONE', 'ARCHIVE_RESOLVED', 'ARCHIVE_PROBE_SUCCEEDED', 'ARCHIVE_PROBE_FAILED', 'ARCHIVE_TARGET_REPLACED', 'ARCHIVE_TARGET_GONE')


def keys(value, required, optional=()):
    if not isinstance(value, dict) or not set(required) <= set(value) or set(value) - set(required) - set(optional):
        raise ValueError('event/payload keys invalid')


def sha(value):
    if not isinstance(value, str) or not re.fullmatch(r'sha256:[0-9a-f]{64}', value):
        raise ValueError('sha256 commitment required')


def text(value):
    if not isinstance(value, str) or not value:
        raise ValueError('nonempty string required')


def url(value):
    text(value)
    try:
        parsed = urlsplit(value)
        port = parsed.port
        host = parsed.hostname
        if parsed.scheme not in ('http','https') or not host or parsed.username is not None or parsed.password is not None or value != value.strip() or re.search(r'\s',value):
            raise ValueError('invalid observation URL')
        if ':' in host: ipaddress.IPv6Address(host)
        elif not re.fullmatch(r'[^\s/\[\]@?#:]+',host): raise ValueError('invalid host')
        if port is not None and not 1 <= port <= 65535: raise ValueError('invalid port')
    except (ValueError,TypeError) as error:
        raise ValueError('valid HTTP(S) observation URL required') from error



def integer(value, minimum=0):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= 9007199254740991:
        raise ValueError('safe integer required')


def validate_payload(kind, p):
    serialize(p)
    if kind not in TYPES:
        raise ValueError('unknown event type')
    if kind == 'GENESIS_BOUNDARY':
        keys(p, ('serialization','importer_version','import_input_digest','artifacts','authority','legacy_corpora','source_commit'))
        if p['serialization'] != VERSION or not re.fullmatch(r'[0-9a-f]{40}', p['source_commit']):
            raise ValueError('genesis version/commit invalid')
        text(p['importer_version']); sha(p['import_input_digest'])
        for collection in ('artifacts','legacy_corpora'):
            if not isinstance(p[collection], list) or not p[collection] or sorted_collection(p[collection]) != p[collection]:
                raise ValueError('genesis canonical artifact collection required')
            paths = []
            for item in p[collection]:
                keys(item, ('path','digest')); text(item['path']); sha(item['digest']); paths.append(item['path'])
                if item['path'].startswith('/') or '..' in item['path'].split('/'):
                    raise ValueError('relative artifact path required')
            if len(set(paths)) != len(paths): raise ValueError('duplicate artifact path')
        keys(p['authority'], ('promotion_path','urls_path','resources_path','manifest_path','registry_path','profile_id','terrain_index_path','release_id'))
        for value in p['authority'].values(): text(value)
    elif kind == 'RESOURCE_CREATED':
        keys(p, ('url','metadata')); url(p['url']); keys(p['metadata'], (), ('resource_type','provenance','eligibility_reason'))
        for value in p['metadata'].values(): text(value)
    elif kind == 'LEGACY_RESOURCE_IMPORTED':
        keys(p, ('url','metadata','genesis_hash','source_ordinal','initial_eligibility'))
        url(p['url']); sha(p['genesis_hash']); integer(p['source_ordinal']);
        keys(p['metadata'], ('resource_type','provenance','eligibility_reason'))
        for value in p['metadata'].values(): text(value)
        if p['initial_eligibility'] != 'ACTIVE': raise ValueError('explicit genesis import exception required')
    elif kind == 'URL_OBSERVED':
        keys(p, ('url','evidence_digest')); url(p['url']); sha(p['evidence_digest'])
    elif kind in ('REDIRECT_OBSERVED','ALIAS_CANDIDATE','ALIAS_CONFIRMED'):
        keys(p, ('from_url','to_url','evidence_digest')); url(p['from_url']); url(p['to_url']); sha(p['evidence_digest'])
    elif kind == 'RESOURCE_MERGED':
        keys(p, ('first','second','survivor','evidence_digest'))
        for field in ('first','second','survivor'): create_seq(p[field])
        sha(p['evidence_digest'])
        if p['survivor'] != survivor(p['first'],p['second']): raise ValueError('incorrect merge survivor')
    elif kind in ('PROBE_SUCCEEDED','PROBE_FAILED','ARCHIVE_PROBE_SUCCEEDED','ARCHIVE_PROBE_FAILED'):
        keys(p, ('probe_version','observed_url','started_at','finished_at'), ('status','final_url','headers_digest','body_digest','body_bytes','reason'))
        text(p['probe_version']); url(p['observed_url']); timestamp(p['started_at']); timestamp(p['finished_at'])
        if p['started_at'] > p['finished_at']: raise ValueError('probe window reversed')
        if 'status' in p: integer(p['status'],100)
        if 'final_url' in p: url(p['final_url'])
        for field in ('headers_digest','body_digest'):
            if field in p: sha(p[field])
        if 'body_bytes' in p: integer(p['body_bytes'])
        if 'reason' in p: text(p['reason'])
    elif kind == 'PROBE_HEARTBEAT':
        keys(p, ('policy_version','started_at','finished_at','evidence_digest','observation_count'))
        text(p['policy_version']); timestamp(p['started_at']); timestamp(p['finished_at']); sha(p['evidence_digest']); integer(p['observation_count'],1)
        if p['started_at'] > p['finished_at']: raise ValueError('heartbeat window reversed')
    elif kind.startswith('MARKED_') or kind.startswith('AVAILABILITY_'):
        keys(p, ('reason','evidence_digest')); text(p['reason']); sha(p['evidence_digest'])
    elif kind in ('ARCHIVE_RESOLVED','ARCHIVE_TARGET_REPLACED','ARCHIVE_TARGET_GONE'):
        keys(p, ('archive_url','evidence_digest')); url(p['archive_url']); sha(p['evidence_digest'])
    elif kind == 'BATCH_REVOKED':
        keys(p, ('resource_ids','reason','evidence_digest')); text(p['reason']); sha(p['evidence_digest'])
        if not isinstance(p['resource_ids'],list) or not p['resource_ids'] or sorted_collection(p['resource_ids']) != p['resource_ids']: raise ValueError('canonical identity collection required')
        for value in p['resource_ids']: create_seq(value)
    else:
        keys(p, ('artifact','artifact_hash')); sha(p['artifact_hash'])
        validate_bound_artifact(kind,p['artifact'])
        if digest('policy' if kind == 'POLICY_BOUND' else 'manifest',p['artifact']) != p['artifact_hash']: raise ValueError('bound artifact hash mismatch')


def event_hash(event):
    return digest('event', {k:v for k,v in event.items() if k != 'hash'})


def validate_event(event):
    kind = event.get('type') if isinstance(event,dict) else None
    keys(event, ('schema','seq','prev','timestamp','type','payload','hash'), () if kind in GLOBALS else ('resource_id',))
    if event['schema'] != EVENT_SCHEMA: raise ValueError('unsupported event schema')
    integer(event['seq'],1); sha(event['prev']); sha(event['hash']); timestamp(event['timestamp'])
    validate_payload(kind,event['payload'])
    if kind not in GLOBALS:
        if 'resource_id' not in event: raise ValueError('resource ID required')
        create_seq(event['resource_id'])
    if kind in CREATES and create_seq(event['resource_id']) != event['seq']: raise ValueError('resource ID minting mismatch')
    if event_hash(event) != event['hash']: raise ValueError('event hash mismatch')
    return event


def validate_bound_artifact(kind, artifact):
    if kind == 'POLICY_BOUND':
        keys(artifact, ('schema','eligibility','availability','heartbeat_policy','serializer'))
        if artifact['schema'] != 'r4b1t-corpus-selection-policy-v1': raise ValueError('unsupported policy schema')
        for field,allowed in [('eligibility',('CANDIDATE','ACTIVE','SUSPECT','RETIRED')),('availability',('LIVE','INTERMITTENT','ARCHIVED_ONLY','GONE'))]:
            collection = artifact[field]
            if not isinstance(collection,list) or not collection or sorted_collection(collection) != collection or any(x not in allowed for x in collection): raise ValueError('invalid canonical policy state set')
    else:
        keys(artifact,('schema','release_id','event_head','event_count','projection_hash','policy_hash','serializer','heartbeat_policy','adapter_manifest_hash','legacy_boundary_hash'))
        if artifact['schema'] != 'r4b1t-corpus-ledger-release-v1': raise ValueError('unsupported release schema')
        text(artifact['release_id']); integer(artifact['event_count'],1)
        for field in ('event_head','projection_hash','policy_hash','adapter_manifest_hash','legacy_boundary_hash'): sha(artifact[field])
    text(artifact['heartbeat_policy'])
    if artifact['serializer'] != VERSION: raise ValueError('unsupported bound serialization')
