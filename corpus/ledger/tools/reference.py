"""Read the committed synthetic test vector, never a public release."""
from pathlib import Path
from corpus.ledger.schema.serialization import serialize, parse


def reference():
    path=Path(__file__).resolve().parents[1]/'fixtures/replay-v1.jsonl'
    return [parse(line) for line in path.read_text('utf-8').splitlines()]

if __name__=='__main__':
    for event in reference(): print(serialize(event))
