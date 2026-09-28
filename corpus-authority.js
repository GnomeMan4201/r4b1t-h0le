(function (root, factory) {
  'use strict';

  var api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.R4b1tCorpusAuthority = api;
  }
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  var activeSource = Object.freeze({
    id: 'typed-candidate-v0.1',
    releaseId: 'typed-candidate-v0.1',
    url: 'corpus/releases/typed-candidate-v0.1/urls.txt',
    resourcesUrl: 'corpus/releases/typed-candidate-v0.1/resources.json',
    manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json',
    expectedDigest: 'sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1',
    promotionId: 'typed-candidate-v0.1-active-v1',
    status: 'active',
    selectionAuthority: true
  });

  var candidateSource = Object.freeze({
    id: 'typed-candidate-v0.1',
    url: 'corpus/releases/typed-candidate-v0.1/urls.txt',
    resourcesUrl: 'corpus/releases/typed-candidate-v0.1/resources.json',
    manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json',
    expectedDigest: 'sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1',
    status: 'candidate',
    selectionAuthority: false
  });

  var legacySource = Object.freeze({
    id: 'legacy-urls-v1',
    url: 'urls.txt',
    expectedDigest: 'sha256:5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41',
    status: 'rollback',
    selectionAuthority: false
  });

  var promotionDescriptor = Object.freeze({
    id: 'typed-candidate-v0.1-active-v1',
    schema: 'r4b1t-runtime-corpus-promotion-v1',
    sourceId: 'typed-candidate-v0.1',
    releaseId: 'typed-candidate-v0.1',
    expectedDigest: activeSource.expectedDigest,
    releaseSelectionAuthority: false,
    runtimeSelectionAuthority: true,
    rollbackSourceId: 'legacy-urls-v1',
    fallback: 'none'
  });

  var activeLoadPromise = null;

  function active() {
    return activeSource;
  }

  function candidate() {
    return candidateSource;
  }

  function legacy() {
    return legacySource;
  }

  function promotion() {
    return promotionDescriptor;
  }

  function activeFetchUrl(tag) {
    var value = String(tag || '').trim();
    if (!value) return activeSource.url;
    return activeSource.url + '?v=' + encodeURIComponent(value);
  }

  function runtimeFetch(options) {
    if (options && typeof options.fetch === 'function') return options.fetch;
    if (root && typeof root.fetch === 'function') return root.fetch.bind(root);
    if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
      return globalThis.fetch.bind(globalThis);
    }
    throw new Error('Corpus fetch unavailable');
  }

  function runtimeCrypto(options) {
    if (options && options.crypto && options.crypto.subtle) return options.crypto;
    if (root && root.crypto && root.crypto.subtle) return root.crypto;
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto;
    }
    throw new Error('Corpus digest unavailable');
  }

  function runtimeTextDecoder() {
    if (root && typeof root.TextDecoder === 'function') return root.TextDecoder;
    if (typeof TextDecoder === 'function') return TextDecoder;
    throw new Error('UTF-8 decoder unavailable');
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  async function digestBytes(bytes, options) {
    var cryptoApi = runtimeCrypto(options);
    var digest = await cryptoApi.subtle.digest(
      'SHA-256',
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    );
    return 'sha256:' + toHex(digest);
  }

  function parseUrls(text) {
    var urls = text.split(/\r?\n/).map(function (value) {
      return value.trim();
    }).filter(function (value) {
      if (!value) return false;
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

    if (!urls.length) throw new Error('Corpus contains no usable routes');
    return Object.freeze(urls);
  }

  async function loadSource(source, options) {
    var fetchImpl = runtimeFetch(options);
    var response = await fetchImpl(activeFetchUrl('shared-v1'), {
      cache: 'no-store'
    });
    if (!response || !response.ok) {
      throw new Error('Corpus unavailable');
    }

    var bytes = new Uint8Array(await response.arrayBuffer());
    var revision = await digestBytes(bytes, options);
    if (revision !== source.expectedDigest) {
      throw new Error(
        'Corpus digest mismatch: expected ' +
        source.expectedDigest +
        ', got ' +
        revision
      );
    }

    var Decoder = runtimeTextDecoder();
    var text;
    try {
      text = new Decoder('utf-8', { fatal: true }).decode(bytes);
    } catch (_) {
      throw new Error('Corpus is not valid UTF-8');
    }

    return Object.freeze({
      source: source,
      revision: revision,
      urls: parseUrls(text),
      byteLength: bytes.byteLength
    });
  }

  function loadActive(options) {
    if (activeLoadPromise) return activeLoadPromise;

    activeLoadPromise = loadSource(activeSource, options).catch(function (error) {
      activeLoadPromise = null;
      throw error;
    });

    return activeLoadPromise;
  }

  return Object.freeze({
    schema: 'r4b1t-runtime-corpus-authority-v3',
    active: active,
    candidate: candidate,
    legacy: legacy,
    promotion: promotion,
    activeFetchUrl: activeFetchUrl,
    loadActive: loadActive
  });
}));
