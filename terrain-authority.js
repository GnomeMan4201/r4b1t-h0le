(function (root, factory) {
  'use strict';
  var commonJs = typeof module === 'object' && module.exports;
  var api = factory(
    root,
    commonJs ? require('./cj1.js') : root && root.R4b1tCJ1,
    commonJs ? require('./corpus-authority.js') : root && root.R4b1tCorpusAuthority
  );
  if (commonJs) module.exports = api;
  if (root) root.R4b1tTerrainAuthority = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function (root, cj1, defaultCorpusAuthority) {
  'use strict';

  // Terrain authority (TERRAIN_AUTHORITY_CONTRACT.md, ADR 0006).
  // Authority chain: corpus/runtime/active-v1.json → corpus/runtime/eligibility-profiles-v1.json
  // (active profile) → terrain-index bytes whose SHA-256 equals the pinned digest.
  // These constants pin the registry's active profile; claims:verify proves they agree.
  if (!cj1) throw new Error('R4b1tCJ1 is required');

  var PROFILE = Object.freeze({
    registrySchema: 'r4b1t-eligibility-profiles-v1',
    profileId: 'diverse-candidate-v0.2/resource-type-identity-v1',
    mapping: 'resource-type-identity-v1',
    promotionId: 'diverse-candidate-v0.2-active-v1',
    releaseId: 'diverse-candidate-v0.2',
    urlsDigest: 'sha256:ba52be7e2fc9120f3bd1ac2a6bacbc61fc937764e6d4637df8711ec2212bf75c',
    resourcesDigest: 'sha256:529a3bcf10b0933ce92428932035750ae0fe93f1490aaa1a40c1384d7ec57aca',
    indexPath: 'corpus/terrains/diverse-candidate-v0.2/terrain-index-v1.json',
    indexSchema: 'r4b1t-terrain-index-v1',
    expectedIndexDigest: 'sha256:a9bbe4fc56020314a11195c9339fa3a04a14082d6b2f6c259c78be6ee38af5fd'
  });

  var TERRAIN_ID = /^[a-z][a-z0-9_]*$/;
  var SHA256 = /^sha256:[0-9a-f]{64}$/;
  var state = { state: 'LOADING', reason: null };
  var loadPromise = null;

  function fail(code, detail) {
    var error = new Error(code + (detail ? ': ' + detail : ''));
    error.code = code;
    return error;
  }

  function exactKeys(value, keys, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('TERRAIN_INDEX_INVALID', label);
    var actual = Object.keys(value).sort().join(',');
    if (actual !== keys.slice().sort().join(',')) throw fail('TERRAIN_INDEX_INVALID', label + ' keys');
  }

  // Pure structural validation of a parsed index document (contract §2).
  function validateIndexDocument(doc, options) {
    var activeCount = options && options.activeCount;
    var release = options && options.release;
    exactKeys(doc, ['schema', 'release', 'vocabulary', 'terrains'], 'document');
    if (doc.schema !== PROFILE.indexSchema) throw fail('TERRAIN_INDEX_INVALID', 'schema');
    exactKeys(doc.release, ['release_id', 'urls_digest', 'resources_digest'], 'release');
    if (!SHA256.test(doc.release.urls_digest) || !SHA256.test(doc.release.resources_digest)) throw fail('TERRAIN_INDEX_INVALID', 'release digests');
    if (release && (doc.release.release_id !== release.release_id || doc.release.urls_digest !== release.urls_digest ||
        doc.release.resources_digest !== release.resources_digest)) {
      throw fail('TERRAIN_INDEX_BINDING_MISMATCH');
    }
    if (doc.vocabulary !== 'resource-type-identity-v1') throw fail('TERRAIN_INDEX_INVALID', 'vocabulary');
    if (!Array.isArray(doc.terrains) || !doc.terrains.length) throw fail('TERRAIN_INDEX_INVALID', 'terrains');
    var previous = null;
    doc.terrains.forEach(function (terrain, position) {
      var label = 'terrains[' + position + ']';
      exactKeys(terrain, ['id', 'label', 'rule', 'count', 'members'], label);
      if (typeof terrain.id !== 'string' || !TERRAIN_ID.test(terrain.id) || terrain.id === 'all') throw fail('TERRAIN_INDEX_INVALID', label + '.id');
      if (previous !== null && !(previous < terrain.id)) throw fail('TERRAIN_INDEX_INVALID', 'terrains must be sorted by id');
      previous = terrain.id;
      if (terrain.label !== terrain.id.replace(/_/g, ' ').toUpperCase()) throw fail('TERRAIN_INDEX_INVALID', label + '.label');
      exactKeys(terrain.rule, ['resource_type'], label + '.rule');
      if (!Array.isArray(terrain.rule.resource_type) || terrain.rule.resource_type.length !== 1 || terrain.rule.resource_type[0] !== terrain.id) {
        throw fail('TERRAIN_INDEX_INVALID', label + '.rule');
      }
      if (!Array.isArray(terrain.members) || !terrain.members.length) throw fail('TERRAIN_INDEX_INVALID', label + ' is dry');
      if (terrain.count !== terrain.members.length) throw fail('TERRAIN_INDEX_INVALID', label + '.count');
      var last = -1;
      terrain.members.forEach(function (member) {
        if (!Number.isSafeInteger(member) || member <= last) throw fail('TERRAIN_INDEX_INVALID', label + ' members must be strictly ascending');
        if (typeof activeCount === 'number' && member >= activeCount) throw fail('TERRAIN_INDEX_INVALID', label + ' member out of range');
        last = member;
      });
    });
    return true;
  }

  function terrainControlState(input) {
    var authority = input && input.authority;
    var count = input && input.count;
    if (authority !== 'READY') {
      return { armable: false, reason: authority === 'UNAVAILABLE' ? 'TERRAIN AUTHORITY UNAVAILABLE' : 'LOADING', note: null };
    }
    if (!Number.isSafeInteger(count) || count < 1) return { armable: false, reason: '0 ELIGIBLE', note: null };
    return { armable: true, reason: null, note: count === 1 ? 'SINGLE ROUTE' : (count === 2 ? 'ALTERNATES' : null) };
  }

  // A trail-declared digest is evidence of use; only the registry establishes authority.
  // `release` is the complete binding {release_id, urls_digest, resources_digest}; all three must match.
  function classifyBinding(registry, release, indexDigest) {
    if (!registry || registry.schema !== PROFILE.registrySchema || !Array.isArray(registry.profiles)) throw fail('REGISTRY_INVALID');
    if (!release || typeof release.release_id !== 'string' || !release.release_id ||
        !SHA256.test(release.urls_digest || '') || !SHA256.test(release.resources_digest || '')) {
      throw fail('RELEASE_BINDING_INCOMPLETE');
    }
    var forRelease = registry.profiles.filter(function (profile) {
      return profile.release &&
        profile.release.release_id === release.release_id &&
        profile.release.urls_digest === release.urls_digest &&
        profile.release.resources_digest === release.resources_digest;
    });
    if (!forRelease.length) return 'UNREGISTERED_RELEASE';
    for (var position = 0; position < forRelease.length; position += 1) {
      var profile = forRelease[position];
      if (profile.terrain_index && profile.terrain_index.digest === indexDigest) {
        return profile.status === 'active' ? 'AUTHORITATIVE_ACTIVE' : 'AUTHORITATIVE_SUPERSEDED';
      }
    }
    return 'UNREGISTERED_MAP';
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
      Object.freeze(value);
    }
    return value;
  }

  async function verifyIndex(options) {
    var fetchImpl = options.fetch || (root && root.fetch && root.fetch.bind(root)) || (globalThis.fetch && globalThis.fetch.bind(globalThis));
    var cryptoApi = options.crypto || (root && root.crypto) || globalThis.crypto;
    var corpusAuthority = options.corpusAuthority || defaultCorpusAuthority || (root && root.R4b1tCorpusAuthority);
    var Decoder = (root && root.TextDecoder) || TextDecoder;
    var expectedDigest = options.expectedIndexDigest || PROFILE.expectedIndexDigest;
    if (!corpusAuthority) throw fail('TERRAIN_INDEX_UNAVAILABLE', 'corpus authority unavailable');

    var response;
    try {
      response = await fetchImpl(PROFILE.indexPath + '?v=terrain-index-v1', { cache: 'no-store' });
    } catch (_) {
      throw fail('TERRAIN_INDEX_UNAVAILABLE');
    }
    if (!response || !response.ok) throw fail('TERRAIN_INDEX_UNAVAILABLE');
    var bytes = new Uint8Array(await response.arrayBuffer());
    var digest = 'sha256:' + toHex(await cryptoApi.subtle.digest('SHA-256', bytes));
    if (digest !== expectedDigest) throw fail('TERRAIN_INDEX_DIGEST_MISMATCH', digest);

    var text;
    var doc;
    try {
      text = new Decoder('utf-8', { fatal: true }).decode(bytes);
      doc = JSON.parse(text);
    } catch (_) {
      throw fail('TERRAIN_INDEX_NOT_CANONICAL', 'not UTF-8 JSON');
    }
    var canonical;
    try {
      canonical = cj1.serialize(doc) + '\n';
    } catch (_) {
      throw fail('TERRAIN_INDEX_NOT_CANONICAL', 'outside CJ-1');
    }
    if (canonical !== text) throw fail('TERRAIN_INDEX_NOT_CANONICAL');

    var active = corpusAuthority.active();
    var binding = { release_id: active.releaseId, urls_digest: active.expectedDigest, resources_digest: active.expectedResourcesDigest };
    if (binding.urls_digest !== PROFILE.urlsDigest || binding.resources_digest !== PROFILE.resourcesDigest || binding.release_id !== PROFILE.releaseId) {
      throw fail('TERRAIN_INDEX_BINDING_MISMATCH', 'active release is not the pinned profile release');
    }
    var loaded = await corpusAuthority.loadActive();
    validateIndexDocument(doc, { activeCount: loaded.urls.length, release: binding });

    return deepFreeze({
      profileId: PROFILE.profileId,
      schema: doc.schema,
      digest: digest,
      vocabulary: doc.vocabulary,
      release: doc.release,
      terrains: doc.terrains.map(function (terrain) {
        return { id: terrain.id, label: terrain.label, count: terrain.count, members: terrain.members.slice() };
      })
    });
  }

  function loadIndex(options) {
    options = options || {};
    if (options.fresh) return verifyIndex(options);
    if (loadPromise) return loadPromise;
    state = { state: 'LOADING', reason: null };
    loadPromise = verifyIndex(options).then(function (index) {
      state = { state: 'READY', reason: null };
      return index;
    }, function (error) {
      state = { state: 'UNAVAILABLE', reason: (error && error.code) || 'TERRAIN_INDEX_UNAVAILABLE' };
      throw error;
    });
    return loadPromise;
  }

  return Object.freeze({
    schema: 'r4b1t-runtime-terrain-authority-v1',
    profile: function () { return PROFILE; },
    status: function () { return { state: state.state, reason: state.reason }; },
    loadIndex: loadIndex,
    validateIndexDocument: validateIndexDocument,
    terrainControlState: terrainControlState,
    classifyBinding: classifyBinding
  });
});
