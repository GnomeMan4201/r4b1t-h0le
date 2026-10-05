'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');

const core = require('../roll-authority-core.js');

function samplePrepared(id, trailSequence = 1) {
  return core.createPrepared({
    transactionId: id,
    trailId: 'trail-seed',
    trailSequence,
    corpusDigest: 'sha256:' + 'a'.repeat(64),
    constraint: { terrain: 'ALL', terrainIndex: null, protocolPolicy: { version: 1, excludeOnion: false } },
    eligibleSnapshot: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
    samplerVersion: core.SAMPLER_VERSION,
    seedSource: { kind: 'local-csprng' },
    seedMaterial: 'seed-' + id,
    drawStart: trailSequence - 1,
    repeatGuardReference: null
  });
}

function loadLedger() {
  return require('../roll-authority-ledger.js');
}

test('lock holder recovers the one orphan PREPARED before preparing a new transaction', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  await store.putPrepared(samplePrepared('orphan', 1));

  const order = [];
  const coordinator = ledger.createCoordinator({
    core,
    store,
    withLock: fn => fn(),
    boundary: async name => order.push(name)
  });

  const terminal = await coordinator.commit(
    async () => {
      order.push('prepare-new');
      return samplePrepared('new', 2);
    },
    async (record, context) => {
      order.push((context.recovered ? 'recover-project:' : 'project:') + record.transactionId);
    }
  );

  assert.equal(terminal.transactionId, 'new');
  assert.deepEqual(order.slice(0, 3), ['recovery:prepared', 'recovery:terminal', 'recover-project:orphan']);
  assert.ok(order.indexOf('prepare-new') > order.indexOf('recover-project:orphan'));
  assert.equal((await store.listPrepared()).length, 0);
});

test('crash after durable terminal but before Trail projection is reconciled exactly once', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  const prepared = samplePrepared('tx-commit-gap', 1);
  await store.putPrepared(prepared);
  const resolution = core.resolvePrepared(prepared);
  const terminal = await store.terminalize(prepared.transactionId, resolution, core.createTerminal);

  const seen = [];
  const coordinator = ledger.createCoordinator({ core, store, withLock: fn => fn() });
  await coordinator.recover(async record => {
    seen.push(record.transactionId);
    await store.markProjected(record.transactionId);
  });
  await coordinator.recover(async record => {
    seen.push('duplicate:' + record.transactionId);
    await store.markProjected(record.transactionId);
  });

  assert.equal(terminal.state, 'COMMITTED');
  assert.deepEqual(seen, ['tx-commit-gap']);
});

test('an unrelated unprojected COMMITTED blocks a new draw instead of being silently recovered', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  const prepared = samplePrepared('tx-live-unrevealed', 1);
  await store.putPrepared(prepared);
  await store.terminalize(
    prepared.transactionId,
    core.resolvePrepared(prepared),
    core.createTerminal
  );

  const projected = [];
  let preparedNew = false;
  const coordinator = ledger.createCoordinator({ core, store, withLock: fn => fn() });

  await assert.rejects(
    coordinator.commit(
      () => {
        preparedNew = true;
        return samplePrepared('tx-should-not-start', 2);
      },
      async record => {
        projected.push(record.transactionId);
        return { projected: true };
      }
    ),
    /UNREVEALED_COMMIT_PENDING/
  );

  assert.equal(preparedNew, false);
  assert.deepEqual(projected, []);
  assert.equal((await store.listUnprojectedCommitted()).length, 1);
  assert.equal((await store.listPrepared()).length, 0);
});

test('explicit recovery crosses an unprojected COMMITTED gap', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  const prepared = samplePrepared('tx-crash-gap', 1);
  await store.putPrepared(prepared);
  await store.terminalize(
    prepared.transactionId,
    core.resolvePrepared(prepared),
    core.createTerminal
  );

  const projected = [];
  const coordinator = ledger.createCoordinator({ core, store, withLock: fn => fn() });
  await coordinator.recover(async (record, context) => {
    projected.push([record.transactionId, context.recovered, context.recoveryMode]);
    return { projected: true };
  });

  assert.deepEqual(projected, [['tx-crash-gap', true, 'restore']]);
  assert.equal((await store.listUnprojectedCommitted()).length, 0);
});

test('authority sequence is allocated atomically with terminal state and is monotonic', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  const coordinator = ledger.createCoordinator({ core, store, withLock: fn => fn() });

  const a = await coordinator.commit(() => samplePrepared('tx-a', 1), async (_, context) => {
    await context.store.markProjected('tx-a');
  });
  const b = await coordinator.commit(() => samplePrepared('tx-b', 2), async (_, context) => {
    await context.store.markProjected('tx-b');
  });

  assert.equal(a.authoritySequence, 1);
  assert.equal(b.authoritySequence, 2);
  assert.equal((await store.get('tx-a')).authoritySequence, 1);
  assert.equal((await store.get('tx-b')).authoritySequence, 2);
  assert.equal((await store.listPrepared()).length, 0);
});


test('concurrent callers sharing the global lock serialize to one PREPARED and monotonic terminals', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  let tail = Promise.resolve();
  const withLock = fn => {
    const run = tail.then(fn, fn);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
  const coordinator = ledger.createCoordinator({ core, store, withLock });
  let trailSequence = 0;

  const commitOne = id => coordinator.commit(
    () => samplePrepared(id, ++trailSequence),
    async (record, context) => { await context.store.markProjected(record.transactionId); }
  );

  const [a, b] = await Promise.all([commitOne('tx-race-a'), commitOne('tx-race-b')]);

  assert.deepEqual([a.authoritySequence, b.authoritySequence], [1, 2]);
  assert.deepEqual((await store.listRecords()).map(r => r.transactionId), ['tx-race-a', 'tx-race-b']);
  assert.equal((await store.listPrepared()).length, 0);
});

test('two live PREPARED records are rejected instead of ordered', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  await store.putPrepared(samplePrepared('first'));
  await assert.rejects(
    store.putPrepared(samplePrepared('second')),
    /PREPARED_CARDINALITY_VIOLATION/
  );
});

test('boundary hooks make crash/recovery sequences deterministic', async () => {
  const ledger = loadLedger();
  const store = ledger.createMemoryStore();
  const coordinator = ledger.createCoordinator({
    core,
    store,
    withLock: fn => fn(),
    boundary: async name => {
      if (name === 'prepared') throw new Error('SIMULATED_CRASH_AT_PREPARED');
    }
  });

  await assert.rejects(
    coordinator.commit(() => samplePrepared('crashed'), async () => {}),
    /SIMULATED_CRASH_AT_PREPARED/
  );
  assert.equal((await store.listPrepared()).length, 1);

  const recovered = [];
  const recovery = ledger.createCoordinator({ core, store, withLock: fn => fn() });
  await recovery.recover(async (record, context) => {
    recovered.push(record.transactionId);
    await context.store.markProjected(record.transactionId);
  });

  assert.deepEqual(recovered, ['crashed']);
  assert.equal((await store.listPrepared()).length, 0);
});

class RollCommand {
  check() { return true; }
  async run(m, r) {
    const id = 'tx-' + m.nextId++;
    const terminal = await r.coordinator.commit(
      () => samplePrepared(id, m.nextTrail++),
      async (record, context) => {
        if (record.state === 'COMMITTED') {
          m.history = core.history.push(m.history, record.transactionId);
        }
        await context.store.markProjected(record.transactionId);
      }
    );
    assert.equal(terminal.transactionId, id);
    assert.ok((await r.store.listPrepared()).length <= 1);
  }
  toString() { return 'ROLL'; }
}

class PreviousCommand {
  check(m) { return core.history.canPrevious(m.history); }
  async run(m, r) {
    m.history = core.history.previous(m.history);
    assert.ok((await r.store.listPrepared()).length <= 1);
  }
  toString() { return 'PREVIOUS'; }
}

class ForwardCommand {
  check(m) { return core.history.canForward(m.history); }
  async run(m, r) {
    m.history = core.history.forward(m.history);
    assert.ok((await r.store.listPrepared()).length <= 1);
  }
  toString() { return 'FORWARD'; }
}

class RecoverCommand {
  check() { return true; }
  async run(m, r) {
    await r.coordinator.recover(async (record, context) => {
      await context.store.markProjected(record.transactionId);
    });
    assert.ok((await r.store.listPrepared()).length <= 1);
  }
  toString() { return 'RECOVER'; }
}

test('fast-check commands preserve PREPARED <= 1 and cursor invariants with reproducible seeds', async () => {
  const ledger = loadLedger();
  await fc.assert(
    fc.asyncProperty(
      fc.scheduler(),
      fc.commands([
        fc.constant(new RollCommand()),
        fc.constant(new PreviousCommand()),
        fc.constant(new ForwardCommand()),
        fc.constant(new RecoverCommand())
      ], { maxCommands: 40 }),
      async (scheduler, commands) => {
        const store = ledger.createMemoryStore();
        const coordinator = ledger.createCoordinator({ core, store, withLock: fn => fn() });
        const setup = () => ({
          model: { history: core.history.empty(), nextId: 1, nextTrail: 1 },
          real: { store, coordinator }
        });
        await fc.scheduledModelRun(scheduler, setup, commands);
        assert.ok((await store.listPrepared()).length <= 1);
      }
    ),
    { seed: 0x4b1, numRuns: 75, verbose: true }
  );
});
