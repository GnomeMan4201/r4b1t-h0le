'use strict';

// Trail record integrity: a committed ROLL is always recorded, and a draft that cannot be
// continued is preserved rather than silently discarded (SELECTION_TRANSACTION_V2.md §5).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const PROMOTION = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/runtime/active-v1.json'), 'utf8'));
const ACTIVE_REVISION = PROMOTION.active.expected_digest;
const ACTIVE_SOURCE = PROMOTION.active.source_id;
const ACTIVE_URLS = fs.readFileSync(path.join(ROOT, PROMOTION.active.url), 'utf8').slice(0, -1).split('\n');
const DRAFT_KEY = 'r4b1t_trail_draft_v1';
const SEED = '7e57000000000000000000000000c0de';

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

// Writes the draft once per test (a reload keeps whatever the runtime persisted).
async function seedDraft(page, routes = []) {
  await page.addInitScript(({ key, draft }) => {
    if (sessionStorage.getItem('__integritySeeded')) return;
    sessionStorage.setItem('__integritySeeded', '1');
    localStorage.setItem(key, JSON.stringify(draft));
  }, {
    key: DRAFT_KEY,
    draft: {
      seed: SEED, createdAt: '2026-10-01T18:00:00.000Z', corpusRevision: ACTIVE_REVISION,
      corpusSourceId: ACTIVE_SOURCE, routes, parent: null,
    },
  });
}

async function ready(page) {
  await page.waitForFunction(() => (
    typeof window.roll === 'function' &&
    typeof window.getTrailManifest === 'function' &&
    window.__r4b1tCommitRoll &&
    window.__r4b1tCommitRoll.__r4b1tAuthority
  ));
  await page.evaluate(async () => {
    await window.R4b1tCorpusAuthority.loadActive();
    await new Promise(resolve => setTimeout(resolve, 50));
  });
}

const commit = page => page.evaluate(() => {
  const result = window.__r4b1tCommitRoll();
  return result && result.transaction;
});
const savedDraft = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
const rollSteps = manifest => manifest.manifest.steps.filter(step => step.kind === 'ROLL').map(step => step.transaction);

function expectContinuousChain(transactions) {
  let cursor = 0;
  let previous = null;
  transactions.forEach((t, i) => {
    expect(t.sequence).toBe(i + 1);
    expect(t.sampler.draw_start).toBe(cursor);
    expect(t.sampler.repeat_guard.reference).toBe(previous);
    cursor += t.sampler.draw_count;
    previous = t.route.url;
  });
}

async function mutateSavedDraft(page, mutate) {
  await page.evaluate(({ key, source }) => {
    const draft = JSON.parse(localStorage.getItem(key));
    // eslint-disable-next-line no-new-func
    new Function('draft', source)(draft);
    localStorage.setItem(key, JSON.stringify(draft));
  }, { key: DRAFT_KEY, source: mutate });
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await blockExternalNetwork(page);
});

test('TR-1: a ROLL committed inside the replay window is recorded and the trail stays exportable', async ({ page }, testInfo) => {
  await seedDraft(page);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await commit(page);
  await commit(page);

  const result = await page.evaluate(async () => {
    await window.importTrailManifest(await window.getTrailManifest());
    // Same task as the replay: its recording suppression has not been lifted yet.
    await window.replayTrailManifest(0);
    const rolled = window.__r4b1tCommitRoll();
    return { url: rolled && rolled.url, sequence: rolled && rolled.transaction.sequence };
  });
  expect(result.sequence).toBe(3);

  const draft = await savedDraft(page);
  // The replayed SELECT is still not recorded; the user's ROLL is.
  expect(draft.routes.map(r => r.action)).toEqual(['ROLL', 'ROLL', 'ROLL']);
  expect(draft.routes[2].url).toBe(result.url);

  const manifest = await page.evaluate(() => window.getTrailManifest());
  expectContinuousChain(rollSteps(manifest));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  const next = await commit(page);
  expect(next.sequence).toBe(4);
  const exported = await page.evaluate(() => window.getTrailManifest());
  expectContinuousChain(rollSteps(exported));

  // The independent re-executor (no JavaScript runtime) re-derives every ROLL, including the
  // one committed inside the replay window.
  const file = testInfo.outputPath('trail.json');
  fs.writeFileSync(file, JSON.stringify(exported));
  const run = spawnSync('python3', [path.join(ROOT, 'tools/reexecute_trail.py'), file, '--root', ROOT], { encoding: 'utf8' });
  expect(run.status, run.stdout + run.stderr).toBe(0);
  expect(run.stdout).toMatch(/PROVEN/);
});

test('TR-2: a malformed latest ROLL preserves the draft instead of silently wiping it', async ({ page }) => {
  await seedDraft(page);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  for (let i = 0; i < 3; i++) await commit(page);
  await mutateSavedDraft(page, 'draft.routes[2].selection_transaction.sampler.draw_count = 0;');
  const damaged = await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);

  const quarantine = await page.evaluate(() => window.getQuarantinedTrailDraft());
  expect(quarantine).not.toBeNull();
  expect(quarantine.raw).toBe(damaged);
  expect(quarantine.reason).toMatch(/step 3/);
  expect(JSON.parse(quarantine.raw).routes).toHaveLength(3);

  // A fresh scope starts; nothing from the damaged draft is continued or reused.
  const draft = await savedDraft(page);
  expect(draft.seed).not.toBe(SEED);
  expect(draft.routes).toHaveLength(0);
  const first = await commit(page);
  expect(first.sequence).toBe(1);
  expect(first.sampler.draw_start).toBe(0);

  await page.evaluate(() => window.openTrailLedger());
  await expect(page.locator('#trailLedgerStatus')).toContainText('PREVIOUS DRAFT NOT CONTINUED');
});

test('TR-3: an out-of-chain saved cursor cannot stall restore', async ({ page }) => {
  test.setTimeout(20000);
  const url = ACTIVE_URLS[0];
  await seedDraft(page, [{
    url, action: 'ROLL',
    selection_transaction: {
      transaction_version: 'r4b1t-selection-transaction/v2', sequence: 1, action: 'ROLL',
      constraint: { terrain: 'ALL', terrainIndex: null, protocolPolicy: { version: 1, excludeOnion: false } },
      corpus_revision: ACTIVE_REVISION, eligible_count: ACTIVE_URLS.length,
      sampler: {
        algorithm: 'uniform-with-repeat-guard-v1', prng: 'mulberry32-v1', seed: SEED,
        draw_start: 9000000000000000, draw_count: 1, repeat_guard: { reference: null, max_draws: 30 },
      },
      route: { url },
    },
  }]);
  await page.goto('./', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await ready(page);
  const quarantine = await page.evaluate(() => window.getQuarantinedTrailDraft());
  expect(quarantine && quarantine.reason).toMatch(/ROLL continuity/);
  expect((await commit(page)).sampler.draw_start).toBe(0);
});

test('TR-4: a broken ROLL chain is not extended even when the latest ROLL looks valid alone', async ({ page }) => {
  await seedDraft(page);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  for (let i = 0; i < 3; i++) await commit(page);
  // The shape of a pre-continuity draft: sequence and cursor restarted at the third ROLL.
  await mutateSavedDraft(page, `
    const t = draft.routes[2].selection_transaction;
    t.sequence = 1; t.sampler.draw_start = 0; t.sampler.repeat_guard.reference = null;`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  const quarantine = await page.evaluate(() => window.getQuarantinedTrailDraft());
  expect(quarantine && quarantine.reason).toMatch(/ROLL continuity mismatch at step 3/);
  expect((await savedDraft(page)).routes).toHaveLength(0);
});

test('TR-5: valid drafts — with SELECT steps and after a fork — resume without quarantine', async ({ page }) => {
  await seedDraft(page);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await commit(page);
  await page.evaluate(url => window.selectUrl(url), ACTIVE_URLS[1]);
  await commit(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  expect(await page.evaluate(() => window.getQuarantinedTrailDraft())).toBeNull();
  expect((await commit(page)).sequence).toBe(3);
  expectContinuousChain(rollSteps(await page.evaluate(() => window.getTrailManifest())));

  // Fork: inherited prefix is IMPORTED, the child scope samples from zero and survives reload.
  await page.evaluate(async () => {
    await window.importTrailManifest(await window.getTrailManifest());
    await window.forkTrailManifest(2);
  });
  expect((await commit(page)).sequence).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  expect(await page.evaluate(() => window.getQuarantinedTrailDraft())).toBeNull();
  const child = await commit(page);
  expect(child.sequence).toBe(2);
  expectContinuousChain(rollSteps(await page.evaluate(() => window.getTrailManifest())));
});
