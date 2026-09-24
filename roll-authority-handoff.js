(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.R4B1TRollAuthorityHandoff = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function commit(authority, recordCommittedTransaction, input) {
    if (!authority || typeof authority.selectRoll !== 'function') throw new TypeError('ROLL selection authority is required');
    if (typeof recordCommittedTransaction !== 'function') throw new TypeError('Trail transaction recorder is required');
    var transaction = authority.selectRoll(input || {});
    if (!transaction) return null;
    if (recordCommittedTransaction(transaction) !== true) return null;
    return transaction;
  }

  return Object.freeze({ commit: commit });
});
