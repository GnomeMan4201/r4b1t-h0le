(function (root, factory) {
  'use strict';
  var commonJs = typeof module === 'object' && module.exports;
  var api = factory(commonJs ? require('./trail-manifest.js') : root && root.R4b1tTrail);
  if (commonJs) module.exports = api;
  if (root) root.R4b1tTrailV03 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (legacy) {
  'use strict';

  if (!legacy) throw new Error('R4b1tTrail v0.1 compatibility API is required');

  var FORMAT = 'r4b1t-trail/v0.3';
  var TRANSACTION_VERSION = 'r4b1t-selection-transaction/v1';
  var SAMPLER_ALGORITHM = 'uniform-with-repeat-guard-v1';
  var PRNG = 'mulberry32-v1';
  var SHA256 = /^sha256:[0-9a-f]{64}$/;

  function assertKeys(value, expected, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
        Object.keys(value).sort().join(',') !== expected.slice().sort().join(',')) {
      throw new TypeError(label + ' contains unsupported fields');
    }
  }

  function assertTimestamp(value) {
    if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
      throw new TypeError('Trail creation time is invalid');
    }
    return value;
  }

  function assertUrl(url) {
    if (typeof url !== 'string' || !url.trim()) throw new TypeError('Route URL must be a non-empty string');
    var parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new TypeError('Route URL must use HTTP or HTTPS');
    }
    if (parsed.username || parsed.password) throw new TypeError('Route URL must not contain credentials');
    return url.trim();
  }

  function cloneCanonical(value) {
    legacy.canonicalJson(value);
    return JSON.parse(JSON.stringify(value));
  }

  function validateConstraint(value) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError('Selection constraint must be a plain object');
    }
    legacy.canonicalJson(value);
  }

  function validateSampler(sampler) {
    assertKeys(sampler, ['algorithm', 'prng', 'seed', 'draw_start', 'draw_count'], 'Transaction sampler');
    if (sampler.algorithm !== SAMPLER_ALGORITHM || sampler.prng !== PRNG ||
        typeof sampler.seed !== 'string' || !sampler.seed) {
      throw new TypeError('Transaction sampler identifiers are invalid');
    }
    if (!Number.isSafeInteger(sampler.draw_start) || sampler.draw_start < 0 ||
        !Number.isSafeInteger(sampler.draw_count) || sampler.draw_count < 1) {
      throw new TypeError('Transaction draw interval is invalid');
    }
  }

  function validateTransaction(transaction) {
    assertKeys(transaction, [
      'transaction_version', 'sequence', 'action', 'constraint',
      'corpus_revision', 'sampler', 'route'
    ], 'Selection transaction');
    if (transaction.transaction_version !== TRANSACTION_VERSION) {
      throw new TypeError('Selection transaction version is invalid');
    }
    if (!Number.isSafeInteger(transaction.sequence) || transaction.sequence < 1) {
      throw new TypeError('Selection transaction sequence is invalid');
    }
    if (transaction.action !== 'ROLL') {
      throw new TypeError('v0.3 currently accepts authoritative ROLL transactions only');
    }
    validateConstraint(transaction.constraint);
    if (!SHA256.test(transaction.corpus_revision || '')) {
      throw new TypeError('Transaction corpus revision is invalid');
    }
    validateSampler(transaction.sampler);
    assertKeys(transaction.route, ['url'], 'Transaction route');
    assertUrl(transaction.route.url);
  }

  function validateManifestShape(manifest) {
    assertKeys(manifest, ['format', 'created_at', 'routes', 'parent'], 'v0.3 manifest');
    if (manifest.format !== FORMAT) throw new TypeError('Unsupported trail format');
    assertTimestamp(manifest.created_at);
    if (!Array.isArray(manifest.routes) || manifest.routes.length < 1) {
      throw new TypeError('v0.3 routes must be a non-empty array');
    }
    if (manifest.parent !== null) {
      throw new TypeError('v0.3 parent lineage is not part of the Phase 3 export contract');
    }

    var priorSequence = 0;
    var priorDrawEnd = -1;
    manifest.routes.forEach(function (route, index) {
      assertKeys(route, ['index', 'route_id', 'url', 'action', 'transaction'], 'v0.3 route');
      if (route.index !== index + 1) throw new TypeError('Route indexes must be contiguous');
      if (!SHA256.test(route.route_id || '')) throw new TypeError('Route ID is invalid at step ' + (index + 1));
      var url = assertUrl(route.url);
      if (route.action !== 'ROLL') throw new TypeError('v0.3 route action must be ROLL');
      validateTransaction(route.transaction);
      if (route.transaction.action !== route.action) throw new TypeError('Transaction action mismatch at step ' + (index + 1));
      if (route.transaction.route.url !== url) throw new TypeError('Transaction route mismatch at step ' + (index + 1));
      if (route.transaction.sequence <= priorSequence) throw new TypeError('Transaction sequence must increase');
      if (priorDrawEnd >= 0 && route.transaction.sampler.draw_start < priorDrawEnd) {
        throw new TypeError('Transaction draw intervals overlap');
      }
      priorSequence = route.transaction.sequence;
      priorDrawEnd = route.transaction.sampler.draw_start + route.transaction.sampler.draw_count;
    });
  }

  async function createManifest(options) {
    options = options || {};
    if (!Array.isArray(options.transactions) || options.transactions.length < 1) {
      throw new TypeError('v0.3 requires committed selection transactions');
    }
    if (options.parent !== null && typeof options.parent !== 'undefined') {
      throw new TypeError('v0.3 parent lineage is not part of the Phase 3 export contract');
    }

    var routes = [];
    for (var index = 0; index < options.transactions.length; index += 1) {
      var transaction = options.transactions[index];
      validateTransaction(transaction);
      var transactionCopy = cloneCanonical(transaction);
      var url = transactionCopy.route.url;
      routes.push({
        index: index + 1,
        route_id: await legacy.routeId(url),
        url: url,
        action: transactionCopy.action,
        transaction: transactionCopy
      });
    }

    var manifest = {
      format: FORMAT,
      created_at: new Date(options.created_at || Date.now()).toISOString(),
      routes: routes,
      parent: null
    };
    validateManifestShape(manifest);
    return manifest;
  }

  async function envelope(manifest) {
    validateManifestShape(manifest);
    return {
      trail_id: 'sha256:' + await legacy.sha256Hex(legacy.canonicalJson(manifest)),
      manifest: manifest
    };
  }

  async function verifyIntegrity(input) {
    var parsed = typeof input === 'string' ? JSON.parse(input) : input;
    assertKeys(parsed, ['trail_id', 'manifest'], 'v0.3 envelope');
    if (!SHA256.test(parsed.trail_id || '')) throw new TypeError('Trail ID is invalid');
    validateManifestShape(parsed.manifest);

    for (var index = 0; index < parsed.manifest.routes.length; index += 1) {
      var route = parsed.manifest.routes[index];
      var expectedRouteId = await legacy.routeId(route.url);
      if (route.route_id !== expectedRouteId) throw new Error('Route ID mismatch at step ' + (index + 1));
    }

    var expected = await envelope(parsed.manifest);
    if (expected.trail_id !== parsed.trail_id) throw new Error('Trail ID mismatch');
    return parsed;
  }

  return Object.freeze({
    FORMAT: FORMAT,
    TRANSACTION_VERSION: TRANSACTION_VERSION,
    SAMPLER_ALGORITHM: SAMPLER_ALGORITHM,
    PRNG: PRNG,
    createManifest: createManifest,
    envelope: envelope,
    verifyIntegrity: verifyIntegrity
  });
});
