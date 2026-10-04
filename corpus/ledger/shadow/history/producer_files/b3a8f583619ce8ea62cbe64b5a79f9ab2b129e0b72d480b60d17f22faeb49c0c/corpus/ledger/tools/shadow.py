"""Explicit shadow-only bootstrap/append/export/verification. Never imported by ROLL."""
import argparse
import json
import os
import tempfile
from pathlib import Path
from corpus.ledger.genesis import snapshot, import_proposals, verify_boundary
from corpus.ledger.sequencer import Sequencer, shadow_path
from corpus.ledger.projection import replay
from corpus.ledger.schema.serialization import VERSION, serialize, parse, digest
from corpus.ledger.verifier import BUNDLE_SCHEMA, verify_bundle
from corpus.ledger.schema.events import validate_event
from corpus.ledger.tools.files import contained


def write_canonical(path, value):
    Path(path).write_text(serialize(value)+'\n',encoding='utf-8')


def read_canonical(path):
    raw=Path(path).read_text('utf-8')
    if not raw.endswith('\n'): raise ValueError('canonical file must have one LF')
    return parse(raw[:-1])


class ExportError(OSError):
    pass


def export(writer, artifacts, output):
    output=shadow_path(output)
    if output.exists() or output==writer.path or writer.path.is_relative_to(output): raise ValueError('export requires fresh destination separate from store')
    output.parent.mkdir(parents=True,exist_ok=True)
    reservation=output.parent/('.'+output.name+'.publish-lock')
    try:
        lock=reservation.open('x');lock.close()
    except FileExistsError as error: raise ValueError('export publication already reserved') from error
    try:
        if output.exists(): raise ValueError('export destination exists')
        events=writer.events(); projected=replay(events)
        bundle={'schema':BUNDLE_SCHEMA,'events':events,'projection':projected,'projection_hash':digest('projection',projected),'event_head':events[-1]['hash'],'event_count':len(events),'genesis_hash':events[0]['hash'],'serialization':VERSION}
        result=verify_bundle(bundle,artifacts)
        with tempfile.TemporaryDirectory(prefix='.'+output.name+'-',dir=output.parent) as temporary:
            stage=Path(temporary)/'complete';stage.mkdir()
            artifact_dir=stage/'artifacts';artifact_dir.mkdir()
            for item in events[0]['payload']['artifacts']:
                path=item['path'];target=contained(artifact_dir,path)
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(artifacts[path])
            (stage/'events.jsonl').write_text(''.join(serialize(event)+'\n' for event in events),encoding='utf-8')
            write_canonical(stage/'projection.json',projected)
            write_canonical(stage/'commitments.json',{k:v for k,v in bundle.items() if k not in ('events','projection')})
            staged,inputs=load_export(stage);verify_bundle(staged,inputs)
            if output.exists(): raise ValueError('export destination exists')
            os.rename(stage,output)
        return result
    except OSError as error:
        raise ExportError('ledger remains committed; immutable export not published: '+str(error)) from error
    finally:
        reservation.unlink()


def publish_committed(writer,artifacts,output):
    try: return export(writer,artifacts,output)
    except (ValueError,OSError,KeyError,TypeError) as error:
        raise ExportError('ledger remains committed; export failed: '+str(error)) from error


def load_export(directory):
    directory=Path(directory)
    raw=(directory/'events.jsonl').read_text('utf-8')
    if not raw.endswith('\n'): raise ValueError('canonical JSONL needs final LF')
    events=[parse(line) for line in raw[:-1].split('\n')]
    commitments=read_canonical(directory/'commitments.json')
    bundle=dict(commitments,events=events,projection=read_canonical(directory/'projection.json'))
    validate_event(events[0])
    if events[0]['type']!='GENESIS_BOUNDARY': raise ValueError('genesis must be first')
    payload=events[0]['payload']
    artifacts={item['path']:contained(directory/'artifacts',item['path']).read_bytes() for item in payload['artifacts']}
    return bundle,artifacts


def main(argv=None):
    parser=argparse.ArgumentParser(description='Offline shadow ledger infrastructure; public selection unchanged')
    commands=parser.add_subparsers(dest='command',required=True)
    boot=commands.add_parser('bootstrap');boot.add_argument('--root',default='.');boot.add_argument('--source-commit',required=True);boot.add_argument('--timestamp',required=True);boot.add_argument('--store',required=True);boot.add_argument('--out',required=True)
    append=commands.add_parser('append');append.add_argument('--store',required=True);append.add_argument('--proposals',required=True);append.add_argument('--boundary-export',required=True);append.add_argument('--out',required=True);append.add_argument('--expected-head')
    verify=commands.add_parser('verify');verify.add_argument('--bundle-dir',required=True);verify.add_argument('--expected-head');verify.add_argument('--expected-genesis')
    args=parser.parse_args(argv)
    if args.command=='bootstrap':
        payload,artifacts=snapshot(args.root,args.source_commit)
        output=shadow_path(args.out);store=shadow_path(args.store)
        if output.exists() or store.is_relative_to(output): raise ValueError('fresh separate export required before append')
        writer=Sequencer(store)
        if writer.events(): raise ValueError('bootstrap requires empty shadow store; no reset allowed')
        writer.submit_many(import_proposals(payload,artifacts,args.timestamp))
        result=publish_committed(writer,artifacts,args.out)
    elif args.command=='append':
        boundary,artifacts=load_export(args.boundary_export);verify_bundle(boundary,artifacts)
        output=shadow_path(args.out);store=shadow_path(args.store)
        if output.exists() or store.is_relative_to(output): raise ValueError('fresh separate export required before append')
        writer=Sequencer(store)
        before=writer.events()
        if not before or before[0]['hash']!=boundary['genesis_hash']: raise ValueError('append store/boundary mismatch')
        proposals=read_canonical(args.proposals)
        if not isinstance(proposals,list): raise ValueError('ordered proposal array required')
        writer.submit_many(proposals,expected_head=args.expected_head)
        result=publish_committed(writer,artifacts,args.out)
    else:
        bundle,artifacts=load_export(args.bundle_dir)
        result=verify_bundle(bundle,artifacts,args.expected_head,args.expected_genesis)
    print(serialize(result))

if __name__=='__main__':
    try: main()
    except ExportError as error:
        print(json.dumps({'status':'EXPORT_FAILED_LEDGER_COMMITTED','error':str(error)}));raise SystemExit(1)
    except (ValueError,OSError,KeyError,TypeError) as error:
        print(json.dumps({'status':'REJECTED','error':str(error)}))
        raise SystemExit(1)
