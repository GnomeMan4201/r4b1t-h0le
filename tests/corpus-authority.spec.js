'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const RELEASE = path.resolve(
  __dirname, '..', 'corpus', 'releases', 'diverse-candidate-v0.2', 'urls.txt',
);
const ACTIVE_URLS = new Set(
  fs.readFileSync(RELEASE, 'utf8').split(/\r?\n/).map(value => value.trim()).filter(Boolean),
);

test('production ROLL selects from explicitly promoted typed corpus', async ({ page }) => {
  const requests = [];

  page.on('request', request => {
    if (request.url().includes('urls.txt')) requests.push(request.url());
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    window.R4b1tCorpusAuthority &&
    typeof window.roll === 'function'
  ));

  const authority = await page.evaluate(async () => {
    const loaded = await window.R4b1tCorpusAuthority.loadActive();
    return {
      active: window.R4b1tCorpusAuthority.active(),
      candidate: window.R4b1tCorpusAuthority.candidate(),
      promotion: window.R4b1tCorpusAuthority.promotion(),
      count: loaded.urls.length,
    };
  });

  expect(authority.active.id).toBe('diverse-candidate-v0.2');
  expect(authority.active.selectionAuthority).toBe(true);
  expect(authority.candidate.selectionAuthority).toBe(false);
  expect(authority.promotion.id).toBe('diverse-candidate-v0.2-active-v1');
  expect(authority.count).toBe(6859);

  await page.waitForTimeout(50);
  await page.evaluate(() => window.roll());
  const selected = (await page.locator('#previewUrl').textContent()).trim();

  expect(ACTIVE_URLS.has(selected)).toBe(true);
  expect(
    requests.some(url => url.includes('/corpus/releases/diverse-candidate-v0.2/urls.txt?')),
  ).toBe(true);
  expect(
    requests.some(url => url.includes('/urls.txt?') && !url.includes('/corpus/releases/')),
  ).toBe(false);
});
