'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const trail = require('../trail-manifest.js');
const v03 = require('../trail-manifest-v03.js');
const { createSelectionAuthority } = require('../selection-authority.js');

const REVISION = 'sha256:' + 'a'.repeat(64);
const CREATED = '2026-09-23T12:00:00.000Z';
const POOL = [
  'https://example.test/a',
  'https://example.test/b',
  'https://example.test/c',
];

function transactions() {
  const authority = createSelectionAuthority({ seed: 'v03-seed' });
  const first = authority.selectRoll({
    pool: POOL,
    prior_url: null,
    constraint: { terrain: 'CODE', tor: { excluded: false, ready: false } },
    corpus_revision: REVISION,
  });
  const second = authority.selectRoll({
    pool: POOL,
    prior_url: first.route.url,
    constraint: { terrain: 'BLOG', tor: { excluded: false, ready: false } },
    corpus_revision: REVISION,
  });
  return [first, second];
}

async function artifact() {
  return v03.envelope(await v03.createManifest({
    created_at: CREATED,
    transactions: transactions(),
    parent: null,
  }));
}

async function rehash(value) {
  value.trail_id = 'sha256:' + await trail.sha256Hex(trail.canonicalJson(value.manifest));
  return value;
}

test('v0.3 generation is deterministic for identical committed transactions', async () => {
  const tx = transactions();
  const left = await v03.envelope(await v03.createManifest({ created_at: CREATED, transactions: tx, parent: null }));
  const right = await v03.envelope(await v03.createManifest({ created_at: CREATED, transactions: tx, parent: null }));
  assert.deepEqual(right, left);
  assert.equal(left.manifest.format, 'r4b1t-trail/v0.3');
});

test('v0.3 integrity verification accepts canonical untampered artifact', async () => {
  const value = await artifact();
  assert.equal((await v03.verifyIntegrity(JSON.stringify(value))).trail_id, value.trail_id);
});

test('tampered v0.3 fails closed', async () => {
  const value = await artifact();
  value.manifest.routes[0].url = 'https://attacker.invalid/';
  await assert.rejects(() => v03.verifyIntegrity(value), /Transaction route mismatch|Route ID mismatch|Trail ID mismatch/);
});

test('transaction route mismatch fails even if attacker recomputes trail_id', async () => {
  const value = await artifact();
  value.manifest.routes[0].transaction.route.url = 'https://attacker.invalid/';
  await rehash(value);
  await assert.rejects(() => v03.verifyIntegrity(value), /Transaction route mismatch/);
});

test('malformed draw interval fails', async () => {
  const value = await artifact();
  value.manifest.routes[0].transaction.sampler.draw_count = 0;
  await rehash(value);
  await assert.rejects(() => v03.verifyIntegrity(value), /draw interval/);
});

test('unsupported sampler or PRNG fails', async () => {
  const sampler = await artifact();
  sampler.manifest.routes[0].transaction.sampler.algorithm = 'mystery-sampler';
  await rehash(sampler);
  await assert.rejects(() => v03.verifyIntegrity(sampler), /sampler identifiers/);

  const prng = await artifact();
  prng.manifest.routes[0].transaction.sampler.prng = 'mystery-prng';
  await rehash(prng);
  await assert.rejects(() => v03.verifyIntegrity(prng), /sampler identifiers/);
});

test('selection-time constraint survives later presentation/filter changes', async () => {
  const tx = transactions();
  const presentation = { terrain: 'CODE' };
  const value = await v03.envelope(await v03.createManifest({ created_at: CREATED, transactions: tx, parent: null }));
  presentation.terrain = 'PAPER';
  assert.equal(value.manifest.routes[0].transaction.constraint.terrain, 'CODE');
  assert.equal(value.manifest.routes[1].transaction.constraint.terrain, 'BLOG');
});

test('trail_id stays stable after presentation-only changes', async () => {
  const tx = transactions();
  const first = await v03.envelope(await v03.createManifest({ created_at: CREATED, transactions: tx, parent: null }));
  const presentation = { filter: 'CODE', previewUrl: tx[0].route.url };
  presentation.filter = 'NEWS';
  presentation.previewUrl = 'https://presentation.invalid/';
  const second = await v03.envelope(await v03.createManifest({ created_at: CREATED, transactions: tx, parent: null }));
  assert.equal(second.trail_id, first.trail_id);
});

test('ROLL transaction fields survive export exactly', async () => {
  const tx = transactions();
  const manifest = await v03.createManifest({ created_at: CREATED, transactions: tx, parent: null });
  assert.deepEqual(manifest.routes[0].transaction, JSON.parse(JSON.stringify(tx[0])));
  assert.deepEqual(manifest.routes[1].transaction, JSON.parse(JSON.stringify(tx[1])));
  assert.equal(manifest.routes[0].url, tx[0].route.url);
  assert.equal(manifest.routes[0].action, tx[0].action);
});

test('v0.3 refuses non-random SELECT transaction semantics', async () => {
  const tx = JSON.parse(JSON.stringify(transactions()[0]));
  tx.action = 'SELECT';
  tx.sampler = null;
  await assert.rejects(
    () => v03.createManifest({ created_at: CREATED, transactions: [tx], parent: null }),
    /ROLL transactions only|sampler/,
  );
});
