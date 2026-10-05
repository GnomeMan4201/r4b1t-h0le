'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../roll-authority-core.js');
const ledger = require('../roll-authority-ledger.js');
const runtimeApi = require('../roll-authority-runtime.js');

function memorySessionStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

function prepared(id, sequence) {
  return core.createPrepared({
    transactionId: id,
    trailId: 'trail-live',
    trailSequence: sequence,
    corpusDigest: 'sha256:' + 'a'.repeat(64),
    constraint: { terrain: 'ALL', terrainIndex: null, protocolPolicy: { version: 1, excludeOnion: false } },
    eligibleSnapshot: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
    samplerVersion: core.SAMPLER_VERSION,
    seedSource: { kind: 'local-csprng' },
    seedMaterial: 'runtime-seed',
    drawStart: sequence - 1,
    repeatGuardReference: null
  });
}

test('normal commit adopts authority before reveal but Trail projection is completed only at reveal', async () => {
  const store = ledger.createMemoryStore();
  let sequence = 0;
  const phases = [];
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'tx-' + (sequence + 1),
    prepare: id => prepared(id, ++sequence),
    project: async (_terminal, context) => {
      phases.push(context && context.reveal ? 'reveal' : context && context.recovered ? 'recovery' : 'commit');
      return context && context.reveal ? { projected: true } : { deferCompletion: true };
    },
    show: async () => {}
  });

  const result = await runtime.commit();
  assert.deepEqual(phases, ['commit']);
  assert.equal((await store.listUnprojectedCommitted()).length, 1);

  await runtime.markRevealed(result);
  assert.deepEqual(phases, ['commit', 'reveal']);
  assert.equal((await store.listUnprojectedCommitted()).length, 0);
});

test('commit exposes a compact presentation object and reveal advances tab-local history', async () => {
  const store = ledger.createMemoryStore();
  let sequence = 0;
  const shown = [];
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'tx-' + (sequence + 1),
    prepare: id => prepared(id, ++sequence),
    project: async (_terminal, context) => context && context.reveal ? { projected: true } : { deferCompletion: true },
    show: async terminal => shown.push(terminal.transactionId)
  });

  const result = await runtime.commit();
  assert.equal(result.transactionId, 'tx-1');
  assert.match(result.url, /^https:\/\/example\.com\//);
  assert.equal(result.authoritySequence, 1);
  assert.equal(runtime.snapshot().entries.length, 0);

  await runtime.markRevealed(result);
  assert.deepEqual(runtime.snapshot(), { entries: ['tx-1'], cursor: 0 });
  assert.equal((await store.listUnprojectedCommitted()).length, 0);
  assert.deepEqual(shown, []);
});

test('reveal-time Trail projection is serialized by the same global authority lock', async () => {
  const store = ledger.createMemoryStore();
  let sequence = 0;
  let lockCalls = 0;
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: async fn => {
      lockCalls += 1;
      return fn();
    },
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'tx-' + (sequence + 1),
    prepare: id => prepared(id, ++sequence),
    project: async (_terminal, context) => context && context.reveal ? { projected: true } : { deferCompletion: true },
    show: async () => {}
  });

  const result = await runtime.commit();
  assert.equal(lockCalls, 1);
  await runtime.markRevealed(result);
  assert.equal(lockCalls, 2);
});

test('PREVIOUS and FORWARD only move the transaction cursor and show recorded terminals', async () => {
  const store = ledger.createMemoryStore();
  let sequence = 0;
  const shown = [];
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'tx-' + (sequence + 1),
    prepare: id => prepared(id, ++sequence),
    project: async (_terminal, context) => context && context.reveal ? { projected: true } : { deferCompletion: true },
    show: async terminal => shown.push(terminal.transactionId)
  });

  const a = await runtime.commit(); await runtime.markRevealed(a);
  const b = await runtime.commit(); await runtime.markRevealed(b);
  const c = await runtime.commit(); await runtime.markRevealed(c);

  assert.equal(runtime.canPrevious(), true);
  const previous = await runtime.previous();
  assert.equal(previous.transactionId, 'tx-2');
  assert.equal(runtime.snapshot().cursor, 1);

  const forward = await runtime.forward();
  assert.equal(forward.transactionId, 'tx-3');
  assert.equal(runtime.snapshot().cursor, 2);
  assert.deepEqual(shown, ['tx-2', 'tx-3']);

  const records = await store.listRecords();
  assert.deepEqual(records.map(r => r.transactionId), ['tx-1', 'tx-2', 'tx-3']);
});

test('new reveal after PREVIOUS truncates forward history without deleting durable transactions', async () => {
  const store = ledger.createMemoryStore();
  let sequence = 0;
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'tx-' + (sequence + 1),
    prepare: id => prepared(id, ++sequence),
    project: async (_terminal, context) => context && context.reveal ? { projected: true } : { deferCompletion: true },
    show: async () => {}
  });

  for (let i = 0; i < 3; i += 1) {
    const result = await runtime.commit();
    await runtime.markRevealed(result);
  }
  await runtime.previous();

  const d = await runtime.commit();
  await runtime.markRevealed(d);

  assert.deepEqual(runtime.snapshot(), { entries: ['tx-1', 'tx-2', 'tx-4'], cursor: 2 });
  assert.deepEqual((await store.listRecords()).map(r => r.transactionId), ['tx-1', 'tx-2', 'tx-3', 'tx-4']);
});

test('explicit recovery presents a terminal commit-gap transaction and records it in tab history', async () => {
  const store = ledger.createMemoryStore();
  const gap = prepared('tx-terminal-gap', 1);
  await store.putPrepared(gap);
  await store.terminalize(
    gap.transactionId,
    core.resolvePrepared(gap),
    core.createTerminal
  );

  const shown = [];
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'unused',
    prepare: () => { throw new Error('not used'); },
    project: async (_terminal, context) => {
      assert.equal(context.recovered, true);
      assert.equal(context.recoveryMode, 'restore');
      return { projected: true };
    },
    show: async terminal => shown.push(terminal.transactionId)
  });

  await runtime.recover();

  assert.deepEqual(shown, ['tx-terminal-gap']);
  assert.deepEqual(runtime.snapshot(), { entries: ['tx-terminal-gap'], cursor: 0 });
  assert.equal((await store.listUnprojectedCommitted()).length, 0);
});

test('recovery projects an orphan commit and adds it to tab-local history exactly once', async () => {
  const store = ledger.createMemoryStore();
  const orphan = prepared('tx-orphan', 1);
  await store.putPrepared(orphan);

  const storage = memorySessionStorage();
  const projected = [];
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: storage,
    idFactory: () => 'unused',
    prepare: () => { throw new Error('not used'); },
    project: async (terminal, context) => {
      projected.push([terminal.transactionId, context.recovered]);
      return { projected: true };
    },
    show: async () => {}
  });

  await runtime.recover();
  await runtime.recover();

  assert.deepEqual(projected, [['tx-orphan', true]]);
  assert.deepEqual(runtime.snapshot(), { entries: ['tx-orphan'], cursor: 0 });
});

test('pre-existing COMMITTED recovery projects durably without auto-showing another tab\'s result', async () => {
  const store = ledger.createMemoryStore();
  const preparedRecord = prepared('tx-live-other-tab', 1);
  await store.putPrepared(preparedRecord);
  await store.terminalize(
    preparedRecord.transactionId,
    core.resolvePrepared(preparedRecord),
    core.createTerminal
  );

  const shown = [];
  const contexts = [];
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'unused',
    prepare: () => { throw new Error('not used'); },
    project: async (terminal, context) => {
      contexts.push([terminal.transactionId, context.recovered, context.recoveredPrepared]);
      return { projected: true };
    },
    show: async terminal => shown.push(terminal.transactionId)
  });

  await runtime.recover();

  assert.deepEqual(contexts, [['tx-live-other-tab', true, false]]);
  assert.deepEqual(runtime.snapshot(), { entries: [], cursor: -1 });
  assert.deepEqual(shown, []);
  assert.equal((await store.listUnprojectedCommitted()).length, 0);
});

test('duplicate reveal completion is idempotent', async () => {
  const store = ledger.createMemoryStore();
  let sequence = 0;
  const runtime = runtimeApi.createRuntime({
    core,
    ledger,
    store,
    withLock: fn => fn(),
    sessionStorage: memorySessionStorage(),
    idFactory: () => 'tx-1',
    prepare: id => prepared(id, ++sequence),
    project: async (_terminal, context) => context && context.reveal ? { projected: true } : { deferCompletion: true },
    show: async () => {}
  });

  const result = await runtime.commit();
  await runtime.markRevealed(result);
  await runtime.markRevealed(result);

  assert.deepEqual(runtime.snapshot(), { entries: ['tx-1'], cursor: 0 });
});
