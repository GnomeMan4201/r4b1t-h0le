'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('runtime v0.3 export uses authoritative transactions and keeps legacy currentEnvelope intact', () => {
  const runtime = fs.readFileSync(path.join(root, 'trail-runtime.js'), 'utf8');
  assert.match(runtime, /v03Api\.createManifest\([\s\S]*transactions:\s*state\.selectionTransactions/);
  assert.match(runtime, /exportBoundaryApi\.choose\(/);
  assert.match(runtime, /async function currentEnvelope\(\)[\s\S]*api\.createManifest/);
  assert.doesNotMatch(runtime, /v03Api\.createManifest\([^)]*terrain\s*:/);
});

test('v0.3 export does not enable existing consumers before Phase 4', () => {
  const runtime = fs.readFileSync(path.join(root, 'trail-runtime.js'), 'utf8');
  assert.match(runtime, /if \(result\.manifest\.format === v03Api\.FORMAT\)[\s\S]*return result/);
  assert.doesNotMatch(runtime, /api\.replay\(.*v03/i);
});

test('Phase 3 does not implement semantic PROVENANCE_PROVEN status', () => {
  for (const name of ['trail-manifest-v03.js', 'trail-runtime.js']) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    assert.equal(source.includes('PROVENANCE_PROVEN'), false);
  }
});
