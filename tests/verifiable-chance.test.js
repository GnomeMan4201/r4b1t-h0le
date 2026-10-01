'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'experiments/verifiable-chance/public-roll.mjs');
const BEACON = path.join(ROOT, 'experiments/verifiable-chance/fixtures/quicknet-round-1000.json');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function runOk(args) {
  const result = run(args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function activeTerrain() {
  const promotion = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/runtime/active-v1.json'), 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/runtime/eligibility-profiles-v1.json'), 'utf8'));
  const profile = registry.profiles.find(p => p.status === 'active' && p.release.release_id === promotion.active.release_id);
  assert.ok(profile, 'active terrain profile');
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, profile.terrain_index.path), 'utf8'));
  assert.ok(index.terrains.length > 0, 'active terrain index');
  return { profile, terrain: index.terrains[0] };
}

test('public-roll JS path reproduces an ALL selection and keeps claims bounded', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r4b1t-public-roll-'));
  try {
    const declaration = path.join(dir, 'declaration.json');
    const receipt = path.join(dir, 'receipt.json');

    runOk(['declare', '--round', '1000', '--terrain', 'ALL', '--out', declaration]);
    runOk(['receipt', '--declaration', declaration, '--beacon', BEACON, '--out', receipt]);
    const report = JSON.parse(runOk(['verify', '--receipt', receipt]));

    const artifact = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    const promotion = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/runtime/active-v1.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, promotion.active.manifest_url), 'utf8'));

    assert.equal(report.status, 'SELECTION_REPRODUCED');
    assert.equal(report.release_id, manifest.release_id);
    assert.equal(report.round, 1000);
    assert.equal(report.claims.route_derivation, 'PROVEN');
    assert.equal(report.claims.beacon_signature, 'NOT_ESTABLISHED_BY_THIS_VERIFIER');
    assert.equal(report.claims.non_cherry_picked, 'NOT_ESTABLISHED');

    assert.equal(artifact.schema, 'r4b1t-public-roll-receipt/v1');
    assert.equal(artifact.witness, null);
    assert.equal(artifact.selection.sampler, 'sha256-ctr-rejection/v1');
    assert.equal(artifact.selection.eligible_count, manifest.counts.resources);
    assert.equal(artifact.selection.terrain_authority, null);
    assert.ok(Number.isSafeInteger(artifact.selection.counter));
    assert.ok(Number.isSafeInteger(artifact.selection.index));
    assert.match(artifact.selection.route.route_id, /^sha256:[0-9a-f]{64}$/);
    assert.match(artifact.selection.route.url, /^https?:\/\//);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('typed terrain declaration binds the active terrain index and exact eligible count', () => {
  const { profile, terrain } = activeTerrain();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r4b1t-public-roll-terrain-'));
  try {
    const declaration = path.join(dir, 'declaration.json');
    const receipt = path.join(dir, 'receipt.json');

    runOk(['declare', '--round', '1000', '--terrain', terrain.id, '--out', declaration]);
    runOk(['receipt', '--declaration', declaration, '--beacon', BEACON, '--out', receipt]);
    const report = JSON.parse(runOk(['verify', '--receipt', receipt]));
    const artifact = JSON.parse(fs.readFileSync(receipt, 'utf8'));

    assert.equal(artifact.declaration.declaration.constraint.terrain, terrain.id);
    assert.equal(
      artifact.declaration.declaration.constraint.terrain_index.digest,
      profile.terrain_index.digest,
    );
    assert.equal(artifact.selection.eligible_count, terrain.count);
    assert.equal(artifact.selection.terrain_authority, 'AUTHORITATIVE_ACTIVE');
    assert.equal(report.claims.route_derivation, 'PROVEN');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('receipt tampering is rejected even when the receipt remains valid JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r4b1t-public-roll-tamper-'));
  try {
    const declaration = path.join(dir, 'declaration.json');
    const receipt = path.join(dir, 'receipt.json');

    runOk(['declare', '--round', '1000', '--out', declaration]);
    runOk(['receipt', '--declaration', declaration, '--beacon', BEACON, '--out', receipt]);

    const artifact = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    artifact.selection.index = (artifact.selection.index + 1) % artifact.selection.eligible_count;
    fs.writeFileSync(receipt, JSON.stringify(artifact, null, 2) + '\n');

    const result = run(['verify', '--receipt', receipt]);
    assert.equal(result.status, 1);
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.code, 'SELECTION_REPRODUCTION_MISMATCH');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('round number is part of the declaration identity', () => {
  const a = JSON.parse(runOk(['declare', '--round', '1000']));
  const b = JSON.parse(runOk(['declare', '--round', '1001']));
  assert.notEqual(a.declaration_id, b.declaration_id);
  assert.equal(a.declaration.beacon.round, 1000);
  assert.equal(b.declaration.beacon.round, 1001);
});
