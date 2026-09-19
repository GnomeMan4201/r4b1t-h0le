'use strict';

const { test, expect } = require('@playwright/test');

test('comparison import UI mounts locally and does not auto-compare', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonImport);
  await page.getByRole('button', { name: 'compare trails' }).click();

  const dialog = page.getByRole('dialog', { name: 'Trail comparison' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Left trail JSON')).toBeVisible();
  await expect(dialog.getByLabel('Right trail JSON')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Compare locally' })).toBeDisabled();
  await expect(dialog.locator('.trail-comparison')).toHaveCount(0);
});

test('two locally selected trail files compare and render without network or persistence', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonImport);

  const requests = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(page.url())) requests.push(request.url());
  });

  await page.evaluate(() => {
    const writes = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      writes.push([key, value]);
      return original.call(this, key, value);
    };
    window.__comparisonStorageWrites = writes;
  });

  const makeTrail = async (seed, urls) => {
    return page.evaluate(async ({ seed, urls }) => {
      const manifest = await window.R4b1tTrail.createManifest({
        created_at: '2026-09-19T23:00:00.000Z',
        corpus_revision: 'sha256:' + 'c'.repeat(64),
        seed,
        terrain: 'RESEARCH',
        routes: urls.map((url) => ({ url, action: 'ROLL' })),
        parent: null,
      });
      return JSON.stringify(await window.R4b1tTrail.envelope(manifest));
    }, { seed, urls });
  };

  const left = await makeTrail('left', ['https://example.org/a', 'https://example.org/left']);
  const right = await makeTrail('right', ['https://example.org/a', 'https://example.org/right']);

  await page.getByRole('button', { name: 'compare trails' }).click();
  const dialog = page.getByRole('dialog', { name: 'Trail comparison' });

  await dialog.getByLabel('Left trail JSON').setInputFiles({
    name: 'left.json',
    mimeType: 'application/json',
    buffer: Buffer.from(left),
  });
  await dialog.getByLabel('Right trail JSON').setInputFiles({
    name: 'right.json',
    mimeType: 'application/json',
    buffer: Buffer.from(right),
  });

  const compare = dialog.getByRole('button', { name: 'Compare locally' });
  await expect(compare).toBeEnabled();
  await compare.click();

  const result = dialog.locator('.trail-comparison');
  await expect(result).toHaveAttribute('data-comparison-state', 'VERIFIED');
  await expect(result).toContainText('SHARED_ANCESTRY_NOT_PROVEN');
  await expect(result).toContainText('DIFFER_REVEALED');
  expect(await page.evaluate(() => window.__comparisonStorageWrites)).toEqual([]);
  expect(requests).toEqual([]);
});

test('unsupported or rejected input remains diagnostic in local import UX', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonImport);
  await page.getByRole('button', { name: 'compare trails' }).click();

  const valid = await page.evaluate(async () => {
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: '2026-09-19T23:10:00.000Z',
      corpus_revision: 'sha256:' + 'd'.repeat(64),
      seed: 'valid',
      terrain: 'RESEARCH',
      routes: [{ url: 'https://example.org/a', action: 'ROLL' }],
      parent: null,
    });
    return JSON.stringify(await window.R4b1tTrail.envelope(manifest));
  });

  const unsupported = JSON.stringify({
    trail_id: 'sha256:' + 'f'.repeat(64),
    manifest: { format: 'r4b1t-trail/v9.9' },
  });

  const dialog = page.getByRole('dialog', { name: 'Trail comparison' });
  await dialog.getByLabel('Left trail JSON').setInputFiles({ name: 'left.json', mimeType: 'application/json', buffer: Buffer.from(valid) });
  await dialog.getByLabel('Right trail JSON').setInputFiles({ name: 'right.json', mimeType: 'application/json', buffer: Buffer.from(unsupported) });
  await dialog.getByRole('button', { name: 'Compare locally' }).click();

  const result = dialog.locator('.trail-comparison');
  await expect(result).toHaveAttribute('data-comparison-state', 'DIAGNOSTIC');
  await expect(result).toContainText('UNVERIFIED');
  await expect(result).toContainText('THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.');
  await expect(result).not.toContainText('SHARED PREFIX');
});

test('closing the comparison dialog discards selected files and rendered result', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonImport);

  const makeTrail = async (seed) => page.evaluate(async (seed) => {
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: '2026-09-19T23:15:00.000Z',
      corpus_revision: 'sha256:' + 'e'.repeat(64),
      seed,
      terrain: 'RESEARCH',
      routes: [{ url: 'https://example.org/' + seed, action: 'ROLL' }],
      parent: null,
    });
    return JSON.stringify(await window.R4b1tTrail.envelope(manifest));
  }, seed);

  const left = await makeTrail('left-clear');
  const right = await makeTrail('right-clear');

  await page.getByRole('button', { name: 'compare trails' }).click();
  const dialog = page.getByRole('dialog', { name: 'Trail comparison' });
  const leftInput = dialog.getByLabel('Left trail JSON');
  const rightInput = dialog.getByLabel('Right trail JSON');

  await leftInput.setInputFiles({ name: 'left.json', mimeType: 'application/json', buffer: Buffer.from(left) });
  await rightInput.setInputFiles({ name: 'right.json', mimeType: 'application/json', buffer: Buffer.from(right) });
  await dialog.getByRole('button', { name: 'Compare locally' }).click();
  await expect(dialog.locator('.trail-comparison')).toHaveCount(1);

  await dialog.getByRole('button', { name: 'close' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'compare trails' }).click();
  await expect(leftInput).toHaveValue('');
  await expect(rightInput).toHaveValue('');
  await expect(dialog.locator('.trail-comparison')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Compare locally' })).toBeDisabled();
});

test('comparison modal supports keyboard close and restores focus', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: 'compare trails' });
  await button.focus();
  await button.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Trail comparison' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('local import implementation has no upload, persistence, telemetry, ranking, or selection hooks', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const source = await page.evaluate(async () => (await fetch('./trail-comparison-import.js')).text());

  for (const forbidden of [
    'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'sendBeacon', 'analytics',
    'upload', 'share_history', 'recent_shares', 'popularity',
    'recommendation', 'selection_weight', 'sampler_weight',
    'rankRoutes(', 'triggerSprout('
  ]) {
    expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
});
