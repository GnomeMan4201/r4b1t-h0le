(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tSelectionV3 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TRANSACTION_VERSION = 'r4b1t-selection-transaction/v3';
  var ALGORITHM = 'site-weighted-two-stage-v1';
  var PRNG = 'mulberry32-u32-v1';
  var MAX_SITE_DRAWS = 30;
  var TWO32 = 4294967296n;
  var MODES = Object.freeze(['UNIFORM_SITE', 'SQRT_DEPTH', 'UNIFORM_URL']);

  function fail(code, detail) {
    var error = new Error(code + (detail ? ': ' + detail : ''));
    error.code = code;
    return error;
  }

  function utf8Bytes(value) {
    var text = String(value);
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text);
    var out = [];
    for (var index = 0; index < text.length; index += 1) {
      var cp = text.codePointAt(index);
      if (cp > 0xffff) index += 1;
      if (cp <= 0x7f) out.push(cp);
      else if (cp <= 0x7ff) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp <= 0xffff) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return out;
  }

  function compareUtf8(left, right) {
    var a = utf8Bytes(left);
    var b = utf8Bytes(right);
    var count = Math.min(a.length, b.length);
    for (var index = 0; index < count; index += 1) {
      if (a[index] < b[index]) return -1;
      if (a[index] > b[index]) return 1;
    }
    return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
  }

  function seedToUint32(seed) {
    var bytes = utf8Bytes(String(seed));
    var hash = 2166136261;
    for (var index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSampler(seed) {
    var state = seedToUint32(seed);
    return function nextUint32() {
      state = (state + 0x6d2b79f5) >>> 0;
      var mixed = state;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return (mixed ^ (mixed >>> 14)) >>> 0;
    };
  }

  function isqrt(value) {
    if (typeof value !== 'bigint' || value < 0n) throw fail('SELECTION_V3_ISQRT_INVALID');
    if (value < 2n) return value;
    var bits = value.toString(2).length;
    var current = 1n << BigInt(Math.ceil(bits / 2));
    while (true) {
      var next = (current + value / current) >> 1n;
      if (next >= current) return current;
      current = next;
    }
  }

  function siteWeight(size, mode) {
    if (!Number.isSafeInteger(size) || size < 1) throw fail('SELECTION_V3_BUCKET_SIZE_INVALID');
    if (mode === 'UNIFORM_SITE') return 1n;
    if (mode === 'UNIFORM_URL') return BigInt(size);
    if (mode === 'SQRT_DEPTH') return isqrt(BigInt(size) << 32n);
    throw fail('SELECTION_V3_WEIGHT_MODE_INVALID', String(mode));
  }

  function prepareSites(urls, siteKey, mode) {
    if (!Array.isArray(urls) || !urls.length) throw fail('SELECTION_V3_ELIGIBLE_URLS_REQUIRED');
    if (typeof siteKey !== 'function') throw fail('SELECTION_V3_SITE_KEY_REQUIRED');
    if (MODES.indexOf(mode) === -1) throw fail('SELECTION_V3_WEIGHT_MODE_INVALID', String(mode));

    var byKey = new Map();
    urls.forEach(function (url) {
      var key = siteKey(url);
      if (typeof key !== 'string' || !key) throw fail('SELECTION_V3_SITE_KEY_INVALID');
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(String(url));
    });

    var groups = Array.from(byKey.keys()).sort(compareUtf8).map(function (key) {
      var bucket = byKey.get(key).slice().sort(compareUtf8);
      return Object.freeze({
        site_key: key,
        urls: Object.freeze(bucket),
        weight: siteWeight(bucket.length, mode)
      });
    });

    var totalWeight = groups.reduce(function (sum, group) {
      return sum + group.weight;
    }, 0n);

    if (totalWeight <= 0n || totalWeight >= TWO32) {
      throw fail('SELECTION_V3_TOTAL_WEIGHT_OUT_OF_RANGE', totalWeight.toString());
    }

    return Object.freeze({
      mode: mode,
      groups: Object.freeze(groups),
      total_weight: totalWeight
    });
  }

  function assertU32(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw fail('SELECTION_V3_U32_INVALID', String(value));
    }
    return value;
  }

  function mapU32(value, total) {
    assertU32(value);
    if (typeof total !== 'bigint' || total <= 0n || total >= TWO32) {
      throw fail('SELECTION_V3_MAP_TOTAL_INVALID');
    }
    return (BigInt(value) * total) >> 32n;
  }

  function resolveSite(prepared, u32) {
    var target = mapU32(u32, prepared.total_weight);
    var cumulative = 0n;
    var index = prepared.groups.length - 1;

    for (var position = 0; position < prepared.groups.length; position += 1) {
      cumulative += prepared.groups[position].weight;
      if (target < cumulative) {
        index = position;
        break;
      }
    }

    return Object.freeze({
      u32: u32,
      target: target,
      index: index,
      group: prepared.groups[index]
    });
  }

  function drawSite(prepared, nextUint32, repeatGuardReference) {
    if (!prepared || !prepared.groups || !prepared.groups.length) {
      throw fail('SELECTION_V3_PREPARED_SITES_REQUIRED');
    }
    if (typeof nextUint32 !== 'function') throw fail('SELECTION_V3_RNG_REQUIRED');

    var guardMode = repeatGuardReference == null
      ? 'none'
      : prepared.groups.length === 1
        ? 'single-site-bypass'
        : 'redraw';

    var draws = 0;
    var selected = null;
    var exhausted = false;

    while (draws < MAX_SITE_DRAWS) {
      selected = resolveSite(prepared, assertU32(nextUint32()));
      draws += 1;

      if (guardMode !== 'redraw' || selected.group.site_key !== repeatGuardReference) break;
      if (draws === MAX_SITE_DRAWS) {
        exhausted = true;
        break;
      }
    }

    return Object.freeze({
      selection: selected,
      site_draw_count: draws,
      repeat_guard: Object.freeze({
        kind: 'site-key',
        reference: repeatGuardReference == null ? null : String(repeatGuardReference),
        max_site_draws: MAX_SITE_DRAWS,
        mode: guardMode,
        exhausted: exhausted
      })
    });
  }

  function normalizeOptions(options) {
    options = options || {};
    if (!Number.isSafeInteger(options.drawStart) || options.drawStart < 0) {
      throw fail('SELECTION_V3_DRAW_START_INVALID');
    }
    if (!Number.isSafeInteger(options.sequence) || options.sequence < 1) {
      throw fail('SELECTION_V3_SEQUENCE_INVALID');
    }
    if (typeof options.seed !== 'string' || !options.seed) throw fail('SELECTION_V3_SEED_INVALID');
    if (typeof options.corpusRevision !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(options.corpusRevision)) {
      throw fail('SELECTION_V3_CORPUS_REVISION_INVALID');
    }
    if (typeof options.pslSha256 !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(options.pslSha256)) {
      throw fail('SELECTION_V3_PSL_DIGEST_INVALID');
    }
    if (typeof options.overridesSha256 !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(options.overridesSha256)) {
      throw fail('SELECTION_V3_OVERRIDE_DIGEST_INVALID');
    }
    return options;
  }

  function select(options) {
    options = normalizeOptions(options);
    var prepared = prepareSites(options.eligibleUrls, options.siteKey, options.weightMode);
    var sampler = createSampler(options.seed);

    for (var consumed = 0; consumed < options.drawStart; consumed += 1) sampler();

    var site = drawSite(prepared, sampler, options.repeatGuardReference == null ? null : options.repeatGuardReference);
    var selected = site.selection;
    var bucket = selected.group.urls;

    var urlDraw = assertU32(sampler());
    var urlIndex = Number(mapU32(urlDraw, BigInt(bucket.length)));
    var url = bucket[urlIndex];

    return Object.freeze({
      transaction_version: TRANSACTION_VERSION,
      sequence: options.sequence,
      action: 'ROLL',
      constraint: options.constraint,
      corpus_revision: options.corpusRevision,
      grouping: Object.freeze({
        algorithm: ALGORITHM,
        site_key_version: 'site-key/v1',
        psl_sha256: options.pslSha256,
        overrides_sha256: options.overridesSha256,
        weight_mode: options.weightMode
      }),
      eligible_url_count: options.eligibleUrls.length,
      eligible_site_count: prepared.groups.length,
      total_site_weight: Number(prepared.total_weight),
      sampler: Object.freeze({
        algorithm: ALGORITHM,
        prng: PRNG,
        seed: options.seed,
        draw_start: options.drawStart,
        draw_count: site.site_draw_count + 1,
        site_draw_count: site.site_draw_count,
        url_draw_count: 1,
        repeat_guard: site.repeat_guard
      }),
      selection: Object.freeze({
        site_draw_u32: selected.u32,
        site_target: Number(selected.target),
        site_index: selected.index,
        site_key: selected.group.site_key,
        site_weight: Number(selected.group.weight),
        site_bucket_size: bucket.length,
        url_draw_u32: urlDraw,
        url_index: urlIndex
      }),
      route: Object.freeze({ url: url })
    });
  }

  function deriveRepeatGuardReference(previousRoll, siteKey) {
    if (previousRoll == null) return null;
    if (typeof siteKey !== 'function') throw fail('SELECTION_V3_SITE_KEY_REQUIRED');
    if (previousRoll.action && previousRoll.action !== 'ROLL') {
      throw fail('SELECTION_V3_PREVIOUS_ROLL_INVALID');
    }
    var route = previousRoll.route;
    if (!route || typeof route.url !== 'string' || !route.url) {
      throw fail('SELECTION_V3_PREVIOUS_ROLL_INVALID');
    }
    return siteKey(route.url);
  }

  function canonicalJson(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw fail('SELECTION_V3_CANONICAL_NUMBER_INVALID');
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      return '{' + Object.keys(value).sort().map(function (key) {
        if (typeof value[key] === 'undefined') throw fail('SELECTION_V3_CANONICAL_UNDEFINED');
        return JSON.stringify(key) + ':' + canonicalJson(value[key]);
      }).join(',') + '}';
    }
    throw fail('SELECTION_V3_CANONICAL_VALUE_INVALID');
  }

  function verifyTransaction(transaction, options) {
    options = Object.assign({}, options || {});
    if (Object.prototype.hasOwnProperty.call(options, 'previousRoll')) {
      options.repeatGuardReference = deriveRepeatGuardReference(options.previousRoll, options.siteKey);
      delete options.previousRoll;
    }
    var expected = select(options);
    if (canonicalJson(transaction) !== canonicalJson(expected)) {
      throw fail('SELECTION_V3_MISMATCH');
    }
    return transaction;
  }

  return Object.freeze({
    TRANSACTION_VERSION: TRANSACTION_VERSION,
    ALGORITHM: ALGORITHM,
    PRNG: PRNG,
    WEIGHT_MODES: MODES,
    MAX_SITE_DRAWS: MAX_SITE_DRAWS,
    seedToUint32: seedToUint32,
    createSampler: createSampler,
    isqrt: isqrt,
    siteWeight: siteWeight,
    prepareSites: prepareSites,
    mapU32: mapU32,
    drawSite: drawSite,
    select: select,
    deriveRepeatGuardReference: deriveRepeatGuardReference,
    canonicalJson: canonicalJson,
    verifyTransaction: verifyTransaction
  });
});
