(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tSiteKeyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SITE_KEY_VERSION = 'site-key/v1';

  function fail(code, detail) {
    var error = new Error(code + (detail ? ': ' + detail : ''));
    error.code = code;
    return error;
  }

  function normalizeHost(host) {
    var value = String(host || '').trim().replace(/\.$/, '');
    if (!value) throw fail('SITE_KEY_HOST_INVALID');
    if (/[^\x00-\x7f]/.test(value)) throw fail('SITE_KEY_HOST_NOT_ASCII');
    return value.toLowerCase();
  }

  function parsePsl(text) {
    if (typeof text !== 'string' || !text) throw fail('SITE_KEY_PSL_INVALID');
    var exact = new Set();
    var wildcard = new Set();
    var exception = new Set();

    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.slice(0, 2) === '//') return;
      var target = exact;
      if (line[0] === '!') {
        target = exception;
        line = line.slice(1);
      } else if (line.slice(0, 2) === '*.') {
        target = wildcard;
        line = line.slice(2);
      }
      target.add(normalizeHost(line));
    });

    if (!exact.size && !wildcard.size && !exception.size) {
      throw fail('SITE_KEY_PSL_EMPTY');
    }

    return Object.freeze({
      exact: exact,
      wildcard: wildcard,
      exception: exception
    });
  }

  function parseOverrides(input) {
    var parsed = typeof input === 'string' ? JSON.parse(input) : input;
    if (!parsed || parsed.schema !== 'r4b1t-site-key-overrides/v1' || !Array.isArray(parsed.rules)) {
      throw fail('SITE_KEY_OVERRIDES_INVALID');
    }

    var rules = parsed.rules.map(function (rule) {
      if (!rule || typeof rule.host !== 'string') throw fail('SITE_KEY_OVERRIDE_INVALID');
      if (rule.kind !== 'path-owner' && rule.kind !== 'at-path-owner') {
        throw fail('SITE_KEY_OVERRIDE_KIND_INVALID', String(rule.kind));
      }
      if (rule.case !== 'lower') throw fail('SITE_KEY_OVERRIDE_CASE_INVALID');
      return Object.freeze({
        host: normalizeHost(rule.host),
        kind: rule.kind,
        case: rule.case
      });
    });

    return Object.freeze({
      schema: parsed.schema,
      rules: Object.freeze(rules)
    });
  }

  function isIpLiteral(host) {
    if (host[0] === '[' && host[host.length - 1] === ']') return true;
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  }

  function registrableDomain(host, psl) {
    var normalized = normalizeHost(host);
    if (isIpLiteral(normalized)) return normalized;
    var labels = normalized.split('.');
    if (labels.length < 2) return normalized;
    if (!psl || !psl.exact || !psl.wildcard || !psl.exception) {
      throw fail('SITE_KEY_PSL_REQUIRED');
    }

    var publicSuffixLabels = 1;
    var exceptionSuffix = null;

    for (var index = 0; index < labels.length; index += 1) {
      var suffix = labels.slice(index).join('.');
      if (psl.exception.has(suffix)) {
        exceptionSuffix = labels.slice(index + 1).join('.');
        break;
      }
      if (psl.exact.has(suffix)) {
        publicSuffixLabels = Math.max(publicSuffixLabels, labels.length - index);
      }
      if (
        index + 1 < labels.length &&
        psl.wildcard.has(labels.slice(index + 1).join('.'))
      ) {
        publicSuffixLabels = Math.max(publicSuffixLabels, labels.length - index);
      }
    }

    if (exceptionSuffix !== null) {
      publicSuffixLabels = exceptionSuffix ? exceptionSuffix.split('.').length : 0;
    }

    if (labels.length <= publicSuffixLabels) return normalized;
    return labels.slice(labels.length - publicSuffixLabels - 1).join('.');
  }

  function validOverrideOwner(host, kind, owner) {
    if (host === 'github.com' && kind === 'path-owner') {
      return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner);
    }
    if (host === 'gitlab.com' && kind === 'path-owner') {
      return /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/.test(owner);
    }
    if (host === 'medium.com' && kind === 'at-path-owner') {
      return /^@[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/.test(owner);
    }
    return false;
  }

  function overrideKey(parsed, normalizedHost, overrides) {
    if (!overrides || !Array.isArray(overrides.rules)) return null;
    var segments = parsed.pathname.split('/').filter(Boolean);

    for (var index = 0; index < overrides.rules.length; index += 1) {
      var rule = overrides.rules[index];
      if (rule.host !== normalizedHost) continue;
      if (!segments.length) return null;

      var owner = segments[0];
      if (!validOverrideOwner(normalizedHost, rule.kind, owner)) return null;
      if (rule.case === 'lower') owner = owner.toLowerCase();
      return normalizedHost + '/' + owner;
    }
    return null;
  }

  function validateRawUrl(raw) {
    var match = String(raw).match(/^https?:\/\/([^\/?#]*)([^?#]*)/i);
    if (!match) throw fail('SITE_KEY_URL_INVALID');

    var authority = match[1];
    var rawPath = match[2] || '';
    if (/[^\x00-\x7f]/.test(authority)) throw fail('SITE_KEY_HOST_NOT_ASCII');
    if (authority.indexOf('%') !== -1 || authority.indexOf('\\') !== -1 ||
        rawPath.indexOf('\\') !== -1) {
      throw fail('SITE_KEY_URL_NOT_CANONICAL');
    }

    var segments = rawPath.split('/');
    for (var index = 0; index < segments.length; index += 1) {
      var dots = segments[index].replace(/%2e/ig, '.');
      if (dots === '.' || dots === '..') throw fail('SITE_KEY_URL_NOT_CANONICAL');
    }
    return raw;
  }

  function siteKey(url, psl, overrides) {
    var raw = validateRawUrl(String(url));
    var parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      throw fail('SITE_KEY_URL_INVALID');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw fail('SITE_KEY_PROTOCOL_INVALID', parsed.protocol);
    }
    if (parsed.username || parsed.password) throw fail('SITE_KEY_CREDENTIALS_FORBIDDEN');

    var host = normalizeHost(parsed.hostname);
    var override = overrideKey(parsed, host, overrides);
    if (override) return override;
    return registrableDomain(host, psl);
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

  function canonicalGroups(urls, psl, overrides) {
    if (!Array.isArray(urls)) throw fail('SITE_KEY_URLS_REQUIRED');
    var byKey = new Map();

    urls.forEach(function (url) {
      var key = siteKey(url, psl, overrides);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(String(url));
    });

    return Object.freeze(Array.from(byKey.keys()).sort(compareUtf8).map(function (key) {
      return Object.freeze({
        site_key: key,
        urls: Object.freeze(byKey.get(key).slice().sort(compareUtf8))
      });
    }));
  }

  return Object.freeze({
    SITE_KEY_VERSION: SITE_KEY_VERSION,
    normalizeHost: normalizeHost,
    parsePsl: parsePsl,
    parseOverrides: parseOverrides,
    registrableDomain: registrableDomain,
    siteKey: siteKey,
    validateRawUrl: validateRawUrl,
    validOverrideOwner: validOverrideOwner,
    compareUtf8: compareUtf8,
    canonicalGroups: canonicalGroups
  });
});
