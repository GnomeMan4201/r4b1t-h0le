(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.R4B1TRollDisclosure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createRollDisclosureBoundary(options = {}) {
    const createNode = options.createNode;
    const mountNode = options.mountNode;
    if (typeof createNode !== 'function' || typeof mountNode !== 'function') {
      throw new TypeError('createNode and mountNode are required');
    }

    let pending = null;
    let revealedTransactionId = null;

    function commit(transactionId, result) {
      if (transactionId == null || result == null) return false;
      pending = Object.freeze({ transactionId, result });
      return true;
    }

    function reveal(event) {
      if (!pending || !event || event.transactionId !== pending.transactionId) return false;
      if (revealedTransactionId === pending.transactionId) return false;
      const node = createNode(pending.result);
      mountNode(node);
      revealedTransactionId = pending.transactionId;
      pending = null;
      return true;
    }

    function cancel(transactionId) {
      if (!pending || pending.transactionId !== transactionId) return false;
      pending = null;
      return true;
    }

    function snapshot() {
      return Object.freeze({
        hasPendingResult: pending !== null,
        revealedTransactionId
      });
    }

    return Object.freeze({ commit, reveal, cancel, snapshot });
  }

  return Object.freeze({ createRollDisclosureBoundary });
});
