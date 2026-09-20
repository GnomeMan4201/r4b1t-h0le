'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const trail = require('../trail-manifest.js');
const proofBundle = require('../proof-session-bundle.js');
const comparisonBundle = require('../trail-comparison-bundle.js');
const replayDelegation = require('../replay-inspection-delegation.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);
const VERIFIED_AT = '2026-09-20T09:30:00.000Z';
const LATER_AT = '2026-09-20T09:31:00.000Z';

function bytes(value) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
}

async function source(urls, seed, parent) {
  const manifest = await trail.createManifest({
    created_at: '2026-09-20T09:20:00.000Z',
    corpus_revision: CORPUS,
    seed,
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: parent || null,
  });
  return trail.envelope(manifest);
}

test('multi-source delegation preserves first-seen exact-byte order and frozen duplicate counts', async () => {
  const a = bytes(await source(['https://example.org/a'], 'order-a'));
  const b = bytes(await source(['https://example.org/b'], 'order-b'));

  const result = await replayDelegation.inspectSources([b, a, b], { verified_at: VERIFIED_AT });
  const projection = result.projection;

  assert.equal(result.delegate, 'r4b1t-proof-session/v0.1');
  assert.equal(projection.sources.length, 2);
  assert.equal(projection.sources[0].slot_id, 'S1');
  assert.equal(projection.sources[0].artifact_digest, 'sha256:' + await trail.sha256Hex(b));
  assert.equal(projection.sources[0].supplied_count, 2);
  assert.equal(projection.sources[1].slot_id, 'S2');
  assert.equal(projection.sources[1].artifact_digest, 'sha256:' + await trail.sha256Hex(a));
  assert.equal(projection.sources[1].supplied_count, 1);
});

test('diagnostic source is scoped and does not poison independently verified sources', async () => {
  const goodA = bytes(await source(['https://example.org/a'], 'diag-a'));
  const goodB = bytes(await source(['https://example.org/b'], 'diag-b'));
  const bad = await source(['https://example.org/bad'], 'diag-bad');
  bad.manifest.routes[0].url = 'https://attacker.invalid/';
  const badBytes = bytes(bad);

  const result = await replayDelegation.inspectSources([goodA, badBytes, goodB], {
    verified_at: VERIFIED_AT,
  });
  const projection = result.projection;

  assert.deepEqual(
    projection.sources.map((item) => item.verification.state),
    ['VERIFIED', 'REJECTED', 'VERIFIED'],
  );
  assert.equal(projection.pairs.length, 1);
  assert.equal(projection.pairs[0].left_slot, 'S1');
  assert.equal(projection.pairs[0].right_slot, 'S3');
  assert.equal(projection.relationships.length, 0);
});

test('direct lineage is delegate-produced and no transitive edge is synthesized', async () => {
  const a = await source(['https://example.org/a'], 'lineage-a');
  const b = await source(
    ['https://example.org/a', 'https://example.org/b'],
    'lineage-b',
    { trail_id: a.trail_id, fork_at: 1 },
  );
  const c = await source(
    ['https://example.org/a', 'https://example.org/b', 'https://example.org/c'],
    'lineage-c',
    { trail_id: b.trail_id, fork_at: 2 },
  );

  const result = await replayDelegation.inspectSources([bytes(a), bytes(b), bytes(c)], {
    verified_at: VERIFIED_AT,
  });

  assert.deepEqual(result.projection.relationships.map((edge) => ({
    parent_slot: edge.parent_slot,
    child_slot: edge.child_slot,
  })), [
    { parent_slot: 'S1', child_slot: 'S2' },
    { parent_slot: 'S2', child_slot: 'S3' },
  ]);
  assert.equal(
    result.projection.relationships.some((edge) => edge.parent_slot === 'S1' && edge.child_slot === 'S3'),
    false,
  );
});

test('portable Proof Session MATCH passes through frozen inspector unchanged', async () => {
  const a = bytes(await source(['https://example.org/a'], 'portable-match-a'));
  const b = bytes(await source(['https://example.org/b'], 'portable-match-b'));
  const portable = await proofBundle.create([a, b], { verified_at: VERIFIED_AT });

  const delegated = await replayDelegation.inspectProofSession(portable, { verified_at: LATER_AT });

  assert.equal(delegated.portable_classification, 'MATCH');
  assert.equal(delegated.result.classification, 'MATCH');
  assert.deepEqual(delegated.result.mismatches, []);
  assert.equal(delegated.result.fresh_projection.sources[0].verification.verified_at, LATER_AT);
});

test('portable Proof Session MISMATCH passes through while fresh recomputation remains authoritative', async () => {
  const a = bytes(await source(['https://example.org/a'], 'portable-mismatch-a'));
  const b = bytes(await source(['https://example.org/b'], 'portable-mismatch-b'));
  const portable = await proofBundle.create([a, b], { verified_at: VERIFIED_AT });

  const stored = JSON.parse(Buffer.from(portable.files[proofBundle.SESSION_FILE]).toString('utf8'));
  stored.summary[0].count = 999;
  portable.files[proofBundle.SESSION_FILE] = new TextEncoder().encode(JSON.stringify(stored, null, 2) + '\n');

  const delegated = await replayDelegation.inspectProofSession(portable, { verified_at: LATER_AT });

  assert.equal(delegated.portable_classification, 'MISMATCH');
  assert.equal(delegated.result.classification, 'MISMATCH');
  assert.ok(delegated.result.mismatches.includes(proofBundle.SESSION_FILE));
  assert.equal(delegated.result.stored_projection.summary[0].count, 999);
  assert.equal(delegated.result.fresh_projection.summary[0].count, 2);
});

test('portable Proof Session UNREADABLE passes through and never substitutes stored projection', async () => {
  const a = bytes(await source(['https://example.org/a'], 'portable-unreadable'));
  const portable = await proofBundle.create([a], { verified_at: VERIFIED_AT });
  delete portable.files[proofBundle.sourceFileName(portable.projection.sources[0])];

  const delegated = await replayDelegation.inspectProofSession(portable, { verified_at: LATER_AT });

  assert.equal(delegated.portable_classification, 'UNREADABLE');
  assert.equal(delegated.result.classification, 'UNREADABLE');
  assert.equal(delegated.result.fresh_projection, null);
  assert.equal(delegated.result.stored_projection, null);
});

test('one unreadable portable Proof Session does not poison an independent file set', async () => {
  const a = bytes(await source(['https://example.org/a'], 'independent-a'));
  const b = bytes(await source(['https://example.org/b'], 'independent-b'));
  const unreadable = await proofBundle.create([a], { verified_at: VERIFIED_AT });
  const readable = await proofBundle.create([b], { verified_at: VERIFIED_AT });

  delete unreadable.files[proofBundle.sourceFileName(unreadable.projection.sources[0])];

  const results = await replayDelegation.inspectProofSessions([unreadable, readable], {
    verified_at: LATER_AT,
  });

  assert.deepEqual(results.map((item) => item.portable_classification), ['UNREADABLE', 'MATCH']);
  assert.equal(results[0].result.fresh_projection, null);
  assert.ok(results[1].result.fresh_projection);
});

test('portable Trail Comparison is delegated without inventing a portable classification', async () => {
  const left = bytes(await source(['https://example.org/a'], 'pair-left'));
  const right = bytes(await source(['https://example.org/b'], 'pair-right'));
  const portable = await comparisonBundle.create(left, right, { verified_at: VERIFIED_AT });

  const delegated = await replayDelegation.inspectTrailComparison(portable, { verified_at: LATER_AT });

  assert.equal(delegated.delegate, 'r4b1t-trail-comparison/v0.1');
  assert.equal(Object.prototype.hasOwnProperty.call(delegated, 'portable_classification'), false);
  assert.equal(delegated.result.left_source_matches, true);
  assert.equal(delegated.result.right_source_matches, true);
  assert.equal(delegated.result.fresh_projection.verification.left.verified_at, LATER_AT);
});

test('delegation defensively copies exact inputs before asynchronous delegate work', async () => {
  const original = bytes(await source(['https://example.org/a'], 'defensive-input'));
  const pristine = new Uint8Array(original);

  const pending = replayDelegation.inspectSources([original], { verified_at: VERIFIED_AT });
  original.fill(0);
  const result = await pending;

  assert.equal(result.projection.sources[0].verification.state, 'VERIFIED');
  assert.equal(
    result.projection.sources[0].artifact_digest,
    'sha256:' + await trail.sha256Hex(pristine),
  );
});

test('returned delegation results are defensive public copies', async () => {
  const a = bytes(await source(['https://example.org/a'], 'defensive-output-a'));
  const b = bytes(await source(['https://example.org/b'], 'defensive-output-b'));
  const first = await replayDelegation.inspectSources([a, b], { verified_at: VERIFIED_AT });

  first.projection.sources[0].verification.state = 'REJECTED';
  first.projection.pairs.length = 0;

  const second = await replayDelegation.inspectSources([a, b], { verified_at: VERIFIED_AT });
  assert.equal(second.projection.sources[0].verification.state, 'VERIFIED');
  assert.equal(second.projection.pairs.length, 1);
});

test('delegation layer contains no second proof algorithm, persistence, network, ranking, or precedence mechanism', () => {
  const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', 'replay-inspection-delegation.js'),
    'utf8',
  );

  for (const forbidden of [
    /verifyLineage/,
    /sharedPrefix/,
    /positionState/,
    /canonicalJson/,
    /localStorage/,
    /sessionStorage/,
    /indexedDB/i,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /EventSource/,
    /navigator\./,
    /document\./,
    /window\./,
    /recommend/i,
    /rank/i,
    /popularity/i,
    /precedence/i,
    /createSampler\s*\(/,
  ]) {
    assert.equal(forbidden.test(sourceCode), false, 'forbidden delegation behavior: ' + forbidden);
  }
});

test('browser build exposes raw-source delegation and fails closed for unavailable portable delegates', async () => {
  const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', 'replay-inspection-delegation.js'),
    'utf8',
  );
  const calls = [];
  const context = {
    Uint8Array,
    TextEncoder,
    R4b1tProofSession: {
      FORMAT: 'r4b1t-proof-session/v0.1',
      async build(inputs) {
        calls.push(inputs.map((input) => Array.from(input)));
        return { sources: [], pairs: [], relationships: [], summary: [] };
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(sourceCode, context, { filename: 'replay-inspection-delegation.js' });

  assert.equal(typeof context.R4b1tReplayInspectionDelegation.inspectSources, 'function');
  await context.R4b1tReplayInspectionDelegation.inspectSources([
    new Uint8Array([2, 1]),
    new Uint8Array([3, 4]),
  ]);
  assert.deepEqual(calls, [[[2, 1], [3, 4]]]);
  await assert.rejects(
    context.R4b1tReplayInspectionDelegation.inspectProofSession({ files: {} }),
    /portable Proof Session inspection is unavailable/i,
  );
});
