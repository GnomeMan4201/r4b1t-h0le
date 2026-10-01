'use strict';

// T1-13: CJ-1 canonical profile vectors.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vectors = require('./fixtures/cj-1/cj-1-vectors.json');

function loadCJ1() {
  return require(path.resolve(__dirname, '..', 'cj1.js'));
}

test('T1-13: CJ-1 serializes every accept vector to the pinned bytes', () => {
  const cj1 = loadCJ1();
  for (const vector of vectors.accept) {
    const bytes = Buffer.from(cj1.serialize(JSON.parse(vector.value_json)), 'utf8').toString('hex');
    assert.equal(bytes, vector.canonical_utf8_hex, vector.name);
  }
});

test('T1-13: CJ-1 rejects every reject vector with CANONICAL_PROFILE_VIOLATION', () => {
  const cj1 = loadCJ1();
  for (const vector of vectors.reject) {
    assert.throws(() => cj1.serialize(JSON.parse(vector.value_json)), error => error.code === 'CANONICAL_PROFILE_VIOLATION', vector.name);
  }
});

test('T1-13: CJ-1 output equals trail-manifest canonicalJson for profile-valid values', () => {
  const cj1 = loadCJ1();
  const trail = require(path.resolve(__dirname, '..', 'trail-manifest.js'));
  const value = { z: [1, { b: null, a: true }], protocolPolicy: { version: 1, excludeOnion: false } };
  assert.equal(cj1.serialize(value), trail.canonicalJson(value));
});
