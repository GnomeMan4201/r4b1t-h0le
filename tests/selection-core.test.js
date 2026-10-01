'use strict';

// T1-04 (core), T1-08 (core), T1-10 / T1-11 (static authority boundaries).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const TRAIL_RUNTIME = fs.readFileSync(path.join(ROOT, 'trail-runtime.js'), 'utf8');
const DUAL_SHELL = fs.readFileSync(path.join(ROOT, 'dual-shell.js'), 'utf8');
const urls = Object.freeze(fs.readFileSync(path.join(ROOT, 'corpus/releases/typed-candidate-v0.1/urls.txt'), 'utf8').slice(0, -1).split('\n'));
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/terrains/typed-candidate-v0.1/terrain-index-v1.json'), 'utf8'));

const core = () => require(path.join(ROOT, 'selection-core.js'));
const constraint = (terrain, excludeOnion = false) => ({
  terrain,
  terrainIndex: terrain === 'ALL' ? null : { schema: 'r4b1t-terrain-index-v1', digest: 'sha256:x' },
  protocolPolicy: { version: 1, excludeOnion },
});

test('T1-04: eligiblePool equals index membership in release order for every terrain', () => {
  const { eligiblePool } = core();
  for (const terrain of index.terrains) {
    assert.deepEqual(eligiblePool(urls, index, constraint(terrain.id)), terrain.members.map(i => urls[i]), terrain.id);
  }
  assert.deepEqual(eligiblePool(urls, index, constraint('ALL')), [...urls]);
  assert.equal(eligiblePool(urls, null, constraint('ALL')).length, 841, 'ALL does not depend on the index');
});

test('T1-04: unknown terrain and missing index fail closed', () => {
  const { eligiblePool } = core();
  assert.throws(() => eligiblePool(urls, index, constraint('code')), e => e.code === 'TERRAIN_UNKNOWN');
  assert.throws(() => eligiblePool(urls, null, constraint('security_tool')), e => e.code === 'TERRAIN_INDEX_REQUIRED');
});

test('T1-08: protocol policy filters after membership and can yield an explicit empty pool', () => {
  const { eligiblePool } = core();
  const fixtureUrls = ['http://aaaaaaaaaaaaaaaa.onion/', 'https://example.org/a', 'http://bbbbbbbbbbbbbbbb.onion/b'];
  const fixtureIndex = { terrains: [{ id: 'hidden', members: [0, 2] }, { id: 'mixed', members: [0, 1, 2] }] };
  assert.deepEqual(eligiblePool(fixtureUrls, fixtureIndex, constraint('hidden', true)), []);
  assert.deepEqual(eligiblePool(fixtureUrls, fixtureIndex, constraint('mixed', true)), ['https://example.org/a']);
  assert.deepEqual(eligiblePool(fixtureUrls, fixtureIndex, constraint('mixed', false)), fixtureUrls);
});

test('T1-04: production eligibility delegates to the selection core, not the hostname table', () => {
  assert.doesNotMatch(INDEX_HTML, /function _getCatFilteredPool\s*\(/, 'legacy hostname-table eligibility must be removed');
  assert.doesNotMatch(INDEX_HTML, /_activeCat/, 'legacy terrain state must be removed');
  assert.match(INDEX_HTML, /function buildEligiblePool\([^)]*constraint[^)]*\)\{[^}]*R4b1tSelectionCore\.eligiblePool\(/);
  assert.match(INDEX_HTML, /<script src="selection-core\.js"><\/script>/);
  assert.match(INDEX_HTML, /<script src="terrain-authority\.js"><\/script>/);
  assert.match(INDEX_HTML, /<script src="cj1\.js"><\/script>/);
});

test('T1-10: armed terrain is never derived from presentation style', () => {
  assert.doesNotMatch(TRAIL_RUNTIME, /204, 17, 17|#cc1111/i, 'trail runtime must not read terrain from button style');
  const fn = DUAL_SHELL.match(/function sourceFilterIsActive\(button\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, 'sourceFilterIsActive present');
  assert.doesNotMatch(fn[0], /style|cc1111|204,17,17/i, 'mobile must read aria-pressed, not style');
});

test('T1-11: the sampler has no ambient Math.random fallback', () => {
  const ee = INDEX_HTML.match(/function ee\(e,rng\)\{[\s\S]*?return t\}/);
  assert.ok(ee, 'ee present');
  assert.doesNotMatch(ee[0], /Math\.random/);
});
