'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const trail = require('../trail-manifest.js');
const topology = require('../trail-topology.js');
const bundle = require('../trail-card-bundle.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);

async function snapshot() {
  const manifest = await trail.createManifest({
    created_at: '2026-09-19T17:00:00.000Z',
    corpus_revision: CORPUS,
    seed: 'portable-bundle',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.org/bundle', action: 'ROLL' }],
    parent: null,
  });
  return trail.envelope(manifest);
}

test('portable bundle preserves exact canonical source bytes alongside projection', async () => {
  const source = JSON.stringify(await snapshot(), null, 2) + '\n';
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T17:01:00.000Z',
  });

  assert.deepEqual(bundle.fileNames(portable), ['README.txt', 'source.json', 'trail-card.json']);
  assert.equal(Buffer.from(portable.files['source.json']).toString('utf8'), source);
  assert.equal(portable.card.verification.state, 'VERIFIED');
  assert.equal(
    portable.card.source.artifact_digest,
    await require('../trail-card.js').digestOf(new TextEncoder().encode(source)),
  );
});

test('portable bundle contains no wrapper evidence manifest', async () => {
  const source = JSON.stringify(await snapshot());
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T17:02:00.000Z',
  });

  assert.deepEqual(bundle.fileNames(portable), ['README.txt', 'source.json', 'trail-card.json']);
  for (const name of bundle.fileNames(portable)) {
    assert.doesNotMatch(name, /manifest|evidence|proof/i);
  }
});

test('bundle inspection freshly re-verifies the bundled source', async () => {
  const source = JSON.stringify(await snapshot());
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T17:03:00.000Z',
  });
  const result = await bundle.inspect(portable, {
    verified_at: '2026-09-19T17:04:00.000Z',
  });

  assert.equal(result.source_matches_stored_card, true);
  assert.equal(result.stored_card.verification.state, 'VERIFIED');
  assert.equal(result.fresh_card.verification.state, 'VERIFIED');
  assert.equal(result.fresh_card.verification.verified_at, '2026-09-19T17:04:00.000Z');
  assert.equal(result.fresh_card.source.artifact_digest, result.source_digest);
});

test('bundle inspection rejects source bytes changed after card generation', async () => {
  const source = JSON.stringify(await snapshot());
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T17:05:00.000Z',
  });

  portable.files['source.json'] = new TextEncoder().encode(source + ' ');
  await assert.rejects(
    () => bundle.inspect(portable, { verified_at: '2026-09-19T17:06:00.000Z' }),
    /source digest mismatch/,
  );
});

test('bundle inspection rejects a projection whose source digest was edited', async () => {
  const source = JSON.stringify(await snapshot());
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T17:07:00.000Z',
  });

  const card = JSON.parse(Buffer.from(portable.files['trail-card.json']).toString('utf8'));
  card.source.artifact_digest = 'sha256:' + 'd'.repeat(64);
  card.verification.verified_digest = card.source.artifact_digest;
  portable.files['trail-card.json'] = new TextEncoder().encode(JSON.stringify(card));

  await assert.rejects(
    () => bundle.inspect(portable, { verified_at: '2026-09-19T17:08:00.000Z' }),
    /source digest mismatch/,
  );
});

test('topology bundle keeps canonical topology export independently usable', async () => {
  const child = await snapshot();
  const exported = await topology.exportTopology([child], {
    created_at: '2026-09-19T17:09:00.000Z',
  });
  const source = JSON.stringify(exported);
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T17:10:00.000Z',
  });

  const standalone = require('../tools/verify-topology-export.js');
  const parsedSource = JSON.parse(Buffer.from(portable.files['source.json']).toString('utf8'));
  const result = await standalone.verifyExport(parsedSource);

  assert.equal(result.proof_state, 'VERIFIED');
  assert.equal(portable.card.verification.state, 'VERIFIED');
  assert.equal(portable.card.source.artifact_format, 'r4b1t-topology-export/v0.1');
});

test('diagnostic source stays diagnostic and is never upgraded by bundling', async () => {
  const bad = await snapshot();
  bad.manifest.routes[0].url = 'https://attacker.invalid/';
  const source = JSON.stringify(bad);

  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T17:11:00.000Z',
  });
  assert.equal(portable.card.verification.state, 'REJECTED');

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-19T17:12:00.000Z',
  });
  assert.equal(inspected.stored_card.verification.state, 'REJECTED');
  assert.equal(inspected.fresh_state, 'REJECTED');
});

test('bundle implementation has no network, account, storage, feed, or ranking hooks', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'trail-card-bundle.js'), 'utf8').toLowerCase();

  for (const forbidden of [
    'fetch(',
    'xmlhttprequest',
    'websocket',
    'localstorage',
    'sessionstorage',
    'account',
    'login',
    'recent shares',
    'gallery',
    'view_count',
    'like_count',
    'trending',
    'popularity',
    'recommendation',
    'sampler',
    'selection_weight',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
