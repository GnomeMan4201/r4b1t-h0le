(function (root, factory) {
  'use strict';
  var commonJs = typeof module === 'object' && module.exports;
  var api = factory(commonJs ? require('./trail-manifest.js') : root && root.R4b1tTrail);
  if (commonJs) module.exports = api;
  if (root) root.R4b1tCJ1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (trail) {
  'use strict';

  // CJ-1 (docs/CANONICAL_JSON_CJ1.md): the existing trail-manifest canonicalJson
  // output, restricted to a value profile that JavaScript and Python serialize
  // byte-identically. canonicalJson itself is not modified.
  if (!trail || typeof trail.canonicalJson !== 'function') throw new Error('R4b1tTrail canonicalJson is required');

  var KEY = /^[A-Za-z0-9_]+$/;

  function violation(where, detail) {
    var error = new TypeError('CANONICAL_PROFILE_VIOLATION: ' + where + ' ' + detail);
    error.code = 'CANONICAL_PROFILE_VIOLATION';
    return error;
  }

  function hasLoneSurrogate(value) {
    for (var index = 0; index < value.length; index += 1) {
      var code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        var next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) { index += 1; continue; }
        return true;
      }
      if (code >= 0xdc00 && code <= 0xdfff) return true;
    }
    return false;
  }

  function check(value, where) {
    where = where || '$';
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw violation(where, 'number must be a safe integer');
      return;
    }
    if (typeof value === 'string') {
      if (hasLoneSurrogate(value)) throw violation(where, 'string contains a lone surrogate');
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(function (item, index) { check(item, where + '[' + index + ']'); });
      return;
    }
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      Object.keys(value).forEach(function (key) {
        if (!KEY.test(key)) throw violation(where, 'key ' + JSON.stringify(key) + ' is outside [A-Za-z0-9_]');
        check(value[key], where + '.' + key);
      });
      return;
    }
    throw violation(where, 'unsupported value');
  }

  function serialize(value) {
    check(value);
    return trail.canonicalJson(value);
  }

  return Object.freeze({ profile: 'CJ-1', check: check, serialize: serialize });
});
