(function (root, factory) {
  'use strict';

  var exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root && typeof root.fetch === 'function') {
    root.R4b1tCorpusSource = exported.createCorpusSource({
      fetchImpl: root.fetch.bind(root),
      sha256Hex: exported.browserSha256Hex
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var policy = Object.freeze({
    version: 'r4b1t-corpus-source/v1',
    selectionAuthority: 'legacy-urls-v1',
    authority: Object.freeze({
      id: 'legacy-urls-v1',
      url: 'urls.txt?v=authority-v1',
      selectionAuthority: true
    }),
    shadow: Object.freeze({
      id: 'typed-candidate-v0.1',
      url: 'corpus/releases/typed-candidate-v0.1/urls.txt?v=shadow-v1',
      manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json?v=shadow-v1',
      selectionAuthority: false
    })
  });

  function toHex(bytes) {
    return Array.from(new Uint8Array(bytes), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  async function browserSha256Hex(bytes) {
    if (
      typeof crypto === 'undefined' ||
      !crypto.subtle ||
      typeof crypto.subtle.digest !== 'function'
    ) {
      throw new Error('SHA-256 unavailable');
    }
    return toHex(await crypto.subtle.digest('SHA-256', bytes));
  }

  function parseCorpus(bytes) {
    var text = new TextDecoder().decode(bytes);
    var urls = text
      .split(/\r?\n/)
      .map(function (value) { return value.trim(); })
      .filter(function (value) { return Boolean(value); })
      .filter(function (value) {
        try {
          var parsed = new URL(value);
          return (
            (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
            !parsed.username &&
            !parsed.password
          );
        } catch (_) {
          return false;
        }
      });

    if (!urls.length) {
      throw new Error('Corpus contains no usable routes');
    }

    return Object.freeze(urls);
  }

  function createCorpusSource(options) {
    options = options || {};
    var fetchImpl = options.fetchImpl;
    var sha256Hex = options.sha256Hex || browserSha256Hex;

    if (typeof fetchImpl !== 'function') {
      throw new TypeError('Corpus source requires fetch');
    }
    if (typeof sha256Hex !== 'function') {
      throw new TypeError('Corpus source requires SHA-256');
    }

    var authorityPromise = null;
    var shadowPromise = null;

    async function load(source) {
      var response = await fetchImpl(source.url, { cache: 'no-store' });
      if (!response || !response.ok) {
        throw new Error('Corpus unavailable: ' + source.id);
      }

      var bytes = new Uint8Array(await response.arrayBuffer());
      var revision = 'sha256:' + await sha256Hex(bytes);
      var urls = parseCorpus(bytes);

      return Object.freeze({
        source: source,
        revision: revision,
        urls: urls
      });
    }

    function cached(which) {
      if (which === 'authority') {
        if (!authorityPromise) {
          authorityPromise = load(policy.authority).catch(function (error) {
            authorityPromise = null;
            throw error;
          });
        }
        return authorityPromise;
      }

      if (!shadowPromise) {
        shadowPromise = load(policy.shadow).catch(function (error) {
          shadowPromise = null;
          throw error;
        });
      }
      return shadowPromise;
    }

    return Object.freeze({
      policy: policy,
      loadAuthority: function () { return cached('authority'); },
      loadShadow: function () { return cached('shadow'); }
    });
  }

  return Object.freeze({
    policy: policy,
    browserSha256Hex: browserSha256Hex,
    createCorpusSource: createCorpusSource
  });
});
