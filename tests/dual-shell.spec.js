'use strict';

const { test, expect } = require('@playwright/test');

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => typeof window.roll === 'function');
  await page.waitForSelector('#r4mShellHost', { state: 'attached' });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test('desktop keeps the native r4b1t shell', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
  await expect(page.locator('.rig')).toBeVisible();
  await expect(page.locator('#r4mShellHost')).toBeHidden();
});

test('mobile selects the dedicated shell and rolls through the shared engine', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'mobile');
  await expect(page.locator('.r4m-shell')).toBeVisible();
  await expect(page.locator('#r4mRoll')).toBeVisible();
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('#r4mDomain')).not.toHaveText('—');
  await expect(page.locator('#r4mUrl')).toHaveText(/^https?:\/\//);
  await expect(page.locator('#previewDomain')).not.toHaveText('—');

  const mirrored = await page.evaluate(() => ({
    route: document.getElementById('r4mUrl').textContent.trim(),
    domain: document.getElementById('r4mDomain').textContent.trim(),
  }));
  const expectedHost = new URL(mirrored.route).hostname.replace(/^www\./, '').toUpperCase();
  expect(mirrored.domain).toBe(expectedHost);
});

test('mobile terrain filter can select and return to all signals', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('[data-mobile-action="filter"]').first().click();
  await expect(page.locator('#r4mFilterSheet')).toHaveClass(/\bopen\b/);
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'CODE' }).click();
  await expect(page.locator('#r4mFilterLabel')).toHaveText('CODE');
  await expect(page.locator('#r4mRollScope')).toHaveText('CODE ROUTES');

  await page.locator('[data-mobile-action="filter"]').first().click();
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'ALL SIGNALS' }).click();
  await expect(page.locator('#r4mFilterLabel')).toHaveText('ALL SIGNALS');
  await expect(page.locator('#r4mRollScope')).toHaveText('FULL CORPUS');
});

test('mobile navigation opens filter and inspect sheets without horizontal overflow', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('[data-mobile-action="filter"]').first().click();
  await expect(page.locator('#r4mFilterSheet')).toHaveClass(/\bopen\b/);
  await page.locator('[data-mobile-action="close-sheets"]').first().click();

  await page.locator('[data-mobile-action="inspect"]').click();
  await expect(page.locator('#r4mInspectSheet')).toHaveClass(/\bopen\b/);

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('mobile branch sheet explains the empty state and offers a recovery action', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.evaluate(() => {
    document.getElementById('previewUrl').textContent = '—';
    document.getElementById('branchGrid').replaceChildren();
    document.getElementById('btnModeBranch').classList.add('active');
  });

  await page.locator('[data-mobile-action="branch"]').click();
  const empty = page.locator('#r4mBranchOptions .r4m-branch-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty.locator('strong')).toHaveText('NO CURRENT ROUTE');
  await expect(empty).toContainText('Roll a route before generating directions.');
  await expect(empty.getByRole('button', { name: 'ROLL A ROUTE' })).toBeVisible();
});


test('mobile can explicitly return from Branch to Random mode without rolling', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const routeBefore = await page.locator('#previewUrl').textContent();

  await page.locator('[data-mobile-action="branch"]').click();
  await expect(page.locator('#r4mBranchSheet')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#btnModeBranch')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#btnModeRandom')).not.toHaveClass(/\bactive\b/);
  await expect(page.locator('#r4mModeLabel')).toHaveText('BRANCH');

  const randomMode = page.locator('#r4mBranchSheet [data-mobile-action="random-mode"]');
  await expect(randomMode).toBeVisible();
  await randomMode.click();

  await expect(page.locator('#btnModeRandom')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#btnModeBranch')).not.toHaveClass(/\bactive\b/);
  await expect(page.locator('#r4mModeLabel')).toHaveText('UNBOUNDED');
  await expect(page.locator('#r4mBranchSheet')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#previewUrl')).toHaveText(routeBefore);
});

test('changing viewport width switches shells without reloading', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'mobile');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
});


test('mobile ROLL keeps route-specific result DOM absent until reveal boundary', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('#r4mUrl')).toHaveText(/^https?:\/\//);
});

test('mobile repeated ROLL activation cannot create a second active transaction', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await page.locator('#r4mRoll').click({ force: true });
  const snapshot = await page.evaluate(() => window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot());
  expect(snapshot).toBeTruthy();
  expect(snapshot.transactionId).toBe(1);
  await expect(page.locator('#r4mRoute')).toBeVisible();
});

test('mobile reduced motion preserves deferred disclosure without strip travel', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('#r4mRoll .r4m-roll-strip')).toBeAttached();
});


test('mobile persisted pageshow preserves an already revealed settled route', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  const before = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    route: document.getElementById('r4mUrl').textContent.trim(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
  }));

  await page.evaluate(() => {
    const route = document.getElementById('r4mRoute');
    if (route) route.removeAttribute('data-motion');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(50);

  const after = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    route: document.getElementById('r4mUrl').textContent.trim(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
    routeMotion: document.getElementById('r4mRoute').getAttribute('data-motion'),
  }));

  expect(after.route).toBe(before.route);
  expect(after.trail).toEqual(before.trail);
  expect(after.snapshot.transactionId).toBe(before.snapshot.transactionId);
  expect(after.snapshot.state).toBe(before.snapshot.state);
  expect(after.routeMotion).toBeNull();
});

test('mobile persisted pageshow resumes without rebuilding settled presentation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  const result = await page.evaluate(() => {
    const before = {
      filterOptions: document.getElementById('r4mFilterOptions'),
      trail: document.getElementById('r4mTrailItems'),
      route: document.getElementById('r4mRoute'),
    };
    const filterChildren = Array.from(before.filterOptions.children);
    const trailChildren = Array.from(before.trail.children);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    return {
      filterHostSame: document.getElementById('r4mFilterOptions') === before.filterOptions,
      filterChildrenSame:
        filterChildren.length === before.filterOptions.children.length &&
        filterChildren.every((node, index) => node === before.filterOptions.children[index]),
      trailHostSame: document.getElementById('r4mTrailItems') === before.trail,
      trailChildrenSame:
        trailChildren.length === before.trail.children.length &&
        trailChildren.every((node, index) => node === before.trail.children[index]),
      routeSame: document.getElementById('r4mRoute') === before.route,
    };
  });

  expect(result.routeSame).toBe(true);
  expect(result.filterHostSame).toBe(true);
  expect(result.filterChildrenSame).toBe(true);
  expect(result.trailHostSame).toBe(true);
  expect(result.trailChildrenSame).toBe(true);
});

test('mobile non-persisted pageshow keeps ordinary synchronization for an already revealed route', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  const before = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    route: document.getElementById('r4mUrl').textContent.trim(),
    domain: document.getElementById('r4mDomain').textContent.trim(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
  }));

  await page.evaluate(() => {
    document.getElementById('r4mUrl').textContent = 'STALE';
    document.getElementById('r4mDomain').textContent = 'STALE';
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
  });

  await expect(page.locator('#r4mUrl')).toHaveText(before.route);
  await expect(page.locator('#r4mDomain')).toHaveText(before.domain);

  const after = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
  }));
  expect(after.trail).toEqual(before.trail);
  expect(after.snapshot.transactionId).toBe(before.snapshot.transactionId);
  expect(after.snapshot.state).toBe(before.snapshot.state);
});
