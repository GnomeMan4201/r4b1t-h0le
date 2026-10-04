"""Declared-input pre-ledger boundary and deterministic importer; no network probes."""
import hashlib
import json
from pathlib import Path
from .schema.events import validate_payload, keys
from .tools.files import contained
from .schema.serialization import VERSION, serialize, digest, sorted_collection, timestamp

IMPORTER_VERSION = 'r4b1t-legacy-import-v1'
PROMOTION = 'corpus/runtime/active-v1.json'
REGISTRY = 'corpus/runtime/eligibility-profiles-v1.json'
# Required shipped pre-ledger inventory for importer v1; additional releases may be included.
HISTORICAL_RELEASES = ('typed-candidate-v0.1','diverse-candidate-v0.2','strange-candidate-v0.3','experience-candidate-v0.4')


def bytes_digest(raw):
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


def document(raw):
    def pairs(items):
        result={}
        for key,value in items:
            if key in result: raise ValueError('duplicate artifact key')
            result[key]=value
        return result
    return json.loads(raw.decode('utf-8'),object_pairs_hook=pairs)


def _records(artifacts, authority):
    urls=artifacts[authority['urls_path']].decode('utf-8')
    if not urls.endswith('\n') or '\r' in urls or urls.endswith('\n\n'): raise ValueError('noncanonical corpus lines')
    rows=document(artifacts[authority['resources_path']])
    if rows['release_id'] != authority['release_id']: raise ValueError('resource release identity mismatch')
    records=rows['resources']
    if [r['url'] for r in records] != urls[:-1].split('\n') or len({r['url'] for r in records}) != len(records): raise ValueError('authoritative resource/order mismatch')
    normalized=[]
    for row in records:
        keys(row,('url','resource_type','provenance','eligibility_reason'))
        record={'url':row['url'],'metadata':{k:v for k,v in row.items() if k!='url'}}
        validate_payload('RESOURCE_CREATED',record)
        normalized.append(record)
    return normalized


def _input_identity(payload):
    return {k:payload[k] for k in ('importer_version','artifacts','legacy_corpora','authority','source_commit','import_record_hashes')}


def verify_boundary(payload, artifacts):
    validate_payload('GENESIS_BOUNDARY',payload)
    if payload['importer_version'] != IMPORTER_VERSION: raise ValueError('unsupported importer version')
    try:
        for item in payload['artifacts'] + payload['legacy_corpora']:
            if bytes_digest(artifacts[item['path']]) != item['digest']: raise ValueError('genesis artifact digest mismatch: '+item['path'])
        a=payload['authority']
        expected_paths={a[k] for k in ('promotion_path','urls_path','resources_path','manifest_path','registry_path','terrain_index_path')}
        bound={x['path'] for x in payload['artifacts']}
        if set(artifacts)!=bound or not {x['path'] for x in payload['legacy_corpora']} <= bound: raise ValueError('undeclared/missing artifact inputs')
        if not expected_paths <= bound or a['promotion_path']!=PROMOTION or a['registry_path']!=REGISTRY: raise ValueError('required authority commitments missing')
        promotion=document(artifacts[a['promotion_path']]); manifest=document(artifacts[a['manifest_path']]);registry=document(artifacts[a['registry_path']])
        if promotion['schema']!='r4b1t-runtime-corpus-promotion-v1' or promotion['fallback']!='none' or promotion['active']['selection_authority'] is not True: raise ValueError('runtime promotion authority invalid')
        active=promotion['active']
        if (active['url'],active['resources_url'],active['manifest_url'],active['release_id']) != (a['urls_path'],a['resources_path'],a['manifest_path'],a['release_id']): raise ValueError('promotion/release path mismatch')
        if manifest['schema']!='r4b1t-corpus-release-v1' or manifest['release_id']!=a['release_id']: raise ValueError('release identity invalid')
        urls_digest=bytes_digest(artifacts[a['urls_path']]);resources_digest=bytes_digest(artifacts[a['resources_path']])
        assertion=promotion['release_assertion']
        if active['expected_digest']!=urls_digest or manifest['urls_digest']!=urls_digest or manifest['resources_digest']!=resources_digest or assertion['urls_digest']!=urls_digest or assertion['resources_digest']!=resources_digest: raise ValueError('release authority digest mismatch')
        if registry['schema']!='r4b1t-eligibility-profiles-v1': raise ValueError('registry schema invalid')
        required={f'corpus/releases/{release}/{name}' for release in HISTORICAL_RELEASES for name in ('urls.txt','resources.json','manifest.json')}
        for registered in registry['profiles']:
            base='corpus/releases/'+registered['release']['release_id']
            required.update(base+'/'+name for name in ('urls.txt','resources.json','manifest.json'))
            required.add(registered['terrain_index']['path'])
            if registered['terrain_index']['path'] in artifacts and bytes_digest(artifacts[registered['terrain_index']['path']])!=registered['terrain_index']['digest']: raise ValueError('historical terrain binding mismatch')
        if not required <= bound: raise ValueError('historical corpus/terrain inventory incomplete')
        matches=[p for p in registry['profiles'] if p['status']=='active' and p['profile_id']==a['profile_id'] and p['promotion_id']==promotion['promotion_id']]
        if len(matches)!=1: raise ValueError('registry/profile binding mismatch')
        profile=matches[0]
        if profile['mapping']!='resource-type-identity-v1' or profile['release']!={'release_id':a['release_id'],'urls_digest':urls_digest,'resources_digest':resources_digest}: raise ValueError('profile release binding mismatch')
        if profile['terrain_index']['schema']!='r4b1t-terrain-index-v1' or profile['terrain_index']['path']!=a['terrain_index_path'] or profile['terrain_index']['digest']!=bytes_digest(artifacts[a['terrain_index_path']]): raise ValueError('terrain digest/binding mismatch')
        terrain=document(artifacts[a['terrain_index_path']])
        if terrain['schema']!='r4b1t-terrain-index-v1' or terrain['vocabulary']!='resource-type-identity-v1' or terrain['release']!=profile['release'] or serialize(terrain)+'\n'!=artifacts[a['terrain_index_path']].decode('utf-8'): raise ValueError('terrain artifact invalid')
        records=_records(artifacts,a)
        if assertion['resources']!=len(records) or manifest['counts']['resources']!=len(records): raise ValueError('eligible resource count mismatch')
        expected=[]
        for kind in sorted({r['metadata']['resource_type'] for r in records}):
            members=[i for i,r in enumerate(records) if r['metadata']['resource_type']==kind]
            expected.append({'id':kind,'label':kind.replace('_',' ').upper(),'rule':{'resource_type':[kind]},'count':len(members),'members':members})
        if terrain['terrains']!=expected: raise ValueError('terrain eligibility reconstruction mismatch')
        proofs=[digest('manifest',record) for record in records]
        if payload.get('import_record_hashes')!=proofs: raise ValueError('legacy record proof mismatch')
        if payload['import_input_digest']!=digest('manifest',_input_identity(payload)): raise ValueError('deterministic import input digest mismatch')
        history={x['path']:x['digest'] for x in payload['legacy_corpora']}
        if history.get(a['urls_path'])!=urls_digest or history.get(promotion['rollback']['url'])!=promotion['rollback']['expected_digest']: raise ValueError('historical corpus boundary missing')
        # Every supplied pre-ledger release is preserved, with its original bytes/digests.
        for path,raw in artifacts.items():
            if path.startswith('corpus/releases/') and path.endswith('/manifest.json'):
                old=document(raw);base=path.rsplit('/',1)[0]
                if history.get(base+'/urls.txt')!=old['urls_digest'] or bytes_digest(artifacts[base+'/urls.txt'])!=old['urls_digest'] or bytes_digest(artifacts[base+'/resources.json'])!=old['resources_digest']: raise ValueError('historical release commitment mismatch')
        return records
    except (KeyError,TypeError,UnicodeError) as error:
        raise ValueError('genesis boundary incomplete/invalid') from error


def snapshot(root, source_commit):
    root=Path(root).resolve()
    promotion=document(contained(root,PROMOTION).read_bytes()); registry=document(contained(root,REGISTRY).read_bytes());active=promotion['active']
    matches=[p for p in registry['profiles'] if p['status']=='active' and p['promotion_id']==promotion['promotion_id']]
    if len(matches)!=1: raise ValueError('unique active terrain binding required')
    profile=matches[0]
    paths={PROMOTION,REGISTRY,active['url'],active['resources_url'],active['manifest_url'],promotion['rollback']['url']}
    paths.update(str(p.relative_to(root)) for p in (root/'corpus/releases').glob('*/*') if p.name in ('urls.txt','resources.json','manifest.json'))
    paths.update(p['terrain_index']['path'] for p in registry['profiles'])
    artifacts={p:contained(root,p).read_bytes() for p in sorted(paths)}
    authority={'promotion_path':PROMOTION,'urls_path':active['url'],'resources_path':active['resources_url'],'manifest_path':active['manifest_url'],'registry_path':REGISTRY,'profile_id':profile['profile_id'],'terrain_index_path':profile['terrain_index']['path'],'release_id':active['release_id']}
    commits=sorted_collection([{'path':p,'digest':bytes_digest(raw)} for p,raw in artifacts.items()])
    history=sorted_collection([x for x in commits if x['path'].endswith('urls.txt')])
    payload={'serialization':VERSION,'importer_version':IMPORTER_VERSION,'source_commit':source_commit,'authority':authority,'artifacts':commits,'legacy_corpora':history,'import_record_hashes':[digest('manifest',r) for r in _records(artifacts,authority)]}
    payload['import_input_digest']=digest('manifest',_input_identity(payload))
    verify_boundary(payload,artifacts)
    return payload,artifacts


def import_proposals(payload, artifacts, boundary_timestamp):
    timestamp(boundary_timestamp)
    records=verify_boundary(payload,artifacts)
    # Input timestamp is the boundary submission time, never resource history/liveness.
    from .schema.events import EVENT_SCHEMA, event_hash
    from .schema.serialization import GENESIS_PREV
    first={'timestamp':boundary_timestamp,'type':'GENESIS_BOUNDARY','payload':payload}
    genesis_hash=event_hash(dict(first,schema=EVENT_SCHEMA,seq=1,prev=GENESIS_PREV))
    return [first] + [{'timestamp':boundary_timestamp,'type':'LEGACY_RESOURCE_IMPORTED','payload':dict(r,genesis_hash=genesis_hash,source_ordinal=i,initial_eligibility='ACTIVE')} for i,r in enumerate(records)]
