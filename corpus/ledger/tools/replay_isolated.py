"""Explicit stdin/stdout replay harness. CI executes this in a network namespace."""
import json
import sys
from corpus.ledger.projection import replay
from corpus.ledger.schema.serialization import serialize, digest, parse

if '--require-isolation' in sys.argv:
    # This is a harness check, outside the pure projection dependency closure.
    import socket
    try:
        with socket.create_connection(('1.1.1.1',443),timeout=0.2): pass
    except OSError: pass
    else: raise SystemExit('usable network detected in isolated replay harness')
raw=sys.stdin.read()
events=[parse(line) for line in raw.splitlines()]
projected=replay(events)
print(serialize({'projection':projected,'projection_hash':digest('projection',projected)}))
