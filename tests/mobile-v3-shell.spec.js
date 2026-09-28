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

test('mobile ROLL is presented as the v3 seam door while retaining the authoritative control', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const roll = page.locator('#r4mRoll');
  await expect(roll).toBeVisible();
  await expect(roll).toHaveAttribute('data-mobile-instrument', 'seam-door');
  await expect(roll.locator('.r4m-door-panel')).toHaveCount(2);
  await expect(roll.locator('.r4m-door-seam')).toBeVisible();
  await expect(roll.locator('.r4m-door-aperture')).toBeVisible();
  await expect(roll.locator('.r4m-roll-chassis')).toHaveCount(0);

  const before = await page.locator('#previewUrl').textContent();
  await roll.click();
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('#previewUrl')).not.toHaveText(before || '—');
});

test('mobile MENU groups all existing capabilities by the object they act on', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mNavMenu').click();

  const menu = page.locator('#r4mMenuSheet');
  await expect(menu.locator('[data-menu-group="from-here"] > h3')).toHaveText('FROM HERE');
  await expect(menu.locator('[data-menu-group="trail"] > h3')).toHaveText('YOUR TRAIL');
  await expect(menu.locator('[data-menu-group="proof"] > h3')).toHaveText('TRAIL FILES & PROOF');
  await expect(menu.locator('[data-menu-group="app"] > h3')).toHaveText('THIS APP');

  const expectedActions = [
    'filter', 'branch', 'inspect',
    'topology', 'history', 'copy-trail',
    'trail-file', 'comparison', 'proof-session', 'replay-inspection',
    'help', 'theme'
  ];
  for (const action of expectedActions) {
    await expect(menu.locator('[data-mobile-action="' + action + '"]')).toHaveCount(1);
  }
  await expect(menu.locator('#r4mMenuZip')).toHaveCount(1);
});

test('mobile History presents recorded visits oldest to newest without creating a revisit entry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const urls = [
    'https://one.example/alpha',
    'https://two.example/bravo',
    'https://three.example/charlie',
  ];

  for (const url of urls) {
    await page.evaluate((value) => {
      window.selectUrl(value);
      window.visit();
      if (typeof window.closeIframe === 'function') window.closeIframe();
    }, url);
  }

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();

  const rows = page.locator('#historyList .r4m-ledger-row');
  await expect(rows).toHaveCount(3);

  const before = await rows.evaluateAll((nodes) => nodes.map((node) => node.textContent.replace(/\s+/g, ' ').trim()));
  expect(before[0]).toContain('one.example');
  expect(before[1]).toContain('two.example');
  expect(before[2]).toContain('three.example');
  expect(before[0]).toMatch(/^001\b/);
  expect(before[2]).toMatch(/^003\b/);
  await expect(rows.nth(2)).toHaveAttribute('data-history-latest', 'true');

  await rows.nth(0).click();
  await expect(page.locator('#previewUrl')).toHaveText('https://one.example/alpha');

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  await expect(page.locator('#historyList .r4m-ledger-row')).toHaveCount(3);
});

test('mobile result keeps the approved action hierarchy after the seam opens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible();
  await expect(route.getByRole('button', { name: 'OPEN DESTINATION ↗' })).toBeVisible();
  await expect(route.getByRole('button', { name: 'KEEP CARD' })).toBeVisible();
  await expect(route.getByRole('button', { name: 'INSPECT' })).toBeVisible();
  await expect(route.getByRole('button', { name: 'ROLL AGAIN' })).toBeVisible();

  await expect(route.locator('#r4mTypedMeta')).toBeHidden();
  await expect(page.locator('#r4mRoll')).toBeHidden();
});
