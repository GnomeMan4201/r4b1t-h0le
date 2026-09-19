'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const trail = require('../trail-manifest.js');
const topology = require('../trail-topology.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('topology core depends only on trail verification formats, not presentation or selection modules', () => {
  const source = read('trail-topology.js');

  assert.match(source, /require\('\.\/trail-manifest\.js'\)/);
  assert.match(source, /require\('\.\/blind-manifest\.js'\)/);

  for (const forbiddenDependency of [
    "require('./trail-wear.js')",
    "require('./topology-runtime.js')",
    "require('./trail-runtime.js')",
    "require('./blind-runtime.js')",
    "require('./index.js')",
  ]) {
    assert.equal(source.includes(forbiddenDependency), false, forbiddenDependency);
  }
});

test('topology proof and export core contains no route-selection or ranking hooks', () => {
  const source = read('trail-topology.js');
  const forbidden = [
    /createSampler\s*\(/,
    /nextFloat\s*\(/,
    /selectUrl\s*\(/,
    /triggerSprout\s*\(/,
    /sampler[_A-Za-z]*\s*=/i,
    /selection[_A-Za-z]*\s*=/i,
    /weight(?:ing|s)?[_A-Za-z]*\s*=/i,
    /popularity[_A-Za-z]*\s*=/i,
    /engagement[_A-Za-z]*\s*=/i,
    /interestingness[_A-Za-z]*\s*=/i,
    /recommend(?:ed|ation)?[_A-Za-z]*\s*=/i,
  ];

  for (const pattern of forbidden) assert.doesNotMatch(source, pattern);
});

test('topology runtime keeps atlas persistence separate from sampler and corpus state', () => {
  const source = read('topology-runtime.js');

  assert.ok(source.includes("var STORAGE_KEY = 'r4b1t_topology_atlas_v1';"));
  assert.ok(source.includes('localStorage.setItem(STORAGE_KEY'));
  assert.ok(source.includes('localStorage.removeItem(STORAGE_KEY)'));

  for (const forbiddenWrite of [
    /localStorage\.setItem\([^,]*(sampler|weight|corpus|ranking|profile|engagement)/i,
    /localStorage\.removeItem\([^)]*(sampler|weight|corpus|ranking|profile|engagement)/i,
    /sessionStorage\.setItem\([^,]*(sampler|weight|corpus|ranking|profile|engagement)/i,
  ]) {
    assert.doesNotMatch(source, forbiddenWrite);
  }
});

test('topology export and import do not mutate source trail artifacts', async () => {
  const snapshot = await trail.envelope(await trail.createManifest({
    created_at: '2026-09-19T02:00:00.000Z',
    corpus_revision: 'sha256:' + 'a'.repeat(64),
    seed: 'contract-boundary',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.org/boundary', action: 'ROLL' }],
    parent: null,
  }));

  const before = trail.canonicalJson(snapshot);
  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-19T02:01:00.000Z',
  });

  assert.equal(trail.canonicalJson(snapshot), before);

  const exportBefore = trail.canonicalJson(exported);
  await topology.importTopology(exported);

  assert.equal(trail.canonicalJson(snapshot), before);
  assert.equal(trail.canonicalJson(exported), exportBefore);
});

test('wear remains presentation-only and is absent from canonical topology export structure', async () => {
  const topologySource = read('trail-topology.js');
  assert.equal(topologySource.includes('R4b1tWear'), false);
  assert.equal(topologySource.includes("require('./trail-wear.js')"), false);

  const snapshot = await trail.envelope(await trail.createManifest({
    created_at: '2026-09-19T02:10:00.000Z',
    corpus_revision: 'sha256:' + 'b'.repeat(64),
    seed: 'wear-boundary',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.net/wear', action: 'ROLL' }],
    parent: null,
  }));

  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-19T02:11:00.000Z',
  });
  const serialized = JSON.stringify(exported).toLowerCase();

  for (const forbidden of ['crease_count', 'fold_size', 'wear_score', 'wear_weight']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('canonical topology export contains no inferred selection metadata', async () => {
  const snapshot = await trail.envelope(await trail.createManifest({
    created_at: '2026-09-19T02:20:00.000Z',
    corpus_revision: 'sha256:' + 'c'.repeat(64),
    seed: 'metadata-boundary',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.com/metadata', action: 'ROLL' }],
    parent: null,
  }));

  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-19T02:21:00.000Z',
  });
  const keys = new Set();

  (function collect(value) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach((key) => {
      keys.add(key.toLowerCase());
      collect(value[key]);
    });
  })(exported);

  for (const forbidden of [
    'score',
    'confidence',
    'popularity',
    'engagement',
    'interestingness',
    'recommendation',
    'selection_weight',
    'sampler_weight',
  ]) {
    assert.equal(keys.has(forbidden), false, forbidden);
  }
});
