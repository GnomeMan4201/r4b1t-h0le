'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const trail = require('../trail-manifest.js');
const comparison = require('../trail-comparison.js');
const session = require('../proof-session.js');
const bundle = require('../proof-session-bundle.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);

async function source(urls, seed, parent) {
  const manifest = await trail.createManifest({
    created_at: '2026-09-19T23:50:00.000Z',
    corpus_revision: CORPUS,
    seed,
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: parent || null,
  });
  return JSON.stringify(await trail.envelope(manifest), null, 2) + '\n';
}

test('Proof Session comparison projection digest is stable across verifier timestamps', async () => {
  const left = new TextEncoder().encode(await source(['https://example.org/a'], 'digest-left'));
  const right = new TextEncoder().encode(await source(['https://example.org/b'], 'digest-right'));

  const first = await comparison.compare(left, right, { verified_at: '2026-09-19T23:51:00.000Z' });
  const second = await comparison.compare(left, right, { verified_at: '2026-09-20T00:01:00.000Z' });

  assert.notDeepEqual(first.verification, second.verification);
  assert.equal(await session.digestProjection(first), await session.digestProjection(second));
});

test('portable Proof Session export preserves unique exact sources and deterministic comparison files', async () => {
  const a = await source(['https://example.org/a'], 'bundle-a');
  const b = await source(['https://example.org/b'], 'bundle-b');
  const portable = await bundle.create([a, b, a], {
    verified_at: '2026-09-19T23:52:00.000Z',
  });

  assert.deepEqual(bundle.fileNames(portable), [
    'README.txt',
    'comparisons/S1--S2--sha256-' + portable.projection.pairs[0].comparison_projection_digest.slice(7) + '.json',
    'proof-session.json',
    'sources/S1--sha256-' + portable.projection.sources[0].artifact_digest.slice(7) + '.json',
    'sources/S2--sha256-' + portable.projection.sources[1].artifact_digest.slice(7) + '.json',
  ]);
  assert.equal(portable.projection.sources.length, 2);
  assert.equal(portable.projection.sources[0].supplied_count, 2);
  assert.equal(Buffer.from(portable.files[bundle.sourceFileName(portable.projection.sources[0])]).toString('utf8'), a);
});

test('fresh offline inspection returns MATCH across a later verification timestamp', async () => {
  const a = await source(['https://example.org/a'], 'match-a');
  const b = await source(['https://example.org/b'], 'match-b');
  const portable = await bundle.create([a, b], {
    verified_at: '2026-09-19T23:53:00.000Z',
  });

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:03:00.000Z',
  });

  assert.equal(inspected.classification, 'MATCH');
  assert.deepEqual(inspected.mismatches, []);
  assert.equal(inspected.fresh_projection.sources[0].verification.verified_at, '2026-09-20T00:03:00.000Z');
  assert.notEqual(
    inspected.stored_projection.sources[0].verification.verified_at,
    inspected.fresh_projection.sources[0].verification.verified_at,
  );
});

test('edited stored session summary yields visible MISMATCH while fresh facts remain available', async () => {
  const a = await source(['https://example.org/a'], 'summary-a');
  const b = await source(['https://example.org/b'], 'summary-b');
  const portable = await bundle.create([a, b], {
    verified_at: '2026-09-19T23:54:00.000Z',
  });

  const stored = JSON.parse(Buffer.from(portable.files['proof-session.json']).toString('utf8'));
  stored.summary[0].count = 999;
  portable.files['proof-session.json'] = new TextEncoder().encode(JSON.stringify(stored, null, 2) + '\n');

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:04:00.000Z',
  });

  assert.equal(inspected.classification, 'MISMATCH');
  assert.ok(inspected.mismatches.includes('proof-session.json'));
  assert.equal(inspected.fresh_projection.summary[0].count, 2);
  assert.equal(inspected.stored_projection.summary[0].count, 999);
});

test('edited stored comparison projection yields MISMATCH without changing fresh comparison result', async () => {
  const a = await source(['https://example.org/a'], 'cmp-a');
  const b = await source(['https://example.org/b'], 'cmp-b');
  const portable = await bundle.create([a, b], {
    verified_at: '2026-09-19T23:55:00.000Z',
  });
  const name = bundle.comparisonFileName(portable.projection.pairs[0]);
  const storedComparison = JSON.parse(Buffer.from(portable.files[name]).toString('utf8'));
  storedComparison.comparison.first_divergence_index = null;
  portable.files[name] = new TextEncoder().encode(JSON.stringify(storedComparison, null, 2) + '\n');

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:05:00.000Z',
  });

  assert.equal(inspected.classification, 'MISMATCH');
  assert.ok(inspected.mismatches.includes(name));
  assert.notEqual(inspected.fresh_comparisons[0].comparison.first_divergence_index, null);
});

test('changed exact source bytes are freshly processed and stored derived presentation becomes MISMATCH', async () => {
  const a = await source(['https://example.org/a'], 'source-a');
  const b = await source(['https://example.org/b'], 'source-b');
  const portable = await bundle.create([a, b], {
    verified_at: '2026-09-19T23:56:00.000Z',
  });

  const firstSource = bundle.sourceFileName(portable.projection.sources[0]);
  portable.files[firstSource] = new TextEncoder().encode(a + ' ');

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:06:00.000Z',
  });

  assert.equal(inspected.classification, 'MISMATCH');
  assert.ok(inspected.mismatches.includes('proof-session.json'));
  assert.notEqual(inspected.fresh_projection.sources[0].artifact_digest, portable.projection.sources[0].artifact_digest);
});

test('missing required source file returns UNREADABLE without trusting stored session facts', async () => {
  const a = await source(['https://example.org/a'], 'missing-a');
  const portable = await bundle.create([a], {
    verified_at: '2026-09-19T23:57:00.000Z',
  });
  delete portable.files[bundle.sourceFileName(portable.projection.sources[0])];

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:07:00.000Z',
  });

  assert.equal(inspected.classification, 'UNREADABLE');
  assert.equal(inspected.fresh_projection, null);
  assert.equal(inspected.stored_projection, null);
  assert.match(inspected.reason, /source/i);
});

test('missing or edited README is non-normative and does not change MATCH', async () => {
  const a = await source(['https://example.org/a'], 'readme-a');
  const portable = await bundle.create([a], {
    verified_at: '2026-09-19T23:58:00.000Z',
  });

  delete portable.files['README.txt'];
  let inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:08:00.000Z',
  });
  assert.equal(inspected.classification, 'MATCH');
  assert.deepEqual(inspected.warnings, ['README.txt missing']);

  portable.files['README.txt'] = new TextEncoder().encode('attacker controlled text');
  inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:09:00.000Z',
  });
  assert.equal(inspected.classification, 'MATCH');
});

test('portable bundle is a file set without evidence-manifest authority or network/storage hooks', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sourceCode = fs.readFileSync(path.resolve(__dirname, '..', 'proof-session-bundle.js'), 'utf8').toLowerCase();

  for (const forbidden of [
    'bundle_format', 'evidence_manifest', 'fetch(', 'xmlhttprequest', 'websocket',
    'localstorage', 'sessionstorage', 'indexeddb', 'sendbeacon', 'telemetry',
    'recommendation', 'popularity', 'selection_weight', 'sampler_weight',
  ]) {
    assert.equal(sourceCode.includes(forbidden), false, forbidden);
  }
});
