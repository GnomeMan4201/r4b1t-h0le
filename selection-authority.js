(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.R4B1TSelectionAuthority = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TRANSACTION_VERSION = 'r4b1t-selection-transaction/v1';
  var SAMPLER_ALGORITHM = 'uniform-with-repeat-guard-v1';
  var PRNG = 'mulberry32-v1';
  var MAX_REPEAT_DRAWS = 30;

  function utf8(value) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(value));
    return Buffer.from(String(value), 'utf8');
  }

  function seedToUint32(seed) {
    var bytes = utf8(seed);
    var hash = 2166136261;
    for (var index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSampler(seed) {
    var state = seedToUint32(seed);
    return function nextFloat() {
      state = (state + 0x6d2b79f5) >>> 0;
      var mixed = state;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    var copy = {};
    Object.keys(value).forEach(function (key) { copy[key] = clone(value[key]); });
    return copy;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function assertCorpusRevision(value) {
    if (!/^sha256:[0-9a-f]{64}$/.test(String(value || ''))) {
      throw new TypeError('Corpus revision must be a sha256 identifier');
    }
    return String(value);
  }

  function assertPool(pool) {
    if (!Array.isArray(pool) || pool.length === 0) throw new TypeError('Selection pool must be a non-empty array');
    return pool.map(function (url) {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new TypeError('Selection pool contains an invalid route');
      return url;
    });
  }

  function createSelectionAuthority(options) {
    options = options || {};
    var seed = String(options.seed || '');
    if (!seed) throw new TypeError('Selection authority requires a seed');

    var samplerFactory = typeof options.createSampler === 'function' ? options.createSampler : createSampler;
    var sampler = samplerFactory(seed);
    if (typeof sampler !== 'function') throw new TypeError('Sampler factory must return a function');

    var cursor = 0;
    var sequence = 0;

    function begin(input) {
      input = input || {};
      var action = String(input.action || '').toUpperCase();
      if (!action) throw new TypeError('Selection action is required');
      var constraint = deepFreeze(clone(input.constraint || {}));
      var corpusRevision = assertCorpusRevision(input.corpus_revision);
      var drawStart = cursor;
      var drawCount = 0;
      var committed = false;

      function nextFloat() {
        if (committed) throw new Error('Selection attempt is already committed');
        var value = Number(sampler());
        if (!(value >= 0 && value < 1)) throw new RangeError('Sampler must return a float in [0, 1)');
        cursor += 1;
        drawCount += 1;
        return value;
      }

      function commit(routeUrl) {
        if (committed) throw new Error('Selection attempt commit is single-use');
        if (typeof routeUrl !== 'string' || !/^https?:\/\//i.test(routeUrl)) throw new TypeError('Committed route must be an HTTP(S) URL');
        if (action === 'ROLL' && drawCount < 1) throw new Error('ROLL commit requires at least one sampler draw');
        committed = true;
        sequence += 1;
        return deepFreeze({
          transaction_version: TRANSACTION_VERSION,
          sequence: sequence,
          action: action,
          constraint: constraint,
          corpus_revision: corpusRevision,
          sampler: {
            algorithm: SAMPLER_ALGORITHM,
            prng: PRNG,
            seed: seed,
            draw_start: drawStart,
            draw_count: drawCount
          },
          route: { url: routeUrl }
        });
      }

      return Object.freeze({
        nextFloat: nextFloat,
        commit: commit,
        drawStart: function () { return drawStart; },
        drawCount: function () { return drawCount; }
      });
    }

    function selectRoll(input) {
      input = input || {};
      var pool = assertPool(input.pool);
      var previous = typeof input.prior_url === 'string' ? input.prior_url : null;
      var attempt = begin({
        action: 'ROLL',
        constraint: input.constraint,
        corpus_revision: input.corpus_revision
      });
      var selected = null;
      var draws = 0;
      do {
        selected = pool[Math.floor(attempt.nextFloat() * pool.length)];
        draws += 1;
        if (selected !== previous) break;
      } while (draws < MAX_REPEAT_DRAWS);
      return attempt.commit(selected);
    }

    return Object.freeze({
      begin: begin,
      selectRoll: selectRoll,
      seed: function () { return seed; },
      cursor: function () { return cursor; }
    });
  }

  return Object.freeze({
    TRANSACTION_VERSION: TRANSACTION_VERSION,
    SAMPLER_ALGORITHM: SAMPLER_ALGORITHM,
    PRNG: PRNG,
    MAX_REPEAT_DRAWS: MAX_REPEAT_DRAWS,
    createSampler: createSampler,
    createSelectionAuthority: createSelectionAuthority
  });
});
