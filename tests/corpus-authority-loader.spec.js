'use strict';

const { test, expect } = require('@playwright/test');

const LEGACY_DIGEST = 'sha256:5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41';

test('ROLL, Trail, and Blind share one verified legacy corpus load', async ({ page }) => {
  const requests = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('/urls.txt?') || url.includes('typed-candidate-v0.1')) {
      requests.push(url);
    }
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
      sourceId: loaded.source.id,
      trailRevision: trail.manifest.corpus_revision,
      blindRevision: blind.manifest.corpus_revision,
      candidateAuthority: window.R4b1tCorpusAuthority.candidate().selectionAuthority,
    };
  });

  expect(result.loadedRevision).toBe(LEGACY_DIGEST);
  expect(result.trailRevision).toBe(LEGACY_DIGEST);
  expect(result.blindRevision).toBe(LEGACY_DIGEST);
  expect(result.sourceId).toBe('legacy-urls-v1');
  expect(result.candidateAuthority).toBe(false);
  expect(requests.filter(url => url.includes('/urls.txt?'))).toHaveLength(1);
  expect(requests.some(url => url.includes('typed-candidate-v0.1'))).toBe(false);
});

test('active corpus digest mismatch fails closed before selection authority is usable', async ({ page }) => {
  await page.route('**/urls.txt?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: 'https://tampered.example/\n',
    });
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
});
