'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const authority = require('../roll-authority-core.js');

function prepared(overrides = {}) {
  return authority.createPrepared({
    transactionId: 'tx-001',
    trailId: 'trail-seed-001',
    trailSequence: 1,
    corpusDigest: 'sha256:' + 'a'.repeat(64),
    constraint: {
      terrain: 'ALL',
      terrainIndex: null,
      protocolPolicy: { version: 1, excludeOnion: false }
    },
    eligibleSnapshot: [
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c'
    ],
    samplerVersion: authority.SAMPLER_VERSION,
    seedSource: { kind: 'local-csprng' },
    seedMaterial: '0123456789abcdef0123456789abcdef',
    drawStart: 0,
    repeatGuardReference: null,
    ...overrides
  });
}

test('PREPARED fixes the future draw and resolves deterministically', () => {
  const input = prepared();
  const first = authority.resolvePrepared(input);
  const second = authority.resolvePrepared(input);

  assert.deepEqual(second, first);
  assert.equal(first.state, 'COMMITTED');
  assert.match(first.url, /^https:\/\/example\.com\//);
  assert.ok(Number.isSafeInteger(first.drawCount));
  assert.ok(first.drawCount >= 1 && first.drawCount <= 30);
});

test('seed source is structured and frozen separately from seed material', () => {
  const input = prepared();
  assert.deepEqual(input.seedSource, { kind: 'local-csprng' });
  assert.equal(input.seedMaterial, '0123456789abcdef0123456789abcdef');
  assert.ok(Object.isFrozen(input));
  assert.ok(Object.isFrozen(input.seedSource));
});

test('missing eligible snapshot resolves to an explicit deterministic failure', () => {
  const input = prepared({ eligibleSnapshot: null });
  assert.deepEqual(authority.resolvePrepared(input), {
    state: 'FAILED',
    failureCode: 'CORPUS_SNAPSHOT_UNAVAILABLE'
  });
});

test('empty eligible set resolves to an explicit deterministic failure', () => {
  const input = prepared({ eligibleSnapshot: [] });
  assert.deepEqual(authority.resolvePrepared(input), {
    state: 'FAILED',
    failureCode: 'EMPTY_ELIGIBLE_SET'
  });
});

test('unavailable sampler version resolves to an explicit deterministic failure', () => {
  const input = prepared({ samplerVersion: 'removed-sampler/v99' });
  assert.deepEqual(authority.resolvePrepared(input), {
    state: 'FAILED',
    failureCode: 'SAMPLER_VERSION_UNAVAILABLE'
  });
});

test('terminal outcomes receive authority sequence without mutating PREPARED identity', () => {
  const input = prepared();
  const resolution = authority.resolvePrepared(input);
  const terminal = authority.createTerminal(input, resolution, 41);

  assert.equal(terminal.transactionId, input.transactionId);
  assert.equal(terminal.authoritySequence, 41);
  assert.equal(terminal.state, 'COMMITTED');
  assert.equal(terminal.result.url, resolution.url);
  assert.equal(terminal.prepared.eligibleCount, input.eligibleSnapshot.length);
  assert.equal(Object.prototype.hasOwnProperty.call(terminal.prepared, 'eligibleSnapshot'), false);
  assert.equal(input.authoritySequence, undefined);
});

test('at most one non-terminal PREPARED record is a hard invariant', () => {
  const one = [prepared()];
  authority.assertPreparedCardinality(one);

  assert.throws(
    () => authority.assertPreparedCardinality([prepared(), prepared({ transactionId: 'tx-002' })]),
    /PREPARED_CARDINALITY_VIOLATION/
  );
});

test('history is transaction-based; repeated result IDs do not collapse transactions', () => {
  let history = authority.history.empty();
  history = authority.history.push(history, 'tx-a');
  history = authority.history.push(history, 'tx-b');
  history = authority.history.push(history, 'tx-c');

  assert.deepEqual(history.entries, ['tx-a', 'tx-b', 'tx-c']);
  assert.equal(history.cursor, 2);

  history = authority.history.previous(history);
  assert.equal(authority.history.current(history), 'tx-b');

  history = authority.history.push(history, 'tx-d');
  assert.deepEqual(history.entries, ['tx-a', 'tx-b', 'tx-d']);
  assert.equal(authority.history.current(history), 'tx-d');
  assert.equal(authority.history.canForward(history), false);
});

test('PREVIOUS and FORWARD move only the cursor', () => {
  let history = { entries: ['tx-a', 'tx-b', 'tx-c'], cursor: 2 };
  const originalEntries = history.entries.slice();

  history = authority.history.previous(history);
  assert.equal(authority.history.current(history), 'tx-b');
  assert.deepEqual(history.entries, originalEntries);

  history = authority.history.forward(history);
  assert.equal(authority.history.current(history), 'tx-c');
  assert.deepEqual(history.entries, originalEntries);
});
