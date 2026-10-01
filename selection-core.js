(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tSelectionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Eligibility core (TERRAIN_AUTHORITY_CONTRACT.md §6, ADR 0006 §4).
  // Pure: the eligible pool depends only on the verified active URL array, the
  // verified terrain index, and the captured selection constraint. Nothing
  // rendered, fetched after load, or observed in the session participates.

  function fail(code, detail) {
    var error = new Error(code + (detail ? ': ' + detail : ''));
    error.code = code;
    return error;
  }

  function eligiblePool(activeUrls, index, constraint) {
    if (!activeUrls || typeof activeUrls.length !== 'number') throw fail('ACTIVE_CORPUS_REQUIRED');
    if (!constraint || typeof constraint.terrain !== 'string') throw fail('CONSTRAINT_INVALID', 'terrain');
    if (!constraint.protocolPolicy || constraint.protocolPolicy.version !== 1) throw fail('CONSTRAINT_INVALID', 'protocolPolicy');
    var base;
    if (constraint.terrain === 'ALL') {
      base = Array.prototype.slice.call(activeUrls);
    } else {
      if (!index || !Array.isArray(index.terrains)) throw fail('TERRAIN_INDEX_REQUIRED', constraint.terrain);
      var terrain = null;
      for (var position = 0; position < index.terrains.length; position += 1) {
        if (index.terrains[position].id === constraint.terrain) { terrain = index.terrains[position]; break; }
      }
      if (!terrain) throw fail('TERRAIN_UNKNOWN', constraint.terrain);
      base = terrain.members.map(function (line) { return activeUrls[line]; });
    }
    if (constraint.protocolPolicy.excludeOnion) {
      base = base.filter(function (url) { return !url.includes('.onion'); });
    }
    return base;
  }

  return Object.freeze({ schema: 'r4b1t-selection-core-v1', eligiblePool: eligiblePool });
});
