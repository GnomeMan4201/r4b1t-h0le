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

async function branchSnapshot(page, origin, presentation) {
  return page.evaluate(async ({ url, title, description }) => {
    window.selectUrl(url);
    document.getElementById('ogTitle').textContent = title;
    document.getElementById('ogDesc').textContent = description;
    await window.sprout();
    return Array.from(document.querySelectorAll('#branchGrid .branch-item')).map(button => ({
      type: button.querySelector('.branch-dir-tag')?.textContent || '',
      reason: button.querySelector('.branch-desc')?.textContent || '',
      domain: button.querySelector('.branch-url-hint')?.textContent || '',
    }));
  }, { url: origin, title: presentation.title, description: presentation.description });
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
  const first = await branchSnapshot(page, origin, {
    title: 'DISPLAY TEXT SHOULD NOT MATTER',
    description: 'MUTATED PRESENTATION ONLY',
  });
  const second = await branchSnapshot(page, origin, {
    title: 'COMPLETELY DIFFERENT TITLE',
    description: 'COMPLETELY DIFFERENT DESCRIPTION',
  });

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

test('BRANCH selection is recorded as explicit v0.3 navigation evidence', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  const seen = [];
  await blockExternalNetwork(page, seen);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForFunction(() => window.__r4b1tCommitRoll && window.__r4b1tCommitRoll.__r4b1tAuthority);

  await page.evaluate(() => window.roll());
  await expect.poll(async () => page.evaluate(async () => (await window.getTrailManifest()).manifest.steps.length)).toBe(1);

  await page.evaluate(async () => {
    window.setMode('branch');
    await window.sprout();
  });
  const firstBranch = page.locator('#branchGrid .branch-item').first();
  await expect(firstBranch).toBeVisible();
  await firstBranch.click();

  const trail = await page.evaluate(() => window.getTrailManifest());
  expect(trail.manifest.format).toBe('r4b1t-trail/v0.3');
  expect(trail.manifest.steps).toHaveLength(2);
  expect(trail.manifest.steps[0].kind).toBe('ROLL');
  expect(trail.manifest.steps[1].kind).toBe('BRANCH');
  expect(trail.manifest.steps[1].navigation.from_step).toBe(1);
  expect(['deeper', 'sideways', 'opposite', 'weird']).toContain(
    trail.manifest.steps[1].navigation.branch_label.toLowerCase(),
  );
});

