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
    id: 'strange-candidate-v0.3',
    releaseId: 'strange-candidate-v0.3',
    url: 'corpus/releases/strange-candidate-v0.3/urls.txt',
    resourcesUrl: 'corpus/releases/strange-candidate-v0.3/resources.json',
    manifestUrl: 'corpus/releases/strange-candidate-v0.3/manifest.json',
    expectedDigest: 'sha256:f85a1c710977814c920ff13eb95cf0b86805486668c99dba2d5024d6b1bda3a7',
    expectedResourcesDigest: 'sha256:347bf83b013e3eec3aff9301863c6cd3acb62d62db6d39e5fa8c27f4c814dee1',
    expectedResourceCount: 6975,
    promotionId: 'strange-candidate-v0.3-active-v1',
    status: 'active',
    selectionAuthority: true
  });

  var candidateSource = Object.freeze({
    id: 'strange-candidate-v0.3',
    url: 'corpus/releases/strange-candidate-v0.3/urls.txt',
    resourcesUrl: 'corpus/releases/strange-candidate-v0.3/resources.json',
    manifestUrl: 'corpus/releases/strange-candidate-v0.3/manifest.json',
    expectedDigest: 'sha256:f85a1c710977814c920ff13eb95cf0b86805486668c99dba2d5024d6b1bda3a7',
    expectedResourcesDigest: 'sha256:347bf83b013e3eec3aff9301863c6cd3acb62d62db6d39e5fa8c27f4c814dee1',
    expectedResourceCount: 6975,
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
    id: 'strange-candidate-v0.3-active-v1',
    schema: 'r4b1t-runtime-corpus-promotion-v1',
    sourceId: 'strange-candidate-v0.3',
    releaseId: 'strange-candidate-v0.3',
    expectedDigest: activeSource.expectedDigest,
    releaseSelectionAuthority: false,
    runtimeSelectionAuthority: true,
    rollbackSourceId: 'legacy-urls-v1',
    fallback: 'none'
  });

  var activeLoadPromise = null;
  var metadataLoadPromise = null;

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

  function metadataFetchUrl(tag) {
    var value = String(tag || '').trim();
    if (!value) return activeSource.resourcesUrl;
    return activeSource.resourcesUrl + '?v=' + encodeURIComponent(value);
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

  function decodeUtf8(bytes, label) {
    var Decoder = runtimeTextDecoder();
    try {
      return new Decoder('utf-8', { fatal: true }).decode(bytes);
    } catch (_) {
      throw new Error((label || 'Content') + ' is not valid UTF-8');
    }
  }

  function normalizeResourceRecord(record, activeUrls, byUrl) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('Resource metadata record is invalid');
    }

    var url = record.url;
    var resourceType = record.resource_type;
    var provenance = record.provenance;
    var reason = record.eligibility_reason;

    if (typeof url !== 'string' || !activeUrls.has(url)) {
      throw new Error('Resource metadata URL is outside active corpus');
    }
    if (Object.prototype.hasOwnProperty.call(byUrl, url)) {
      throw new Error('Resource metadata contains duplicate URL');
    }
    if (typeof resourceType !== 'string' || !resourceType) {
      throw new Error('Resource metadata type is invalid');
    }
    if (typeof reason !== 'string' || !reason) {
      throw new Error('Resource metadata eligibility reason is invalid');
    }
    if (
      typeof provenance !== 'string' ||
      !/^provenance:sha256:[0-9a-f]{64}$/.test(provenance)
    ) {
      throw new Error('Resource metadata provenance is invalid');
    }

    return Object.freeze({
      url: url,
      resource_type: resourceType,
      provenance: provenance,
      eligibility_reason: reason
    });
  }

  async function loadResourceMetadata(options) {
    if (metadataLoadPromise) return metadataLoadPromise;

    metadataLoadPromise = (async function () {
      var active = await loadActive(options);
      var fetchImpl = runtimeFetch(options);
      var response = await fetchImpl(metadataFetchUrl('resource-meta-v1'), {
        cache: 'no-store'
      });
      if (!response || !response.ok) {
        throw new Error('Resource metadata unavailable');
      }

      var bytes = new Uint8Array(await response.arrayBuffer());
      var digest = await digestBytes(bytes, options);
      if (digest !== activeSource.expectedResourcesDigest) {
        throw new Error(
          'Resource metadata digest mismatch: expected ' +
          activeSource.expectedResourcesDigest +
          ', got ' +
          digest
        );
      }

      var parsed;
      try {
        parsed = JSON.parse(decodeUtf8(bytes, 'Resource metadata'));
      } catch (error) {
        if (error && /UTF-8/.test(String(error.message || error))) throw error;
        throw new Error('Resource metadata JSON is invalid');
      }

      if (
        !parsed ||
        parsed.schema !== 'r4b1t-corpus-resources-v1' ||
        parsed.release_id !== activeSource.releaseId ||
        !Array.isArray(parsed.resources)
      ) {
        throw new Error('Resource metadata document is invalid');
      }
      if (parsed.resources.length !== activeSource.expectedResourceCount) {
        throw new Error('Resource metadata count mismatch');
      }

      var activeUrls = new Set(active.urls);
      var byUrl = {};
      parsed.resources.forEach(function (record) {
        var normalized = normalizeResourceRecord(record, activeUrls, byUrl);
        byUrl[normalized.url] = normalized;
      });

      if (Object.keys(byUrl).length !== active.urls.length) {
        throw new Error('Resource metadata does not cover active corpus');
      }

      return Object.freeze({
        releaseId: parsed.release_id,
        digest: digest,
        count: parsed.resources.length,
        byUrl: Object.freeze(byUrl)
      });
    }()).catch(function (error) {
      metadataLoadPromise = null;
      throw error;
    });

    return metadataLoadPromise;
  }

  async function resourceFor(url, options) {
    if (typeof url !== 'string' || !url) return null;
    var metadata = await loadResourceMetadata(options);
    return metadata.byUrl[url] || null;
  }

  return Object.freeze({
    schema: 'r4b1t-runtime-corpus-authority-v3',
    active: active,
    candidate: candidate,
    legacy: legacy,
    promotion: promotion,
    activeFetchUrl: activeFetchUrl,
    loadActive: loadActive,
    loadResourceMetadata: loadResourceMetadata,
    resourceFor: resourceFor
  });
}));
