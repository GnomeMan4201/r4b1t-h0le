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

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test('mobile landing states the product once and leaves utilities to MENU', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.roll === 'function');
  await page.waitForSelector('#r4mHero h1');

  const hero = page.locator('#r4mHero');
  await expect(hero).toBeVisible();
  await expect(hero.locator('img[src="rabbit-aperture.svg"]')).toBeVisible();
  await expect(page.locator('#r4mApertureState')).toHaveText('RANDOM DISCOVERY / CYBERSECURITY WEB');
  await expect(hero.locator('h1')).toHaveText('A DOOR, NOT A FEED.');
  await expect(hero.locator('p')).toHaveText('NO PROFILE. NO RANKING. COMMITTED BEFORE REVEAL.');

  await expect(page.locator('.r4m-header-actions')).toHaveCount(0);
  await expect(page.locator('.r4m-filter-strip')).toHaveCount(0);
  await expect(page.locator('.r4m-status')).toHaveCount(0);
  await expect(page.locator('#r4mFilterLabel')).toBeHidden();
  await expect(page.locator('#r4mModeLabel')).toBeHidden();

  await expect(page.locator('#r4mModeRoll')).toBeVisible();
  await expect(page.locator('#r4mModeBlind')).toBeVisible();
  await expect(page.locator('#r4mDescentEntry')).toBeHidden();
  await expect(page.locator('.r4m-enter')).toHaveCount(0);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('.r4m-enter')).toHaveText('OPEN DESTINATION ↗', { timeout: 1500 });
});
