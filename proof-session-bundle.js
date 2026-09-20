(function (root, factory) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(
    isNode ? require('./trail-manifest.js') : root && root.R4b1tTrail,
    isNode ? require('./trail-comparison.js') : root && root.R4b1tTrailComparison,
    isNode ? require('./proof-session.js') : root && root.R4b1tProofSession
  );
  if (isNode) module.exports = api;
  if (root) root.R4b1tProofSessionBundle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (trail, comparison, session) {
'use strict';

if (!trail || !comparison || !session) throw new Error('Proof Session bundle requires frozen proof delegates');

const SESSION_FILE = 'proof-session.json';
const README_FILE = 'README.txt';
const SOURCE_PREFIX = 'sources/';
const COMPARISON_PREFIX = 'comparisons/';

function exactBytes(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return new Uint8Array(input);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
  throw new TypeError('Portable Proof Session requires exact source bytes');
}

function utf8(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(exactBytes(bytes));
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
}

function digestHex(value) {
  return String(value).replace(/^sha256:/, '');
}

function sourceFileName(source) {
  return SOURCE_PREFIX + source.slot_id + '--sha256-' + digestHex(source.artifact_digest) + '.json';
}

function comparisonFileName(pair) {
  return COMPARISON_PREFIX + pair.left_slot + '--' + pair.right_slot +
    '--sha256-' + digestHex(pair.comparison_projection_digest) + '.json';
}

function readmeFor(projection) {
  return [
    'r4b1t Proof Session portable file set',
    '',
    'Canonical evidence inputs: files under sources/',
    'Derived comparison presentation: files under comparisons/',
    'Derived session presentation: ' + SESSION_FILE,
    'Human documentation only: ' + README_FILE,
    '',
    'Session format: ' + projection.format,
    'Unique sources: ' + projection.sources.length,
    'Verified pairs: ' + projection.pairs.length,
    '',
    'Inspection must freshly verify source bytes and recompute all derived facts before presentation.',
    'Stored comparison and session projections are comparison targets only.',
    'README.txt is non-normative and is never consulted for machine validity.',
    ''
  ].join('\n');
}

async function digestOf(bytes) {
  return 'sha256:' + await trail.sha256Hex(exactBytes(bytes));
}

async function uniqueInputs(inputs) {
  if (!Array.isArray(inputs)) throw new TypeError('Portable Proof Session inputs must be an array');
  const ordered = [];
  const byDigest = new Map();
  for (const input of inputs) {
    const bytes = exactBytes(input);
    const digest = await digestOf(bytes);
    if (!byDigest.has(digest)) {
      const item = { digest, bytes, supplied_count: 1 };
      byDigest.set(digest, item);
      ordered.push(item);
    } else {
      byDigest.get(digest).supplied_count += 1;
    }
  }
  return ordered;
}

async function derive(inputs, options) {
  const verifiedAt = options && options.verified_at;
  const projection = await session.build(inputs.map(exactBytes), { verified_at: verifiedAt });
  const unique = await uniqueInputs(inputs);

  if (unique.length !== projection.sources.length) {
    throw new Error('Portable Proof Session source derivation mismatch');
  }

  const slotBytes = new Map();
  projection.sources.forEach((source, index) => {
    const item = unique[index];
    if (!item || item.digest !== source.artifact_digest) {
      throw new Error('Portable Proof Session source ordering mismatch');
    }
    slotBytes.set(source.slot_id, item.bytes);
  });

  const pairProjections = [];
  for (const pair of projection.pairs) {
    const left = slotBytes.get(pair.left_slot);
    const right = slotBytes.get(pair.right_slot);
    if (!left || !right) throw new Error('Portable Proof Session pair source missing');
    const pairProjection = await comparison.compare(left, right, { verified_at: verifiedAt });
    comparison.validateProjection(pairProjection);
    const digest = await session.digestProjection(pairProjection);
    if (digest !== pair.comparison_projection_digest) {
      throw new Error('Portable Proof Session comparison digest mismatch');
    }
    pairProjections.push(pairProjection);
  }

  return { projection, unique, slotBytes, pairProjections };
}

async function create(inputs, options) {
  const derived = await derive(inputs, options || {});
  const files = {};

  derived.projection.sources.forEach((source, index) => {
    files[sourceFileName(source)] = new Uint8Array(derived.unique[index].bytes);
  });

  derived.projection.pairs.forEach((pair, index) => {
    files[comparisonFileName(pair)] = jsonBytes(derived.pairProjections[index]);
  });

  files[SESSION_FILE] = jsonBytes(derived.projection);
  files[README_FILE] = new TextEncoder().encode(readmeFor(derived.projection));

  return {
    projection: JSON.parse(JSON.stringify(derived.projection)),
    comparisons: derived.pairProjections.map((value) => JSON.parse(JSON.stringify(value))),
    files
  };
}

function fileNames(bundle) {
  if (!bundle || !bundle.files) return [];
  return Object.keys(bundle.files).sort();
}

function parseSourceEntries(bundle) {
  const names = fileNames(bundle).filter((name) => name.startsWith(SOURCE_PREFIX));
  if (!names.length) throw new Error('Portable Proof Session has no source files');

  const parsed = names.map((name) => {
    const match = /^sources\/S([1-9][0-9]*)--sha256-([0-9a-f]{64})\.json$/.exec(name);
    if (!match) throw new Error('Portable Proof Session source filename is invalid');
    return { name, slot: Number(match[1]), named_digest: 'sha256:' + match[2] };
  }).sort((a, b) => a.slot - b.slot);

  parsed.forEach((entry, index) => {
    if (entry.slot !== index + 1) throw new Error('Portable Proof Session source slots are not contiguous');
  });
  return parsed;
}

function semanticSessionProjection(value) {
  session.validateProjection(value);
  const copy = JSON.parse(JSON.stringify(value));
  copy.sources.forEach((source) => {
    source.supplied_count = 1;
    if (source.verification) source.verification.verified_at = null;
  });
  return copy;
}

function semanticEqual(left, right) {
  return trail.canonicalJson(left) === trail.canonicalJson(right);
}

function unreadable(reason, warnings) {
  return {
    classification: 'UNREADABLE',
    reason,
    warnings: warnings || [],
    mismatches: [],
    fresh_projection: null,
    stored_projection: null,
    fresh_comparisons: []
  };
}

async function inspect(bundle, options) {
  const warnings = [];
  if (!bundle || !bundle.files || typeof bundle.files !== 'object') {
    return unreadable('Portable Proof Session file set is missing', warnings);
  }
  if (!bundle.files[README_FILE]) warnings.push('README.txt missing');

  let sourceEntries;
  try {
    sourceEntries = parseSourceEntries(bundle);
  } catch (error) {
    return unreadable(error.message, warnings);
  }

  const sourceBytes = [];
  for (const entry of sourceEntries) {
    if (!bundle.files[entry.name]) return unreadable('Portable Proof Session source file is missing', warnings);
    let bytes;
    try {
      bytes = exactBytes(bundle.files[entry.name]);
      utf8(bytes);
    } catch (error) {
      return unreadable('Portable Proof Session source file is unreadable', warnings);
    }
    sourceBytes.push(bytes);
  }

  const verifiedAt = options && options.verified_at;
  let freshProjection;
  try {
    freshProjection = await session.build(sourceBytes, { verified_at: verifiedAt });
  } catch (error) {
    return unreadable('Portable Proof Session fresh recomputation failed: ' + error.message, warnings);
  }

  const freshComparisons = [];
  const sourceBySlot = new Map();
  freshProjection.sources.forEach((source, index) => sourceBySlot.set(source.slot_id, sourceBytes[index]));

  for (const pair of freshProjection.pairs) {
    const pairProjection = await comparison.compare(
      sourceBySlot.get(pair.left_slot),
      sourceBySlot.get(pair.right_slot),
      { verified_at: verifiedAt }
    );
    comparison.validateProjection(pairProjection);
    freshComparisons.push(pairProjection);
  }

  let storedProjection;
  try {
    if (!bundle.files[SESSION_FILE]) return unreadable('Portable Proof Session stored session projection is missing', warnings);
    storedProjection = JSON.parse(utf8(bundle.files[SESSION_FILE]));
  } catch (error) {
    return unreadable('Portable Proof Session stored session projection is unreadable', warnings);
  }

  const mismatches = [];
  let storedProjectionValid = true;
  try {
    session.validateProjection(storedProjection);
  } catch (error) {
    storedProjectionValid = false;
    mismatches.push(SESSION_FILE);
  }

  if (storedProjectionValid && !semanticEqual(
    semanticSessionProjection(storedProjection),
    semanticSessionProjection(freshProjection)
  )) {
    mismatches.push(SESSION_FILE);
  }

  const expectedComparisonNames = freshProjection.pairs.map(comparisonFileName);
  const actualComparisonNames = fileNames(bundle).filter((name) => name.startsWith(COMPARISON_PREFIX));

  for (const name of actualComparisonNames) {
    if (!expectedComparisonNames.includes(name) && !mismatches.includes(name)) mismatches.push(name);
  }

  for (let index = 0; index < freshProjection.pairs.length; index += 1) {
    const pair = freshProjection.pairs[index];
    const name = comparisonFileName(pair);
    const bytes = bundle.files[name];
    if (!bytes) {
      if (!mismatches.includes(name)) mismatches.push(name);
      continue;
    }

    let storedComparison;
    try {
      storedComparison = JSON.parse(utf8(bytes));
      comparison.validateProjection(storedComparison);
    } catch (error) {
      if (!mismatches.includes(name)) mismatches.push(name);
      continue;
    }

    if (!semanticEqual(
      session.semanticComparisonProjection(storedComparison),
      session.semanticComparisonProjection(freshComparisons[index])
    )) {
      if (!mismatches.includes(name)) mismatches.push(name);
    }
  }

  return {
    classification: mismatches.length ? 'MISMATCH' : 'MATCH',
    reason: null,
    warnings,
    mismatches: mismatches.sort(),
    fresh_projection: freshProjection,
    stored_projection: storedProjection,
    fresh_comparisons: freshComparisons
  };
}

return Object.freeze({
  SESSION_FILE,
  README_FILE,
  SOURCE_PREFIX,
  COMPARISON_PREFIX,
  create,
  inspect,
  derive,
  fileNames,
  sourceFileName,
  comparisonFileName,
  semanticSessionProjection
});
});
