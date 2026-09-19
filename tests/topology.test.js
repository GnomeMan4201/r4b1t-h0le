'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');
const topology = require('../trail-topology.js');

const CORPUS = 'sha256:' + 'a'.repeat(64);
const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NONCE = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';

async function v01(options) {
  return trail.envelope(await trail.createManifest({
    created_at: options.created_at,
    corpus_revision: CORPUS,
    seed: options.seed,
    terrain: 'RESEARCH',
    routes: options.routes,
    parent: options.parent || null,
  }));
}

test('topology verifies, deduplicates, and links known v0.1 snapshots', async () => {
  const parent = await v01({
    created_at: '2026-09-14T20:00:00.000Z',
    seed: 'parent',
    routes: [{ url: 'https://example.org/one', action: 'ROLL' }],
  });
  const child = await v01({
    created_at: '2026-09-14T21:00:00.000Z',
    seed: 'child',
    routes: [
      { url: 'https://example.org/one', action: 'ROLL' },
      { url: 'https://example.net/two', action: 'BRANCH' },
    ],
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });
  const graph = await topology.build([child, parent, child]);
  assert.equal(graph.snapshots.length, 2);
  assert.equal(graph.snapshots[1].parent_known, true);
  assert.equal(graph.snapshots[1].stops[0].inherited, true);
  assert.equal(graph.snapshots[1].stops[1].inherited, false);
});

test('topology preserves an honest unresolved-parent stub', async () => {
  const child = await v01({
    created_at: '2026-09-14T21:00:00.000Z',
    seed: 'child',
    routes: [{ url: 'https://example.org/one', action: 'ROLL' }],
    parent: { trail_id: 'sha256:' + 'b'.repeat(64), fork_at: 1 },
  });
  const graph = await topology.build([child]);
  assert.equal(graph.snapshots[0].parent_known, false);
});

test('concealed v0.2 stops expose no route identity through topology', async () => {
  const manifest = await blind.create({
    created_at: '2026-09-14T22:00:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
  });
  const committed = await blind.commit(manifest, 'https://secret.example/path', NONCE);
  const snapshot = await blind.envelope(committed.manifest);
  const graph = await topology.build([snapshot]);
  const serialized = JSON.stringify(graph);
  assert.equal(graph.snapshots[0].stops[0].state, 'concealed');
  assert.equal(graph.snapshots[0].stops[0].url, null);
  assert.equal(serialized.includes('secret.example'), false);
});

test('topology rejects a tampered snapshot instead of mapping it', async () => {
  const snapshot = await v01({
    created_at: '2026-09-14T20:00:00.000Z',
    seed: 'parent',
    routes: [{ url: 'https://example.org/one', action: 'ROLL' }],
  });
  snapshot.manifest.routes[0].url = 'https://attacker.invalid/';
  await assert.rejects(() => topology.build([snapshot]), /Route ID mismatch/);
});

test('topology rejects individually valid snapshots with false lineage', async () => {
  const parent = await v01({
    created_at: '2026-09-14T20:00:00.000Z',
    seed: 'parent',
    routes: [{ url: 'https://example.org/one', action: 'ROLL' }],
  });
  const child = await v01({
    created_at: '2026-09-14T21:00:00.000Z',
    seed: 'child',
    routes: [{ url: 'https://example.net/not-inherited', action: 'ROLL' }],
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });
  await assert.rejects(() => topology.build([parent, child]), /Fork prefix mismatch/);
});

test('v0.2 child stops begin after the parent fork and are not inherited', async () => {
  const parentManifest = await blind.create({
    created_at: '2026-09-14T22:00:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
  });
  const parentCommitted = await blind.commit(parentManifest, 'https://example.org/parent', NONCE);
  const parent = await blind.envelope(parentCommitted.manifest);
  const childManifest = await blind.create({
    created_at: '2026-09-14T23:00:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
    parent: {
      trail_id: parent.trail_id,
      genesis_id: parent.manifest.genesis_id,
      fork_at: 0,
      commitment: parent.manifest.steps[0].commitment,
    },
  });
  const childCommitted = await blind.commit(
    childManifest,
    'https://example.net/after-fork',
    'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM',
  );
  const child = await blind.envelope(childCommitted.manifest);
  const graph = await topology.build([parent, child]);
  const childNode = graph.snapshots.find((snapshot) => snapshot.trail_id === child.trail_id);
  assert.equal(childNode.parent_known, true);
  assert.equal(childNode.stops[0].inherited, false);
});


test('proof-state model derives categorical artifact, relationship, and stop states', async () => {
  const parent = await v01({
    created_at: '2026-09-18T15:00:00.000Z',
    seed: 'proof-parent',
    routes: [{ url: 'https://example.org/parent', action: 'ROLL' }],
  });
  const knownChild = await v01({
    created_at: '2026-09-18T15:01:00.000Z',
    seed: 'proof-known-child',
    routes: [
      { url: 'https://example.org/parent', action: 'ROLL' },
      { url: 'https://example.net/child', action: 'BRANCH' },
    ],
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });
  const absentChild = await v01({
    created_at: '2026-09-18T15:02:00.000Z',
    seed: 'proof-absent-child',
    routes: [{ url: 'https://example.com/absent', action: 'ROLL' }],
    parent: { trail_id: 'sha256:' + 'b'.repeat(64), fork_at: 1 },
  });

  const graph = await topology.build([parent, knownChild, absentChild]);
  const parentNode = graph.snapshots.find((node) => node.trail_id === parent.trail_id);
  const knownNode = graph.snapshots.find((node) => node.trail_id === knownChild.trail_id);
  const absentNode = graph.snapshots.find((node) => node.trail_id === absentChild.trail_id);

  assert.equal(parentNode.proof_state, 'VERIFIED');
  assert.equal(parentNode.relationship_state, null);
  assert.equal(parentNode.stops[0].proof_state, 'REVEALED');

  assert.equal(knownNode.proof_state, 'VERIFIED');
  assert.equal(knownNode.relationship_state, 'VERIFIED');

  assert.equal(absentNode.proof_state, 'VERIFIED');
  assert.equal(absentNode.relationship_state, 'PARENT ABSENT');
});

test('proof-state model derives CONCEALED and REVEALED for Blind Descent stops', async () => {
  const manifest = await blind.create({
    created_at: '2026-09-18T16:00:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
  });
  const committed = await blind.commit(manifest, 'https://example.org/hidden', NONCE);
  const concealed = await blind.envelope(committed.manifest);

  const concealedGraph = await topology.build([concealed]);
  assert.equal(concealedGraph.snapshots[0].stops[0].proof_state, 'CONCEALED');

  const revealedManifest = await blind.reveal(committed.manifest, committed.secret);
  const revealed = await blind.envelope(revealedManifest);
  const revealedGraph = await topology.build([revealed]);
  assert.equal(revealedGraph.snapshots[0].stops[0].proof_state, 'REVEALED');
});

test('proof-state model classifies invalid artifacts as REJECTED without admitting them to the graph', async () => {
  const snapshot = await v01({
    created_at: '2026-09-18T17:00:00.000Z',
    seed: 'proof-rejected',
    routes: [{ url: 'https://example.org/original', action: 'ROLL' }],
  });
  snapshot.manifest.routes[0].url = 'https://attacker.invalid/';

  const classified = await topology.classify(snapshot);
  assert.equal(classified.proof_state, 'REJECTED');
  assert.equal(classified.snapshot, null);
  assert.equal(classified.trail_id, snapshot.trail_id);
  assert.match(classified.reason, /Route ID mismatch/);

  await assert.rejects(() => topology.build([snapshot]), /Route ID mismatch/);
});

test('proof-state vocabulary contains no probabilistic confidence semantics', () => {
  assert.deepEqual(topology.PROOF_STATES, {
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED',
    PARENT_ABSENT: 'PARENT ABSENT',
    CONCEALED: 'CONCEALED',
    REVEALED: 'REVEALED',
  });

  const serialized = JSON.stringify(topology.PROOF_STATES).toLowerCase();
  for (const banned of ['confidence', 'score', 'percent', 'probability', 'interesting']) {
    assert.equal(serialized.includes(banned), false);
  }
});


test('topology export is deterministic and round-trips through independent re-verification', async () => {
  const parent = await v01({
    created_at: '2026-09-18T20:00:00.000Z',
    seed: 'roundtrip-parent',
    routes: [{ url: 'https://example.org/one', action: 'ROLL' }],
  });
  const child = await v01({
    created_at: '2026-09-18T20:01:00.000Z',
    seed: 'roundtrip-child',
    routes: [
      { url: 'https://example.org/one', action: 'ROLL' },
      { url: 'https://example.net/two', action: 'BRANCH' },
    ],
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });

  const options = { created_at: '2026-09-18T20:05:00.000Z' };
  const first = await topology.exportTopology([child, parent], options);
  const second = await topology.exportTopology([child, parent], options);

  assert.equal(topology.EXPORT_FORMAT, 'r4b1t-topology-export/v0.1');
  assert.equal(trail.canonicalJson(first), trail.canonicalJson(second));
  assert.equal(first.nodes.length, 2);
  assert.equal(first.edges.length, 1);
  assert.equal(first.edges[0].proof_state, 'VERIFIED');

  const imported = await topology.importTopology(JSON.stringify(first));
  assert.equal(imported.graph.snapshots.length, 2);
  assert.equal(imported.diagnostics.length, 0);
  assert.equal(trail.canonicalJson(imported.export), trail.canonicalJson(first));

  const rebuilt = await topology.exportTopology(imported.snapshots, options);
  assert.equal(trail.canonicalJson(rebuilt), trail.canonicalJson(first));
});

test('topology export preserves concealed commitments without leaking route identity', async () => {
  const manifest = await blind.create({
    created_at: '2026-09-18T20:10:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
  });
  const committed = await blind.commit(manifest, 'https://secret.example/private', NONCE);
  const snapshot = await blind.envelope(committed.manifest);

  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-18T20:11:00.000Z',
  });
  const stop = exported.nodes[0].stops[0];

  assert.equal(stop.proof_state, 'CONCEALED');
  assert.equal(stop.route_id, null);
  assert.equal(stop.url, null);
  assert.match(stop.commitment, /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(exported).includes('secret.example'), false);

  const imported = await topology.importTopology(exported);
  assert.equal(imported.graph.snapshots[0].stops[0].proof_state, 'CONCEALED');
  assert.equal(imported.graph.snapshots[0].stops[0].url, null);
});

test('topology export keeps rejected artifacts diagnostics-only', async () => {
  const valid = await v01({
    created_at: '2026-09-18T20:20:00.000Z',
    seed: 'roundtrip-valid',
    routes: [{ url: 'https://example.org/valid', action: 'ROLL' }],
  });
  const rejected = JSON.parse(JSON.stringify(valid));
  rejected.manifest.routes[0].url = 'https://attacker.invalid/';

  const exported = await topology.exportTopology([valid, rejected], {
    created_at: '2026-09-18T20:21:00.000Z',
  });

  assert.equal(exported.nodes.length, 1);
  assert.equal(exported.nodes[0].trail_id, valid.trail_id);
  assert.equal(exported.diagnostics.length, 1);
  assert.equal(exported.diagnostics[0].proof_state, 'REJECTED');
  assert.equal(exported.diagnostics[0].trail_id, rejected.trail_id);
  assert.match(exported.diagnostics[0].reason, /Route ID mismatch/);

  const imported = await topology.importTopology(exported);
  assert.equal(imported.graph.snapshots.length, 1);
  assert.equal(imported.diagnostics.length, 1);
});

test('topology import rejects tampered canonical manifests', async () => {
  const snapshot = await v01({
    created_at: '2026-09-18T20:30:00.000Z',
    seed: 'roundtrip-tamper-manifest',
    routes: [{ url: 'https://example.org/original', action: 'ROLL' }],
  });
  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-18T20:31:00.000Z',
  });

  exported.nodes[0].manifest.routes[0].url = 'https://attacker.invalid/';
  await assert.rejects(() => topology.importTopology(exported), /Route ID mismatch/);
});

test('topology import rejects tampered derived node and edge claims', async () => {
  const parent = await v01({
    created_at: '2026-09-18T20:40:00.000Z',
    seed: 'roundtrip-derived-parent',
    routes: [{ url: 'https://example.org/one', action: 'ROLL' }],
  });
  const child = await v01({
    created_at: '2026-09-18T20:41:00.000Z',
    seed: 'roundtrip-derived-child',
    routes: [
      { url: 'https://example.org/one', action: 'ROLL' },
      { url: 'https://example.net/two', action: 'BRANCH' },
    ],
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });

  const original = await topology.exportTopology([parent, child], {
    created_at: '2026-09-18T20:42:00.000Z',
  });

  const nodeTamper = JSON.parse(JSON.stringify(original));
  nodeTamper.nodes[1].stops[1].url = 'https://attacker.invalid/';
  await assert.rejects(() => topology.importTopology(nodeTamper), /node derivation mismatch/);

  const edgeTamper = JSON.parse(JSON.stringify(original));
  edgeTamper.edges[0].fork_at = 0;
  await assert.rejects(() => topology.importTopology(edgeTamper), /edge derivation mismatch/);
});

test('topology export requires explicit deterministic creation metadata', async () => {
  const snapshot = await v01({
    created_at: '2026-09-18T20:50:00.000Z',
    seed: 'roundtrip-explicit-time',
    routes: [{ url: 'https://example.org/time', action: 'ROLL' }],
  });

  await assert.rejects(
    () => topology.exportTopology([snapshot], {}),
    /Topology export creation time must be an ISO timestamp/,
  );
});
