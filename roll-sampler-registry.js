(function (root, factory) {
  'use strict';
  var v1 = root && root.R4B1TRollSamplerV1;
  if (typeof module === 'object' && module.exports) v1 = require('./roll-sampler-v1.js');
  var api = factory(v1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4B1TRollSamplerRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (v1) {
  'use strict';

  if (!v1 || typeof v1.version !== 'string' || typeof v1.resolve !== 'function') {
    throw new Error('ROLL_SAMPLER_V1_UNAVAILABLE');
  }

  var table = Object.freeze((function () {
    var out = {};
    out[v1.version] = v1;
    return out;
  })());

  return Object.freeze({
    get: function (version) {
      return Object.prototype.hasOwnProperty.call(table, version) ? table[version] : null;
    },
    versions: function () {
      return Object.freeze(Object.keys(table));
    }
  });
});
