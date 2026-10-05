(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4B1TRollAuthorityCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PREPARED_SCHEMA = 'r4b1t-roll-authority-prepared/v1';
  var TERMINAL_SCHEMA = 'r4b1t-roll-authority-terminal/v1';
  var SAMPLER_VERSION = 'uniform-repeat-guard-mulberry32/v1';
  var MAX_DRAWS = 30;
  var SHA256 = /^sha256:[0-9a-f]{64}$/;

  var FAILURE_CODES = Object.freeze({
    CORPUS_SNAPSHOT_UNAVAILABLE: 'CORPUS_SNAPSHOT_UNAVAILABLE',
    EMPTY_ELIGIBLE_SET: 'EMPTY_ELIGIBLE_SET',
    SAMPLER_VERSION_UNAVAILABLE: 'SAMPLER_VERSION_UNAVAILABLE',
    PREPARED_RECORD_INVALID: 'PREPARED_RECORD_INVALID',
    SEED_MATERIAL_INVALID: 'SEED_MATERIAL_INVALID',
    SAMPLER_EXECUTION_FAILURE: 'SAMPLER_EXECUTION_FAILURE'
  });

  function clone(value) {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function assertUrl(url, label) {
    if (typeof url !== 'string' || !url) throw new TypeError((label || 'URL') + ' is invalid');
    var parsed = new URL(url);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
      throw new TypeError((label || 'URL') + ' is invalid');
    }
    return url;
  }

  function createPrepared(input) {
    input = input || {};
    if (typeof input.transactionId !== 'string' || !input.transactionId) throw new TypeError('transactionId is required');
    if (typeof input.trailId !== 'string' || !input.trailId) throw new TypeError('trailId is required');
    if (!Number.isSafeInteger(input.trailSequence) || input.trailSequence < 1) throw new TypeError('trailSequence is invalid');
    if (!SHA256.test(input.corpusDigest || '')) throw new TypeError('corpusDigest is invalid');
    if (typeof input.samplerVersion !== 'string' || !input.samplerVersion) throw new TypeError('samplerVersion is required');
    if (!input.seedSource || typeof input.seedSource !== 'object' || Array.isArray(input.seedSource) ||
        typeof input.seedSource.kind !== 'string' || !input.seedSource.kind) {
      throw new TypeError('seedSource is invalid');
    }
    if (typeof input.seedMaterial !== 'string' || !input.seedMaterial) throw new TypeError('seedMaterial is invalid');
    if (!Number.isSafeInteger(input.drawStart) || input.drawStart < 0) throw new TypeError('drawStart is invalid');
    if (input.repeatGuardReference !== null && typeof input.repeatGuardReference !== 'string') {
      throw new TypeError('repeatGuardReference is invalid');
    }
    if (input.repeatGuardReference !== null) assertUrl(input.repeatGuardReference, 'repeatGuardReference');
    if (input.eligibleSnapshot !== null && !Array.isArray(input.eligibleSnapshot)) {
      throw new TypeError('eligibleSnapshot is invalid');
    }
    if (Array.isArray(input.eligibleSnapshot)) {
      input.eligibleSnapshot.forEach(function (url, index) { assertUrl(url, 'eligibleSnapshot[' + index + ']'); });
    }

    return deepFreeze({
      schema: PREPARED_SCHEMA,
      state: 'PREPARED',
      transactionId: input.transactionId,
      trailId: input.trailId,
      trailSequence: input.trailSequence,
      corpusDigest: input.corpusDigest,
      constraint: clone(input.constraint),
      eligibleSnapshot: input.eligibleSnapshot === null ? null : input.eligibleSnapshot.slice(),
      samplerVersion: input.samplerVersion,
      seedSource: clone(input.seedSource),
      seedMaterial: input.seedMaterial,
      drawStart: input.drawStart,
      repeatGuardReference: input.repeatGuardReference
    });
  }

  function utf8(value) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(String(value));
    var encoded = unescape(encodeURIComponent(String(value)));
    var bytes = new Uint8Array(encoded.length);
    for (var index = 0; index < encoded.length; index += 1) bytes[index] = encoded.charCodeAt(index);
    return bytes;
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

  function failed(code) {
    return Object.freeze({ state: 'FAILED', failureCode: code });
  }

  function resolvePrepared(prepared) {
    if (!prepared || prepared.state !== 'PREPARED' || prepared.schema !== PREPARED_SCHEMA) {
      return failed(FAILURE_CODES.PREPARED_RECORD_INVALID);
    }
    if (prepared.samplerVersion !== SAMPLER_VERSION) {
      return failed(FAILURE_CODES.SAMPLER_VERSION_UNAVAILABLE);
    }
    if (prepared.eligibleSnapshot === null) {
      return failed(FAILURE_CODES.CORPUS_SNAPSHOT_UNAVAILABLE);
    }
    if (!Array.isArray(prepared.eligibleSnapshot)) {
      return failed(FAILURE_CODES.PREPARED_RECORD_INVALID);
    }
    if (!prepared.eligibleSnapshot.length) {
      return failed(FAILURE_CODES.EMPTY_ELIGIBLE_SET);
    }
    if (typeof prepared.seedMaterial !== 'string' || !prepared.seedMaterial) {
      return failed(FAILURE_CODES.SEED_MATERIAL_INVALID);
    }

    try {
      var nextFloat = createSampler(prepared.seedMaterial);
      for (var consumed = 0; consumed < prepared.drawStart; consumed += 1) nextFloat();

      var selected = null;
      var drawCount = 0;
      do {
        selected = prepared.eligibleSnapshot[Math.floor(nextFloat() * prepared.eligibleSnapshot.length)];
        drawCount += 1;
        if (prepared.repeatGuardReference === null || selected !== prepared.repeatGuardReference) break;
      } while (drawCount < MAX_DRAWS);

      return Object.freeze({
        state: 'COMMITTED',
        url: selected,
        drawCount: drawCount
      });
    } catch (_) {
      return failed(FAILURE_CODES.SAMPLER_EXECUTION_FAILURE);
    }
  }

  function createTerminal(prepared, resolution, authoritySequence) {
    if (!prepared || prepared.state !== 'PREPARED') throw new TypeError('PREPARED transaction required');
    if (!Number.isSafeInteger(authoritySequence) || authoritySequence < 1) throw new TypeError('authoritySequence is invalid');
    if (!resolution || (resolution.state !== 'COMMITTED' && resolution.state !== 'FAILED')) {
      throw new TypeError('terminal resolution is invalid');
    }

    var out = {
      schema: TERMINAL_SCHEMA,
      transactionId: prepared.transactionId,
      authoritySequence: authoritySequence,
      state: resolution.state,
      prepared: prepared
    };
    if (resolution.state === 'COMMITTED') {
      out.result = { url: resolution.url, drawCount: resolution.drawCount };
    } else {
      out.failure = { code: resolution.failureCode };
    }
    return deepFreeze(out);
  }

  function assertPreparedCardinality(records) {
    var count = (records || []).filter(function (record) {
      return record && record.state === 'PREPARED';
    }).length;
    if (count > 1) throw new Error('PREPARED_CARDINALITY_VIOLATION');
    return count;
  }

  function normalizeHistory(snapshot) {
    var entries = snapshot && Array.isArray(snapshot.entries)
      ? snapshot.entries.filter(function (id) { return typeof id === 'string' && id; })
      : [];
    var cursor = snapshot && Number.isSafeInteger(snapshot.cursor) ? snapshot.cursor : entries.length - 1;
    if (!entries.length) cursor = -1;
    else cursor = Math.max(0, Math.min(cursor, entries.length - 1));
    return { entries: entries.slice(), cursor: cursor };
  }

  var history = Object.freeze({
    empty: function () { return Object.freeze({ entries: Object.freeze([]), cursor: -1 }); },
    normalize: function (snapshot) {
      var normalized = normalizeHistory(snapshot);
      return Object.freeze({ entries: Object.freeze(normalized.entries), cursor: normalized.cursor });
    },
    push: function (snapshot, transactionId) {
      if (typeof transactionId !== 'string' || !transactionId) throw new TypeError('transactionId is required');
      var current = normalizeHistory(snapshot);
      var entries = current.entries.slice(0, current.cursor + 1);
      entries.push(transactionId);
      return Object.freeze({ entries: Object.freeze(entries), cursor: entries.length - 1 });
    },
    previous: function (snapshot) {
      var current = normalizeHistory(snapshot);
      if (current.cursor > 0) current.cursor -= 1;
      return Object.freeze({ entries: Object.freeze(current.entries), cursor: current.cursor });
    },
    forward: function (snapshot) {
      var current = normalizeHistory(snapshot);
      if (current.cursor >= 0 && current.cursor < current.entries.length - 1) current.cursor += 1;
      return Object.freeze({ entries: Object.freeze(current.entries), cursor: current.cursor });
    },
    current: function (snapshot) {
      var current = normalizeHistory(snapshot);
      return current.cursor >= 0 ? current.entries[current.cursor] : null;
    },
    canPrevious: function (snapshot) {
      return normalizeHistory(snapshot).cursor > 0;
    },
    canForward: function (snapshot) {
      var current = normalizeHistory(snapshot);
      return current.cursor >= 0 && current.cursor < current.entries.length - 1;
    }
  });

  return Object.freeze({
    PREPARED_SCHEMA: PREPARED_SCHEMA,
    TERMINAL_SCHEMA: TERMINAL_SCHEMA,
    SAMPLER_VERSION: SAMPLER_VERSION,
    MAX_DRAWS: MAX_DRAWS,
    FAILURE_CODES: FAILURE_CODES,
    createPrepared: createPrepared,
    resolvePrepared: resolvePrepared,
    createTerminal: createTerminal,
    assertPreparedCardinality: assertPreparedCardinality,
    history: history
  });
});
