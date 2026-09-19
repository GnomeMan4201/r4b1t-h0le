'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);
const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NONCE_A = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
const NONCE_B = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';

function comparison() {
  return require('../trail-comparison.js');
}

async function v01(urls, options) {
  options = options || {};
  const manifest = await trail.createManifest({
    created_at: options.created_at || '2026-09-19T22:00:00.000Z',
    corpus_revision: CORPUS,
    seed: options.seed || 'comparison-test',
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: options.parent || null,
  });
  return trail.envelope(manifest);
}

async function v02(steps, options) {
  options = options || {};
  let manifest = await blind.create({
    created_at: options.created_at || '2026-09-19T22:10:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
    parent: options.parent || null,
  });

  for (let index = 0; index < steps.length; index += 1) {
    const item = steps[index];
    const committed = await blind.commit(manifest, item.url, item.nonce || (index === 0 ? NONCE_A : NONCE_B));
    manifest = committed.manifest;
    if (item.revealed) manifest = await blind.reveal(manifest, committed.secret);
  }

  return blind.envelope(manifest);
}

function bytes(value, pretty) {
  return new TextEncoder().encode(pretty ? JSON.stringify(value, null, 2) + '\n' : JSON.stringify(value));
}

test('comparison binds both VERIFIED inputs to exact source bytes', async () => {
  const left = await v01(['https://example.org/a']);
  const right = await v01(['https://example.org/a', 'https://example.org/b'], { seed: 'right' });
  const leftBytes = bytes(left, true);
  const rightBytes = bytes(right, false);

  const result = await comparison().compare(leftBytes, rightBytes, {
    verified_at: '2026-09-19T22:20:00.000Z',
  });

  assert.equal(result.verification.left.state, 'VERIFIED');
  assert.equal(result.verification.right.state, 'VERIFIED');
  assert.equal(result.verification.left.verified_digest, result.sources.left.artifact_digest);
  assert.equal(result.verification.right.verified_digest, result.sources.right.artifact_digest);
  assert.equal(result.sources.left.artifact_digest, await comparison().digestOf(leftBytes));
  assert.equal(result.sources.right.artifact_digest, await comparison().digestOf(rightBytes));

  const leftCompactDigest = await comparison().digestOf(bytes(left, false));
  assert.notEqual(leftCompactDigest, result.sources.left.artifact_digest);
});

test('revealed divergence derives shared prefix and first divergence deterministically', async () => {
  const left = await v01(['https://example.org/a', 'https://example.org/left']);
  const right = await v01(['https://example.org/a', 'https://example.org/right'], { seed: 'right-diverge' });

  const result = await comparison().compare(bytes(left), bytes(right), {
    verified_at: '2026-09-19T22:21:00.000Z',
  });

  assert.equal(result.comparison.shared_prefix_length, 1);
  assert.equal(result.comparison.first_divergence_index, 1);
  assert.equal(result.comparison.lineage_state, 'SHARED_ANCESTRY_NOT_PROVEN');
  assert.deepEqual(result.comparison.positions.map((position) => position.state), [
    'MATCH_REVEALED',
    'DIFFER_REVEALED',
  ]);
  assert.equal(JSON.stringify(result).includes('https://'), false);
});

test('identical verified trail is SAME_TRAIL with no divergence', async () => {
  const source = await v01(['https://example.org/a', 'https://example.org/b']);
  const sourceBytes = bytes(source);

  const result = await comparison().compare(sourceBytes, sourceBytes, {
    verified_at: '2026-09-19T22:22:00.000Z',
  });

  assert.equal(result.comparison.lineage_state, 'SAME_TRAIL');
  assert.equal(result.comparison.shared_prefix_length, 2);
  assert.equal(result.comparison.first_divergence_index, null);
  assert.deepEqual(result.comparison.positions.map((position) => position.state), [
    'MATCH_REVEALED',
    'MATCH_REVEALED',
  ]);
});

test('v0.1 direct parent relationship is verified with canonical lineage verifier', async () => {
  const parent = await v01(['https://example.org/a']);
  const child = await v01(
    ['https://example.org/a', 'https://example.org/b'],
    { seed: 'child', parent: { trail_id: parent.trail_id, fork_at: 1 } },
  );

  const result = await comparison().compare(bytes(parent), bytes(child), {
    verified_at: '2026-09-19T22:23:00.000Z',
  });

  assert.equal(result.comparison.lineage_state, 'LEFT_PARENT_OF_RIGHT');
  assert.equal(result.comparison.direct_fork_at, 1);
  assert.equal(result.comparison.shared_prefix_length, 1);
  assert.equal(result.comparison.first_divergence_index, 1);
  assert.equal(result.comparison.positions[1].state, 'RIGHT_ONLY');
});

test('swapping inputs preserves facts while exchanging side-specific lineage and position state', async () => {
  const parent = await v01(['https://example.org/a']);
  const child = await v01(
    ['https://example.org/a', 'https://example.org/b'],
    { seed: 'swap-child', parent: { trail_id: parent.trail_id, fork_at: 1 } },
  );

  const forward = await comparison().compare(bytes(parent), bytes(child), {
    verified_at: '2026-09-19T22:24:00.000Z',
  });
  const reverse = await comparison().compare(bytes(child), bytes(parent), {
    verified_at: '2026-09-19T22:24:00.000Z',
  });

  assert.equal(forward.comparison.lineage_state, 'LEFT_PARENT_OF_RIGHT');
  assert.equal(reverse.comparison.lineage_state, 'RIGHT_PARENT_OF_LEFT');
  assert.equal(forward.comparison.direct_fork_at, reverse.comparison.direct_fork_at);
  assert.equal(forward.comparison.shared_prefix_length, reverse.comparison.shared_prefix_length);
  assert.equal(forward.comparison.first_divergence_index, reverse.comparison.first_divergence_index);
  assert.equal(forward.comparison.positions[1].state, 'RIGHT_ONLY');
  assert.equal(reverse.comparison.positions[1].state, 'LEFT_ONLY');
});

test('concealed comparison uses commitments without exposing route identity', async () => {
  const left = await v02([{ url: 'https://secret.example/a', revealed: false, nonce: NONCE_A }]);
  const same = JSON.parse(JSON.stringify(left));
  const right = await v02([{ url: 'https://secret.example/b', revealed: false, nonce: NONCE_A }], { created_at: '2026-09-19T22:11:00.000Z' });

  const identical = await comparison().compare(bytes(left), bytes(same), {
    verified_at: '2026-09-19T22:25:00.000Z',
  });
  assert.equal(identical.comparison.positions[0].state, 'BOTH_CONCEALED_SAME_COMMITMENT');
  assert.equal(identical.comparison.positions[0].left.route_id, null);
  assert.equal(identical.comparison.positions[0].right.route_id, null);
  assert.ok(identical.comparison.positions[0].left.commitment);

  const different = await comparison().compare(bytes(left), bytes(right), {
    verified_at: '2026-09-19T22:25:00.000Z',
  });
  assert.equal(different.comparison.positions[0].state, 'BOTH_CONCEALED_DIFFERENT_COMMITMENT');
  const serialized = JSON.stringify(different);
  assert.equal(serialized.includes('secret.example'), false);
});

test('mixed concealed/revealed states identify the concealed side without testing hidden route identity', async () => {
  const concealed = await v02([{ url: 'https://secret.example/a', revealed: false, nonce: NONCE_A }]);
  const revealed = await v02([{ url: 'https://example.org/public', revealed: true, nonce: NONCE_A }], { created_at: '2026-09-19T22:12:00.000Z' });

  const result = await comparison().compare(bytes(concealed), bytes(revealed), {
    verified_at: '2026-09-19T22:26:00.000Z',
  });

  assert.equal(result.comparison.positions[0].state, 'LEFT_CONCEALED');
  assert.equal(result.comparison.positions[0].left.route_id, null);
  assert.ok(result.comparison.positions[0].left.commitment);
  assert.ok(result.comparison.positions[0].right.route_id);
  assert.equal(JSON.stringify(result).includes('public'), false);
  assert.equal(JSON.stringify(result).includes('secret.example'), false);
});

test('tampered source is REJECTED and suppresses all comparison facts', async () => {
  const left = await v01(['https://example.org/a']);
  const right = await v01(['https://example.org/a'], { seed: 'tamper-right' });
  right.manifest.routes[0].url = 'https://attacker.invalid/';

  const result = await comparison().compare(bytes(left), bytes(right), {
    verified_at: '2026-09-19T22:27:00.000Z',
  });

  assert.equal(result.verification.left.state, 'VERIFIED');
  assert.equal(result.verification.right.state, 'REJECTED');
  assert.equal(result.comparison, null);
  assert.equal(result.diagnostic_notice, 'THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.');
});

test('unsupported source is UNVERIFIED and suppresses all comparison facts', async () => {
  const left = await v01(['https://example.org/a']);
  const unsupported = new TextEncoder().encode(JSON.stringify({
    trail_id: 'sha256:' + 'f'.repeat(64),
    manifest: { format: 'r4b1t-trail/v9.9' },
  }));

  const result = await comparison().compare(bytes(left), unsupported, {
    verified_at: '2026-09-19T22:28:00.000Z',
  });

  assert.equal(result.verification.left.state, 'VERIFIED');
  assert.equal(result.verification.right.state, 'UNVERIFIED');
  assert.equal(result.verification.right.verified_at, null);
  assert.equal(result.comparison, null);
});

test('direct parent claim that fails canonical lineage verification rejects the child side', async () => {
  const parent = await v01(['https://example.org/a']);
  const child = await v01(
    ['https://example.org/not-a', 'https://example.org/b'],
    { seed: 'bad-lineage-child', parent: { trail_id: parent.trail_id, fork_at: 1 } },
  );

  const result = await comparison().compare(bytes(parent), bytes(child), {
    verified_at: '2026-09-19T22:29:00.000Z',
  });

  assert.equal(result.verification.left.state, 'VERIFIED');
  assert.equal(result.verification.right.state, 'REJECTED');
  assert.match(result.verification.right.reason, /Fork prefix mismatch/);
  assert.equal(result.comparison, null);
});

test('comparison core exposes no network, persistence, ranking, recommendation, or selection hooks', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'trail-comparison.js'), 'utf8');

  for (const forbidden of [
    'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'createSampler(', 'nextFloat(',
    'selection_weight', 'sampler_weight', 'popularity', 'engagement',
    'recommendation', 'rankRoutes(', 'triggerSprout(', 'R4b1tWear',
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});
