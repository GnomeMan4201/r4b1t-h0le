'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const verifier = require('../tools/verify-topology-export.js');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'topology-v2', 'independent-verifier-valid.json');

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('independent verifier accepts the committed topology export fixture', async () => {
  const result = await verifier.verifyExport(loadFixture());

  assert.deepEqual(result, {
    format: 'r4b1t-topology-export/v0.1',
    created_at: '2026-09-19T03:20:00.000Z',
    nodes: 1,
    edges: 0,
    diagnostics: 0,
    proof_state: 'VERIFIED',
  });
});

test('independent verifier rejects tampered embedded trail material', async () => {
  const value = loadFixture();
  value.nodes[0].manifest.routes[0].url = 'https://attacker.invalid/';

  await assert.rejects(
    () => verifier.verifyExport(value),
    /Route ID mismatch/,
  );
});

test('independent verifier rejects tampered derived stop claims', async () => {
  const value = loadFixture();
  value.nodes[0].stops[0].url = 'https://attacker.invalid/';

  await assert.rejects(
    () => verifier.verifyExport(value),
    /Topology node stop derivation mismatch/,
  );
});

test('independent verifier CLI succeeds without loading topology runtime modules', () => {
  const run = spawnSync(
    process.execPath,
    ['tools/verify-topology-export.js', FIXTURE],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /TOPOLOGY VERIFIED/);
  assert.match(run.stdout, /nodes:\s+1/);
  assert.equal(run.stderr, '');
});

test('independent verifier CLI exits nonzero on tampered input from stdin', () => {
  const value = loadFixture();
  value.nodes[0].proof_state = 'REJECTED';

  const run = spawnSync(
    process.execPath,
    ['tools/verify-topology-export.js', '-'],
    { cwd: ROOT, input: JSON.stringify(value), encoding: 'utf8' },
  );

  assert.equal(run.status, 1);
  assert.match(run.stderr, /REJECTED \/ Topology node proof state must be VERIFIED/);
  assert.equal(run.stdout, '');
});

test('independent verifier does not depend on trail-topology or browser runtime', () => {
  const source = fs.readFileSync(path.join(ROOT, 'tools', 'verify-topology-export.js'), 'utf8');

  assert.equal(source.includes("require('../trail-topology.js')"), false);
  assert.equal(source.includes('R4b1tTopology'), false);
  assert.equal(source.includes('window.'), false);
  assert.equal(source.includes('document.'), false);
});
