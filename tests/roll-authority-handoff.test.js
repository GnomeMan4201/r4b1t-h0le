'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSelectionAuthority } = require('../selection-authority.js');
const { createRecorder } = require('../selection-transaction-recorder.js');
const { commit } = require('../roll-authority-handoff.js');

const REVISION = 'sha256:' + 'b'.repeat(64);
const POOL = ['https://example.test/a', 'https://example.test/b', 'https://example.test/c'];

test('handoff preserves object identity from selection authority into trail recorder', () => {
  const authority = createSelectionAuthority({ seed: 'handoff-seed' });
  let recorded = null;
  let recordCount = 0;
  const recorder = createRecorder({ onRecord: tx => { recorded = tx; recordCount += 1; } });
  const tx = commit(authority, recorder.record, {
    pool: POOL,
    prior_url: null,
    constraint: { terrain: 'CODE' },
    corpus_revision: REVISION,
  });
  assert.equal(recordCount, 1);
  assert.equal(recorded, tx);
  assert.equal(tx.route.url, recorded.route.url);
});

test('handoff uses explicit authority sampler and does not touch ambient Math.random', () => {
  const nativeRandom = Math.random;
  Math.random = () => { throw new Error('ambient Math.random is forbidden'); };
  try {
    const authority = createSelectionAuthority({ seed: 'explicit-seed' });
    const recorder = createRecorder({ onRecord: () => {} });
    const tx = commit(authority, recorder.record, {
      pool: POOL,
      prior_url: null,
      constraint: { terrain: 'ALL' },
      corpus_revision: REVISION,
    });
    assert.equal(tx.sampler.prng, 'mulberry32-v1');
    assert.equal(tx.sampler.draw_count >= 1, true);
  } finally {
    Math.random = nativeRandom;
  }
});

test('selection-time constraint remains immutable after direct recording', () => {
  const authority = createSelectionAuthority({ seed: 'constraint-seed' });
  const recorder = createRecorder({ onRecord: () => {} });
  const constraint = { terrain: 'CODE', tor: { excluded: false, ready: false } };
  const tx = commit(authority, recorder.record, {
    pool: POOL,
    prior_url: null,
    constraint,
    corpus_revision: REVISION,
  });
  constraint.terrain = 'BLOG';
  constraint.tor.excluded = true;
  assert.deepEqual(tx.constraint, { terrain: 'CODE', tor: { excluded: false, ready: false } });
});
