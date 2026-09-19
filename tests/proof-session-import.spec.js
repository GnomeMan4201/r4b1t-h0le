'use strict';

const { test, expect } = require('@playwright/test');

async function makeTrail(page, seed, urls, options = {}) {
  return page.evaluate(async ({ seed, urls, options }) => {
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: options.created_at || '2026-09-19T23:55:00.000Z',
      corpus_revision: 'sha256:' + 'c'.repeat(64),
      seed,
      terrain: 'RESEARCH',
      routes: urls.map((url) => ({ url, action: 'ROLL' })),
      parent: options.parent || null,
    });
    return JSON.stringify(await window.R4b1tTrail.envelope(manifest), null, 2) + '\n';
  }, { seed, urls, options });
}

test('Proof Sessions local import mounts only when opened and accepts multiple files', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  await expect(page.locator('#proofSessionOverlay')).toBeHidden();
  await page.getByRole('button', { name: 'proof session' }).click();

  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await expect(dialog).toBeVisible();
  const picker = dialog.getByLabel('Trail JSON files');
  await expect(picker).toHaveAttribute('multiple', '');
  await expect(dialog.getByRole('button', { name: 'Build locally' })).toBeDisabled();
  await expect(dialog.locator('.proof-session')).toHaveCount(0);
});

test('selected files build one local ephemeral session with no network or storage writes', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  const requests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const current = new URL(page.url());
    if (url.origin !== current.origin) requests.push(request.url());
  });

  await page.evaluate(() => {
    const writes = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      writes.push([key, value]);
      return original.call(this, key, value);
    };
    window.__proofSessionStorageWrites = writes;
  });

  const a = await makeTrail(page, 'session-a', ['https://example.org/a']);
  const b = await makeTrail(page, 'session-b', ['https://example.org/b']);
  const c = await makeTrail(page, 'session-c', ['https://example.org/c']);

  await page.getByRole('button', { name: 'proof session' }).click();
  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await dialog.getByLabel('Trail JSON files').setInputFiles([
    { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(b) },
    { name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(c) },
  ]);

  await expect(dialog.getByRole('button', { name: 'Build locally' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Build locally' }).click();

  const result = dialog.locator('.proof-session');
  await expect(result).toHaveCount(1);
  await expect(result).toContainText('SOURCES');
  await expect(result).toContainText('VERIFIED PAIRS');
  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(3);

  expect(await page.evaluate(() => window.__proofSessionStorageWrites)).toEqual([]);
  expect(requests).toEqual([]);
});

test('exact duplicate selected bytes remain one session source while selected-file list preserves both local choices', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  const source = await makeTrail(page, 'duplicate', ['https://example.org/a']);

  await page.getByRole('button', { name: 'proof session' }).click();
  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await dialog.getByLabel('Trail JSON files').setInputFiles([
    { name: 'copy-one.json', mimeType: 'application/json', buffer: Buffer.from(source) },
    { name: 'copy-two.json', mimeType: 'application/json', buffer: Buffer.from(source) },
  ]);
  await dialog.getByRole('button', { name: 'Build locally' }).click();

  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(2);
  await expect(dialog.locator('.proof-session-source')).toHaveCount(1);
  await expect(dialog.locator('.proof-session-source')).toContainText('SUPPLIED');
  await expect(dialog.locator('.proof-session-source')).toContainText('2');
});

test('removing a selected file recomputes the session from remaining exact bytes', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  const a = await makeTrail(page, 'remove-a', ['https://example.org/a']);
  const b = await makeTrail(page, 'remove-b', ['https://example.org/b']);
  const c = await makeTrail(page, 'remove-c', ['https://example.org/c']);

  await page.getByRole('button', { name: 'proof session' }).click();
  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await dialog.getByLabel('Trail JSON files').setInputFiles([
    { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(b) },
    { name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(c) },
  ]);
  await dialog.getByRole('button', { name: 'Build locally' }).click();

  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(3);
  await expect(dialog.locator('.proof-session-source')).toHaveCount(3);
  await expect(dialog.locator('.proof-session-pair')).toHaveCount(3);

  await dialog.getByRole('button', { name: 'Remove b.json' }).click();

  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(2);
  await expect(dialog.locator('.proof-session-source')).toHaveCount(2);
  await expect(dialog.locator('.proof-session-pair')).toHaveCount(1);
  await expect(dialog.getByText('b.json', { exact: true })).toHaveCount(0);
});

test('removing the last selected file clears the rendered session', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  const a = await makeTrail(page, 'remove-last', ['https://example.org/a']);

  await page.getByRole('button', { name: 'proof session' }).click();
  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await dialog.getByLabel('Trail JSON files').setInputFiles({
    name: 'only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(a),
  });
  await dialog.getByRole('button', { name: 'Build locally' }).click();
  await expect(dialog.locator('.proof-session')).toHaveCount(1);

  await dialog.getByRole('button', { name: 'Remove only.json' }).click();

  await expect(dialog.locator('.proof-session')).toHaveCount(0);
  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Build locally' })).toBeDisabled();
});

test('diagnostic files remain visible but do not create pair facts in local session UX', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  const valid = await makeTrail(page, 'diagnostic-valid', ['https://example.org/a']);
  const unsupported = JSON.stringify({
    trail_id: 'sha256:' + 'f'.repeat(64),
    manifest: { format: 'r4b1t-trail/v9.9' },
  });

  await page.getByRole('button', { name: 'proof session' }).click();
  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await dialog.getByLabel('Trail JSON files').setInputFiles([
    { name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(valid) },
    { name: 'unsupported.json', mimeType: 'application/json', buffer: Buffer.from(unsupported) },
  ]);
  await dialog.getByRole('button', { name: 'Build locally' }).click();

  await expect(dialog.locator('.proof-session-diagnostic-source[data-proof-state="UNVERIFIED"]')).toHaveCount(1);
  await expect(dialog.locator('.proof-session-pair')).toHaveCount(0);
  await expect(dialog.locator('.proof-session-relationship')).toHaveCount(0);
});

test('closing Proof Session discards selected files, rendered result, and in-memory state', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  const a = await makeTrail(page, 'close-a', ['https://example.org/a']);
  const b = await makeTrail(page, 'close-b', ['https://example.org/b']);

  const openButton = page.getByRole('button', { name: 'proof session' });
  await openButton.click();
  const dialog = page.getByRole('dialog', { name: 'Proof Session' });

  await dialog.getByLabel('Trail JSON files').setInputFiles([
    { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(b) },
  ]);
  await dialog.getByRole('button', { name: 'Build locally' }).click();
  await expect(dialog.locator('.proof-session')).toHaveCount(1);

  await dialog.getByRole('button', { name: 'close' }).click();
  await expect(dialog).toBeHidden();

  await openButton.click();
  await expect(dialog.getByLabel('Trail JSON files')).toHaveValue('');
  await expect(dialog.locator('.proof-session-import-selected-item')).toHaveCount(0);
  await expect(dialog.locator('.proof-session')).toHaveCount(0);
  expect(await page.evaluate(() => window.R4b1tProofSessionImport.getSelectedCount())).toBe(0);
});

test('Proof Session modal supports Escape close and restores focus', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionImport);

  const button = page.getByRole('button', { name: 'proof session' });
  await button.focus();
  await button.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Proof Session' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('Proof Session import implementation contains no persistence, remote transfer, telemetry, ranking, or selection hooks', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const source = await page.evaluate(async () => (await fetch('./proof-session-import.js')).text());

  for (const forbidden of [
    'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'caches.',
    'sendBeacon', 'analytics', 'telemetry', 'recent_sessions',
    'recommendation', 'popularity', 'selection_weight', 'sampler_weight',
    'rankRoutes(', 'triggerSprout('
  ]) {
    expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
});
