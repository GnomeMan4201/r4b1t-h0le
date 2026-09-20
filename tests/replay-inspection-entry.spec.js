'use strict';

const { test, expect } = require('@playwright/test');

async function loadIntegrated(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('./', { waitUntil: 'domcontentloaded' });
  expect(response && response.status()).toBe(200);
  await page.waitForFunction(() => (
    window.R4b1tReplayInspection
    && window.R4b1tReplayInspectionImport
    && typeof window.openReplayInspection === 'function'
    && typeof window.closeReplayInspection === 'function'
  ));
  expect(errors).toEqual([]);
}

async function trailSource(page, urls, seed) {
  return page.evaluate(async ({ urls, seed }) => {
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: '2026-09-20T10:00:00.000Z',
      corpus_revision: 'sha256:' + 'c'.repeat(64),
      seed,
      terrain: 'RESEARCH',
      routes: urls.map((url) => ({ url, action: 'ROLL' })),
      parent: null,
    });
    return JSON.stringify(await window.R4b1tTrail.envelope(manifest), null, 2) + '\n';
  }, { urls, seed });
}

test('production shell exposes Replay explicitly on desktop and phone width', async ({ page }, testInfo) => {
  await loadIntegrated(page);

  if (testInfo.project.name === 'mobile-chromium') {
    await page.waitForFunction(() => document.documentElement.dataset.r4b1tInterface === 'mobile');
    const entry = page.getByRole('button', { name: 'VERIFY + REPLAY TRAIL ↗' });
    await expect(entry).toBeVisible();
    await entry.click();
  } else {
    await page.waitForFunction(() => document.documentElement.dataset.r4b1tInterface === 'desktop');
    const entry = page.getByRole('button', { name: 'replay', exact: true });
    await expect(entry).toBeVisible();
    await entry.click();
  }

  const dialog = page.getByRole('dialog', { name: 'Replay Inspection' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('NO SOURCE LOADED');
  await expect(dialog.getByLabel('Trail JSON file')).toBeVisible();

  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
});

test('integrated Replay verifies local bytes, navigates, and discards state on close', async ({ page }) => {
  await loadIntegrated(page);
  const source = await trailSource(page, [
    'https://example.org/replay-a',
    'https://example.org/replay-b',
  ], 'integrated-replay');

  const writes = await page.evaluate(() => {
    window.__replayStorageWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      window.__replayStorageWrites.push([key, value]);
      return original.call(this, key, value);
    };
    return window.__replayStorageWrites;
  });
  expect(writes).toEqual([]);

  await page.evaluate(() => window.openReplayInspection());
  const dialog = page.getByRole('dialog', { name: 'Replay Inspection' });
  await dialog.getByLabel('Trail JSON file').setInputFiles({
    name: 'trail.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  });

  const replay = dialog.locator('.replay-inspection');
  await expect(replay).toHaveAttribute('data-proof-state', 'VERIFIED');
  await expect(replay).toContainText('1 / 2');
  await expect(replay).toContainText('https://example.org/replay-a');

  await replay.getByRole('button', { name: 'Next' }).click();
  await expect(replay).toContainText('2 / 2');
  await expect(replay).toContainText('https://example.org/replay-b');

  await dialog.getByRole('button', { name: 'close' }).click();
  await expect(dialog).toBeHidden();

  await page.evaluate(() => window.openReplayInspection());
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('NO SOURCE LOADED');
  await expect(dialog).not.toContainText('https://example.org/replay-a');
  await expect(dialog).not.toContainText('https://example.org/replay-b');
  expect(await page.evaluate(() => window.__replayStorageWrites)).toEqual([]);
});

test('Escape closes Replay and destroys verified presentation state', async ({ page }) => {
  await loadIntegrated(page);
  const source = await trailSource(page, ['https://example.org/escape'], 'escape-replay');

  await page.evaluate(() => window.openReplayInspection());
  const dialog = page.getByRole('dialog', { name: 'Replay Inspection' });
  await dialog.getByLabel('Trail JSON file').setInputFiles({
    name: 'escape.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  });
  await expect(dialog).toContainText('https://example.org/escape');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.evaluate(() => window.openReplayInspection());
  await expect(dialog).toContainText('NO SOURCE LOADED');
  await expect(dialog).not.toContainText('https://example.org/escape');
});
