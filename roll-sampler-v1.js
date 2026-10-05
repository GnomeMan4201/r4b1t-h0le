(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4B1TRollSamplerV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 'uniform-repeat-guard-mulberry32/v1';

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

  function resolve(input, maxDraws) {
    var nextFloat = createSampler(input.seedMaterial);
    for (var consumed = 0; consumed < input.drawStart; consumed += 1) nextFloat();

    var selected = null;
    var drawCount = 0;
    do {
      selected = input.eligibleSnapshot[Math.floor(nextFloat() * input.eligibleSnapshot.length)];
      drawCount += 1;
      if (input.repeatGuardReference === null || selected !== input.repeatGuardReference) break;
    } while (drawCount < maxDraws);

    return Object.freeze({ url: selected, drawCount: drawCount });
  }

  return Object.freeze({
    version: VERSION,
    createSampler: createSampler,
    resolve: resolve
  });
});
