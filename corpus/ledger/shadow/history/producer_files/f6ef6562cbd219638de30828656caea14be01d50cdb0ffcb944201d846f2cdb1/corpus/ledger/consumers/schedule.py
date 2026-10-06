"""Pure, versioned network work allocation. Never ROLL or eligibility authority."""
from corpus.ledger.schema.events import integer,sha
from corpus.ledger.schema.identity import create_seq
from corpus.ledger.schema.serialization import timestamp,digest,serialize

DAILY='shadow-daily-window-v1'


def policy():
    return {'schema':'r4b1t-shadow-schedule-policy-v1','version':'shadow-daily-round-robin-v1','heartbeat_policy':DAILY,'probe_version':'r4b1t-shadow-head-v1','cron_utc':'47 11 * * *','daily_observation_budget':100,'window_limit':100,'ordering':'numeric-create-seq-round-robin','eligibility_transitions':False,'availability_transitions':False,'public_authority':False}


def validate_policy(value):
    if serialize(value)!=serialize(policy()): raise ValueError('unsupported scheduled shadow policy')


def plan(projected,cursor,budget,day):
    integer(cursor);integer(budget,1)
    if budget>policy()['daily_observation_budget']: raise ValueError('daily budget exceeded')
    timestamp(day+'T00:00:00.000Z');sha(projected['event_head'])
    ids=sorted([r['resource_id'] for r in projected['resources'] if r['absorbed_into'] is None],key=create_seq)
    if not ids or len(ids)!=len(set(ids)): raise ValueError('canonical resource population required')
    rotated=[rid for rid in ids if create_seq(rid)>cursor]+[rid for rid in ids if create_seq(rid)<=cursor]
    selected=rotated[:budget]
    return {'schema':'r4b1t-shadow-run-plan-v1','day':day,'budget':budget,'input_cursor':cursor,'cursor_create_seq':create_seq(selected[-1]),'resource_ids':selected,'pool_digest':digest('manifest',{'resource_ids':ids}),'source_head':projected['event_head'],'policy':policy(),'policy_hash':digest('policy',policy())}
