'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const v1 = require('../roll-sampler-v1.js');
const registry = require('../roll-sampler-registry.js');
const trail = require('../trail-manifest.js');

test('sampler v1 is a frozen pure module registered by immutable version', () => {
  assert.equal(v1.version, 'uniform-repeat-guard-mulberry32/v1');
  assert.ok(Object.isFrozen(v1));
  assert.equal(registry.get(v1.version), v1);
  assert.deepEqual(registry.versions(), [v1.version]);
  assert.ok(Object.isFrozen(registry));
});

test('sampler v1 stays byte-for-byte compatible with the existing Trail sampler stream', () => {
  const seed = '0123456789abcdef0123456789abcdef';
  const authoritySampler = v1.createSampler(seed);
  const trailSampler = trail.createSampler(seed);

  for (let index = 0; index < 128; index += 1) {
    assert.equal(authoritySampler(), trailSampler(), 'stream diverged at draw ' + index);
  }
});

test('sampler v1 resolves repeat-guard draws deterministically without external state', () => {
  const input = {
    eligibleSnapshot: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
    seedMaterial: '0123456789abcdef0123456789abcdef',
    drawStart: 7,
    repeatGuardReference: 'https://example.com/a'
  };

  const first = v1.resolve(input, 30);
  const second = v1.resolve(input, 30);
  assert.deepEqual(second, first);
  assert.match(first.url, /^https:\/\/example\.com\//);
  assert.ok(first.drawCount >= 1 && first.drawCount <= 30);
});

test('unknown sampler versions are absent instead of silently falling through to current code', () => {
  assert.equal(registry.get('uniform-repeat-guard-mulberry32/v99'), null);
});
