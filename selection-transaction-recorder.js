(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.R4B1TSelectionTransactionRecorder = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TRANSACTION_VERSION = 'r4b1t-selection-transaction/v1';

  function assertCommittedRoll(transaction) {
    if (!transaction || transaction.transaction_version !== TRANSACTION_VERSION) {
      throw new TypeError('Committed selection transaction is required');
    }
    if (transaction.action !== 'ROLL') throw new TypeError('Recorder accepts committed ROLL transactions only');
    if (!Number.isSafeInteger(transaction.sequence) || transaction.sequence < 1) throw new TypeError('Transaction sequence is invalid');
    if (!transaction.route || typeof transaction.route.url !== 'string' || !/^https?:\/\//i.test(transaction.route.url)) {
      throw new TypeError('Transaction route is invalid');
    }
    if (!transaction.sampler || typeof transaction.sampler.seed !== 'string') throw new TypeError('Transaction sampler is invalid');
    if (!Object.isFrozen(transaction) || !Object.isFrozen(transaction.route) ||
        !Object.isFrozen(transaction.constraint) || !Object.isFrozen(transaction.sampler)) {
      throw new TypeError('Transaction must be deeply frozen before recording');
    }
    return transaction;
  }

  function identityKey(transaction) {
    return transaction.sampler.seed + ':' + String(transaction.sequence);
  }

  function createRecorder(options) {
    options = options || {};
    if (typeof options.onRecord !== 'function') throw new TypeError('Recorder requires an onRecord callback');
    var seenObjects = new WeakSet();
    var seenIdentities = new Set();

    function record(transaction) {
      transaction = assertCommittedRoll(transaction);
      var key = identityKey(transaction);
      if (seenObjects.has(transaction) || seenIdentities.has(key)) return false;
      seenObjects.add(transaction);
      seenIdentities.add(key);
      try {
        options.onRecord(transaction);
      } catch (error) {
        seenObjects.delete(transaction);
        seenIdentities.delete(key);
        throw error;
      }
      return true;
    }

    return Object.freeze({ record: record });
  }

  return Object.freeze({
    TRANSACTION_VERSION: TRANSACTION_VERSION,
    createRecorder: createRecorder
  });
});
