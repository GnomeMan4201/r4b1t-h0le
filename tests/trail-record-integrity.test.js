'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const promotion = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/runtime/active-v1.json')));
const revision = promotion.active.expected_digest;
const urls = fs.readFileSync(path.join(ROOT, promotion.active.url), 'utf8').trim().split('\n');
const KEY = 'r4b1t_trail_draft_v1';

// Execute the actual runtime and verification modules. Only browser I/O is replaced;
// assertions use its public commit/import/export APIs and durable draft bytes.
async function runtime(storage = new Map()) {
  const listeners = new Map();
  const overlay = { style: {}, setAttribute() {}, focus() {} };
  const document = {
    getElementById(id) { return id === 'trailLedgerOverlay' ? overlay : null; },
    querySelector() { return null; },
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  const context = vm.createContext({
    document, URL, TextEncoder, TextDecoder, crypto: webcrypto, console,
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
    },
    setTimeout() {}, clearInterval() {},
    setInterval(callback) { callback(); return 1; },
  });
  vm.runInContext('window = globalThis', context);
  for (const name of ['trail-manifest.js', 'cj1.js', 'trail-v03.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), context);
  }
  context.R4b1tCorpusAuthority = {
    async loadActive() { return { revision, source: { id: promotion.active.source_id } }; },
  };
  vm.runInContext(`
    __r4b1tCaptureSelectionConstraint = () => ({ terrain: 'ALL', terrainIndex: null,
      protocolPolicy: { version: 1, excludeOnion: false } });
    __r4b1tCommitRoll = (rng, constraint, reference) => {
      rng(); return { url: ${JSON.stringify(urls[0])}, eligibleCount: ${urls.length}, repeatGuardReference: reference };
    };
    selectUrl = () => {};
  `, context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'trail-runtime.js'), 'utf8'), context, { timeout: 1000 });
  listeners.get('DOMContentLoaded')();
  await context.getTrailManifest();
  return { context, storage, draft: () => JSON.parse(storage.get(KEY)) };
}

test('every committed ROLL is recorded once inside the replay suppression window', async () => {
  const r = await runtime();
  r.context.__r4b1tCommitRoll();
  await r.context.importTrailManifest(await r.context.getTrailManifest());
  await r.context.replayTrailManifest(0);
  const committed = r.context.__r4b1tCommitRoll();
  assert.equal(r.draft().routes.length, 2);
  assert.equal(r.draft().routes[1].selection_transaction.sequence, committed.transaction.sequence);
  const envelope = await r.context.getTrailManifest();
  assert.equal(envelope.manifest.steps.length, 2);
});

test('a broken earlier ROLL is preserved and never extended on reload', async () => {
  const r = await runtime();
  r.context.__r4b1tCommitRoll();
  r.context.__r4b1tCommitRoll();
  const draft = r.draft();
  draft.routes[0].selection_transaction.sequence = 9;
  const raw = JSON.stringify(draft);
  r.storage.set(KEY, raw);
  const restored = await runtime(r.storage);
  assert.equal(restored.draft().routes.length, 0);
  assert.equal(restored.context.getQuarantinedTrailDraft().raw, raw);
  assert.equal(restored.context.__r4b1tCommitRoll().transaction.sequence, 1);
});

test('a draft from an older corpus is preserved before a fresh scope starts', async () => {
  const r = await runtime();
  r.context.__r4b1tCommitRoll();
  const draft = r.draft();
  draft.corpusRevision = 'sha256:' + '0'.repeat(64);
  draft.routes[0].selection_transaction.corpus_revision = draft.corpusRevision;
  const raw = JSON.stringify(draft);
  r.storage.set(KEY, raw);
  const restored = await runtime(r.storage);
  assert.equal(restored.draft().routes.length, 0);
  const quarantine = restored.context.getQuarantinedTrailDraft();
  assert.ok(quarantine, 'stale draft evidence must survive the corpus boundary');
  assert.equal(quarantine.raw, raw);
  assert.match(quarantine.reason, /corpus revision/i);
  assert.equal(restored.context.__r4b1tCommitRoll().transaction.sequence, 1);
});
