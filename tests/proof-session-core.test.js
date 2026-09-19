'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');
const comparison = require('../trail-comparison.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);
const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NONCE_A = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
const NONCE_B = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';

function core() {
  return require('../proof-session.js');
}

async function v01(urls, options) {
  options = options || {};
  const manifest = await trail.createManifest({
    created_at: options.created_at || '2026-09-19T23:00:00.000Z',
    corpus_revision: CORPUS,
    seed: options.seed || 'proof-session-test',
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: options.parent || null,
  });
  return trail.envelope(manifest);
}

async function v02(steps, options) {
  options = options || {};
  let manifest = await blind.create({
    created_at: options.created_at || '2026-09-19T23:10:00.000Z',
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

function summaryObject(result) {
  return Object.fromEntries(result.summary.map((item) => [item.label, item.count]));
}

test('core verifies exact bytes, deduplicates identical source bytes, and preserves first-import slot order', async () => {
  const first = await v01(['https://example.org/a']);
  const second = await v01(['https://example.org/b'], { seed: 'second' });
  const firstPretty = bytes(first, true);

  const result = await core().build([firstPretty, bytes(second), firstPretty], {
    verified_at: '2026-09-19T23:20:00.000Z',
  });

  assert.equal(result.sources.length, 2);
  assert.deepEqual(result.sources.map((source) => source.slot_id), ['S1', 'S2']);
  assert.equal(result.sources[0].supplied_count, 2);
  assert.equal(result.sources[1].supplied_count, 1);
  assert.equal(result.sources[0].artifact_digest, await comparison.digestOf(firstPretty));
  assert.equal(result.sources[0].verification.state, 'VERIFIED');
  assert.equal(result.sources[0].verification.verified_digest, result.sources[0].artifact_digest);
  assert.equal(result.sources[0].canonical_trail_id, first.trail_id);
});

test('same canonical trail with different exact bytes remains two slots', async () => {
  const source = await v01(['https://example.org/a']);
  const compact = bytes(source, false);
  const pretty = bytes(source, true);

  const result = await core().build([compact, pretty], {
    verified_at: '2026-09-19T23:21:00.000Z',
  });

  assert.equal(result.sources.length, 2);
  assert.notEqual(result.sources[0].artifact_digest, result.sources[1].artifact_digest);
  assert.equal(result.sources[0].canonical_trail_id, result.sources[1].canonical_trail_id);
  assert.equal(result.pairs.length, 1);
  assert.equal(summaryObject(result)['IDENTICAL TRAIL PAIRS'], 1);
});

test('core builds every unordered VERIFIED pair exactly once in slot order', async () => {
  const a = await v01(['https://example.org/a']);
  const b = await v01(['https://example.org/b'], { seed: 'b' });
  const c = await v01(['https://example.org/c'], { seed: 'c' });

  const result = await core().build([bytes(a), bytes(b), bytes(c)], {
    verified_at: '2026-09-19T23:22:00.000Z',
  });

  assert.deepEqual(
    result.pairs.map((pair) => pair.left_slot + ':' + pair.right_slot),
    ['S1:S2', 'S1:S3', 'S2:S3'],
  );
  assert.equal(summaryObject(result)['VERIFIED PAIRS'], 3);
});

test('core delegates pair semantics to frozen Trail Comparison v1 projections', async () => {
  const left = await v01(['https://example.org/a', 'https://example.org/left']);
  const right = await v01(['https://example.org/a', 'https://example.org/right'], { seed: 'right' });
  const leftBytes = bytes(left);
  const rightBytes = bytes(right);

  const expected = await comparison.compare(leftBytes, rightBytes, {
    verified_at: '2026-09-19T23:23:00.000Z',
  });
  const result = await core().build([leftBytes, rightBytes], {
    verified_at: '2026-09-19T23:23:00.000Z',
  });

  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].comparison_format, comparison.FORMAT);
  assert.equal(result.pairs[0].comparison_projection_digest, await core().digestProjection(expected));
  assert.equal(summaryObject(result)['DIVERGENT PAIRS'], 1);
  assert.equal(summaryObject(result)['SHARED PREFIX ONLY PAIRS'], 1);
});

test('direct parent edges come only from direct Comparison v1 lineage facts', async () => {
  const parent = await v01(['https://example.org/a']);
  const child = await v01(
    ['https://example.org/a', 'https://example.org/b'],
    { seed: 'child', parent: { trail_id: parent.trail_id, fork_at: 1 } },
  );

  const result = await core().build([bytes(parent), bytes(child)], {
    verified_at: '2026-09-19T23:24:00.000Z',
  });

  assert.deepEqual(result.relationships.map((edge) => ({
    type: edge.type,
    parent_slot: edge.parent_slot,
    child_slot: edge.child_slot,
  })), [{
    type: 'DIRECT_PARENT',
    parent_slot: 'S1',
    child_slot: 'S2',
  }]);
  assert.equal(summaryObject(result)['DIRECT RELATIONSHIPS'], 1);
});

test('three-source direct chain never manufactures a transitive relationship edge', async () => {
  const a = await v01(['https://example.org/a']);
  const b = await v01(
    ['https://example.org/a', 'https://example.org/b'],
    { seed: 'b-child', parent: { trail_id: a.trail_id, fork_at: 1 } },
  );
  const c = await v01(
    ['https://example.org/a', 'https://example.org/b', 'https://example.org/c'],
    { seed: 'c-child', parent: { trail_id: b.trail_id, fork_at: 2 } },
  );

  const result = await core().build([bytes(a), bytes(b), bytes(c)], {
    verified_at: '2026-09-19T23:25:00.000Z',
  });

  assert.deepEqual(
    result.relationships.map((edge) => edge.parent_slot + '>' + edge.child_slot),
    ['S1>S2', 'S2>S3'],
  );
  assert.equal(result.relationships.some((edge) => edge.parent_slot === 'S1' && edge.child_slot === 'S3'), false);
});

test('REJECTED and UNVERIFIED sources remain diagnostic and contribute no pair or relationship facts', async () => {
  const valid = await v01(['https://example.org/a']);
  const tampered = await v01(['https://example.org/b'], { seed: 'tampered' });
  tampered.manifest.routes[0].url = 'https://attacker.invalid/';

  const unsupported = new TextEncoder().encode(JSON.stringify({
    trail_id: 'sha256:' + 'f'.repeat(64),
    manifest: { format: 'r4b1t-trail/v9.9' },
  }));

  const result = await core().build([bytes(valid), bytes(tampered), unsupported], {
    verified_at: '2026-09-19T23:26:00.000Z',
  });
  const summary = summaryObject(result);

  assert.deepEqual(result.sources.map((source) => source.verification.state), [
    'VERIFIED', 'REJECTED', 'UNVERIFIED'
  ]);
  assert.equal(result.pairs.length, 0);
  assert.equal(result.relationships.length, 0);
  assert.equal(summary.VERIFIED, 1);
  assert.equal(summary.REJECTED, 1);
  assert.equal(summary.UNVERIFIED, 1);
  assert.equal(summary['VERIFIED PAIRS'], 0);
  assert.equal(summary['DIVERGENT PAIRS'], 0);
});

test('concealed v0.2 sources are summarized only from frozen comparison facts without route leakage', async () => {
  const left = await v02([{ url: 'https://secret.example/a', revealed: false, nonce: NONCE_A }]);
  const right = await v02([{ url: 'https://secret.example/b', revealed: false, nonce: NONCE_A }], {
    created_at: '2026-09-19T23:11:00.000Z',
  });

  const result = await core().build([bytes(left), bytes(right)], {
    verified_at: '2026-09-19T23:27:00.000Z',
  });

  assert.equal(result.sources.every((source) => source.verification.state === 'VERIFIED'), true);
  assert.equal(result.pairs.length, 1);
  assert.equal(summaryObject(result)['DIVERGENT PAIRS'], 1);
  assert.equal(JSON.stringify(result).includes('secret.example'), false);
});

test('core output is deterministic for identical bytes and explicit verification timestamp', async () => {
  const a = await v01(['https://example.org/a']);
  const b = await v01(['https://example.org/b'], { seed: 'det-b' });
  const inputs = [bytes(a, true), bytes(b, false)];

  const first = await core().build(inputs, { verified_at: '2026-09-19T23:28:00.000Z' });
  const second = await core().build(inputs, { verified_at: '2026-09-19T23:28:00.000Z' });

  assert.deepEqual(second, first);
});

test('core validates its own projection invariants and rejects altered pair ordering', async () => {
  const a = await v01(['https://example.org/a']);
  const b = await v01(['https://example.org/b'], { seed: 'validate-b' });
  const c = await v01(['https://example.org/c'], { seed: 'validate-c' });
  const result = await core().build([bytes(a), bytes(b), bytes(c)], {
    verified_at: '2026-09-19T23:29:00.000Z',
  });

  const altered = JSON.parse(JSON.stringify(result));
  [altered.pairs[0], altered.pairs[1]] = [altered.pairs[1], altered.pairs[0]];

  assert.throws(() => core().validateProjection(altered), /pair order/i);
});

test('core exposes no network, persistence, sampler, ranking, recommendation, or selection hooks', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'proof-session.js'), 'utf8');

  for (const forbidden of [
    'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'caches.',
    'createSampler(', 'nextFloat(', 'selection_weight', 'sampler_weight',
    'popularity', 'engagement', 'recommendation', 'rankRoutes(',
    'triggerSprout(', 'R4b1tWear',
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});
