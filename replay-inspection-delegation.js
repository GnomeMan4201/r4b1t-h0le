(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./proof-session.js') : root && root.R4b1tProofSession,
    isNode ? require('./proof-session-bundle.js') : null,
    isNode ? require('./trail-comparison-bundle.js') : null
  );
  if (isNode) module.exports = api;
  if (root) root.R4b1tReplayInspectionDelegation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (proofSession, proofSessionBundle, trailComparisonBundle) {
  'use strict';

  if (!proofSession || typeof proofSession.build !== 'function') throw new Error('Replay delegation requires Proof Session');
  var FORMAT = 'r4b1t-replay-inspection-delegation/v0.1';

  function cloneJson(value) {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function copyExactInput(input) {
    if (typeof input === 'string') return String(input);
    if (input instanceof Uint8Array) return new Uint8Array(input);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
    throw new TypeError('Replay delegation requires exact source bytes');
  }

  function copyFileSet(bundle) {
    if (!bundle || !bundle.files || typeof bundle.files !== 'object') return { files: {} };
    var files = {};
    Object.keys(bundle.files).forEach(function (name) { files[name] = copyExactInput(bundle.files[name]); });
    return { files: files };
  }

  async function inspectSources(inputs, options) {
    if (!Array.isArray(inputs)) throw new TypeError('Replay multi-source inputs must be an array');
    var projection = await proofSession.build(inputs.map(copyExactInput), options || {});
    return { format: FORMAT, delegate: proofSession.FORMAT, projection: cloneJson(projection) };
  }

  async function inspectProofSession(bundle, options) {
    if (!proofSessionBundle || typeof proofSessionBundle.inspect !== 'function') {
      throw new Error('Portable Proof Session inspection is unavailable in this browser slice');
    }
    var result = await proofSessionBundle.inspect(copyFileSet(bundle), options || {});
    return { format: FORMAT, delegate: proofSession.FORMAT, portable_classification: result.classification, result: cloneJson(result) };
  }

  async function inspectProofSessions(bundles, options) {
    if (!Array.isArray(bundles)) throw new TypeError('Replay portable Proof Session inputs must be an array');
    var results = [];
    for (var index = 0; index < bundles.length; index += 1) results.push(await inspectProofSession(bundles[index], options || {}));
    return results;
  }

  async function inspectTrailComparison(bundle, options) {
    if (!trailComparisonBundle || typeof trailComparisonBundle.inspect !== 'function') {
      throw new Error('Portable Trail Comparison inspection is unavailable in this browser slice');
    }
    var result = await trailComparisonBundle.inspect(copyFileSet(bundle), options || {});
    return { format: FORMAT, delegate: 'r4b1t-trail-comparison/v0.1', result: cloneJson(result) };
  }

  return Object.freeze({
    FORMAT: FORMAT,
    inspectSources: inspectSources,
    inspectProofSession: inspectProofSession,
    inspectProofSessions: inspectProofSessions,
    inspectTrailComparison: inspectTrailComparison
  });
});
