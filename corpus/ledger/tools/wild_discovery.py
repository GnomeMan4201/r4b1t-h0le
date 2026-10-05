"""Frozen reviewed WILD evidence adapter for Corpus Ledger shadow discovery."""
import argparse
import hashlib
import os
import tempfile
from pathlib import Path

from corpus.ledger.consumers.wild_discovery import (
    EVIDENCE_SCHEMA, FILES, MANIFEST, VERSION,
    build_window, proposals, verify_window,
)
from corpus.ledger.schema.serialization import parse, serialize, sorted_collection
from corpus.ledger.sequencer import shadow_path
from corpus.ledger.tools.files import contained
from corpus.ledger.tools.shadow import load_export, read_canonical, write_canonical
from corpus.ledger.verifier import verify_bundle

ROOT=Path(__file__).resolve().parents[3]
ARTIFACT_SHA256='sha256:3dd3f572897203789c93ae5e75fbd2e1f4c0b41720a72e3ebf9fcb27e1cf8a89'
ACCEPTED='corpus/wild/reviews/wild-50-v061-campaign-accepted.jsonl'
CAMPAIGN='corpus/wild/evidence/wild-50-v061/campaign-manifest.json'
CLASSIFICATION='corpus/classification/resource-classification-v2.0.json'
REVIEW='corpus/wild/reviews/wild-50-v061-review.csv'
QUALITY='corpus/wild/reviews/wild-50-v061-quality-tags.csv'
EVIDENCE_PATHS=(ACCEPTED,CAMPAIGN,CLASSIFICATION,REVIEW,QUALITY)
EVIDENCE_FIELDS=(
    ('accepted_export',ACCEPTED),
    ('campaign_manifest',CAMPAIGN),
    ('classification',CLASSIFICATION),
    ('review',REVIEW),
    ('quality_tags',QUALITY),
)


def producer_files():
    return {path:contained(ROOT,path).read_bytes() for path in FILES}


def producer_manifest(inputs=None):
    if inputs is None: inputs=producer_files()
    if set(inputs)!=set(FILES): raise ValueError('exact WILD producer inventory required')
    return {
        'schema':MANIFEST,
        'version':VERSION,
        'files':sorted_collection([
            {'path':path,'digest':'sha256:'+hashlib.sha256(raw).hexdigest()}
            for path,raw in inputs.items()
        ]),
    }


def evidence_files():
    return {path:contained(ROOT,path).read_bytes() for path in EVIDENCE_PATHS}


def evidence_manifest(inputs=None):
    if inputs is None: inputs=evidence_files()
    if set(inputs)!=set(EVIDENCE_PATHS): raise ValueError('exact canonical WILD evidence inventory required')
    def item(path):
        return {'path':path,'digest':'sha256:'+hashlib.sha256(inputs[path]).hexdigest()}
    return {
        'schema':EVIDENCE_SCHEMA,
        'artifact_sha256':ARTIFACT_SHA256,
        'accepted_export':item(ACCEPTED),
        'campaign_manifest':item(CAMPAIGN),
        'classification':item(CLASSIFICATION),
        'review':item(REVIEW),
        'quality_tags':item(QUALITY),
    }


def load_records(path=ACCEPTED):
    target=contained(ROOT,path) if isinstance(path,str) else Path(path)
    raw=target.read_text('utf-8')
    if not raw.endswith('\n'): raise ValueError('canonical WILD JSONL requires final LF')
    rows=[parse(line) for line in raw[:-1].split('\n')]
    if not rows: raise ValueError('reviewed WILD export must not be empty')
    return rows


def prepare(boundary,declaration_timestamp,output):
    output=shadow_path(output)
    if output.exists(): raise ValueError('fresh immutable WILD discovery destination required')
    before,artifacts=load_export(boundary);verify_bundle(before,artifacts)

    producer=producer_files()
    evidence=evidence_files()
    records=load_records()
    evidence_bound=evidence_manifest(evidence)
    window=build_window(
        before['events'],records,declaration_timestamp,
        producer_manifest(producer),evidence_bound,
    )
    submitted=proposals(before['events'],window)

    output.parent.mkdir(parents=True,exist_ok=True)
    reservation=output.parent/('.'+output.name+'.publish-lock')
    with reservation.open('x'): pass
    try:
        with tempfile.TemporaryDirectory(prefix='.'+output.name+'-',dir=output.parent) as temp:
            stage=Path(temp)/'complete';stage.mkdir()
            for path,raw in producer.items():
                destination=contained(stage/'producer_files',path)
                destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(raw)
            for path,raw in evidence.items():
                destination=contained(stage/'evidence_files',path)
                destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(raw)
            write_canonical(stage/'window.json',window)
            write_canonical(stage/'proposals.json',submitted)

            for item in window['producer_manifest']['files']:
                actual=contained(stage/'producer_files',item['path']).read_bytes()
                if 'sha256:'+hashlib.sha256(actual).hexdigest()!=item['digest']:
                    raise ValueError('staged WILD producer bytes differ')
            for field,path in EVIDENCE_FIELDS:
                actual=contained(stage/'evidence_files',path).read_bytes()
                if 'sha256:'+hashlib.sha256(actual).hexdigest()!=window['evidence'][field]['digest']:
                    raise ValueError('staged WILD evidence bytes differ')

            if output.exists(): raise ValueError('immutable WILD discovery destination appeared')
            os.rename(stage,output)
    finally:
        reservation.unlink()
    return {
        'status':'SHADOW_WILD_DISCOVERY_PROPOSALS_ONLY',
        'records':len(records),
        'source_head':before['event_head'],
        'artifact_sha256':ARTIFACT_SHA256,
    }


def verify_exports(before_dir,after_dir,window_dir):
    before,artifacts=load_export(before_dir);verify_bundle(before,artifacts)
    after,after_artifacts=load_export(after_dir)
    verify_bundle(after,after_artifacts,expected_genesis=before['genesis_hash'])
    prefix=len(before['events'])
    if after['events'][:prefix]!=before['events']:
        raise ValueError('WILD discovery source is not committed prefix')

    root=Path(window_dir)
    window=read_canonical(root/'window.json')
    if read_canonical(root/'proposals.json')!=proposals(before['events'],window):
        raise ValueError('WILD discovery proposals differ from evidence')

    expected={'window.json','proposals.json'}
    expected|={'producer_files/'+path for path in FILES}
    expected|={'evidence_files/'+path for path in EVIDENCE_PATHS}
    observed={str(path.relative_to(root)) for path in root.rglob('*') if path.is_file()}
    if observed!=expected:
        raise ValueError('missing or undeclared WILD discovery evidence files')

    producer={path:contained(root,'producer_files/'+path).read_bytes() for path in FILES}
    evidence={path:contained(root,'evidence_files/'+path).read_bytes() for path in EVIDENCE_PATHS}
    return verify_window(before['events'],window,after['events'][prefix:],producer,evidence)


def main(argv=None):
    parser=argparse.ArgumentParser(description='Canonical reviewed WILD records; shadow proposals only, no network or public authority')
    commands=parser.add_subparsers(dest='command',required=True)
    record=commands.add_parser('prepare')
    record.add_argument('--boundary-export',required=True)
    record.add_argument('--timestamp',required=True)
    record.add_argument('--out',required=True)
    verify=commands.add_parser('verify')
    verify.add_argument('--before',required=True)
    verify.add_argument('--after',required=True)
    verify.add_argument('--window',required=True)
    args=parser.parse_args(argv)
    if args.command=='prepare':
        result=prepare(args.boundary_export,args.timestamp,args.out)
    else:
        result=verify_exports(args.before,args.after,args.window)
    print(serialize(result))


if __name__=='__main__':
    main()
