'use strict';

const { test, expect } = require('@playwright/test');

test('runtime authority exposes candidate without fetching it for selection', async ({ page }) => {
  const requests = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('urls.txt') || url.includes('typed-candidate-v0.1')) {
      requests.push(url);
    }
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    window.R4b1tCorpusAuthority &&
    typeof window.roll === 'function' &&
    typeof window.openBlindDescent === 'function'
  ));

  const authority = await page.evaluate(() => ({
    active: window.R4b1tCorpusAuthority.active(),
    candidate: window.R4b1tCorpusAuthority.candidate(),
  }));

  expect(authority.active.id).toBe('legacy-urls-v1');
  expect(authority.active.url).toBe('urls.txt');
  expect(authority.active.selectionAuthority).toBe(true);
  expect(authority.candidate.id).toBe('typed-candidate-v0.1');
  expect(authority.candidate.selectionAuthority).toBe(false);

  await page.evaluate(() => window.roll());
  await page.evaluate(() => window.openBlindDescent());

  expect(
    requests.some(url => url.includes('corpus/releases/typed-candidate-v0.1')),
  ).toBe(false);
  expect(
    requests.some(url => url.includes('/urls.txt?')),
  ).toBe(true);
});
