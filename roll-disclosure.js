(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.R4B1TRollDisclosure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RESULT_ATTR = 'data-roll-result';

  function assertHost(host) {
    if (!host || typeof host.appendChild !== 'function') {
      throw new TypeError('ROLL disclosure host must be a DOM element');
    }
  }

  function createRollDisclosure(options = {}) {
    const host = options.host;
    const documentRef = options.document || (host && host.ownerDocument);
    assertHost(host);
    if (!documentRef || typeof documentRef.createElement !== 'function') {
      throw new TypeError('ROLL disclosure requires a document');
    }

    let pending = null;
    let revealedTransactionId = null;

    function stage(transactionId, result) {
      if (transactionId == null) throw new TypeError('transactionId is required');
      pending = Object.freeze({ transactionId, result });
      return true;
    }

    function clear(transactionId) {
      if (pending && (transactionId == null || pending.transactionId === transactionId)) pending = null;
      return true;
    }

    function reveal(event) {
      if (!pending || !event || event.transactionId !== pending.transactionId) return false;
      if (revealedTransactionId === event.transactionId) return false;

      const node = documentRef.createElement('section');
      node.setAttribute(RESULT_ATTR, '');
      node.setAttribute('data-roll-transaction', String(event.transactionId));
      node.setAttribute('role', 'region');
      node.setAttribute('aria-label', 'ROLL result');

      const result = pending.result || {};
      const domain = documentRef.createElement('div');
      domain.setAttribute('data-roll-result-domain', '');
      domain.textContent = String(result.domain || '');
      node.appendChild(domain);

      const url = documentRef.createElement('div');
      url.setAttribute('data-roll-result-url', '');
      url.textContent = String(result.url || '');
      node.appendChild(url);

      if (result.title) {
        const title = documentRef.createElement('div');
        title.setAttribute('data-roll-result-title', '');
        title.textContent = String(result.title);
        node.appendChild(title);
      }

      host.appendChild(node);
      revealedTransactionId = event.transactionId;
      pending = null;
      return true;
    }

    return Object.freeze({
      stage,
      clear,
      reveal,
      hasPending: () => pending !== null,
      revealedTransactionId: () => revealedTransactionId
    });
  }

  return Object.freeze({ RESULT_ATTR, createRollDisclosure });
});
