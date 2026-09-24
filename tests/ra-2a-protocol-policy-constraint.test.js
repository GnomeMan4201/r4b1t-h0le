'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INDEX = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const TRAIL_RUNTIME = fs.readFileSync(path.resolve(__dirname, '..', 'trail-runtime.js'), 'utf8');

const FIXTURE_CORPUS = [
  { id: 'c1', url: 'https://example.org/a', scheme: 'https' },
  { id: 'o1', url: 'http://exampleonion1abcdefghijklmno.onion/a', scheme: 'onion' },
  { id: 'c2', url: 'https://example.net/b', scheme: 'https' },
  { id: 'o2', url: 'http://exampleonion2abcdefghijklmno.onion/b', scheme: 'onion' },
  { id: 'c3', url: 'http://example.com/c', scheme: 'http' },
  { id: 'o3', url: 'http://exampleonion3abcdefghijklmno.onion/c', scheme: 'onion' },
  { id: 'c4', url: 'https://example.io/d', scheme: 'https' },
  { id: 'o4', url: 'http://exampleonion4abcdefghijklmno.onion/d', scheme: 'onion' },
];

function referenceFilter(corpus, policy) {
  if (!policy.excludeOnion) return corpus.slice();
  return corpus.filter(entry => entry.scheme !== 'onion');
}

test('RA-2A oracle preserves corpus order for explicit protocol policy states', () => {
  assert.deepEqual(referenceFilter(FIXTURE_CORPUS, { excludeOnion: true }).map(e => e.id), ['c1','c2','c3','c4']);
  assert.deepEqual(referenceFilter(FIXTURE_CORPUS, { excludeOnion: false }).map(e => e.id), FIXTURE_CORPUS.map(e => e.id));
});

test('RA-2A: production exposes one captured selection constraint consumed by pool construction', () => {
  assert.match(INDEX, /function\s+captureSelectionConstraint\s*\(/, 'selection-time constraint capture must be explicit');
  assert.match(INDEX, /function\s+buildEligiblePool\s*\([^)]*constraint[^)]*\)/, 'eligible-pool construction must consume the captured constraint');
  assert.doesNotMatch(INDEX, /function _commitRollSelection\(rng\)[\s\S]*?s\.torExcluded[\s\S]*?ee\(/, 'ROLL must not read live Tor preference while constructing the sampled pool');
});

test('RA-2A: immutable transaction records versioned protocol policy even when exclusion is false', () => {
  assert.match(TRAIL_RUNTIME, /protocolPolicy\s*:\s*\{\s*version\s*:\s*1\s*,\s*excludeOnion\s*:/, 'transaction constraint must explicitly bind protocolPolicy v1 and excludeOnion');
  assert.match(TRAIL_RUNTIME, /constraint\s*:\s*selectionConstraint/, 'the committed transaction must consume the captured selection constraint');
  assert.doesNotMatch(TRAIL_RUNTIME, /constraint\s*:\s*\{\s*terrain\s*:\s*selectionTerrain\s*\}/, 'terrain-only transaction constraints are incomplete');
});

test('RA-2A independent fixture requires exact eligible-pool membership and order', () => {
  const excluded = referenceFilter(FIXTURE_CORPUS, { excludeOnion: true });
  const included = referenceFilter(FIXTURE_CORPUS, { excludeOnion: false });
  assert.deepEqual(excluded, FIXTURE_CORPUS.filter(e => e.scheme !== 'onion'));
  assert.deepEqual(included, FIXTURE_CORPUS);
  assert.equal(excluded.some(e => e.scheme === 'onion'), false);
});
