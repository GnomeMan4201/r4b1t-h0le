"""Pure ledger replay. All inputs are event data; no live authority or side effects."""
from .schema.events import validate_event, CREATES
from .schema.identity import create_seq, survivor
from .schema.serialization import GENESIS_PREV, serialize, parse, digest, sorted_collection

PROJECTION_SCHEMA = 'r4b1t-corpus-ledger-projection-v1'


def empty_state():
    return {'head':GENESIS_PREV,'count':0,'genesis':None,'resources':{},'resolution':{},'imports':[], 'observations':[]}


def canonical_id(state, resource_id):
    create_seq(resource_id)
    if resource_id not in state['resources']: raise ValueError('unknown resource identity')
    seen = set()
    while resource_id in state['resolution']:
        if resource_id in seen: raise ValueError('resolution cycle')
        seen.add(resource_id)
        resource_id = state['resolution'][resource_id]
        if resource_id not in state['resources']: raise ValueError('missing absorbed-ID resolution')
    return resource_id


def apply_event(state, event):
    validate_event(event)
    if event['seq'] != state['count'] + 1 or event['prev'] != state['head']: raise ValueError('sequence/prev continuity mismatch')
    kind, p = event['type'], event['payload']
    if state['count'] == 0:
        if kind != 'GENESIS_BOUNDARY': raise ValueError('genesis must be first')
    elif kind == 'GENESIS_BOUNDARY': raise ValueError('duplicate genesis')
    if kind == 'GENESIS_BOUNDARY':
        state['genesis'] = {'hash':event['hash'],'payload':parse(serialize(p))}
    elif kind in CREATES:
        rid = event['resource_id']
        if rid in state['resources']: raise ValueError('identity recycled')
        if kind == 'LEGACY_RESOURCE_IMPORTED':
            ordinal = p['source_ordinal']
            proofs = state['genesis']['payload'].get('import_record_hashes',[])
            proof = digest('manifest',{'url':p['url'],'metadata':p['metadata']})
            if p['genesis_hash'] != state['genesis']['hash'] or ordinal >= len(proofs) or proofs[ordinal] != proof or ordinal in state['imports']: raise ValueError('legacy ACTIVE import not proven by genesis')
            state['imports'].append(ordinal)
        state['resources'][rid] = {'resource_id':rid,'create_seq':create_seq(rid),'url':p['url'],'urls':[p['url']],'observed_urls':[p['url']],'metadata':dict(p['metadata']),'eligibility':'ACTIVE' if kind == 'LEGACY_RESOURCE_IMPORTED' else 'CANDIDATE','availability':None,'archive_targets':[], 'absorbed_into':None}
    elif kind == 'RESOURCE_MERGED':
        first, second = p['first'],p['second']
        if canonical_id(state,first) != first or canonical_id(state,second) != second: raise ValueError('merge must name current canonical identities')
        keep = survivor(first,second)
        if p['survivor'] != keep or event['resource_id'] != keep: raise ValueError('incorrect merge survivor declaration')
        absorbed = second if keep == first else first
        state['resolution'][absorbed] = keep
        for old in tuple(state['resolution']):
            state['resolution'][old] = canonical_id(state,old)
            state['resources'][old]['absorbed_into'] = state['resolution'][old]
        for collection in ('urls','observed_urls','archive_targets'):
            state['resources'][keep][collection] = sorted_collection(list(set(state['resources'][keep][collection] + state['resources'][absorbed][collection])))
        # State axes and original metadata are never inferred or overwritten by a merge.
    elif 'resource_id' in event:
        rid = canonical_id(state,event['resource_id'])
        resource = state['resources'][rid]
        if kind.startswith('MARKED_'): resource['eligibility'] = kind[7:]
        elif kind.startswith('AVAILABILITY_'): resource['availability'] = kind[13:]
        elif kind == 'URL_OBSERVED': resource['observed_urls'] = sorted_collection(list(set(resource['observed_urls'] + [p['url']])))
        elif kind == 'ALIAS_CONFIRMED':
            if p['from_url'] not in resource['urls']: raise ValueError('alias source is not confirmed for identity')
            resource['urls'] = sorted_collection(list(set(resource['urls'] + [p['to_url']])))
        elif kind in ('ARCHIVE_RESOLVED','ARCHIVE_TARGET_REPLACED'):
            resource['archive_targets'] = sorted_collection(list(set(resource['archive_targets'] + [p['archive_url']])))
        elif kind == 'ARCHIVE_TARGET_GONE':
            if p['archive_url'] not in resource['archive_targets']: raise ValueError('unknown archive target')
            resource['archive_targets'].remove(p['archive_url'])
    elif kind == 'BATCH_REVOKED':
        for rid in p['resource_ids']: canonical_id(state,rid)
    if kind not in CREATES and kind != 'GENESIS_BOUNDARY':
        observation = {'seq':event['seq'],'type':kind,'payload':parse(serialize(p))}
        if 'resource_id' in event: observation['resource_id'] = event['resource_id']
        state['observations'].append(observation)
    state['head'],state['count'] = event['hash'],event['seq']


def projection(state):
    if not state['genesis']: raise ValueError('genesis required')
    return {'schema':PROJECTION_SCHEMA,'event_head':state['head'],'event_count':state['count'],'genesis':state['genesis'],'resources':[state['resources'][rid] for rid in sorted(state['resources'],key=create_seq)],'resolutions':sorted_collection([{'absorbed_id':old,'survivor_id':canonical_id(state,old)} for old in state['resolution']]),'observations':state['observations']}


def replay(events):
    state = empty_state()
    for event in events: apply_event(state,event)
    return projection(state)


def resolve(projected, resource_id):
    resources = {r['resource_id'] for r in projected['resources']}
    if resource_id not in resources: raise ValueError('unknown identity')
    mapping = {r['absorbed_id']:r['survivor_id'] for r in projected['resolutions']}
    expected = {r['resource_id']:r['absorbed_into'] for r in projected['resources'] if r['absorbed_into'] is not None}
    if mapping != expected: raise ValueError('missing or incorrect absorbed-ID resolution')
    seen = set()
    while resource_id in mapping:
        if resource_id in seen: raise ValueError('resolution cycle')
        seen.add(resource_id); resource_id = mapping[resource_id]
        if resource_id not in resources: raise ValueError('missing absorbed-ID resolution')
    return resource_id
