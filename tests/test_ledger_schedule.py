import unittest
from corpus.ledger.consumers.schedule import plan
from corpus.ledger.projection import replay
from corpus.ledger.tools.reference import reference

class ScheduleTests(unittest.TestCase):
    def test_round_robin_is_numeric_bounded_and_blind_to_outcomes(self):
        projected=replay(reference())
        result=plan(projected,0,2,'2026-10-04')
        self.assertEqual(result['resource_ids'],['r4b1t:r:000000000000002'])
        self.assertEqual(result['cursor_create_seq'],2)
        projected['resources'][0]['eligibility']='SUSPECT'
        projected['resources'][0]['availability']='GONE'
        self.assertEqual(plan(projected,0,2,'2026-10-04'),result)
        with self.assertRaises(ValueError): plan(projected,0,101,'2026-10-04')
        projected['resources']=[{'resource_id':f'r4b1t:r:{n:015d}','absorbed_into':None} for n in (30,2,10)]
        self.assertEqual(plan(projected,2,2,'2026-10-04')['resource_ids'],[f'r4b1t:r:{n:015d}' for n in (10,30)])
        self.assertEqual(plan(projected,30,2,'2026-10-04')['resource_ids'],[f'r4b1t:r:{n:015d}' for n in (2,10)])

    def test_daily_unchanged_outcome_suppresses_full_probe_across_windows(self):
        from corpus.ledger.consumers.probe_windows import build_window,proposals,DAILY_FILES
        from corpus.ledger.consumers.schedule import DAILY,policy
        from corpus.ledger.schema.serialization import sorted_collection
        from tests.test_ledger_probe_windows import MANIFEST,observation,RID
        import copy
        import tempfile
        from pathlib import Path
        from corpus.ledger.sequencer import Sequencer
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        writer=Sequencer(Path(temp.name)/'corpus/ledger/shadow/emission.sqlite3');writer.restore_committed(reference())
        row=observation()
        writer.submit_many([{'type':'PROBE_SUCCEEDED','resource_id':RID,'timestamp':row['payload']['finished_at'],'payload':row['payload']}],expected_head=writer.events()[-1]['hash'])
        before=writer.events();projected=writer.snapshot()
        manifest=copy.deepcopy(MANIFEST);manifest['files']=sorted_collection([{'path':path,'digest':'sha256:'+'0'*64} for path in DAILY_FILES])
        window=build_window(projected,[row],manifest,policy_version=DAILY,emission_policy=policy())
        self.assertEqual([p['type'] for p in proposals(window)],['PROBE_HEARTBEAT'])
        changed=copy.deepcopy(window);changed['observations'][0]['payload']['status']=500
        self.assertEqual([p['type'] for p in proposals(changed)],['PROBE_FAILED','PROBE_HEARTBEAT'])
        bad=copy.deepcopy(window);bad['prior_outcomes']=[]
        from corpus.ledger.consumers.probe_windows import verify_window
        with self.assertRaises(ValueError): verify_window(before,bad,[],{})

    def test_cold_sequencer_restore_preserves_exact_order_and_refuses_reset(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.sequencer import Sequencer
        original=reference()
        with tempfile.TemporaryDirectory() as directory:
            writer=Sequencer(Path(directory)/'corpus/ledger/shadow/restore.sqlite3')
            writer.restore_committed(original)
            self.assertEqual(writer.events(),original)
            with self.assertRaises(ValueError): writer.restore_committed(original)
            self.assertEqual(writer.events(),original)

    def test_daily_heartbeat_requires_atomic_source_binding(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.sequencer import Sequencer
        from tests.test_ledger_engine import genesis,proposal
        with tempfile.TemporaryDirectory() as directory:
            writer=Sequencer(Path(directory)/'corpus/ledger/shadow/head.sqlite3')
            writer.submit(genesis());rid=writer.submit(proposal())['resource_id']
            proposed={'type':'PROBE_HEARTBEAT','resource_id':rid,'timestamp':'2026-10-04T08:00:00.000Z','payload':{'policy_version':'shadow-daily-window-v1','started_at':'2026-10-04T08:00:00.000Z','finished_at':'2026-10-04T08:00:00.000Z','evidence_digest':'sha256:'+'0'*64,'observation_count':1}}
            before=writer.events()
            with self.assertRaises(ValueError): writer.submit_many([proposed])
            self.assertEqual(writer.events(),before)

class HistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import tempfile
        from pathlib import Path
        from tests.test_ledger_genesis import ROOT
        from corpus.ledger.tools.history import initialize
        cls.temp=tempfile.TemporaryDirectory();cls.addClassCleanup(cls.temp.cleanup)
        cls.base=Path(cls.temp.name)/'corpus/ledger/shadow/history'
        initialize(cls.base,ROOT)

    def test_durable_history_restores_runs_and_skips_duplicate_day_without_network(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.tools.history import run,verify_history
        def observer(rid,target,guard,limiter):
            return {'resource_id':rid,'payload':{'probe_version':'r4b1t-shadow-head-v1','observed_url':target,'final_url':target,'status':200,'headers_digest':'sha256:'+'0'*64,'started_at':'2026-10-04T08:00:00.000Z','finished_at':'2026-10-04T08:00:01.000Z'}}
        with tempfile.TemporaryDirectory() as directory:
            out=Path(directory)/'corpus/ledger/shadow/day1'
            result=run(self.base,'2026-10-04',2,out,observer=observer)
            self.assertEqual(result['status'],'STAGED_SHADOW_RUN')
            history=verify_history(out)
            self.assertEqual(history['state']['event_count'],7038)
            self.assertEqual(history['state']['cursor_create_seq'],3)
            self.assertEqual(history['projected']['resources'],verify_history(self.base)['projected']['resources'])
            def forbidden(*args): raise AssertionError('completed date must not probe')
            self.assertEqual(run(out,'2026-10-04',2,Path(directory)/'corpus/ledger/shadow/duplicate',observer=forbidden)['status'],'SKIPPED_COMPLETED_DATE')
            with self.assertRaises(ValueError): run(out,'2026-10-03',2,Path(directory)/'corpus/ledger/shadow/backfill',observer=forbidden)
            self.assertEqual(verify_history(out)['state'],history['state'])

    def test_checkpoint_and_chunk_tampering_fail_closed(self):
        import tempfile,shutil
        from pathlib import Path
        from corpus.ledger.tools.history import verify_history
        from corpus.ledger.tools.shadow import read_canonical,write_canonical
        for field,value in [('cursor_create_seq',9),('event_count',1),('projection_hash','sha256:'+'0'*64),('last_run_day','2026-10-04')]:
            with self.subTest(field=field),tempfile.TemporaryDirectory() as directory:
                changed=Path(directory)/'corpus/ledger/shadow/history';shutil.copytree(self.base,changed)
                state=read_canonical(changed/'HEAD.json');state[field]=value;write_canonical(changed/'HEAD.json',state)
                with self.assertRaises(ValueError): verify_history(changed)
        with tempfile.TemporaryDirectory() as directory:
            changed=Path(directory)/'corpus/ledger/shadow/history';shutil.copytree(self.base,changed)
            with (changed/'chunks/genesis.jsonl').open('a') as stream: stream.write('{}\n')
            with self.assertRaises(ValueError): verify_history(changed)

    def test_failed_observer_does_not_advance_history(self):
        import tempfile
        from pathlib import Path
        from corpus.ledger.tools.history import run,verify_history
        before=verify_history(self.base)['state']
        def broken(*args): raise RuntimeError('injected worker failure')
        with tempfile.TemporaryDirectory() as directory:
            out=Path(directory)/'corpus/ledger/shadow/failed'
            with self.assertRaises(RuntimeError): run(self.base,'2026-10-04',2,out,observer=broken)
            self.assertFalse(out.exists())
        self.assertEqual(verify_history(self.base)['state'],before)

    def test_fast_forward_publication_rejects_competing_commit(self):
        import tempfile,subprocess
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);remote=root/'remote.git';work=root/'publisher'
            def git(*args,check=True): return subprocess.run(['git',*args],cwd=work if work.exists() else root,check=check,capture_output=True,text=True)
            git('init','--bare',str(remote));git('clone',str(remote),str(work))
            git('config','user.name','shadow-test');git('config','user.email','shadow@example.invalid')
            (work/'evidence').write_text('genesis');git('add','evidence');git('commit','-m','genesis')
            base=git('rev-parse','HEAD').stdout.strip();git('push','origin','HEAD:refs/heads/automation/corpus-ledger-shadow')
            (work/'evidence').write_text('first run');git('commit','-am','first run');git('push','origin','HEAD:refs/heads/automation/corpus-ledger-shadow')
            accepted=git('rev-parse','HEAD').stdout.strip();git('checkout','--detach',base)
            (work/'evidence').write_text('competing run');git('commit','-am','competing run')
            result=git('push','origin','HEAD:refs/heads/automation/corpus-ledger-shadow',check=False)
            self.assertNotEqual(result.returncode,0)
            self.assertIn(accepted,git('ls-remote','origin','refs/heads/automation/corpus-ledger-shadow').stdout)
