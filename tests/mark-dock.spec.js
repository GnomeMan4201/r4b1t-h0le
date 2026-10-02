'use strict';

// The mark dock: while any sheet or overlay is open, the production mark stays on screen
// above it, so the rabbit's reaction to that command is actually seen. Layout only.

const { test, expect } = require('@playwright/test');

async function openShell(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#r4mRoll', { state: 'visible' });
  await page.waitForSelector('#r4h-root', { state: 'attached' });
  await page.waitForFunction(() => typeof window.openTrailLedger === 'function' && typeof window.openTrailTopology === 'function');
}

async function fromMenu(page, action) {
  await page.locator('#r4mNavMenu').tap();
  await page.waitForSelector('#r4mMenuSheet.open');
  await page.locator(`#r4mMenuSheet [data-mobile-action="${action}"]`).first().tap();
}

// the mark is docked, fully on screen, and the surface starts at or below its bottom edge
async function expectDockedAbove(page, surfaceId) {
  await expect(page.locator('html')).toHaveClass(/\br4m-mark-docked\b/);
  await expect(page.locator('#' + surfaceId)).toBeVisible();
  await page.waitForTimeout(450); // let the panel finish sliding in
  const g = await page.evaluate((id) => {
    const svg = document.querySelector('#r4mProductionMark > svg');
    const s = svg.getBoundingClientRect();
    const p = document.getElementById(id).getBoundingClientRect();
    return { pos: getComputedStyle(svg).position, top: s.top, bottom: s.bottom, height: s.height, vh: innerHeight, panelTop: p.top };
  }, surfaceId);
  expect(g.pos).toBe('fixed');
  expect(g.height).toBeGreaterThan(60);
  expect(g.top).toBeGreaterThanOrEqual(0);
  expect(g.bottom).toBeLessThanOrEqual(g.vh);
  expect(g.panelTop, `${surfaceId} starts under the mark`).toBeGreaterThanOrEqual(g.bottom - 1);
}

test.describe('mark dock', () => {
  test.skip(({ isMobile }) => !isMobile, 'the production mark mounts in the mobile shell');

  test('MENU, BRANCH and the bottom sheets keep the rabbit on stage', async ({ page }) => {
    await openShell(page);
    await page.locator('#r4mNavMenu').tap();
    await expectDockedAbove(page, 'r4mMenuSheet');
    await page.locator('#r4mMenuSheet [data-mobile-action="branch"]').first().tap();
    await expectDockedAbove(page, 'r4mBranchSheet');
    await expect(page.locator('html')).toHaveClass(/\bbranch-open\b/);
  });

  test('history, topology, replay and trail overlays keep the rabbit on stage', async ({ page }) => {
    for (const [open, id] of [
      [(p) => fromMenu(p, 'history'), 'historyOverlay'],
      [(p) => fromMenu(p, 'topology'), 'trailTopologyOverlay'],
      [(p) => fromMenu(p, 'replay-inspection'), 'replayInspectionOverlay'],
      [(p) => p.evaluate(() => window.openTrailLedger()), 'trailLedgerOverlay'],
    ]) {
      await openShell(page);
      await open(page);
      await expectDockedAbove(page, id);
    }
  });

  test('BLIND DESCENT plays in view: the rabbit is docked above the descent stage', async ({ page }) => {
    await openShell(page);
    await page.locator('[data-mobile-action="stage-blind"]').first().tap();
    await page.locator('[data-mobile-action="blind-descent"]').first().tap();
    await expect(page.locator('html')).toHaveClass(/\bblind-descending\b/);
    await expectDockedAbove(page, 'blindDescentOverlay');
  });

  test('closing returns the mark to the page exactly where it was', async ({ page }) => {
    await openShell(page);
    const svgRect = () => page.evaluate(() => {
      const r = document.querySelector('#r4mProductionMark > svg').getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    });
    const before = await svgRect();
    await page.locator('#r4mNavMenu').tap();
    await expectDockedAbove(page, 'r4mMenuSheet');
    expect(await svgRect(), 'docks in place when the mark is on screen').toEqual(before);
    await page.locator('#r4mNavMenu').tap(); // CLOSE
    await expect(page.locator('html')).not.toHaveClass(/\br4m-mark-docked\b/);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#r4mProductionMark > svg')).position)).not.toBe('fixed');
    expect(await svgRect()).toEqual(before);
  });
});
