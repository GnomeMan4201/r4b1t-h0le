'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const PROMOTION = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/runtime/active-v1.json'), 'utf8'));
const ACTIVE_REVISION = PROMOTION.active.expected_digest;
const ACTIVE_SOURCE = PROMOTION.active.source_id;

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

async function seedDraft(page, seed) {
  await page.addInitScript(({ seed, revision, sourceId }) => {
    if (sessionStorage.getItem('__continuitySeeded')) return;
    sessionStorage.setItem('__continuitySeeded', '1');
    localStorage.setItem('r4b1t_trail_draft_v1', JSON.stringify({
      seed,
      createdAt: '2026-10-01T18:00:00.000Z',
      corpusRevision: revision,
      corpusSourceId: sourceId,
      routes: [],
      parent: null,
    }));
  }, { seed, revision: ACTIVE_REVISION, sourceId: ACTIVE_SOURCE });
}

async function installPoolLimit(page, terrainId, limit) {
  await page.addInitScript(({ terrainId, limit }) => {
    let real;
    Object.defineProperty(window, 'R4b1tSelectionCore', {
      configurable: true,
      get() { return real; },
      set(value) {
        real = Object.freeze(Object.assign({}, value, {
          eligiblePool(urls, index, constraint) {
            const pool = value.eligiblePool(urls, index, constraint);
            return constraint && constraint.terrain === terrainId ? pool.slice(0, limit) : pool;
          },
        }));
      },
    });
  }, { terrainId, limit });
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

async function armTerrain(page, terrainId) {
  await page.waitForSelector(`#catFilter button[data-terrain-id="${terrainId}"]`, { state: 'attached' });
  await page.evaluate((id) => {
    document.querySelector(`#catFilter button[data-terrain-id="${id}"]`).click();
  }, terrainId);
}

async function commit(page) {
  return page.evaluate(() => {
    const result = window.__r4b1tCommitRoll();
    return result && result.transaction;
  });
}

async function savedRoutes(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('r4b1t_trail_draft_v1')).routes);
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test('S1/S2: reload resumes the sampler cursor and transaction sequence from the draft', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await seedDraft(page, 'sampler-continuity-reload-v1');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const first = await commit(page);
  const second = await commit(page);
  const expectedCursor = second.sampler.draw_start + second.sampler.draw_count;

  expect(first.sequence).toBe(1);
  expect(second.sequence).toBe(2);
  expect(second.sampler.repeat_guard.reference).toBe(first.route.url);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);

  const third = await commit(page);
  expect(third.sequence).toBe(3);
  expect(third.sampler.draw_start).toBe(expectedCursor);
  expect(third.sampler.repeat_guard.reference).toBe(second.route.url);

  const routes = await savedRoutes(page);
  expect(routes).toHaveLength(3);
  expect(routes[2].selection_transaction.sequence).toBe(3);
});

test('S3: every committed ROLL is recorded even when the selected URL repeats', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await seedDraft(page, 'sampler-continuity-repeat-v1');
  await installPoolLimit(page, 'threat_feed', 1);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await armTerrain(page, 'threat_feed');

  const first = await commit(page);
  const second = await commit(page);

  expect(second.route.url).toBe(first.route.url);
  expect(second.sampler.repeat_guard.reference).toBe(first.route.url);
  expect(second.sampler.draw_count).toBe(30);

  const routes = await savedRoutes(page);
  expect(routes).toHaveLength(2);
  expect(routes[0].selection_transaction.sequence).toBe(1);
  expect(routes[1].selection_transaction.sequence).toBe(2);
  expect(routes[1].url).toBe(routes[0].url);
});

test('S4: NEW TRAIL starts with a null repeat-guard reference', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await seedDraft(page, 'sampler-continuity-reset-v1');
  await installPoolLimit(page, 'threat_feed', 1);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await armTerrain(page, 'threat_feed');

  const beforeReset = await commit(page);
  await page.evaluate(() => window.resetReproducibleTrail());
  const afterReset = await commit(page);

  expect(afterReset.route.url).toBe(beforeReset.route.url);
  expect(afterReset.sequence).toBe(1);
  expect(afterReset.sampler.draw_start).toBe(0);
  expect(afterReset.sampler.draw_count).toBe(1);
  expect(afterReset.sampler.repeat_guard.reference).toBeNull();
});

test('S4: a fork starts a new repeat-guard scope even when it inherits the parent route', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await seedDraft(page, 'sampler-continuity-fork-v1');
  await installPoolLimit(page, 'threat_feed', 1);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await armTerrain(page, 'threat_feed');

  const parentRoll = await commit(page);
  const parent = await page.evaluate(() => window.getTrailManifest());
  await page.evaluate(async (artifact) => {
    await window.importTrailManifest(artifact);
    await window.forkTrailManifest(1);
  }, parent);

  const childRoll = await commit(page);
  expect(childRoll.route.url).toBe(parentRoll.route.url);
  expect(childRoll.sequence).toBe(1);
  expect(childRoll.sampler.draw_start).toBe(0);
  expect(childRoll.sampler.draw_count).toBe(1);
  expect(childRoll.sampler.repeat_guard.reference).toBeNull();
});
