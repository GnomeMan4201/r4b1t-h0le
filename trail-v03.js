(function (root, factory) {
  'use strict';
  var commonJs = typeof module === 'object' && module.exports;
  var api = factory(
    commonJs ? require('./trail-manifest.js') : root && root.R4b1tTrail,
    commonJs ? require('./cj1.js') : root && root.R4b1tCJ1
  );
  if (commonJs) module.exports = api;
  if (root) root.R4b1tTrailV03 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (trail, cj1) {
  'use strict';

  if (!trail || typeof trail.routeId !== 'function' || typeof trail.sha256Hex !== 'function') {
    throw new Error('R4b1tTrail v0.1 compatibility API is required');
  }
  if (!cj1 || typeof cj1.serialize !== 'function') throw new Error('R4b1tCJ1 is required');

  var FORMAT = 'r4b1t-trail/v0.3';
  var TRANSACTION = 'r4b1t-selection-transaction/v2';
  var SHA256 = /^sha256:[0-9a-f]{64}$/;
  var IMPORT_FORMATS = new Set(['r4b1t-trail/v0.1', 'r4b1t-trail/v0.2', FORMAT]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertKeys(value, expected, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
        Object.keys(value).sort().join(',') !== expected.slice().sort().join(',')) {
      throw new TypeError(label + ' contains unsupported fields');
    }
  }

  function assertSha(value, label) {
    if (!SHA256.test(value || '')) throw new TypeError(label + ' must be a sha256 identifier');
    return value;
  }

  function assertTimestamp(value) {
    if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
      throw new TypeError('Trail creation time is invalid');
    }
    return value;
  }

  function assertUrl(value, label) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(label + ' must be a non-empty URL');
    var parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new TypeError(label + ' must use HTTP or HTTPS');
    }
    if (parsed.username || parsed.password) throw new TypeError(label + ' must not contain credentials');
    return value.trim();
  }

  function normalizeParent(parent) {
    if (parent === null || typeof parent === 'undefined') return null;
    assertKeys(parent, ['trail_id', 'fork_at'], 'Parent');
    assertSha(parent.trail_id, 'Parent trail ID');
    if (!Number.isSafeInteger(parent.fork_at) || parent.fork_at < 0) {
      throw new TypeError('Fork position is invalid');
    }
    return { trail_id: parent.trail_id, fork_at: parent.fork_at };
  }

  function validateConstraint(constraint) {
    assertKeys(constraint, ['terrain', 'terrainIndex', 'protocolPolicy'], 'ROLL constraint');
    if (typeof constraint.terrain !== 'string' || !constraint.terrain) {
      throw new TypeError('ROLL terrain is invalid');
    }

    assertKeys(constraint.protocolPolicy, ['version', 'excludeOnion'], 'ROLL protocol policy');
    if (constraint.protocolPolicy.version !== 1 || typeof constraint.protocolPolicy.excludeOnion !== 'boolean') {
      throw new TypeError('ROLL protocol policy is invalid');
    }

    if (constraint.terrain === 'ALL') {
      if (constraint.terrainIndex !== null) throw new TypeError('ALL terrain must not bind a terrain index');
    } else {
      assertKeys(constraint.terrainIndex, ['schema', 'digest'], 'ROLL terrain index');
      if (constraint.terrainIndex.schema !== 'r4b1t-terrain-index-v1') {
        throw new TypeError('ROLL terrain index schema is invalid');
      }
      assertSha(constraint.terrainIndex.digest, 'ROLL terrain index digest');
    }
  }

  function validateTransaction(transaction, stepRoute, corpusRevision) {
    assertKeys(transaction, [
      'transaction_version', 'sequence', 'action', 'constraint', 'corpus_revision',
      'eligible_count', 'sampler', 'route'
    ], 'ROLL transaction');

    if (transaction.transaction_version !== TRANSACTION || transaction.action !== 'ROLL') {
      throw new TypeError('ROLL transaction version/action is invalid');
    }
    if (!Number.isSafeInteger(transaction.sequence) || transaction.sequence < 1) {
      throw new TypeError('ROLL transaction sequence is invalid');
    }
    if (transaction.corpus_revision !== corpusRevision) {
      throw new Error('ROLL transaction corpus revision mismatch');
    }
    if (!Number.isSafeInteger(transaction.eligible_count) || transaction.eligible_count < 1) {
      throw new TypeError('ROLL eligible count is invalid');
    }

    validateConstraint(transaction.constraint);

    assertKeys(transaction.sampler, [
      'algorithm', 'prng', 'seed', 'draw_start', 'draw_count', 'repeat_guard'
    ], 'ROLL sampler');
    if (transaction.sampler.algorithm !== 'uniform-with-repeat-guard-v1' ||
        transaction.sampler.prng !== 'mulberry32-v1' ||
        typeof transaction.sampler.seed !== 'string' || !transaction.sampler.seed) {
      throw new TypeError('ROLL sampler declaration is invalid');
    }
    if (!Number.isSafeInteger(transaction.sampler.draw_start) || transaction.sampler.draw_start < 0 ||
        !Number.isSafeInteger(transaction.sampler.draw_count) || transaction.sampler.draw_count < 1) {
      throw new TypeError('ROLL sampler interval is invalid');
    }

    assertKeys(transaction.sampler.repeat_guard, ['reference', 'max_draws'], 'ROLL repeat guard');
    if (transaction.sampler.repeat_guard.reference !== null) {
      assertUrl(transaction.sampler.repeat_guard.reference, 'ROLL repeat guard reference');
    }
    if (transaction.sampler.repeat_guard.max_draws !== 30) {
      throw new TypeError('ROLL repeat guard max_draws is invalid');
    }

    assertKeys(transaction.route, ['url'], 'ROLL transaction route');
    var transactionUrl = assertUrl(transaction.route.url, 'ROLL transaction route URL');
    if (transactionUrl !== stepRoute.url) throw new Error('ROLL transaction route mismatch');
  }

  async function validateRoute(route, stepIndex) {
    assertKeys(route, ['route_id', 'url'], 'Step route');
    var url = assertUrl(route.url, 'Step route URL');
    var expected = await trail.routeId(url);
    if (route.route_id !== expected) throw new Error('Route ID mismatch at step ' + stepIndex);
  }

  function validateImportedSource(source) {
    assertKeys(source, ['format', 'trail_id', 'step_index'], 'IMPORTED source');
    if (!IMPORT_FORMATS.has(source.format)) throw new TypeError('IMPORTED source format is unsupported');
    assertSha(source.trail_id, 'IMPORTED source trail ID');
    if (!Number.isSafeInteger(source.step_index) || source.step_index < 1) {
      throw new TypeError('IMPORTED source step index is invalid');
    }
  }

  async function validateManifest(manifest) {
    assertKeys(manifest, ['format', 'created_at', 'corpus_revision', 'steps', 'parent'], 'Trail v0.3 manifest');
    if (manifest.format !== FORMAT) throw new TypeError('Unsupported trail format');
    assertTimestamp(manifest.created_at);
    assertSha(manifest.corpus_revision, 'Corpus revision');
    if (!Array.isArray(manifest.steps)) throw new TypeError('Trail steps must be an array');
    var parent = normalizeParent(manifest.parent);
    if (parent && parent.fork_at > manifest.steps.length) {
      throw new TypeError('Fork position exceeds child step prefix');
    }

    // CJ-1 is part of the v0.3 identity contract, not merely an implementation detail.
    cj1.check(manifest);

    var rollSequence = 0;
    var rollCursor = 0;
    var rollSeed = null;
    var previousRollUrl = null;

    for (var index = 0; index < manifest.steps.length; index += 1) {
      var step = manifest.steps[index];
      if (!step || step.index !== index + 1) throw new Error('Step indexes must be contiguous');
      if (typeof step.kind !== 'string') throw new TypeError('Step kind is invalid at step ' + (index + 1));

      if (step.kind === 'ROLL') {
        assertKeys(step, ['index', 'kind', 'route', 'transaction'], 'ROLL step');
        await validateRoute(step.route, step.index);
        validateTransaction(step.transaction, step.route, manifest.corpus_revision);

        rollSequence += 1;
        var sampler = step.transaction.sampler;
        var expectedReference = previousRollUrl;
        if (step.transaction.sequence !== rollSequence ||
            sampler.draw_start !== rollCursor ||
            sampler.repeat_guard.reference !== expectedReference ||
            (rollSeed !== null && sampler.seed !== rollSeed)) {
          throw new Error('ROLL continuity mismatch at step ' + step.index);
        }
        if (rollSeed === null) rollSeed = sampler.seed;
        rollCursor += sampler.draw_count;
        previousRollUrl = step.route.url;
        continue;
      }

      if (step.kind === 'SELECT') {
        assertKeys(step, ['index', 'kind', 'route'], 'SELECT step');
        await validateRoute(step.route, step.index);
        continue;
      }

      if (step.kind === 'BRANCH') {
        assertKeys(step, ['index', 'kind', 'route', 'navigation'], 'BRANCH step');
        await validateRoute(step.route, step.index);
        assertKeys(step.navigation, ['from_step', 'branch_label'], 'BRANCH navigation');
        if (!Number.isSafeInteger(step.navigation.from_step) || step.navigation.from_step < 1 ||
            step.navigation.from_step >= step.index) {
          throw new Error('BRANCH source step must refer to an earlier step');
        }
        if (typeof step.navigation.branch_label !== 'string' || !step.navigation.branch_label.trim()) {
          throw new TypeError('BRANCH label is invalid');
        }
        continue;
      }

      if (step.kind === 'IMPORTED') {
        assertKeys(step, ['index', 'kind', 'route', 'source'], 'IMPORTED step');
        await validateRoute(step.route, step.index);
        validateImportedSource(step.source);
        continue;
      }

      throw new TypeError('Unsupported step kind at step ' + step.index);
    }

    if (parent) {
      for (var prefix = 0; prefix < parent.fork_at; prefix += 1) {
        var inherited = manifest.steps[prefix];
        if (!inherited || inherited.kind !== 'IMPORTED' ||
            inherited.source.trail_id !== parent.trail_id ||
            inherited.source.step_index !== prefix + 1) {
          throw new Error('Fork prefix must be explicitly IMPORTED from the declared parent');
        }
      }
    }

    return manifest;
  }

  async function envelope(manifestInput) {
    var manifest = clone(manifestInput);
    await validateManifest(manifest);
    return {
      trail_id: 'sha256:' + await trail.sha256Hex(cj1.serialize(manifest)),
      manifest: manifest
    };
  }

  async function verify(input) {
    var parsed = typeof input === 'string' ? JSON.parse(input) : clone(input);
    assertKeys(parsed, ['trail_id', 'manifest'], 'Trail v0.3 envelope');
    assertSha(parsed.trail_id, 'Trail ID');
    await validateManifest(parsed.manifest);
    var expected = await envelope(parsed.manifest);
    if (parsed.trail_id !== expected.trail_id) throw new Error('Trail ID mismatch');
    return parsed;
  }

  async function verifyLineage(childInput, parentInput) {
    var child = await verify(childInput);
    var parent = await verify(parentInput);
    var declaration = child.manifest.parent;
    if (!declaration) throw new TypeError('Child trail does not declare a parent');
    if (declaration.trail_id !== parent.trail_id) throw new Error('Parent trail ID mismatch');
    if (declaration.fork_at > parent.manifest.steps.length) {
      throw new Error('Fork position exceeds parent steps');
    }

    for (var index = 0; index < declaration.fork_at; index += 1) {
      var inherited = child.manifest.steps[index];
      var parentStep = parent.manifest.steps[index];
      if (inherited.kind !== 'IMPORTED' ||
          inherited.source.format !== FORMAT ||
          inherited.source.trail_id !== parent.trail_id ||
          inherited.source.step_index !== index + 1 ||
          cj1.serialize(inherited.route) !== cj1.serialize(parentStep.route)) {
        throw new Error('Fork prefix mismatch at step ' + (index + 1));
      }
    }

    return { child: child, parent: parent, fork_at: declaration.fork_at };
  }

  async function importV01(input, options) {
    var source = await trail.verify(input);
    options = options || {};
    var steps = [];
    for (var index = 0; index < source.manifest.routes.length; index += 1) {
      var route = source.manifest.routes[index];
      steps.push({
        index: index + 1,
        kind: 'IMPORTED',
        route: { route_id: route.route_id, url: route.url },
        source: {
          format: 'r4b1t-trail/v0.1',
          trail_id: source.trail_id,
          step_index: index + 1
        }
      });
    }

    return envelope({
      format: FORMAT,
      created_at: new Date(options.created_at || Date.now()).toISOString(),
      corpus_revision: source.manifest.corpus_revision,
      steps: steps,
      parent: null
    });
  }

  return Object.freeze({
    FORMAT: FORMAT,
    TRANSACTION: TRANSACTION,
    validateManifest: validateManifest,
    envelope: envelope,
    verify: verify,
    verifyLineage: verifyLineage,
    importV01: importV01
  });
});
