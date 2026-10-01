(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tBranchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STOP = new Set([
    'http', 'https', 'html', 'www', 'com', 'org', 'net', 'github',
    'index', 'page', 'post', 'blog', 'article', 'read', 'view', 'docs',
    'wiki', 'home', 'main', 'about', 'info', 'site'
  ]);

  function parseHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      var parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      if (parsed.username || parsed.password) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function domainKey(value) {
    var parsed = parseHttpUrl(value);
    if (!parsed) return '';
    var host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'github.com') {
      var parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return (parts[0] + '/' + parts[1]).toLowerCase();
    }
    return host;
  }

  function tokens(value) {
    var parsed = parseHttpUrl(value);
    if (!parsed) return [];
    var host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    var raw = (host + ' ' + parsed.pathname).toLowerCase().split(/[^a-z0-9]+/);
    var seen = new Set();
    var out = [];
    raw.forEach(function (token) {
      if (token.length <= 3 || STOP.has(token) || seen.has(token)) return;
      seen.add(token);
      out.push(token);
    });
    return out;
  }

  function similarity(a, b) {
    var left = tokens(a);
    var right = tokens(b);
    if (!left.length || !right.length) return 0;
    var set = new Set(left);
    var overlap = 0;
    right.forEach(function (token) { if (set.has(token)) overlap += 1; });
    return overlap / (left.length + right.length - overlap);
  }

  function fnv1a32(input) {
    var hash = 0x811c9dc5;
    for (var index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function stableRank(origin, label, candidate) {
    return fnv1a32('r4b1t-branch-v1\n' + origin + '\n' + label + '\n' + candidate);
  }

  function compareRank(origin, label) {
    return function (a, b) {
      var ar = stableRank(origin, label, a.url);
      var br = stableRank(origin, label, b.url);
      if (ar !== br) return ar - br;
      return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
    };
  }

  function compareScoreDesc(origin, label) {
    var rank = compareRank(origin, label);
    return function (a, b) {
      if (a.score !== b.score) return b.score - a.score;
      return rank(a, b);
    };
  }

  function compareScoreAsc(origin, label) {
    var rank = compareRank(origin, label);
    return function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      return rank(a, b);
    };
  }

  function pick(candidates, used, predicate, comparator) {
    var pool = candidates.filter(function (candidate) {
      return !used.has(candidate.url) && predicate(candidate);
    });
    if (!pool.length) return null;
    pool.sort(comparator);
    var selected = pool[0];
    used.add(selected.url);
    return selected;
  }

  function describe(candidate, type, fallback) {
    if (!candidate) return null;
    var reason;
    if (type === 'deeper') {
      reason = candidate.sameScope
        ? 'same scope · strongest URL-token overlap'
        : 'strongest URL-token overlap';
    } else if (type === 'sideways') {
      reason = candidate.score > 0
        ? 'different scope · strongest URL-token overlap'
        : 'different scope · deterministic fallback';
    } else if (type === 'opposite') {
      reason = candidate.score === 0
        ? 'different scope · zero overlap'
        : 'different scope · weakest overlap';
    } else {
      reason = fallback ? 'deterministic release tangent' : 'deterministic release tangent';
    }
    return {
      url: candidate.url,
      domain: candidate.scope,
      type: type,
      reason: reason
    };
  }

  function generate(originUrl, corpusUrls) {
    var origin = parseHttpUrl(originUrl);
    if (!origin || !Array.isArray(corpusUrls)) return [];

    var originText = origin.href;
    var originScope = domainKey(originText);
    var seen = new Set();
    var candidates = [];

    corpusUrls.forEach(function (value) {
      var parsed = parseHttpUrl(value);
      if (!parsed) return;
      var url = parsed.href;
      if (url === originText || seen.has(url)) return;
      seen.add(url);
      var scope = domainKey(url);
      candidates.push({
        url: url,
        scope: scope,
        sameScope: scope === originScope,
        score: similarity(originText, url)
      });
    });

    if (candidates.length < 4) return [];

    var used = new Set();

    var deeper = pick(
      candidates,
      used,
      function (candidate) { return candidate.sameScope; },
      compareScoreDesc(originText, 'deeper')
    ) || pick(
      candidates,
      used,
      function () { return true; },
      compareScoreDesc(originText, 'deeper-fallback')
    );

    var sideways = pick(
      candidates,
      used,
      function (candidate) { return !candidate.sameScope && candidate.score > 0; },
      compareScoreDesc(originText, 'sideways')
    ) || pick(
      candidates,
      used,
      function (candidate) { return !candidate.sameScope; },
      compareRank(originText, 'sideways-fallback')
    );

    var opposite = pick(
      candidates,
      used,
      function (candidate) { return !candidate.sameScope && candidate.score === 0; },
      compareRank(originText, 'opposite')
    ) || pick(
      candidates,
      used,
      function (candidate) { return !candidate.sameScope; },
      compareScoreAsc(originText, 'opposite-fallback')
    );

    var weird = pick(
      candidates,
      used,
      function () { return true; },
      compareRank(originText, 'weird')
    );

    return [
      describe(deeper, 'deeper', !deeper || !deeper.sameScope),
      describe(sideways, 'sideways', !sideways || sideways.score === 0),
      describe(opposite, 'opposite', !opposite || opposite.score !== 0),
      describe(weird, 'weird', true)
    ].filter(Boolean);
  }

  return Object.freeze({
    generate: generate,
    domainKey: domainKey,
    similarity: similarity,
    stableRank: stableRank
  });
});
