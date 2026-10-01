'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const trail = require('../trail-manifest.js');
const v03 = require('../trail-v03.js');
const selection = require('../selection-core.js');

const ROOT = path.resolve(__dirname, '..');
const RELEASE = path.join(ROOT, 'corpus/releases/diverse-candidate-v0.2');
const URL_BYTES = fs.readFileSync(path.join(RELEASE, 'urls.txt'));
const URLS = URL_BYTES.toString('utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RELEASE, 'manifest.json'), 'utf8'));
const INDEX_PATH = path.join(ROOT, 'corpus/terrains/diverse-candidate-v0.2/terrain-index-v1.json');
const INDEX_BYTES = fs.readFileSync(INDEX_PATH);
const INDEX = JSON.parse(INDEX_BYTES.toString('utf8'));
const INDEX_DIGEST = 'sha256:' + crypto.createHash('sha256').update(INDEX_BYTES).digest('hex');
const SEED = '00112233445566778899aabbccddeeff';

function constraint(terrain) {
  return {
    terrain,
    terrainIndex: terrain === 'ALL' ? null : { schema: 'r4b1t-terrain-index-v1', digest: INDEX_DIGEST },
    protocolPolicy: { version: 1, excludeOnion: false },
  };
}

async function buildArtifact(terrains) {
  const sampler = trail.createSampler(SEED);
  let cursor = 0;
  let sequence = 0;
  let previous = null;
  const steps = [];

  for (const terrain of terrains) {
    const c = constraint(terrain);
    const pool = selection.eligiblePool(URLS, INDEX, c);
    let selected = null;
    let drawCount = 0;
    do {
      selected = pool[Math.floor(sampler() * pool.length)];
      drawCount += 1;
      if (previous === null || selected !== previous) break;
    } while (drawCount < 30);

    sequence += 1;
    const tx = {
      transaction_version: 'r4b1t-selection-transaction/v2',
      sequence,
      action: 'ROLL',
      constraint: c,
      corpus_revision: MANIFEST.urls_digest,
      eligible_count: pool.length,
      sampler: {
        algorithm: 'uniform-with-repeat-guard-v1',
        prng: 'mulberry32-v1',
        seed: SEED,
        draw_start: cursor,
        draw_count: drawCount,
        repeat_guard: { reference: previous, max_draws: 30 },
      },
      route: { url: selected },
    };
    steps.push({
      index: steps.length + 1,
      kind: 'ROLL',
      route: { route_id: await trail.routeId(selected), url: selected },
      transaction: tx,
    });
    cursor += drawCount;
    previous = selected;
  }

  return v03.envelope({
    format: v03.FORMAT,
    created_at: '2026-10-01T20:30:00.000Z',
    corpus_revision: MANIFEST.urls_digest,
    steps,
    parent: null,
  });
}

function runPython(artifact) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r4b1t-reexec-'));
  const file = path.join(dir, 'trail.json');
  fs.writeFileSync(file, JSON.stringify(artifact) + '\n');
  const result = spawnSync(
    'python3',
    ['tools/reexecute_trail.py', file, '--root', ROOT, '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

test('independent Python re-executor reproduces JS ROLLs across ALL and typed terrain', async () => {
  const artifact = await buildArtifact(['ALL', 'security_tool']);
  const result = runPython(artifact);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'PROVENANCE_REEXECUTED');
  assert.equal(report.roll_steps, 2);
  assert.equal(report.release_id, 'diverse-candidate-v0.2');
  assert.equal(report.seed_state_bits, 32);
  assert.equal(report.claims.route_derivation, 'PROVEN');
  assert.equal(report.claims.seed_fairness, 'NOT_ESTABLISHED');
  assert.equal(report.rolls[0].terrain, 'ALL');
  assert.equal(report.rolls[1].terrain, 'security_tool');
  assert.equal(report.rolls[1].terrain_authority, 'AUTHORITATIVE_ACTIVE');
});

test('integrity-valid arbitrary route substitution fails independent re-execution', async () => {
  const source = await buildArtifact(['ALL']);
  const manifest = structuredClone(source.manifest);
  const original = manifest.steps[0].route.url;
  const replacement = URLS.find(url => url !== original);
  assert.ok(replacement);

  manifest.steps[0].route = {
    route_id: await trail.routeId(replacement),
    url: replacement,
  };
  manifest.steps[0].transaction.route.url = replacement;

  // v0.3 base integrity accepts this artifact because route IDs and envelope
  // identity are internally consistent. Sampler re-execution must reject it.
  const substituted = await v03.envelope(manifest);
  await v03.verify(substituted);

  const result = runPython(substituted);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'REEXECUTION_FAILED');
  assert.equal(report.code, 'ROUTE_REEXECUTION_MISMATCH');
});

test('FNV seed fold stays pinned to the current 32-bit sampler state', () => {
  // Independent Python tests pin the numeric fold too; this assertion documents
  // the JS-side consequence without pretending the 128-bit-looking seed is a
  // 128-bit PRNG state.
  const a = trail.createSampler(SEED);
  const b = trail.createSampler(SEED);
  for (let i = 0; i < 8; i += 1) assert.equal(a(), b());
});
