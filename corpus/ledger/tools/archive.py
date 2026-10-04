"""Explicit archive operations: producer inputs and frozen code commitments only."""
from pathlib import Path
from corpus.ledger.consumers.archive_windows import FILES,PROBE
from corpus.ledger.tools.files import contained
from corpus.ledger.schema.serialization import sorted_collection
from corpus.ledger.tools.history import raw_hash
ROOT=Path(__file__).resolve().parents[3]


def producer_files(): return {path:contained(ROOT,path).read_bytes() for path in FILES}


def producer_manifest():
    return {'schema':'r4b1t-shadow-archive-producer-v1','version':PROBE,'files':sorted_collection([{'path':path,'digest':raw_hash(raw)} for path,raw in producer_files().items()])}


def collect_and_stage(history,name,resource_ids,output,observer=None):
    from corpus.ledger.tools.history import verify_history,archive_run,archive_preflight
    from corpus.ledger.consumers.archive_windows import records
    from corpus.ledger.consumers.head_probe import observe,PublicTargetGuard,RateLimiter
    if not isinstance(resource_ids,list) or not 1<=len(resource_ids)<=100 or len(set(resource_ids))!=len(resource_ids): raise ValueError('bounded explicit unique archive identities required')
    before=verify_history(history);output=archive_preflight(before['state'],name,output);targets={r['resource_id']:r['archive_url'] for r in records(before['events'])}
    if any(rid not in targets or targets[rid] is None for rid in resource_ids): raise ValueError('current explicit archive target required')
    if observer is None: observer=observe
    guard,limiter=PublicTargetGuard(),RateLimiter();operations=[]
    for rid in resource_ids:
        row=observer(rid,targets[rid],guard,limiter);p=dict(row['payload'])
        if row['resource_id']!=rid or p['observed_url']!=targets[rid] or p['probe_version']!='r4b1t-shadow-head-v1': raise ValueError('archive observer input/output binding differs')
        p['probe_version']=PROBE
        operations.append({'type':'ARCHIVE_PROBE','resource_id':rid,'payload':p})
    return archive_run(history,name,operations,output,expected_head=before['state']['event_head'])


def main():
    import argparse
    from corpus.ledger.tools.shadow import read_canonical
    from corpus.ledger.schema.serialization import serialize
    parser=argparse.ArgumentParser(description='Explicit existing archive targets; no lookup or public authority')
    commands=parser.add_subparsers(dest='command',required=True)
    collect=commands.add_parser('collect');collect.add_argument('--history',required=True);collect.add_argument('--name',required=True);collect.add_argument('--resources',required=True);collect.add_argument('--out',required=True)
    args=parser.parse_args()
    print(serialize(collect_and_stage(args.history,args.name,read_canonical(args.resources),args.out)))

if __name__=='__main__': main()
