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
async function runtime(storage = new Map(), allowBlocked = false) {
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
      setItem(key, value) {
        if (storage.failKeys && storage.failKeys.has(key)) throw new Error('Storage unavailable');
        storage.set(key, String(value));
      },
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
  if (allowBlocked) { await Promise.resolve(); await Promise.resolve(); }
  else await context.getTrailManifest();
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

test('failed recording exposes no route and consumes no sampler interval', async () => {
  const r = await runtime();
  const before = r.storage.get(KEY);
  r.storage.failKeys = new Set([KEY]);
  assert.equal(r.context.__r4b1tCommitRoll(), null);
  assert.equal(r.storage.get(KEY), before);
  r.storage.failKeys.clear();
  const result = r.context.__r4b1tCommitRoll();
  assert.equal(result.transaction.sequence, 1);
  assert.equal(result.transaction.sampler.draw_start, 0);
  assert.equal(r.draft().routes.length, 1);
  assert.equal((await r.context.getTrailManifest()).manifest.steps.length, 1);
});

test('failed quarantine keeps original bytes and blocks sampling and export', async () => {
  const r = await runtime();
  r.context.__r4b1tCommitRoll();
  const damaged = r.draft();
  damaged.routes[0].selection_transaction.sequence = 8;
  const raw = JSON.stringify(damaged);
  r.storage.set(KEY, raw);
  r.storage.failKeys = new Set(['r4b1t_trail_draft_quarantine_v1']);
  const restored = await runtime(r.storage, true);
  assert.equal(restored.storage.get(KEY), raw);
  assert.equal(restored.context.__r4b1tCommitRoll(), null);
  await assert.rejects(restored.context.getTrailManifest(), /preservation unavailable/i);
});

test('malformed saved JSON is preserved verbatim rather than overwritten', async () => {
  const storage = new Map([[KEY, '{broken-json']]);
  const r = await runtime(storage);
  assert.equal(r.context.getQuarantinedTrailDraft().raw, '{broken-json');
  assert.equal(r.draft().routes.length, 0);
});

test('malformed route URLs are quarantined without silently dropping the step', async () => {
  const r = await runtime();
  r.context.__r4b1tCommitRoll();
  const draft = r.draft();
  draft.routes[0].url = 'not a URL';
  const raw = JSON.stringify(draft);
  r.storage.set(KEY, raw);
  const restored = await runtime(r.storage);
  assert.equal(restored.context.getQuarantinedTrailDraft().raw, raw);
  assert.equal(restored.draft().routes.length, 0);
});

test('restore rejects unsupported or altered sampler transaction declarations', async () => {
  for (const mutate of [
    t => { t.transaction_version = 'r4b1t-selection-transaction/v999'; },
    t => { t.sampler.algorithm = 'another-sampler'; },
    t => { t.sampler.repeat_guard.max_draws = 31; },
    t => { t.eligible_count = 0; },
    t => { t.constraint.protocolPolicy.version = 2; },
  ]) {
    const r = await runtime();
    r.context.__r4b1tCommitRoll();
    const draft = r.draft();
    mutate(draft.routes[0].selection_transaction);
    const raw = JSON.stringify(draft);
    r.storage.set(KEY, raw);
    const restored = await runtime(r.storage);
    assert.equal(restored.context.getQuarantinedTrailDraft().raw, raw);
    assert.equal(restored.context.__r4b1tCommitRoll().transaction.sequence, 1);
  }
});

test('a later rejected draft retains previously quarantined evidence', async () => {
  const storage = new Map([[KEY, '{first-broken-json']]);
  const first = await runtime(storage);
  assert.equal(first.context.getQuarantinedTrailDraft().raw, '{first-broken-json');
  storage.set(KEY, '{second-broken-json');
  const second = await runtime(storage);
  const quarantine = second.context.getQuarantinedTrailDraft();
  assert.equal(quarantine.raw, '{second-broken-json');
  assert.ok(JSON.stringify(quarantine).includes('{first-broken-json'));
});
