'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');
const replay = require('../replay-inspection.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);
const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NONCE_A = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
const NONCE_B = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';
const VERIFIED_AT = '2026-09-20T09:10:00.000Z';

function bytes(value, pretty) {
  return new TextEncoder().encode(pretty ? JSON.stringify(value, null, 2) + '\n' : JSON.stringify(value));
}

async function v01(urls, seed) {
  const manifest = await trail.createManifest({
    created_at: '2026-09-20T09:00:00.000Z',
    corpus_revision: CORPUS,
    seed: seed || 'replay-v01',
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: null,
  });
  return trail.envelope(manifest);
}

async function v02ConcealedThenRevealed() {
  let manifest = await blind.create({
    created_at: '2026-09-20T09:01:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
    parent: null,
  });

  const first = await blind.commit(manifest, 'https://secret.example/first', NONCE_A);
  manifest = first.manifest;

  const second = await blind.commit(manifest, 'https://example.org/revealed', NONCE_B);
  manifest = await blind.reveal(second.manifest, second.secret);

  return blind.envelope(manifest);
}

test('state machine exposes only neutral state while exact bytes are being verified', async () => {
  const source = bytes(await v01(['https://example.org/a']), true);
  const machine = replay.createMachine();

  const pending = machine.load(source, { verified_at: VERIFIED_AT });
  const during = machine.snapshot();

  assert.equal(during.phase, 'VERIFYING');
  assert.equal(during.source, null);
  assert.equal(during.position, null);
  assert.equal(during.total_positions, 0);
  assert.equal(during.current_step, null);
  assert.equal(during.diagnostic, null);

  const loaded = await pending;
  assert.equal(loaded.phase, 'VERIFIED');
  assert.equal(loaded.current_step, null);
});

test('valid v0.1 source verifies from exact bytes before replay begins', async () => {
  const envelope = await v01(['https://example.org/a', 'https://example.org/b']);
  const source = bytes(envelope, true);
  const expectedDigest = 'sha256:' + await trail.sha256Hex(source);
  const machine = replay.createMachine();

  const loaded = await machine.load(source, { verified_at: VERIFIED_AT });

  assert.equal(loaded.phase, 'VERIFIED');
  assert.equal(loaded.source.artifact_format, trail.FORMAT);
  assert.equal(loaded.source.artifact_digest, expectedDigest);
  assert.equal(loaded.source.canonical_trail_id, envelope.trail_id);
  assert.equal(loaded.source.verification.state, 'VERIFIED');
  assert.equal(loaded.source.verification.verified_digest, expectedDigest);
  assert.equal(loaded.total_positions, 2);
  assert.equal(loaded.current_step, null);

  const inspecting = machine.begin();
  assert.equal(inspecting.phase, 'INSPECTING');
  assert.deepEqual(inspecting.current_step, {
    position: 0,
    source_index: 1,
    state: 'REVEALED',
    commitment: null,
    route_id: envelope.manifest.routes[0].route_id,
    url: 'https://example.org/a',
    action: 'ROLL',
  });

  const second = machine.next();
  assert.equal(second.position, 1);
  assert.equal(second.current_step.url, 'https://example.org/b');
});

test('v0.2 concealed positions expose commitment but no route identity', async () => {
  const envelope = await v02ConcealedThenRevealed();
  const machine = replay.createMachine();

  await machine.load(bytes(envelope, true), { verified_at: VERIFIED_AT });
  const first = machine.begin();

  assert.equal(first.current_step.state, 'CONCEALED');
  assert.match(first.current_step.commitment, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.current_step.route_id, null);
  assert.equal(first.current_step.url, null);
  assert.equal(JSON.stringify(first.current_step).includes('secret.example'), false);

  const second = machine.next();
  assert.equal(second.current_step.state, 'REVEALED');
  assert.equal(second.current_step.url, 'https://example.org/revealed');
  assert.match(second.current_step.route_id, /^sha256:[0-9a-f]{64}$/);
});

test('backward navigation cannot copy a later revealed route into an earlier concealed step', async () => {
  const envelope = await v02ConcealedThenRevealed();
  const machine = replay.createMachine();

  await machine.load(bytes(envelope, false), { verified_at: VERIFIED_AT });
  machine.begin();
  const revealed = machine.next();
  assert.equal(revealed.current_step.url, 'https://example.org/revealed');

  const concealedAgain = machine.previous();
  assert.equal(concealedAgain.current_step.state, 'CONCEALED');
  assert.equal(concealedAgain.current_step.route_id, null);
  assert.equal(concealedAgain.current_step.url, null);
  assert.equal(JSON.stringify(concealedAgain).includes('https://example.org/revealed'), false);
});

test('tampered supported source is REJECTED and cannot enter INSPECTING', async () => {
  const envelope = await v01(['https://example.org/a']);
  envelope.manifest.routes[0].url = 'https://attacker.invalid/';

  const machine = replay.createMachine();
  const result = await machine.load(bytes(envelope, true), { verified_at: VERIFIED_AT });

  assert.equal(result.phase, 'REJECTED');
  assert.equal(result.source.verification.state, 'REJECTED');
  assert.equal(result.source.canonical_trail_id, null);
  assert.equal(result.total_positions, 0);
  assert.equal(result.current_step, null);
  assert.throws(() => machine.begin(), /VERIFIED source/);
});

test('unsupported and structurally unreadable sources are UNVERIFIED diagnostic material', async () => {
  const machine = replay.createMachine();

  const unsupported = await machine.load(bytes({
    trail_id: 'sha256:' + 'f'.repeat(64),
    manifest: { format: 'r4b1t-trail/v9.9' },
  }), { verified_at: VERIFIED_AT });

  assert.equal(unsupported.phase, 'UNVERIFIED');
  assert.equal(unsupported.source.verification.state, 'UNVERIFIED');
  assert.equal(unsupported.source.verification.verified_at, null);
  assert.equal(unsupported.diagnostic.reason, 'Unsupported source artifact format');

  const unreadable = await machine.load(new TextEncoder().encode('{not json'), { verified_at: VERIFIED_AT });
  assert.equal(unreadable.phase, 'UNVERIFIED');
  assert.equal(unreadable.diagnostic.reason, 'Source is not valid JSON');
});

test('exact source digest remains byte-sensitive while canonical trail identity remains stable', async () => {
  const envelope = await v01(['https://example.org/a']);
  const compact = bytes(envelope, false);
  const pretty = bytes(envelope, true);

  const left = replay.createMachine();
  const right = replay.createMachine();

  const compactResult = await left.load(compact, { verified_at: VERIFIED_AT });
  const prettyResult = await right.load(pretty, { verified_at: VERIFIED_AT });

  assert.equal(compactResult.phase, 'VERIFIED');
  assert.equal(prettyResult.phase, 'VERIFIED');
  assert.equal(compactResult.source.canonical_trail_id, prettyResult.source.canonical_trail_id);
  assert.notEqual(compactResult.source.artifact_digest, prettyResult.source.artifact_digest);
});

test('load copies supplied bytes before asynchronous verification begins', async () => {
  const source = bytes(await v01(['https://example.org/a']), true);
  const pristine = new Uint8Array(source);
  const machine = replay.createMachine();

  const pending = machine.load(source, { verified_at: VERIFIED_AT });
  source.fill(0);
  const result = await pending;

  assert.equal(result.phase, 'VERIFIED');
  assert.equal(result.source.artifact_digest, 'sha256:' + await trail.sha256Hex(pristine));
});

test('reset invalidates an in-flight verification and discards all inspection state', async () => {
  const source = bytes(await v01(['https://example.org/a']), true);
  const machine = replay.createMachine();

  const pending = machine.load(source, { verified_at: VERIFIED_AT });
  const reset = machine.reset();

  assert.equal(reset.phase, 'UNLOADED');
  assert.equal(reset.source, null);

  await pending;
  assert.deepEqual(machine.snapshot(), {
    format: replay.FORMAT,
    phase: 'UNLOADED',
    source: null,
    position: null,
    total_positions: 0,
    current_step: null,
    diagnostic: null,
  });
});

test('returned snapshots are defensive copies and cannot mutate machine authority state', async () => {
  const source = bytes(await v01(['https://example.org/a']), true);
  const machine = replay.createMachine();

  await machine.load(source, { verified_at: VERIFIED_AT });
  const first = machine.begin();
  first.source.verification.state = 'REJECTED';
  first.current_step.url = 'https://attacker.invalid/';

  const fresh = machine.snapshot();
  assert.equal(fresh.source.verification.state, 'VERIFIED');
  assert.equal(fresh.current_step.url, 'https://example.org/a');
});

test('repeated inspection of identical bytes is deterministic with identical explicit runtime metadata', async () => {
  const source = bytes(await v02ConcealedThenRevealed(), true);
  const left = replay.createMachine();
  const right = replay.createMachine();

  assert.deepEqual(
    await left.load(source, { verified_at: VERIFIED_AT }),
    await right.load(source, { verified_at: VERIFIED_AT })
  );
  assert.deepEqual(left.begin(), right.begin());
  assert.deepEqual(left.next(), right.next());
  assert.deepEqual(left.previous(), right.previous());
});

test('pure Replay core has no persistence, network, sampler-runtime, corpus, ranking, or recommendation dependency', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'replay-inspection.js'), 'utf8');

  for (const forbidden of [
    /localStorage/,
    /sessionStorage/,
    /indexedDB/i,
    /caches\s*\./,
    /document\./,
    /window\./,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /EventSource/,
    /navigator\./,
    /trail-runtime/,
    /blind-runtime/,
    /corpus/i,
    /recommend/i,
    /rank/i,
    /popularity/i,
    /createSampler\s*\(/,
  ]) {
    assert.equal(forbidden.test(source), false, 'forbidden Replay core dependency: ' + forbidden);
  }
});
