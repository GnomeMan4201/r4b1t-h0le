'use strict';

const proofSession = require('./proof-session.js');
const proofSessionBundle = require('./proof-session-bundle.js');
const trailComparisonBundle = require('./trail-comparison-bundle.js');

const FORMAT = 'r4b1t-replay-inspection-delegation/v0.1';

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
  if (!bundle || !bundle.files || typeof bundle.files !== 'object') {
    return { files: {} };
  }

  const files = {};
  Object.keys(bundle.files).forEach((name) => {
    files[name] = copyExactInput(bundle.files[name]);
  });
  return { files };
}

async function inspectSources(inputs, options) {
  if (!Array.isArray(inputs)) throw new TypeError('Replay multi-source inputs must be an array');

  const exactInputs = inputs.map(copyExactInput);
  const projection = await proofSession.build(exactInputs, options || {});

  return {
    format: FORMAT,
    delegate: proofSession.FORMAT,
    projection: cloneJson(projection),
  };
}

async function inspectProofSession(bundle, options) {
  const result = await proofSessionBundle.inspect(copyFileSet(bundle), options || {});
  return {
    format: FORMAT,
    delegate: proofSession.FORMAT,
    portable_classification: result.classification,
    result: cloneJson(result),
  };
}

async function inspectProofSessions(bundles, options) {
  if (!Array.isArray(bundles)) throw new TypeError('Replay portable Proof Session inputs must be an array');

  const results = [];
  for (let index = 0; index < bundles.length; index += 1) {
    results.push(await inspectProofSession(bundles[index], options || {}));
  }
  return results;
}

async function inspectTrailComparison(bundle, options) {
  const result = await trailComparisonBundle.inspect(copyFileSet(bundle), options || {});
  return {
    format: FORMAT,
    delegate: 'r4b1t-trail-comparison/v0.1',
    result: cloneJson(result),
  };
}

module.exports = Object.freeze({
  FORMAT,
  inspectSources,
  inspectProofSession,
  inspectProofSessions,
  inspectTrailComparison,
});
