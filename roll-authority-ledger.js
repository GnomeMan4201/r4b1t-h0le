(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4B1TRollAuthorityLedger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DB_NAME = 'r4b1t-roll-authority-v1';
  var DB_VERSION = 1;
  var RECORDS = 'records';
  var META = 'meta';
  var PROJECTIONS = 'projections';
  var SEQUENCE_KEY = 'authoritySequence';
  var LOCK_NAME = 'r4b1t-roll-authority-draw-v1';

  function clone(value) {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function createMemoryStore() {
    var records = new Map();
    var projected = new Set();
    var authoritySequence = 0;

    async function listPrepared() {
      return Array.from(records.values()).filter(function (record) {
        return record && record.state === 'PREPARED';
      }).map(clone);
    }

    async function putPrepared(prepared) {
      var live = await listPrepared();
      if (live.length && !live.some(function (record) { return record.transactionId === prepared.transactionId; })) {
        throw new Error('PREPARED_CARDINALITY_VIOLATION');
      }
      records.set(prepared.transactionId, clone(prepared));
      return clone(prepared);
    }

    async function terminalize(transactionId, resolution, createTerminal) {
      var current = records.get(transactionId);
      if (!current) throw new Error('PREPARED_NOT_FOUND');
      if (current.state !== 'PREPARED') return clone(current);
      authoritySequence += 1;
      var terminal = createTerminal(current, resolution, authoritySequence);
      records.set(transactionId, clone(terminal));
      return clone(terminal);
    }

    async function get(transactionId) {
      return clone(records.get(transactionId) || null);
    }

    async function listUnprojectedCommitted() {
      return Array.from(records.values()).filter(function (record) {
        return record && record.state === 'COMMITTED' && !projected.has(record.transactionId);
      }).sort(function (a, b) {
        return a.authoritySequence - b.authoritySequence;
      }).map(clone);
    }

    async function markProjected(transactionId) {
      projected.add(transactionId);
      return true;
    }

    async function listRecords() {
      return Array.from(records.values()).sort(function (a, b) {
        var left = Number.isSafeInteger(a.authoritySequence) ? a.authoritySequence : Number.MAX_SAFE_INTEGER;
        var right = Number.isSafeInteger(b.authoritySequence) ? b.authoritySequence : Number.MAX_SAFE_INTEGER;
        return left - right;
      }).map(clone);
    }

    return Object.freeze({
      listPrepared: listPrepared,
      putPrepared: putPrepared,
      terminalize: terminalize,
      get: get,
      listUnprojectedCommitted: listUnprojectedCommitted,
      markProjected: markProjected,
      listRecords: listRecords
    });
  }

  function requestResult(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB request failed')); };
    });
  }

  function transactionComplete(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onabort = function () { reject(transaction.error || new Error('IndexedDB transaction aborted')); };
      transaction.onerror = function () { reject(transaction.error || new Error('IndexedDB transaction failed')); };
    });
  }

  function strictTransaction(db, stores, mode) {
    try {
      return db.transaction(stores, mode, { durability: 'strict' });
    } catch (_) {
      return db.transaction(stores, mode);
    }
  }

  function openAuthorityDatabase(indexedDb, name) {
    if (!indexedDb || typeof indexedDb.open !== 'function') {
      return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'));
    }
    return new Promise(function (resolve, reject) {
      var request = indexedDb.open(name || DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: 'transactionId' });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(PROJECTIONS)) db.createObjectStore(PROJECTIONS, { keyPath: 'transactionId' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('INDEXEDDB_OPEN_FAILED')); };
    });
  }

  function createIndexedDbStore(options) {
    options = options || {};
    var indexedDb = options.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    var dbPromise = openAuthorityDatabase(indexedDb, options.name || DB_NAME);

    async function db() { return dbPromise; }

    async function listPrepared() {
      var database = await db();
      var tx = database.transaction([RECORDS], 'readonly');
      var values = await requestResult(tx.objectStore(RECORDS).getAll());
      await transactionComplete(tx);
      return values.filter(function (record) { return record && record.state === 'PREPARED'; });
    }

    async function putPrepared(prepared) {
      var database = await db();
      var tx = strictTransaction(database, [RECORDS], 'readwrite');
      var store = tx.objectStore(RECORDS);
      var values = await requestResult(store.getAll());
      var live = values.filter(function (record) { return record && record.state === 'PREPARED'; });
      if (live.length && !live.some(function (record) { return record.transactionId === prepared.transactionId; })) {
        tx.abort();
        try { await transactionComplete(tx); } catch (_) {}
        throw new Error('PREPARED_CARDINALITY_VIOLATION');
      }
      store.put(clone(prepared));
      await transactionComplete(tx);
      return clone(prepared);
    }

    async function terminalize(transactionId, resolution, createTerminal) {
      var database = await db();
      var tx = strictTransaction(database, [RECORDS, META], 'readwrite');
      var recordStore = tx.objectStore(RECORDS);
      var metaStore = tx.objectStore(META);
      var current = await requestResult(recordStore.get(transactionId));
      if (!current) {
        tx.abort();
        try { await transactionComplete(tx); } catch (_) {}
        throw new Error('PREPARED_NOT_FOUND');
      }
      if (current.state !== 'PREPARED') {
        await transactionComplete(tx);
        return current;
      }
      var sequenceRecord = await requestResult(metaStore.get(SEQUENCE_KEY));
      var sequence = sequenceRecord && Number.isSafeInteger(sequenceRecord.value) ? sequenceRecord.value + 1 : 1;
      var terminal = createTerminal(current, resolution, sequence);
      recordStore.put(clone(terminal));
      metaStore.put({ key: SEQUENCE_KEY, value: sequence });
      await transactionComplete(tx);
      return clone(terminal);
    }

    async function get(transactionId) {
      var database = await db();
      var tx = database.transaction([RECORDS], 'readonly');
      var value = await requestResult(tx.objectStore(RECORDS).get(transactionId));
      await transactionComplete(tx);
      return value || null;
    }

    async function listUnprojectedCommitted() {
      var database = await db();
      var tx = database.transaction([RECORDS, PROJECTIONS], 'readonly');
      var values = await requestResult(tx.objectStore(RECORDS).getAll());
      var projections = await requestResult(tx.objectStore(PROJECTIONS).getAll());
      await transactionComplete(tx);
      var seen = new Set(projections.map(function (entry) { return entry.transactionId; }));
      return values.filter(function (record) {
        return record && record.state === 'COMMITTED' && !seen.has(record.transactionId);
      }).sort(function (a, b) { return a.authoritySequence - b.authoritySequence; });
    }

    async function markProjected(transactionId) {
      var database = await db();
      var tx = strictTransaction(database, [PROJECTIONS], 'readwrite');
      tx.objectStore(PROJECTIONS).put({ transactionId: transactionId });
      await transactionComplete(tx);
      return true;
    }

    async function listRecords() {
      var database = await db();
      var tx = database.transaction([RECORDS], 'readonly');
      var values = await requestResult(tx.objectStore(RECORDS).getAll());
      await transactionComplete(tx);
      return values.sort(function (a, b) {
        var left = Number.isSafeInteger(a.authoritySequence) ? a.authoritySequence : Number.MAX_SAFE_INTEGER;
        var right = Number.isSafeInteger(b.authoritySequence) ? b.authoritySequence : Number.MAX_SAFE_INTEGER;
        return left - right;
      });
    }

    return Object.freeze({
      listPrepared: listPrepared,
      putPrepared: putPrepared,
      terminalize: terminalize,
      get: get,
      listUnprojectedCommitted: listUnprojectedCommitted,
      markProjected: markProjected,
      listRecords: listRecords
    });
  }

  function createNavigatorLock(navigatorObject, name) {
    var nav = navigatorObject || (typeof navigator !== 'undefined' ? navigator : null);
    var lockName = name || LOCK_NAME;
    return async function withLock(callback) {
      if (!nav || !nav.locks || typeof nav.locks.request !== 'function') {
        throw new Error('WEB_LOCKS_UNAVAILABLE');
      }
      return nav.locks.request(lockName, { mode: 'exclusive' }, callback);
    };
  }

  function createCoordinator(options) {
    options = options || {};
    var core = options.core;
    var store = options.store;
    var withLock = options.withLock;
    var boundary = typeof options.boundary === 'function' ? options.boundary : async function () {};
    if (!core || typeof core.resolvePrepared !== 'function' || typeof core.createTerminal !== 'function') {
      throw new TypeError('roll authority core is required');
    }
    if (!store || typeof store.listPrepared !== 'function' || typeof store.terminalize !== 'function') {
      throw new TypeError('authority store is required');
    }
    if (typeof withLock !== 'function') throw new TypeError('withLock is required');

    async function projectRecord(record, projectTerminal, context) {
      if (typeof projectTerminal !== 'function' || !record) return;
      var projection = await projectTerminal(record, Object.assign({ store: store }, context || {}));
      if (!projection || projection.deferCompletion !== true) {
        await store.markProjected(record.transactionId);
      }
    }

    async function projectPending(projectTerminal, recoveredPreparedId, recoveryMode) {
      if (typeof projectTerminal !== 'function') return;
      var pending = await store.listUnprojectedCommitted();
      for (var index = 0; index < pending.length; index += 1) {
        var record = pending[index];
        await projectRecord(record, projectTerminal, {
          recovered: true,
          recoveredPrepared: Boolean(recoveredPreparedId && record.transactionId === recoveredPreparedId),
          recoveryMode: recoveryMode || 'restore'
        });
      }
    }

    async function terminalizePreparedIfPresent() {
      var prepared = await store.listPrepared();
      core.assertPreparedCardinality(prepared);
      if (prepared.length !== 1) return null;

      await boundary('recovery:prepared', prepared[0]);
      var resolution = core.resolvePrepared(prepared[0]);
      var terminal = await store.terminalize(prepared[0].transactionId, resolution, core.createTerminal);
      await boundary('recovery:terminal', terminal);
      return terminal;
    }

    async function assertPreparedCleared() {
      var remaining = await store.listPrepared();
      core.assertPreparedCardinality(remaining);
      if (remaining.length !== 0) throw new Error('PREPARED_RECOVERY_INCOMPLETE');
    }

    async function recoverLocked(projectTerminal) {
      var terminal = await terminalizePreparedIfPresent();
      var recoveredPreparedId = terminal && terminal.state === 'COMMITTED'
        ? terminal.transactionId
        : null;
      await projectPending(projectTerminal, recoveredPreparedId, 'restore');
      await assertPreparedCleared();
    }

    async function recoverBeforeCommitLocked(projectTerminal) {
      var terminal = await terminalizePreparedIfPresent();
      if (terminal && terminal.state === 'COMMITTED') {
        await projectRecord(terminal, projectTerminal, {
          recovered: true,
          recoveredPrepared: true,
          recoveryMode: 'pre-commit'
        });
      }
      await assertPreparedCleared();

      // A pre-existing COMMITTED that has not crossed reveal belongs to another
      // live or not-yet-restored presentation. Do not silently turn it into a
      // Trail step merely because this tab wants another draw. Explicit recover()
      // is the operation that crosses a crash/restoration gap.
      var pending = await store.listUnprojectedCommitted();
      if (pending.length) throw new Error('UNREVEALED_COMMIT_PENDING');
    }

    async function recover(projectTerminal) {
      return withLock(function () { return recoverLocked(projectTerminal); });
    }

    async function commit(createPrepared, projectTerminal) {
      if (typeof createPrepared !== 'function') throw new TypeError('createPrepared is required');
      return withLock(async function () {
        await recoverBeforeCommitLocked(projectTerminal);
        var prepared = await createPrepared();
        await store.putPrepared(prepared);
        core.assertPreparedCardinality(await store.listPrepared());
        await boundary('prepared', prepared);

        var resolution = core.resolvePrepared(prepared);
        await boundary('draw-complete', { prepared: prepared, resolution: resolution });

        var terminal = await store.terminalize(prepared.transactionId, resolution, core.createTerminal);
        await boundary('terminal', terminal);

        if (terminal.state === 'COMMITTED' && typeof projectTerminal === 'function') {
          await projectRecord(terminal, projectTerminal, {
            recovered: false,
            recoveredPrepared: false,
            recoveryMode: null
          });
        }
        core.assertPreparedCardinality(await store.listPrepared());
        return terminal;
      });
    }

    return Object.freeze({
      recover: recover,
      commit: commit
    });
  }

  return Object.freeze({
    DB_NAME: DB_NAME,
    LOCK_NAME: LOCK_NAME,
    createMemoryStore: createMemoryStore,
    createIndexedDbStore: createIndexedDbStore,
    createNavigatorLock: createNavigatorLock,
    createCoordinator: createCoordinator
  });
});
