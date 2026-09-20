'use strict';

const { test, expect } = require('@playwright/test');

const PROD_ORIGIN = 'https://r4b1t.badbananaresearch.com';
const METADATA_PROXY_ORIGIN = 'https://r4b1t-proxy.badbanana6969.workers.dev';

async function loadProduction(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBe(200);

  await page.waitForFunction(() => (
    window.R4b1tTrail
    && window.R4b1tBlind
    && window.R4b1tReplayInspection
    && window.R4b1tReplayInspectionImport
    && typeof window.openReplayInspection === 'function'
    && typeof window.closeReplayInspection === 'function'
  ));
  expect(errors).toEqual([]);
}

async function makeV01(page, urls, seed) {
  return page.evaluate(async ({ urls, seed }) => {
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: '2026-09-20T10:20:00.000Z',
      corpus_revision: 'sha256:' + 'c'.repeat(64),
      seed,
      terrain: 'RESEARCH',
      routes: urls.map((url) => ({ url, action: 'ROLL' })),
      parent: null,
    });
    return JSON.stringify(await window.R4b1tTrail.envelope(manifest), null, 2) + '\n';
  }, { urls, seed });
}

async function makeV02(page) {
  return page.evaluate(async () => {
    const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const NONCE_A = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
    const NONCE_B = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';
    let manifest = await window.R4b1tBlind.create({
      created_at: '2026-09-20T10:21:00.000Z',
      corpus_revision: 'sha256:' + 'c'.repeat(64),
      terrain: 'RESEARCH',
      trail_salt: SALT,
      parent: null,
    });
    const first = await window.R4b1tBlind.commit(manifest, 'https://concealed.example/never-render', NONCE_A);
    manifest = first.manifest;
    const second = await window.R4b1tBlind.commit(manifest, 'https://example.org/valid-reveal', NONCE_B);
    manifest = await window.R4b1tBlind.reveal(second.manifest, second.secret);
    return JSON.stringify(await window.R4b1tBlind.envelope(manifest), null, 2) + '\n';
  });
}

async function observeReplayOnly(page) {
  const requests = [];
  const handler = (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    const origin = new URL(url).origin;
    if (origin !== PROD_ORIGIN && origin !== METADATA_PROXY_ORIGIN) requests.push(url);
  };
  page.on('request', handler);

  await page.evaluate(() => {
    window.__replayAcceptanceWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      window.__replayAcceptanceWrites.push([key, value]);
      return original.call(this, key, value);
    };
  });

  return {
    requests,
    writes: () => page.evaluate(() => window.__replayAcceptanceWrites || []),
  };
}

test('live production exposes Replay on desktop and iPhone without horizontal overflow', async ({ page }, testInfo) => {
  await loadProduction(page);

  if (testInfo.project.name === 'iphone13-production') {
    await page.waitForFunction(() => document.documentElement.dataset.r4b1tInterface === 'mobile');
    await expect(page.locator('.r4m-nav [data-mobile-action="replay-inspection"]')).toBeVisible();
  } else {
    await page.waitForFunction(() => document.documentElement.dataset.r4b1tInterface === 'desktop');
    await expect(page.getByRole('button', { name: 'replay', exact: true })).toBeVisible();
  }

  await page.evaluate(() => window.openReplayInspection());
  const dialog = page.getByRole('dialog', { name: 'Replay Inspection' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('NO SOURCE LOADED');

  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
});

test('live Replay verifies exact local bytes, navigates, and remains ephemeral with no remote transfer', async ({ page }) => {
  await loadProduction(page);
  const source = await makeV01(page, [
    'https://example.org/production-replay-a',
    'https://example.org/production-replay-b',
  ], 'production-replay');
  const observed = await observeReplayOnly(page);

  await page.evaluate(() => window.openReplayInspection());
  const dialog = page.getByRole('dialog', { name: 'Replay Inspection' });
  await dialog.getByLabel('Trail JSON file').setInputFiles({
    name: 'production-trail.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  });

  const replay = dialog.locator('.replay-inspection');
  await expect(replay).toHaveAttribute('data-proof-state', 'VERIFIED');
  await expect(replay).toContainText('1 / 2');
  await expect(replay).toContainText('https://example.org/production-replay-a');

  await replay.getByRole('button', { name: 'Next' }).click();
  await expect(replay).toContainText('2 / 2');
  await expect(replay).toContainText('https://example.org/production-replay-b');

  expect(await observed.writes()).toEqual([]);
  expect(observed.requests).toEqual([]);

  await dialog.getByRole('button', { name: 'close' }).click();
  await page.evaluate(() => window.openReplayInspection());
  await expect(dialog).toContainText('NO SOURCE LOADED');
  await expect(dialog).not.toContainText('production-replay-a');
  await expect(dialog).not.toContainText('production-replay-b');
});

test('iPhone replay keeps concealed identity out of current DOM before and after backward navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone13-production', 'phone-width concealment acceptance');
  await loadProduction(page);
  const source = await makeV02(page);

  await page.evaluate(() => window.openReplayInspection());
  const dialog = page.getByRole('dialog', { name: 'Replay Inspection' });
  await dialog.getByLabel('Trail JSON file').setInputFiles({
    name: 'blind-trail.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  });

  const replay = dialog.locator('.replay-inspection');
  await expect(replay).toContainText('CONCEALED');
  let surface = await replay.evaluate((node) => node.innerHTML);
  expect(surface).not.toContain('concealed.example');
  expect(surface).not.toContain('valid-reveal');

  await replay.getByRole('button', { name: 'Next' }).click();
  await expect(replay).toContainText('https://example.org/valid-reveal');

  await replay.getByRole('button', { name: 'Previous' }).click();
  await expect(replay).toContainText('CONCEALED');
  surface = await replay.evaluate((node) => node.innerHTML);
  expect(surface).not.toContain('concealed.example');
  expect(surface).not.toContain('valid-reveal');
});

test('tampered supported source fails closed in live Replay', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-production', 'single diagnostic acceptance pass');
  await loadProduction(page);
  const source = JSON.parse(await makeV01(page, ['https://example.org/original'], 'production-tamper'));
  source.manifest.routes[0].url = 'https://attacker.invalid/';

  await page.evaluate(() => window.openReplayInspection());
  const dialog = page.getByRole('dialog', { name: 'Replay Inspection' });
  await dialog.getByLabel('Trail JSON file').setInputFiles({
    name: 'tampered.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  });

  const replay = dialog.locator('.replay-inspection');
  await expect(replay).toHaveAttribute('data-proof-state', 'REJECTED');
  await expect(replay).not.toContainText('https://attacker.invalid/');
  await expect(replay.getByRole('button', { name: 'Next' })).toHaveCount(0);
});
