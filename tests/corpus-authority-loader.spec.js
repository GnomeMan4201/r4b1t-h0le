'use strict';

const { test, expect } = require('@playwright/test');

const ACTIVE_DIGEST = 'sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1';
const ACTIVE_PATH = '/corpus/releases/typed-candidate-v0.1/urls.txt?';

test('ROLL, Trail, and Blind share one verified promoted corpus load', async ({ page }) => {
  const requests = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('urls.txt')) requests.push(url);
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    window.R4b1tCorpusAuthority &&
    typeof window.roll === 'function' &&
    typeof window.openBlindDescent === 'function' &&
    typeof window.getTrailManifest === 'function'
  ));

  const result = await page.evaluate(async () => {
    const loaded = await window.R4b1tCorpusAuthority.loadActive();
    await window.openBlindDescent();
    const trail = await window.getTrailManifest();
    const blind = await window.getBlindManifest();
    return {
      loadedRevision: loaded.revision,
      count: loaded.urls.length,
      sourceId: loaded.source.id,
      trailRevision: trail.manifest.corpus_revision,
      blindRevision: blind.manifest.genesis.corpus_revision,
      activeAuthority: window.R4b1tCorpusAuthority.active().selectionAuthority,
      releaseAuthority: window.R4b1tCorpusAuthority.candidate().selectionAuthority,
    };
  });

  expect(result.loadedRevision).toBe(ACTIVE_DIGEST);
  expect(result.trailRevision).toBe(ACTIVE_DIGEST);
  expect(result.blindRevision).toBe(ACTIVE_DIGEST);
  expect(result.count).toBe(841);
  expect(result.sourceId).toBe('typed-candidate-v0.1');
  expect(result.activeAuthority).toBe(true);
  expect(result.releaseAuthority).toBe(false);
  expect(requests.filter(url => url.includes(ACTIVE_PATH))).toHaveLength(1);
  expect(
    requests.some(url => url.includes('/urls.txt?') && !url.includes('/corpus/releases/')),
  ).toBe(false);
});

test('promoted corpus digest mismatch fails closed without legacy fallback', async ({ page }) => {
  let legacyRequests = 0;
  await page.route('**/corpus/releases/typed-candidate-v0.1/urls.txt?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: 'https://tampered.example/\n',
    });
  });
  await page.route('**/urls.txt?*', async route => {
    legacyRequests += 1;
    await route.continue();
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.R4b1tCorpusAuthority));

  const message = await page.evaluate(async () => {
    try {
      await window.R4b1tCorpusAuthority.loadActive();
      return 'accepted';
    } catch (error) {
      return String(error && error.message || error);
    }
  });

  expect(message).toMatch(/digest mismatch/i);
  expect(legacyRequests).toBe(0);
});
