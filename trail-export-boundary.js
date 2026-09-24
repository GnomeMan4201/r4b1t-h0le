(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.R4B1TTrailExportBoundary = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var V01 = 'r4b1t-trail/v0.1';
  var V03 = 'r4b1t-trail/v0.3';

  function legacy(reason) {
    return Object.freeze({ format: V01, reason: reason });
  }

  function choose(input) {
    input = input || {};
    var routes = Array.isArray(input.routes) ? input.routes : [];
    var transactions = Array.isArray(input.transactions) ? input.transactions : [];

    if (input.legacy_boundary) return legacy('legacy-draft-or-non-random-selection');
    if (input.parent) return legacy('legacy-parent-lineage');
    if (!transactions.length) return legacy('no-authoritative-transactions');
    if (routes.some(function (route) { return !route || route.action !== 'ROLL'; })) {
      return legacy('non-random-selection');
    }
    if (routes.length !== transactions.length) return legacy('route-transaction-count-mismatch');

    for (var index = 0; index < transactions.length; index += 1) {
      var transaction = transactions[index];
      var route = routes[index];
      if (!transaction || transaction.transaction_version !== 'r4b1t-selection-transaction/v1' ||
          transaction.action !== 'ROLL' || !transaction.route ||
          transaction.route.url !== route.url) {
        return legacy('unmatched-authoritative-transaction');
      }
    }
    return Object.freeze({ format: V03, reason: 'authoritative-roll-transactions' });
  }

  return Object.freeze({ V01: V01, V03: V03, choose: choose });
});
