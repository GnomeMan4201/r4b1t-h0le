'use strict';

const comparison = require('./trail-comparison.js');

const LEFT_SOURCE_FILE = 'left-source.json';
const RIGHT_SOURCE_FILE = 'right-source.json';
const PROJECTION_FILE = 'trail-comparison.json';
const README_FILE = 'README.txt';

function exactBytes(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return new Uint8Array(input);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
  throw new TypeError('Portable Trail Comparison bundle requires exact source bytes');
}

function utf8(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function readmeFor(projection) {
  return [
    'r4b1t Trail Comparison portable handoff',
    '',
    'Authority: ' + LEFT_SOURCE_FILE,
    'Authority: ' + RIGHT_SOURCE_FILE,
    'Derived presentation: ' + PROJECTION_FILE,
    '',
    'Left format:  ' + (projection.sources.left.artifact_format || 'unreadable'),
    'Left digest:  ' + projection.sources.left.artifact_digest,
    'Left state:   ' + projection.verification.left.state,
    '',
    'Right format: ' + (projection.sources.right.artifact_format || 'unreadable'),
    'Right digest: ' + projection.sources.right.artifact_digest,
    'Right state:  ' + projection.verification.right.state,
    '',
    'The comparison projection is derived presentation, not evidence authority.',
    'Re-verify both source files and recompute comparison locally.',
    'This handoff does not merge, repair, or replace either canonical source.',
    ''
  ].join('\n');
}

async function create(leftInput, rightInput, options) {
  const leftBytes = exactBytes(leftInput);
  const rightBytes = exactBytes(rightInput);
  const projection = await comparison.compare(leftBytes, rightBytes, options || {});

  const leftDigest = await comparison.digestOf(leftBytes);
  const rightDigest = await comparison.digestOf(rightBytes);

  if (projection.sources.left.artifact_digest !== leftDigest) {
    throw new Error('Portable comparison left digest does not match bundled source bytes');
  }
  if (projection.sources.right.artifact_digest !== rightDigest) {
    throw new Error('Portable comparison right digest does not match bundled source bytes');
  }

  return {
    left_source_bytes: leftBytes,
    right_source_bytes: rightBytes,
    projection: JSON.parse(JSON.stringify(projection)),
    files: {
      [LEFT_SOURCE_FILE]: leftBytes,
      [RIGHT_SOURCE_FILE]: rightBytes,
      [PROJECTION_FILE]: new TextEncoder().encode(JSON.stringify(projection, null, 2) + '\n'),
      [README_FILE]: new TextEncoder().encode(readmeFor(projection))
    }
  };
}

async function inspect(bundle, options) {
  if (!bundle || !bundle.files ||
      !bundle.files[LEFT_SOURCE_FILE] ||
      !bundle.files[RIGHT_SOURCE_FILE] ||
      !bundle.files[PROJECTION_FILE]) {
    throw new TypeError('Portable Trail Comparison bundle is missing required files');
  }

  const leftBytes = exactBytes(bundle.files[LEFT_SOURCE_FILE]);
  const rightBytes = exactBytes(bundle.files[RIGHT_SOURCE_FILE]);

  let storedProjection;
  try {
    storedProjection = JSON.parse(utf8(exactBytes(bundle.files[PROJECTION_FILE])));
  } catch (error) {
    throw new Error('Portable Trail Comparison projection is unreadable');
  }

  comparison.validateProjection(storedProjection);

  const leftDigest = await comparison.digestOf(leftBytes);
  const rightDigest = await comparison.digestOf(rightBytes);

  if (storedProjection.sources.left.artifact_digest !== leftDigest) {
    throw new Error('Portable Trail Comparison left source digest mismatch');
  }
  if (storedProjection.sources.right.artifact_digest !== rightDigest) {
    throw new Error('Portable Trail Comparison right source digest mismatch');
  }

  const fresh = await comparison.compare(leftBytes, rightBytes, options || {});

  return {
    left_source_digest: leftDigest,
    right_source_digest: rightDigest,
    stored_projection: storedProjection,
    fresh_projection: fresh,
    left_source_matches: true,
    right_source_matches: true
  };
}

function fileNames(bundle) {
  if (!bundle || !bundle.files) return [];
  return Object.keys(bundle.files).sort();
}

module.exports = {
  LEFT_SOURCE_FILE,
  RIGHT_SOURCE_FILE,
  PROJECTION_FILE,
  README_FILE,
  create,
  inspect,
  fileNames
};
