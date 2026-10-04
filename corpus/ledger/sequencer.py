"""Only shadow ledger writer. SQLite BEGIN IMMEDIATE serializes processes and threads."""
import sqlite3
from pathlib import Path
from contextlib import closing
from .schema.events import EVENT_SCHEMA, CREATES, GLOBALS, keys, event_hash, sha
from .schema.identity import MAX_CREATE_SEQ
from .schema.serialization import parse, serialize
from .projection import empty_state, apply_event, projection


def shadow_path(path):
    path = Path(path).resolve()
    parts = path.parts
    if not any(parts[i:i+3] == ('corpus','ledger','shadow') for i in range(len(parts)-3)):
        raise ValueError('storage must be under corpus/ledger/shadow')
    return path


def _mint(seq):
    if not 1 <= seq <= MAX_CREATE_SEQ: raise ValueError('identity version exhausted')
    return f'r4b1t:r:{seq:015d}'


class Sequencer:
    def __init__(self, path):
        self.path = shadow_path(path)
        self.path.parent.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(self.path, timeout=30)) as db:
            db.execute('CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, canonical TEXT NOT NULL)')
            db.commit()

    def events(self):
        with closing(sqlite3.connect(self.path, timeout=30)) as db:
            return [parse(row[0]) for row in db.execute('SELECT canonical FROM events ORDER BY seq')]

    def submit(self, proposal):
        return self.submit_many([proposal])[0]

    def submit_many(self, proposals, expected_head=None):
        # Producers cannot supply/reserve final identities or order/hash fields.
        proposals=list(proposals)
        requires_head=any(isinstance(p,dict) and isinstance(p.get('payload'),dict) and (p['payload'].get('probe_version')=='r4b1t-shadow-head-v1' or p['payload'].get('policy_version')=='shadow-explicit-window-v1') for p in proposals)
        if requires_head and expected_head is None: raise ValueError('versioned probe windows require expected source head')
        with closing(sqlite3.connect(self.path, timeout=30)) as db:
            db.execute('BEGIN IMMEDIATE')
            try:
                state = empty_state()
                for seq,raw in db.execute('SELECT seq, canonical FROM events ORDER BY seq'):
                    event = parse(raw)
                    if event['seq'] != seq: raise ValueError('SQL order column disagrees with event')
                    apply_event(state,event)
                if expected_head is not None:
                    sha(expected_head)
                    if state['head'] != expected_head: raise ValueError('stale source head; no proposals appended')
                assigned = []
                for proposal in proposals:
                    kind = proposal.get('type') if isinstance(proposal,dict) else None
                    keys(proposal, ('timestamp','type','payload'), () if kind in CREATES or kind in GLOBALS else ('resource_id',))
                    event = dict(proposal,schema=EVENT_SCHEMA,seq=state['count']+1,prev=state['head'])
                    if kind in CREATES: event['resource_id'] = _mint(event['seq'])
                    event['hash'] = event_hash(event)
                    apply_event(state,event)
                    db.execute('INSERT INTO events VALUES (?,?)',(event['seq'],serialize(event)))
                    assigned.append(parse(serialize(event)))
                db.commit()
                return assigned
            except BaseException:
                db.rollback()
                raise

    def snapshot(self):
        from .projection import replay
        return replay(self.events())
