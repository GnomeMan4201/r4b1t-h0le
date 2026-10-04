"""Offline shadow consistency verifier over declared artifacts; no runtime or network."""
from .schema.serialization import VERSION, serialize, digest
from .schema.events import keys
from .projection import replay, resolve
from .genesis import verify_boundary

BUNDLE_SCHEMA = 'r4b1t-shadow-ledger-bundle-v1'
EVIDENCE_BOUNDARY = 'Shadow integrity and deterministic derivation only. No public release authority, remote observation truth, current reachability, safety, authorship, external chronology, or transitive Trail proof is established.'


def verify_bundle(bundle, artifacts, expected_head=None, expected_genesis=None):
    keys(bundle,('schema','events','projection','projection_hash','event_head','event_count','genesis_hash','serialization'))
    if bundle['schema']!=BUNDLE_SCHEMA or bundle['serialization']!=VERSION: raise ValueError('unsupported shadow bundle')
    projected=replay(bundle['events'])
    if bundle['event_head']!=projected['event_head'] or bundle['event_count']!=projected['event_count'] or bundle['genesis_hash']!=projected['genesis']['hash']: raise ValueError('bundle chain commitments mismatch')
    if expected_head is not None and expected_head!=bundle['event_head']: raise ValueError('declared trusted head mismatch')
    if expected_genesis is not None and expected_genesis!=bundle['genesis_hash']: raise ValueError('declared trusted genesis mismatch')
    verify_boundary(projected['genesis']['payload'],artifacts)
    if serialize(projected)!=serialize(bundle['projection']) or digest('projection',projected)!=bundle['projection_hash']: raise ValueError('projection derivation/hash mismatch')
    for item in projected['resolutions']: resolve(projected,item['absorbed_id'])
    return {'status':'VERIFIED_SHADOW_INTEGRITY','event_count':projected['event_count'],'event_head':projected['event_head'],'genesis_hash':projected['genesis']['hash'],'projection_hash':bundle['projection_hash'],'evidence_boundary':EVIDENCE_BOUNDARY}
