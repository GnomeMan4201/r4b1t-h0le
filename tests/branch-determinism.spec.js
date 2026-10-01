'use strict';

const { test, expect } = require('@playwright/test');

async function blockExternalNetwork(page, seen) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    const host = new URL(url).hostname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    seen.push(url);
    return route.abort('blockedbyclient');
  });
}

async function ready(page) {
  await page.waitForFunction(() => typeof window.sprout === 'function' && typeof window.selectUrl === 'function');
  await page.evaluate(async () => {
    await window.R4b1tCorpusAuthority.loadActive();
    await new Promise(r => setTimeout(r, 50));
  });
}

async function branchSnapshot(page, origin) {
  return page.evaluate(async (url) => {
    window.selectUrl(url);
    document.getElementById('ogTitle').textContent = 'DISPLAY TEXT SHOULD NOT MATTER';
    document.getElementById('ogDesc').textContent = 'MUTATED PRESENTATION ONLY';
    await window.sprout();
    return Array.from(document.querySelectorAll('#branchGrid .branch-item')).map(button => ({
      type: button.querySelector('.branch-dir-tag')?.textContent || '',
      reason: button.querySelector('.branch-desc')?.textContent || '',
      domain: button.querySelector('.branch-url-hint')?.textContent || '',
    }));
  }, origin);
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});

test('BRANCH is stable under presentation mutation and does not fetch enrichment', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  const seen = [];
  await blockExternalNetwork(page, seen);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const origin = 'https://github.com/sullo/nikto';
  const first = await branchSnapshot(page, origin);

  await page.evaluate(() => {
    document.getElementById('ogTitle').textContent = 'COMPLETELY DIFFERENT TITLE';
    document.getElementById('ogDesc').textContent = 'COMPLETELY DIFFERENT DESCRIPTION';
  });
  const second = await branchSnapshot(page, origin);

  expect(first).toHaveLength(4);
  expect(second).toEqual(first);
  expect(seen.filter(url => /wikipedia\.org/i.test(url))).toEqual([]);
});

test('production BRANCH authority has no ambient randomness or history exclusion input', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  const seen = [];
  await blockExternalNetwork(page, seen);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const source = await page.evaluate(() => ({
    generate: window.R4b1tBranchCore && window.R4b1tBranchCore.generate.toString(),
    sprout: window.sprout.toString(),
  }));

  expect(source.generate).toBeTruthy();
  expect(source.generate).not.toMatch(/Math\.random|document|localStorage|sessionStorage|fetch\s*\(/);
  expect(source.sprout).not.toMatch(/h\.nodes\.map|new Set\(/);
});
