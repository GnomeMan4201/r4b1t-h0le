'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const trail = require('../trail-manifest.js');
const v03 = require('../trail-v03.js');
const SelectionV3 = require('../selection-v3.js');
const SiteKey = require('../site-key-v1.js');

const SHA1 = 'sha256:' + '1'.repeat(64);
const SHA2 = 'sha256:' + '2'.repeat(64);
const SEED = '00112233445566778899aabbccddeeff';
const GOLDEN_ID = 'sha256:95c1e6b1c0a02c06c93639a4528971fc3d06799191c6942f312c4401b963e6ab';

const GOLDEN = {
  format: 'r4b1t-trail/v0.3',
  created_at: '2026-10-01T18:30:00.000Z',
  corpus_revision: SHA1,
  steps: [
    {
      index: 1,
      kind: 'ROLL',
      route: {
        route_id: 'sha256:4a8ea6b3f63e0571ff3bcbf703e115184155d085c132f82b201fd4ff50b34ee2',
        url: 'https://example.org/tool',
      },
      transaction: {
        transaction_version: 'r4b1t-selection-transaction/v2',
        sequence: 1,
        action: 'ROLL',
        constraint: {
          terrain: 'ALL',
          terrainIndex: null,
          protocolPolicy: { version: 1, excludeOnion: false },
        },
        corpus_revision: SHA1,
        eligible_count: 3,
        sampler: {
          algorithm: 'uniform-with-repeat-guard-v1',
          prng: 'mulberry32-v1',
          seed: SEED,
          draw_start: 0,
          draw_count: 1,
          repeat_guard: { reference: null, max_draws: 30 },
        },
        route: { url: 'https://example.org/tool' },
      },
    },
    {
      index: 2,
      kind: 'SELECT',
      route: {
        route_id: 'sha256:978fa79ea5b1bdd3cf74fbff5767e3e88a891bc276ae14a5987977cdfe7bafb2',
        url: 'https://example.org/manual',
      },
    },
    {
      index: 3,
      kind: 'BRANCH',
      route: {
        route_id: 'sha256:3edad4ea10dcc883228fb3b9593d4429aa15c0a4c228c35dcbffc23d93284f3d',
        url: 'https://example.org/branch',
      },
      navigation: { from_step: 2, branch_label: 'SIDEWAYS' },
    },
    {
      index: 4,
      kind: 'ROLL',
      route: {
        route_id: 'sha256:6f6194c05691ac14335589bdb05707089c88972406c9594efc2071d697a0ed47',
        url: 'https://example.org/next',
      },
      transaction: {
        transaction_version: 'r4b1t-selection-transaction/v2',
        sequence: 2,
        action: 'ROLL',
        constraint: {
          terrain: 'security_tool',
          terrainIndex: { schema: 'r4b1t-terrain-index-v1', digest: SHA2 },
          protocolPolicy: { version: 1, excludeOnion: false },
        },
        corpus_revision: SHA1,
        eligible_count: 2,
        sampler: {
          algorithm: 'uniform-with-repeat-guard-v1',
          prng: 'mulberry32-v1',
          seed: SEED,
          draw_start: 1,
          draw_count: 2,
          repeat_guard: { reference: 'https://example.org/tool', max_draws: 30 },
        },
        route: { url: 'https://example.org/next' },
      },
    },
  ],
  parent: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('v0.3 golden manifest is content-addressed with CJ-1 and preserves step-level evidence', async () => {
  assert.equal(v03.FORMAT, 'r4b1t-trail/v0.3');
  const envelope = await v03.envelope(GOLDEN);
  assert.equal(envelope.trail_id, GOLDEN_ID);
  const verified = await v03.verify(envelope);
  assert.equal(verified.trail_id, GOLDEN_ID);
  assert.equal('terrain' in verified.manifest, false);
  assert.equal(verified.manifest.steps[0].transaction.constraint.terrain, 'ALL');
  assert.equal(verified.manifest.steps[3].transaction.constraint.terrain, 'security_tool');
  assert.equal(verified.manifest.steps[2].navigation.branch_label, 'SIDEWAYS');
});

test('v0.3 rejects a route substitution even when the envelope hash is recomputed', async () => {
  const manifest = clone(GOLDEN);
  manifest.steps[0].route.url = 'https://attacker.invalid/replaced';
  manifest.steps[0].transaction.route.url = 'https://attacker.invalid/replaced';
  const envelope = {
    trail_id: 'sha256:' + await trail.sha256Hex(require('../cj1.js').serialize(manifest)),
    manifest,
  };
  await assert.rejects(() => v03.verify(envelope), /Route ID mismatch at step 1/);
});

test('v0.3 enforces local ROLL sequence, draw continuity, and trail-scoped repeat guard', async () => {
  for (const mutate of [
    m => { m.steps[3].transaction.sequence = 3; },
    m => { m.steps[3].transaction.sampler.draw_start = 2; },
    m => { m.steps[3].transaction.sampler.repeat_guard.reference = 'https://example.org/branch'; },
    m => { m.steps[3].transaction.sampler.seed = 'different-seed'; },
  ]) {
    const manifest = clone(GOLDEN);
    mutate(manifest);
    await assert.rejects(() => v03.envelope(manifest), /ROLL continuity/);
  }
});

test('v0.3 BRANCH records a backward source step without claiming branch semantics', async () => {
  const manifest = clone(GOLDEN);
  manifest.steps[2].navigation.from_step = 3;
  await assert.rejects(() => v03.envelope(manifest), /BRANCH source step/);
});

test('v0.3 import of v0.1 labels every copied route IMPORTED and does not invent transaction provenance', async () => {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/trails/parent.json'), 'utf8'));
  const sourceVerified = await trail.verify(source);
  const imported = await v03.importV01(source, { created_at: '2026-10-01T18:40:00.000Z' });
  const verified = await v03.verify(imported);

  assert.equal(verified.manifest.corpus_revision, sourceVerified.manifest.corpus_revision);
  assert.equal(verified.manifest.steps.length, sourceVerified.manifest.routes.length);
  for (let i = 0; i < verified.manifest.steps.length; i += 1) {
    const step = verified.manifest.steps[i];
    assert.equal(step.kind, 'IMPORTED');
    assert.equal('transaction' in step, false);
    assert.deepEqual(step.source, {
      format: 'r4b1t-trail/v0.1',
      trail_id: sourceVerified.trail_id,
      step_index: i + 1,
    });
    assert.equal(step.route.url, sourceVerified.manifest.routes[i].url);
  }
});

test('v0.3 lineage verifies imported parent prefix while child sampling starts a fresh scope', async () => {
  const parent = await v03.envelope({
    format: 'r4b1t-trail/v0.3',
    created_at: '2026-10-01T18:45:00.000Z',
    corpus_revision: SHA1,
    steps: [clone(GOLDEN.steps[0])],
    parent: null,
  });

  const childRoute = {
    route_id: await trail.routeId('https://example.org/child'),
    url: 'https://example.org/child',
  };
  const childTx = clone(GOLDEN.steps[0].transaction);
  childTx.route.url = childRoute.url;
  childTx.eligible_count = 4;

  const child = await v03.envelope({
    format: 'r4b1t-trail/v0.3',
    created_at: '2026-10-01T18:46:00.000Z',
    corpus_revision: SHA1,
    steps: [
      {
        index: 1,
        kind: 'IMPORTED',
        route: clone(parent.manifest.steps[0].route),
        source: { format: 'r4b1t-trail/v0.3', trail_id: parent.trail_id, step_index: 1 },
      },
      {
        index: 2,
        kind: 'ROLL',
        route: childRoute,
        transaction: childTx,
      },
    ],
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });

  const lineage = await v03.verifyLineage(child, parent);
  assert.equal(lineage.fork_at, 1);
  assert.equal(lineage.child.manifest.steps[1].transaction.sequence, 1);
  assert.equal(lineage.child.manifest.steps[1].transaction.sampler.draw_start, 0);
  assert.equal(lineage.child.manifest.steps[1].transaction.sampler.repeat_guard.reference, null);
});

test('v0.1 verifier and IDs remain unchanged', async () => {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/trails/parent.json'), 'utf8'));
  const before = source.trail_id;
  const verified = await trail.verify(source);
  assert.equal(verified.trail_id, before);
});


test('v0.3 accepts a structurally valid v3 ROLL transaction', async () => {
  const psl = SiteKey.parsePsl(fs.readFileSync(path.join(__dirname, '..', 'selection/site-key-v1/public_suffix_list_ascii_v1.dat'), 'utf8'));
  const overrides = SiteKey.parseOverrides(fs.readFileSync(path.join(__dirname, '..', 'selection/site-key-v1/platform-overrides.json'), 'utf8'));
  const urls = ['https://example.org/a', 'https://github.com/OpenAI/project'];
  const tx = SelectionV3.select({
    eligibleUrls: urls,
    siteKey: url => SiteKey.siteKey(url, psl, overrides),
    seed: SEED,
    drawStart: 0,
    weightMode: 'UNIFORM_SITE',
    repeatGuardReference: null,
    sequence: 1,
    constraint: {
      terrain: 'ALL',
      terrainIndex: null,
      protocolPolicy: { version: 1, excludeOnion: false },
    },
    corpusRevision: SHA1,
    pslSha256: 'sha256:2b44fcd3f7a3da5f9d326073a495629a65eaf66c88a9f018b494067933f026e8',
    overridesSha256: 'sha256:36945dc17210612eb86f3e46762601467d81f0355e8f8dceceb4e13a3e0f003d',
  });
  const route = { route_id: await trail.routeId(tx.route.url), url: tx.route.url };
  const envelope = await v03.envelope({
    format: v03.FORMAT,
    created_at: '2026-10-05T15:02:00.000Z',
    corpus_revision: SHA1,
    steps: [{ index: 1, kind: 'ROLL', route, transaction: tx }],
    parent: null,
  });
  const verified = await v03.verify(envelope);
  assert.equal(verified.manifest.steps[0].transaction.transaction_version, 'r4b1t-selection-transaction/v3');
});
