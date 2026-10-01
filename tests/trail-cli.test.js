'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const trail = require('../trail-manifest.js');
const v03 = require('../trail-v03.js');

const ROOT = path.resolve(__dirname, '..');
const VERIFY = path.join(ROOT, 'tools', 'verify-trail.js');
const REVISION = 'sha256:' + 'a'.repeat(64);

async function makeImportedV03() {
  const manifest = await trail.createManifest({
    created_at: '2026-10-01T19:30:00.000Z',
    corpus_revision: REVISION,
    seed: 'cli-v03-seed',
    terrain: 'ALL',
    routes: [{ url: 'https://example.org/cli-v03', action: 'ROLL' }],
    parent: null,
  });
  const legacy = await trail.envelope(manifest);
  return v03.importV01(legacy, { created_at: '2026-10-01T19:31:00.000Z' });
}

function runVerifier(paths) {
  return spawnSync(process.execPath, [VERIFY, ...paths], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('trail:verify accepts a v0.3 artifact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r4b1t-v03-cli-'));
  try {
    const artifact = await makeImportedV03();
    const file = path.join(dir, 'trail.json');
    fs.writeFileSync(file, JSON.stringify(artifact));

    const result = runVerifier([file]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /TRAIL VERIFIED \/ V0\.3/);
    assert.match(result.stdout, /steps:\s+1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('trail:verify checks v0.3 parent lineage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r4b1t-v03-lineage-'));
  try {
    const parent = await makeImportedV03();
    const inherited = parent.manifest.steps[0];
    const child = await v03.envelope({
      format: v03.FORMAT,
      created_at: '2026-10-01T19:32:00.000Z',
      corpus_revision: parent.manifest.corpus_revision,
      steps: [{
        index: 1,
        kind: 'IMPORTED',
        route: inherited.route,
        source: {
          format: v03.FORMAT,
          trail_id: parent.trail_id,
          step_index: 1,
        },
      }],
      parent: { trail_id: parent.trail_id, fork_at: 1 },
    });

    const childFile = path.join(dir, 'child.json');
    const parentFile = path.join(dir, 'parent.json');
    fs.writeFileSync(childFile, JSON.stringify(child));
    fs.writeFileSync(parentFile, JSON.stringify(parent));

    const result = runVerifier([childFile, parentFile]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /LINEAGE VERIFIED \/ V0\.3/);
    assert.match(result.stdout, /fork:\s+1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
