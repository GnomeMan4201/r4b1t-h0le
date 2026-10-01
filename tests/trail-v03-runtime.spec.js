'use strict';

const { test, expect } = require('@playwright/test');

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

async function ready(page) {
  await page.waitForFunction(() => (
    typeof window.getTrailManifest === 'function' &&
    typeof window.roll === 'function' &&
    window.__r4b1tCommitRoll &&
    window.__r4b1tCommitRoll.__r4b1tAuthority
  ));
  await page.evaluate(async () => {
    await window.R4b1tCorpusAuthority.loadActive();
    await new Promise(resolve => setTimeout(resolve, 50));
  });
}

async function commit(page) {
  return page.evaluate(() => {
    const result = window.__r4b1tCommitRoll();
    return result && result.transaction;
  });
}

async function arm(page, terrain) {
  await page.waitForSelector(`#catFilter button[data-terrain-id="${terrain}"]`, { state: 'attached' });
  await page.evaluate((id) => document.querySelector(`#catFilter button[data-terrain-id="${id}"]`).click(), terrain);
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test('V3R-01: default Trail export is v0.3 with the exact committed ROLL transaction', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const transaction = await commit(page);
  const artifact = await page.evaluate(() => window.getTrailManifest());

  expect(artifact.manifest.format).toBe('r4b1t-trail/v0.3');
  expect(artifact.manifest).not.toHaveProperty('terrain');
  expect(artifact.manifest).not.toHaveProperty('sampler');
  expect(artifact.manifest.steps).toHaveLength(1);
  expect(artifact.manifest.steps[0].kind).toBe('ROLL');
  expect(artifact.manifest.steps[0].transaction).toEqual(transaction);
  expect(await page.evaluate((value) => window.R4b1tTrailV03.verify(value).then(v => v.trail_id), artifact))
    .toBe(artifact.trail_id);
});

test('V3R-02: mixed terrain ROLLs preserve their own immutable constraints', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  await arm(page, 'security_tool');
  await commit(page);
  await arm(page, 'ALL');
  await commit(page);

  const artifact = await page.evaluate(() => window.getTrailManifest());
  expect(artifact.manifest.steps.map(step => step.kind)).toEqual(['ROLL', 'ROLL']);
  expect(artifact.manifest.steps[0].transaction.constraint.terrain).toBe('security_tool');
  expect(artifact.manifest.steps[1].transaction.constraint.terrain).toBe('ALL');
  expect(artifact.manifest).not.toHaveProperty('terrain');
});

test('V3R-03: SELECT is a recorded navigation step and replay does not manufacture another step', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const target = await page.evaluate(async () => (await window.R4b1tCorpusAuthority.loadActive()).urls[17]);
  await page.evaluate(url => window.selectUrl(url), target);

  const before = await page.evaluate(() => window.getTrailManifest());
  expect(before.manifest.steps).toHaveLength(1);
  expect(before.manifest.steps[0].kind).toBe('SELECT');
  expect(before.manifest.steps[0].route.url).toBe(target);
  expect(before.manifest.steps[0]).not.toHaveProperty('transaction');

  await page.evaluate(async (artifact) => {
    await window.importTrailManifest(artifact);
    await window.replayTrailManifest(0);
  }, before);

  const after = await page.evaluate(() => window.getTrailManifest());
  expect(after.manifest.steps).toHaveLength(1);
  expect(after.trail_id).toBe(before.trail_id);
});

test('V3R-04: real BRANCH button activation enters the exported step sequence', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  await page.evaluate(() => window.roll());
  await expect.poll(async () => page.evaluate(async () => (await window.getTrailManifest()).manifest.steps.length)).toBe(1);

  await page.evaluate(() => window.setMode('branch'));
  const item = page.locator('#branchGrid .branch-item').first();
  await expect(item).toBeVisible({ timeout: 8000 });
  const label = (await item.locator('.branch-dir-tag').textContent()).trim();
  await item.click();

  await expect.poll(async () => page.evaluate(async () => (await window.getTrailManifest()).manifest.steps.length)).toBe(2);
  const artifact = await page.evaluate(() => window.getTrailManifest());
  expect(artifact.manifest.steps[1].kind).toBe('BRANCH');
  expect(artifact.manifest.steps[1].navigation.from_step).toBe(1);
  expect(artifact.manifest.steps[1].navigation.branch_label).toBe(label);
});

test('V3R-05: legacy v0.1 export stays available and remains verifiable', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await commit(page);

  const legacy = await page.evaluate(() => window.getLegacyTrailManifest());
  expect(legacy.manifest.format).toBe('r4b1t-trail/v0.1');
  expect(await page.evaluate((value) => window.R4b1tTrail.verify(value).then(v => v.trail_id), legacy)).toBe(legacy.trail_id);

  const replayed = await page.evaluate(async (artifact) => {
    await window.importTrailManifest(artifact);
    return window.replayTrailManifest(0);
  }, legacy);
  expect(replayed).toBe(legacy.manifest.routes[0].url);
});

test('V3R-06: v0.3 fork uses an explicit imported prefix and a fresh child ROLL scope', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await commit(page);

  const parent = await page.evaluate(() => window.getTrailManifest());
  const child = await page.evaluate(async (artifact) => {
    await window.importTrailManifest(artifact);
    return window.forkTrailManifest(1);
  }, parent);

  expect(child.manifest.format).toBe('r4b1t-trail/v0.3');
  expect(child.manifest.parent).toEqual({ trail_id: parent.trail_id, fork_at: 1 });
  expect(child.manifest.steps).toHaveLength(1);
  expect(child.manifest.steps[0].kind).toBe('IMPORTED');
  expect(child.manifest.steps[0].source).toEqual({
    format: 'r4b1t-trail/v0.3',
    trail_id: parent.trail_id,
    step_index: 1,
  });

  const local = await commit(page);
  expect(local.sequence).toBe(1);
  expect(local.sampler.draw_start).toBe(0);
  expect(local.sampler.repeat_guard.reference).toBeNull();

  const extended = await page.evaluate(() => window.getTrailManifest());
  expect(extended.manifest.steps.map(step => step.kind)).toEqual(['IMPORTED', 'ROLL']);
  expect(await page.evaluate((value) => window.R4b1tTrailV03.verifyLineage(value[0], value[1]).then(x => x.fork_at), [extended, parent]))
    .toBe(1);
});

test('V3R-07: v0.3 export does not fail by feeding an unsupported artifact into the v0.1/v0.2 topology atlas', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await commit(page);

  const result = await page.evaluate(async () => {
    let topologyCalls = 0;
    window.rememberTopologySnapshot = async () => {
      topologyCalls += 1;
      throw new Error('old topology does not support v0.3');
    };
    const exported = await window.exportTrailManifest();
    return { format: exported.manifest.format, topologyCalls };
  });

  expect(result.format).toBe('r4b1t-trail/v0.3');
  expect(result.topologyCalls).toBe(0);
});
