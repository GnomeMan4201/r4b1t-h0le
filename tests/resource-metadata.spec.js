'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const RESOURCES = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'corpus', 'releases', 'typed-candidate-v0.1', 'resources.json'),
    'utf8',
  ),
);
const BY_URL = new Map(RESOURCES.resources.map(record => [record.url, record]));

async function allowLocalOnly(page, overrides = {}) {
  await page.route('**/*', async route => {
    const requestUrl = route.request().url();
    const parsed = new URL(requestUrl);

    if (overrides.tamperMetadata &&
        parsed.pathname.endsWith('/corpus/releases/typed-candidate-v0.1/resources.json')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: '{"schema":"tampered"}\n',
      });
    }

    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) {
      return route.continue();
    }
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      return route.continue();
    }
    return route.abort('blockedbyclient');
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => (
    window.R4b1tCorpusAuthority &&
    typeof window.roll === 'function' &&
    document.getElementById('r4mShellHost')
  ));
}

async function rollVisible(page, projectName) {
  if (projectName === 'mobile-chromium') {
    await page.locator('#r4mRoll').click();
    await expect(page.locator('#r4mRoute')).toBeVisible();
  } else {
    await page.locator('#btnGo').click();
  }
  await expect(page.locator('#previewUrl')).toHaveText(/^https?:\/\//);
}

test('typed resource metadata is requested only after reveal and describes the selected route', async ({ page }, testInfo) => {
  await allowLocalOnly(page);
  const resourceRequests = [];
  page.on('request', request => {
    if (request.url().includes('/resources.json')) resourceRequests.push(request.url());
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.waitForFunction(() => (
    window.R4b1tCorpusAuthority &&
    window.R4b1tCorpusAuthority.active().id === 'typed-candidate-v0.1'
  ));

  expect(resourceRequests).toHaveLength(0);

  await rollVisible(page, testInfo.project.name);
  await expect(page.locator('#typedResourceMeta')).toHaveAttribute('data-state', 'verified');

  const selected = (await page.locator('#previewUrl').textContent()).trim();
  const expected = BY_URL.get(selected);
  expect(expected).toBeTruthy();

  await expect(page.locator('#typedResourceType')).toHaveText(
    expected.resource_type.replace(/_/g, ' ').toUpperCase(),
  );
  await expect(page.locator('#typedEligibilityReason')).toHaveText(
    expected.eligibility_reason.replace(/_/g, ' '),
  );
  await expect(page.locator('#typedProvenance')).toHaveText(expected.provenance);
  expect(resourceRequests).toHaveLength(1);

  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.locator('#r4mResourceType')).toHaveText(
      expected.resource_type.replace(/_/g, ' ').toUpperCase(),
    );
    await page.locator('#r4mNavMenu').click();
    await page.locator('#r4mMenuSheet [data-mobile-action="inspect"]').click();
    await expect(page.locator('#r4mInspectResourceType')).toHaveText(
      expected.resource_type.replace(/_/g, ' ').toUpperCase(),
    );
    await expect(page.locator('#r4mInspectEligibility')).toHaveText(
      expected.eligibility_reason.replace(/_/g, ' '),
    );
    await expect(page.locator('#r4mInspectProvenance')).toHaveText(expected.provenance);
  }
});

test('metadata verification failure does not revoke or reroll the selected route', async ({ page }, testInfo) => {
  await allowLocalOnly(page, { tamperMetadata: true });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await rollVisible(page, testInfo.project.name);
  const selected = (await page.locator('#previewUrl').textContent()).trim();

  await expect(page.locator('#typedResourceMeta')).toHaveAttribute('data-state', 'unavailable');
  await expect(page.locator('#typedResourceMeta')).toBeHidden();

  const artifact = await page.evaluate(() => window.getTrailManifest());
  expect(artifact.manifest.routes.some(route => route.url === selected)).toBe(true);
  expect(BY_URL.has(selected)).toBe(true);
});

test('post-selection metadata failure never triggers a second selection', async ({ page }, testInfo) => {
  await allowLocalOnly(page, { tamperMetadata: true });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const before = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('r4b1t_trail_draft_v1') || 'null');
    return saved && saved.routes ? saved.routes.length : 0;
  });

  await rollVisible(page, testInfo.project.name);
  await expect(page.locator('#typedResourceMeta')).toHaveAttribute('data-state', 'unavailable');

  const after = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('r4b1t_trail_draft_v1') || 'null');
    return saved && saved.routes ? saved.routes.length : 0;
  });

  expect(after).toBe(before + 1);
});
