'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');
const topology = require('../trail-topology.js');
const card = require('../trail-card.js');

const CORPUS = 'sha256:' + 'a'.repeat(64);

function bytes(value) {
  return JSON.stringify(value);
}

async function v01Snapshot(options) {
  const manifest = await trail.createManifest({
    created_at: options.created_at,
    corpus_revision: CORPUS,
    seed: options.seed || 'card-core',
    terrain: 'RESEARCH',
    routes: options.routes || [],
    parent: options.parent || null,
  });
  return trail.envelope(manifest);
}

test('projects a verified v0.1 trail from exact source bytes', async () => {
  const snapshot = await v01Snapshot({
    created_at: '2026-09-19T15:00:00.000Z',
    routes: [
      { url: 'https://example.org/one', action: 'ROLL' },
      { url: 'https://example.org/two', action: 'ROLL' },
    ],
  });
  const source = bytes(snapshot);
  const projected = await card.project(source, { verified_at: '2026-09-19T15:01:00.000Z' });

  assert.equal(projected.verification.state, 'VERIFIED');
  assert.equal(projected.source.artifact_format, trail.FORMAT);
  assert.equal(projected.verification.verified_digest, projected.source.artifact_digest);
  assert.equal(projected.display.kind, 'trail');
  assert.equal(projected.display.stop_count, 2);
  assert.deepEqual(projected.display.stops, [
    { index: 0, state: 'revealed' },
    { index: 1, state: 'revealed' },
  ]);
  card.validateProjection(projected);
});

test('digest binds the exact UTF-8 bytes, including insignificant JSON whitespace', async () => {
  const snapshot = await v01Snapshot({
    created_at: '2026-09-19T15:02:00.000Z',
    routes: [{ url: 'https://example.net/exact-bytes', action: 'ROLL' }],
  });
  const compact = JSON.stringify(snapshot);
  const pretty = JSON.stringify(snapshot, null, 2);
  const left = await card.project(compact, { verified_at: '2026-09-19T15:03:00.000Z' });
  const right = await card.project(pretty, { verified_at: '2026-09-19T15:03:00.000Z' });

  assert.equal(left.verification.state, 'VERIFIED');
  assert.equal(right.verification.state, 'VERIFIED');
  assert.notEqual(left.source.artifact_digest, right.source.artifact_digest);
});

test('projects concealed v0.2 material without leaking route identity', async () => {
  let manifest = await blind.create({
    created_at: '2026-09-19T15:04:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  });
  const committed = await blind.commit(
    manifest,
    'https://secret.example/never-on-card',
    'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
  );
  const snapshot = await blind.envelope(committed.manifest);
  const projected = await card.project(bytes(snapshot), { verified_at: '2026-09-19T15:05:00.000Z' });

  assert.equal(projected.verification.state, 'VERIFIED');
  assert.equal(projected.display.concealed_count, 1);
  assert.deepEqual(projected.display.stops, [{ index: 0, state: 'concealed' }]);
  assert.equal(JSON.stringify(projected).includes('secret.example'), false);
});

test('keeps PARENT ABSENT as a verified relationship fact', async () => {
  const missingParentId = 'sha256:' + 'b'.repeat(64);
  const child = await v01Snapshot({
    created_at: '2026-09-19T15:06:00.000Z',
    routes: [],
    parent: { trail_id: missingParentId, fork_at: 0 },
  });
  const exported = await topology.exportTopology([child], {
    created_at: '2026-09-19T15:07:00.000Z',
  });
  const projected = await card.project(bytes(exported), { verified_at: '2026-09-19T15:08:00.000Z' });

  assert.equal(projected.verification.state, 'VERIFIED');
  assert.equal(projected.display.kind, 'topology');
  assert.equal(projected.display.parent_absent_count, 1);
  assert.equal(projected.display.branch_diagram.nodes[0].relationship_state, 'PARENT ABSENT');
  assert.equal(projected.display.branch_diagram.edges[0].relationship_state, 'PARENT ABSENT');
});

test('verifier-detected trail tampering produces REJECTED diagnostic card', async () => {
  const snapshot = await v01Snapshot({
    created_at: '2026-09-19T15:09:00.000Z',
    routes: [{ url: 'https://example.com/original', action: 'ROLL' }],
  });
  snapshot.manifest.routes[0].url = 'https://attacker.invalid/';
  const projected = await card.project(bytes(snapshot), { verified_at: '2026-09-19T15:10:00.000Z' });

  assert.equal(projected.verification.state, 'REJECTED');
  assert.match(projected.verification.reason, /Route ID mismatch/);
  assert.equal(projected.display, null);
  assert.equal(projected.diagnostic_notice, card.DIAGNOSTIC_NOTICE);
});

test('verifier-detected topology tampering produces REJECTED diagnostic card', async () => {
  const snapshot = await v01Snapshot({
    created_at: '2026-09-19T15:11:00.000Z',
    routes: [{ url: 'https://example.org/topology', action: 'ROLL' }],
  });
  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-19T15:12:00.000Z',
  });
  exported.nodes[0].stops[0].url = 'https://attacker.invalid/';
  const projected = await card.project(bytes(exported), { verified_at: '2026-09-19T15:13:00.000Z' });

  assert.equal(projected.verification.state, 'REJECTED');
  assert.match(projected.verification.reason, /Topology node stop derivation mismatch/);
  assert.equal(projected.display, null);
});

test('unsupported source format fails closed to UNVERIFIED', async () => {
  const projected = await card.project(
    JSON.stringify({ format: 'r4b1t-topology-export/v9.9', nodes: [] }),
    { verified_at: '2026-09-19T15:14:00.000Z' },
  );

  assert.equal(projected.verification.state, 'UNVERIFIED');
  assert.equal(projected.verification.verified_at, null);
  assert.equal(projected.verification.verified_digest, null);
  assert.equal(projected.display, null);
  assert.equal(projected.diagnostic_notice, card.DIAGNOSTIC_NOTICE);
});

test('malformed JSON is REJECTED and still binds the attempted bytes', async () => {
  const source = '{"format":"r4b1t-trail/v0.1",';
  const projected = await card.project(source, { verified_at: '2026-09-19T15:15:00.000Z' });

  assert.equal(projected.verification.state, 'REJECTED');
  assert.equal(projected.source.artifact_format, null);
  assert.match(projected.source.artifact_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(projected.display, null);
});

test('projection requires explicit verification time for every attempted supported verification', async () => {
  const snapshot = await v01Snapshot({
    created_at: '2026-09-19T15:16:00.000Z',
    routes: [],
  });

  await assert.rejects(
    () => card.project(bytes(snapshot)),
    /explicit ISO timestamp/,
  );
});

test('projector source contains no DOM, storage, share, sampler, ranking, or network hooks', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'trail-card.js'), 'utf8');

  for (const forbidden of [
    /document\./,
    /window\./,
    /localStorage/,
    /sessionStorage/,
    /navigator\.share/,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /createSampler\s*\(/,
    /selection_weight/i,
    /popularity/i,
    /engagement/i,
    /recommendation/i,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});
