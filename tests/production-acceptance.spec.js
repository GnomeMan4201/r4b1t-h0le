'use strict';

const { test, expect } = require('@playwright/test');

const PROD_ORIGIN = 'https://r4b1t.badbananaresearch.com';
const METADATA_PROXY_ORIGIN = 'https://r4b1t-proxy.badbanana6969.workers.dev';

async function loadProduction(page) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBe(200);

  await page.waitForFunction(() => (
    typeof window.roll === 'function'
    && window.R4b1tTrail
    && window.R4b1tTrailComparisonImport
    && window.R4b1tProofSessionImport
    && typeof window.openTrailTopology === 'function'
    && typeof window.openTrailWearSample === 'function'
  ));

  await expect(page).toHaveTitle('r4b1t');
  expect(pageErrors).toEqual([]);
}

async function makeTrail(page, seed, urls) {
  return page.evaluate(async ({ seed, urls }) => {
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: '2026-09-20T08:20:00.000Z',
      corpus_revision: 'sha256:' + 'c'.repeat(64),
      seed,
      terrain: 'RESEARCH',
      routes: urls.map((url) => ({ url, action: 'ROLL' })),
      parent: null,
    });
    return JSON.stringify(await window.R4b1tTrail.envelope(manifest), null, 2) + '\n';
  }, { seed, urls });
}

async function beginLocalOnlyObservation(page) {
  const unexpectedOffOriginRequests = [];
  const handler = (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    const origin = new URL(url).origin;
    if (origin !== PROD_ORIGIN && origin !== METADATA_PROXY_ORIGIN) unexpectedOffOriginRequests.push(url);
  };
  page.on('request', handler);

  await page.evaluate(() => {
    const writes = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      writes.push([key, value]);
      return original.call(this, key, value);
    };
    window.__productionAcceptanceStorageWrites = writes;
  });

  return {
    unexpectedOffOriginRequests,
    async storageWrites() {
      return page.evaluate(() => window.__productionAcceptanceStorageWrites || []);
    },
  };
}

test('live front door, exploration, topology, and proof entry points remain usable', async ({ page }, testInfo) => {
  await loadProduction(page);

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);

  if (testInfo.project.name === 'iphone13-production') {
    await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'mobile');
    await expect(page.locator('.r4m-shell [data-mobile-action="proof-session"]')).toBeVisible();
    await page.locator('.r4m-shell [data-mobile-action="proof-session"]').click();
    await expect(page.getByRole('dialog', { name: 'Proof Session' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.r4m-shell [data-mobile-action="comparison"]')).toBeVisible();
    await page.locator('.r4m-shell [data-mobile-action="comparison"]').click();
    await expect(page.getByRole('dialog', { name: 'Trail comparison' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#r4mRoll')).toBeVisible();
    await page.locator('#r4mRoll').click();
    await expect(page.locator('#r4mUrl')).toHaveText(/^https?:\/\//);
  } else {
    await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
    await expect(page.getByRole('button', { name: 'proof session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'compare trails' })).toBeVisible();
    await page.locator('#btnGo').click();
    await expect(page.locator('#previewUrl')).toHaveText(/^https?:\/\//);

    const before = await page.evaluate(() => ({
      preview: document.getElementById('previewUrl').textContent,
      trail: document.getElementById('trailItems').textContent,
    }));

    await page.evaluate(() => window.toggleProofSession());
    await expect(page.getByRole('dialog', { name: 'Proof Session' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.evaluate(() => window.toggleTrailComparison());
    await expect(page.getByRole('dialog', { name: 'Trail comparison' })).toBeVisible();
    await page.keyboard.press('Escape');

    const after = await page.evaluate(() => ({
      preview: document.getElementById('previewUrl').textContent,
      trail: document.getElementById('trailItems').textContent,
    }));
    expect(after).toEqual(before);
  }

  await page.evaluate(async () => window.openTrailWearSample());
  await expect(page.locator('#trailTopologyOverlay')).toHaveClass(/\bopen\b/);
  await expect(page.locator('.topology-card[data-proof-state="VERIFIED"]')).toHaveCount(2);
  await expect(page.locator('.topology-parent-stub')).toHaveCount(0);

  const topologyOverflow = await page.evaluate(() => (
    document.getElementById('trailTopologyOverlay').scrollWidth > window.innerWidth + 1
  ));
  expect(topologyOverflow).toBe(false);
});

test('live Trail Comparison accepts explicit local files without persistence or remote transfer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-production', 'single desktop acceptance pass');
  await loadProduction(page);

  const left = await makeTrail(page, 'prod-compare-left', ['https://example.org/a', 'https://example.org/left']);
  const right = await makeTrail(page, 'prod-compare-right', ['https://example.org/a', 'https://example.org/right']);
  const observed = await beginLocalOnlyObservation(page);

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
  await dialog.getByRole('button', { name: 'Compare locally' }).click();

  const result = dialog.locator('.trail-comparison');
  await expect(result).toHaveAttribute('data-comparison-state', 'VERIFIED');
  await expect(result).toContainText('DIFFER_REVEALED');
  await expect(result).toContainText('SHARED_ANCESTRY_NOT_PROVEN');

  expect(await observed.storageWrites()).toEqual([]);
  expect(observed.unexpectedOffOriginRequests).toEqual([]);

  await dialog.getByRole('button', { name: 'close' }).click();
  await page.getByRole('button', { name: 'compare trails' }).click();
  await expect(dialog.getByLabel('Left trail JSON')).toHaveValue('');
  await expect(dialog.getByLabel('Right trail JSON')).toHaveValue('');
  await expect(dialog.locator('.trail-comparison')).toHaveCount(0);
});

test('phone-width Proof Session import is local, ephemeral, deduplicated, and recomputes on removal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone13-production', 'phone-width release acceptance');
  await loadProduction(page);

  const a = await makeTrail(page, 'prod-session-a', ['https://example.org/a']);
  const b = await makeTrail(page, 'prod-session-b', ['https://example.org/b']);
  const unsupported = JSON.stringify({
    trail_id: 'sha256:' + 'f'.repeat(64),
    manifest: { format: 'r4b1t-trail/v9.9' },
  });

  const observed = await beginLocalOnlyObservation(page);

  await page.evaluate(() => window.toggleProofSession());
  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await expect(dialog).toBeVisible();

  const picker = dialog.getByLabel('Trail JSON files');
  await expect(picker).toHaveAttribute('multiple', '');

  await picker.setInputFiles([
    { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'a-copy.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(b) },
  ]);
  await dialog.getByRole('button', { name: 'Build locally' }).click();

  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(3);
  await expect(dialog.locator('.proof-session-source')).toHaveCount(2);
  await expect(dialog.locator('.proof-session-pair')).toHaveCount(1);
  const suppliedCounts = await dialog.locator('.proof-session-source').evaluateAll((nodes) => nodes.map((node) => {
    const field = Array.from(node.querySelectorAll('.proof-session-field'))
      .find((row) => row.querySelector('.proof-session-field-label')?.textContent === 'SUPPLIED');
    return Number(field?.querySelector('.proof-session-field-value')?.textContent || 0);
  }));
  expect(suppliedCounts.sort((a, b) => a - b)).toEqual([1, 2]);

  await dialog.getByRole('button', { name: 'Remove b.json' }).click();
  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(2);
  await expect(dialog.locator('.proof-session-source')).toHaveCount(1);
  await expect(dialog.locator('.proof-session-pair')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Remove a-copy.json' }).click();
  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(1);
  await expect(dialog.locator('.proof-session-source')).toHaveCount(1);

  await dialog.getByRole('button', { name: 'Remove a.json' }).click();
  await expect(dialog.locator('.proof-session')).toHaveCount(0);
  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(0);

  await picker.setInputFiles([
    { name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'unsupported.json', mimeType: 'application/json', buffer: Buffer.from(unsupported) },
  ]);
  await dialog.getByRole('button', { name: 'Build locally' }).click();

  await expect(dialog.locator('.proof-session-diagnostic-source[data-proof-state="UNVERIFIED"]')).toHaveCount(1);
  await expect(dialog.locator('.proof-session-pair')).toHaveCount(0);
  await expect(dialog.locator('.proof-session-relationship')).toHaveCount(0);

  expect(await observed.storageWrites()).toEqual([]);
  expect(observed.unexpectedOffOriginRequests).toEqual([]);

  await dialog.getByRole('button', { name: 'close' }).click();
  await page.evaluate(() => window.toggleProofSession());
  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(0);
  await expect(dialog.locator('.proof-session')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);
  await page.evaluate(() => window.toggleProofSession());
  const reopened = page.getByRole('dialog', { name: 'Proof Session' });
  await expect(reopened.locator('.proof-session-import-selected-item')).toHaveCount(0);
  await expect(reopened.locator('.proof-session')).toHaveCount(0);
});
