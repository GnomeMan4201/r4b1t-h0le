'use strict';

const cardCore = require('./trail-card.js');

const SOURCE_FILE = 'source.json';
const CARD_FILE = 'trail-card.json';
const README_FILE = 'README.txt';

function exactBytes(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return new Uint8Array(input);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
  throw new TypeError('Portable Trail Card bundle requires exact source bytes');
}

function utf8(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function readmeFor(card) {
  return [
    'r4b1t Trail Card portable bundle',
    '',
    'Evidence authority: ' + SOURCE_FILE,
    'Presentation only:  ' + CARD_FILE,
    '',
    'Source format: ' + (card.source.artifact_format || 'unreadable'),
    'Source digest: ' + card.source.artifact_digest,
    'Card state:    ' + card.verification.state,
    '',
    'The Trail Card is not evidence authority.',
    'Re-verify source.json with the applicable standalone verifier.',
    'A detached card documents a render-time claim only.',
    ''
  ].join('\n');
}

async function create(sourceInput, options) {
  const sourceBytes = exactBytes(sourceInput);
  const card = await cardCore.project(sourceBytes, options || {});
  const digest = await cardCore.digestOf(sourceBytes);

  if (card.source.artifact_digest !== digest) {
    throw new Error('Portable bundle card digest does not match bundled source bytes');
  }

  return {
    source_bytes: sourceBytes,
    card: JSON.parse(JSON.stringify(card)),
    files: {
      [SOURCE_FILE]: sourceBytes,
      [CARD_FILE]: new TextEncoder().encode(JSON.stringify(card, null, 2) + '\n'),
      [README_FILE]: new TextEncoder().encode(readmeFor(card))
    }
  };
}

async function inspect(bundle, options) {
  if (!bundle || !bundle.files || !bundle.files[SOURCE_FILE] || !bundle.files[CARD_FILE]) {
    throw new TypeError('Portable Trail Card bundle is missing required files');
  }

  const sourceBytes = exactBytes(bundle.files[SOURCE_FILE]);
  let storedCard;
  try {
    storedCard = JSON.parse(utf8(exactBytes(bundle.files[CARD_FILE])));
  } catch (error) {
    throw new Error('Portable Trail Card bundle card projection is unreadable');
  }

  cardCore.validateProjection(storedCard);

  const sourceDigest = await cardCore.digestOf(sourceBytes);
  if (storedCard.source.artifact_digest !== sourceDigest) {
    throw new Error('Portable Trail Card bundle source digest mismatch');
  }

  const fresh = await cardCore.project(sourceBytes, options || {});

  return {
    source_digest: sourceDigest,
    stored_card: storedCard,
    fresh_card: fresh,
    source_matches_stored_card: true,
    fresh_state: fresh.verification.state
  };
}

function fileNames(bundle) {
  if (!bundle || !bundle.files) return [];
  return Object.keys(bundle.files).sort();
}

module.exports = {
  SOURCE_FILE,
  CARD_FILE,
  README_FILE,
  create,
  inspect,
  fileNames
};
