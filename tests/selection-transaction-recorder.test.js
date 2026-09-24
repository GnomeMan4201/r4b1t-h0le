'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSelectionAuthority } = require('../selection-authority.js');
const { createRecorder } = require('../selection-transaction-recorder.js');

const REVISION = 'sha256:' + 'a'.repeat(64);
const POOL = ['https://example.test/a', 'https://example.test/b'];

function transaction() {
  return createSelectionAuthority({ seed: 'recorder-seed' }).selectRoll({
    pool: POOL,
    prior_url: null,
    constraint: { terrain: 'CODE', tor: { excluded: false, ready: false } },
    corpus_revision: REVISION,
  });
}

test('recorder passes through the exact committed transaction object once', () => {
  const received = [];
  const recorder = createRecorder({ onRecord: tx => received.push(tx) });
  const tx = transaction();
  assert.equal(recorder.record(tx), true);
  assert.equal(received.length, 1);
  assert.equal(received[0], tx);
  assert.equal(recorder.record(tx), false);
  assert.equal(received.length, 1);
});

test('logical duplicate identity cannot create a second authoritative record', () => {
  let count = 0;
  const recorder = createRecorder({ onRecord: () => { count += 1; } });
  const tx = transaction();
  const duplicate = Object.freeze({
    ...tx,
    constraint: tx.constraint,
    sampler: tx.sampler,
    route: tx.route,
  });
  assert.notEqual(duplicate, tx);
  assert.equal(recorder.record(tx), true);
  assert.equal(recorder.record(duplicate), false);
  assert.equal(count, 1);
});

test('recorder rejects mutable or reconstructed provenance objects', () => {
  const recorder = createRecorder({ onRecord: () => {} });
  const tx = transaction();
  assert.throws(() => recorder.record({ ...tx }), /deeply frozen/);
});
