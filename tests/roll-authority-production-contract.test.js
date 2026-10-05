'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('production loads authority core and ledger before motion, then runtime after Trail bridge', () => {
  const html = read('index.html');
  const core = html.indexOf('roll-authority-core.js');
  const ledger = html.indexOf('roll-authority-ledger.js');
  const motion = html.indexOf('roll-motion-machine.js');
  const trail = html.indexOf('trail-runtime.js');
  const runtime = html.indexOf('roll-authority-runtime.js');

  assert.ok(core > 0);
  assert.ok(core < ledger);
  assert.ok(ledger < motion);
  assert.ok(trail < runtime);
});

test('service worker precaches every roll authority runtime asset', () => {
  const sw = read('sw.js');
  for (const asset of [
    './roll-authority-core.js',
    './roll-authority-ledger.js',
    './roll-authority-runtime.js'
  ]) {
    assert.ok(sw.includes(asset), asset + ' must be precached');
  }
});

test('production ROLL prefers durable authority and completes it at reveal', () => {
  const source = read('roll-production-integration.js');
  assert.match(source, /R4B1TRollAuthority/);
  assert.match(source, /authority\.commit\(\)/);
  assert.match(source, /markRevealed\(payload\.result\)/);
  assert.match(source, /pendingIntent = true/);
  assert.match(source, /cancelPendingIntent/);
});

test('result surface exposes DRAW sequence and cursor navigation', () => {
  const production = read('roll-production-integration.js');
  const shell = read('dual-shell.js');

  assert.match(production, /id="r4mDrawSequence"/);
  assert.match(production, /data-mobile-action="previous"/);
  assert.match(production, /data-mobile-action="forward"/);
  assert.match(shell, /action === 'previous'/);
  assert.match(shell, /action === 'forward'/);
});

test('Trail bridge keeps authority transaction id private from exported v0.3 transaction', () => {
  const runtime = read('trail-runtime.js');
  const v03 = read('trail-v03.js');

  assert.match(runtime, /authority_transaction_id/);
  assert.match(runtime, /__r4b1tPrepareAuthorityRoll/);
  assert.match(runtime, /__r4b1tProjectAuthorityTerminal/);

  assert.match(v03, /'transaction_version', 'sequence', 'action', 'constraint', 'corpus_revision'/);
  assert.match(v03, /'eligible_count', 'sampler', 'route'/);
  assert.doesNotMatch(v03, /authority_transaction_id/);
});

test('browser runtime uses IndexedDB authority, Web Locks and direct sessionStorage cursor navigation', () => {
  const runtime = read('roll-authority-runtime.js');
  const ledger = read('roll-authority-ledger.js');

  assert.match(runtime, /sessionStorage/);
  assert.doesNotMatch(runtime, /popstate|history\.pushState|history\.back\(|history\.forward\(/);
  assert.match(runtime, /createIndexedDbStore/);
  assert.match(runtime, /createNavigatorLock/);
  assert.match(ledger, /durability: 'strict'/);
  assert.match(ledger, /PREPARED_CARDINALITY_VIOLATION/);
});

test('queued ROLL cannot outrun reveal-bound Trail completion', () => {
  const source = read('roll-production-integration.js');
  assert.match(source, /var revealPending = null/);
  assert.match(source, /markRevealed\(payload\.result\)/);
  assert.match(source, /revealPending = completion/);
  assert.match(source, /entry\.to === 'SETTLED'[\s\S]*revealPending\.then/);
  assert.match(source, /commitPending \|\| revealPending/);
});
