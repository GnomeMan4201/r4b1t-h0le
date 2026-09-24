'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  TRANSACTION_VERSION,
  createSelectionAuthority,
} = require('../selection-authority.js');

const REVISION = 'sha256:' + 'a'.repeat(64);
const POOL = [
  'https://example.test/a',
  'https://example.test/b',
  'https://example.test/c',
];

function scriptedSampler(values) {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('scripted sampler exhausted');
    return values[index++];
  };
}

function authority(values = [0.1]) {
  return createSelectionAuthority({
    seed: 'test-seed',
    createSampler: () => scriptedSampler(values),
  });
}

test('committed transaction is deeply immutable and owns the selected route', () => {
  const constraint = { terrain: 'CODE', tor: { excluded: true, ready: false } };
  const tx = authority([0.45]).selectRoll({
    pool: POOL,
    prior_url: null,
    constraint,
    corpus_revision: REVISION,
  });

  assert.equal(tx.transaction_version, TRANSACTION_VERSION);
  assert.equal(tx.action, 'ROLL');
  assert.equal(tx.route.url, POOL[1]);
  assert.equal(Object.isFrozen(tx), true);
  assert.equal(Object.isFrozen(tx.constraint), true);
  assert.equal(Object.isFrozen(tx.constraint.tor), true);
  assert.equal(Object.isFrozen(tx.sampler), true);
  assert.equal(Object.isFrozen(tx.route), true);
  assert.throws(() => { tx.route.url = POOL[2]; }, TypeError);
});

test('attempt commit is single-use', () => {
  const attempt = authority([0.2]).begin({
    action: 'ROLL',
    constraint: { terrain: 'ALL' },
    corpus_revision: REVISION,
  });
  attempt.nextFloat();
  const tx = attempt.commit(POOL[0]);
  assert.equal(tx.route.url, POOL[0]);
  assert.throws(() => attempt.commit(POOL[1]), /single-use|already committed/);
  assert.throws(() => attempt.nextFloat(), /already committed/);
});

test('selection consumes the authority-owned explicit sampler and never ambient Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('ambient Math.random must not be used'); };
  try {
    const tx = authority([0.8]).selectRoll({
      pool: POOL,
      prior_url: null,
      constraint: { terrain: 'ALL' },
      corpus_revision: REVISION,
    });
    assert.equal(tx.route.url, POOL[2]);
    assert.deepEqual(tx.sampler, {
      algorithm: 'uniform-with-repeat-guard-v1',
      prng: 'mulberry32-v1',
      seed: 'test-seed',
      draw_start: 0,
      draw_count: 1,
    });
  } finally {
    Math.random = original;
  }
});

test('draw_start and draw_count include every repeat-guard draw', () => {
  const a = authority([0.05, 0.05, 0.72, 0.4]);
  const first = a.selectRoll({
    pool: POOL,
    prior_url: POOL[0],
    constraint: { terrain: 'CODE' },
    corpus_revision: REVISION,
  });
  assert.equal(first.route.url, POOL[2]);
  assert.equal(first.sampler.draw_start, 0);
  assert.equal(first.sampler.draw_count, 3);

  const second = a.selectRoll({
    pool: POOL,
    prior_url: null,
    constraint: { terrain: 'BLOG' },
    corpus_revision: REVISION,
  });
  assert.equal(second.sampler.draw_start, 3);
  assert.equal(second.sampler.draw_count, 1);
  assert.equal(a.cursor(), 4);
});

test('constraint is captured at selection time and later mutation cannot rewrite transaction identity', () => {
  const constraint = { terrain: 'CODE', tor: { excluded: false, ready: false } };
  const a = authority([0.2]);
  const attempt = a.begin({ action: 'ROLL', constraint, corpus_revision: REVISION });
  constraint.terrain = 'BLOG';
  constraint.tor.excluded = true;
  attempt.nextFloat();
  const tx = attempt.commit(POOL[0]);
  assert.deepEqual(tx.constraint, { terrain: 'CODE', tor: { excluded: false, ready: false } });
});

test('DOM or presentation mutation has no path into committed provenance', () => {
  const presentation = { textContent: 'https://presentation.invalid/' };
  const tx = authority([0.4]).selectRoll({
    pool: POOL,
    prior_url: null,
    constraint: { terrain: 'CODE' },
    corpus_revision: REVISION,
  });
  presentation.textContent = 'https://mutated.invalid/';
  assert.equal(tx.route.url, POOL[1]);
  assert.notEqual(tx.route.url, presentation.textContent);
});

test('same seed and inputs produce shell-agnostic desktop/mobile transaction semantics', () => {
  const make = () => createSelectionAuthority({ seed: 'shared-shell-seed' });
  const input = {
    pool: POOL,
    prior_url: POOL[2],
    constraint: { terrain: 'CODE', tor: { excluded: false, ready: false } },
    corpus_revision: REVISION,
  };
  const desktop = make().selectRoll(input);
  const mobile = make().selectRoll(input);
  assert.deepEqual(mobile, desktop);
});

test('production wiring uses one shared commit function for desktop and mobile and has no Math.random replacement', (t) => {
  const root = path.resolve(__dirname, '..');
  const required = ['index.html', 'roll-production-integration.js', 'trail-runtime.js'];
  if (required.some(file => !fs.existsSync(path.join(root, file)))) {
    t.skip('full repository source is not materialized in this local test harness');
    return;
  }
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const integration = fs.readFileSync(path.join(root, 'roll-production-integration.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'trail-runtime.js'), 'utf8');

  assert.match(index, /function _commitRollSelection\(\)[\s\S]*?selectRoll/);
  assert.match(index, /function B\(\)\{let r=_commitRollSelection\(\)/);
  assert.match(integration, /root\.__r4b1tCommitRoll\(\)/);
  assert.doesNotMatch(runtime, /Math\.random\s*=/);
  assert.doesNotMatch(index, /Math\.random\s*=/);
});
