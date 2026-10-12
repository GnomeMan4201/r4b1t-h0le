'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const promotion = JSON.parse(fs.readFileSync(path.join(__dirname, '../corpus/runtime/active-v1.json'), 'utf8'));

// These viewport heights model the usable page with browser bars visible.
// They are geometry regressions, not native iOS browser-chrome emulation.
for (const height of [668, 635]) {
  test(`short portrait result keeps destination above fixed controls at 390x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium');
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height });
    await page.emulateMedia({ reducedMotion: height === 635 ? 'reduce' : 'no-preference' });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)
        ? route.continue() : route.abort('blockedbyclient');
    });
    await page.addInitScript(active => {
      localStorage.setItem('r4b1t_trail_draft_v1', JSON.stringify({
        seed: 'short-portrait-result-v1', createdAt: '2026-10-12T23:00:00.000Z',
        corpusRevision: active.expected_digest, corpusSourceId: active.source_id,
        routes: [], parent: null,
      }));
    }, promotion.active);
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.R4B1TRollReel && window.R4B1TRollReel.isMounted() &&
      window.__r4b1tCommitRoll && window.__r4b1tCommitRoll.__r4b1tAuthority);
    const count = await page.evaluate(async () => (await window.getTrailManifest()).manifest.steps.length);
    const ids = new Set();
    for (let index = 0; index < 10; index += 1) {
      await page.locator(index ? '#r4mRollAgain' : '#r4mRoll').click();
      await expect(page.locator('html')).toHaveAttribute('data-r4m-presentation', 'revealed');
      await expect(page.locator('#r4mRollReel')).toHaveAttribute('data-phase', 'revealed');
      await expect.poll(() => page.evaluate(async () => (await window.getTrailManifest()).manifest.steps.length))
        .toBe(count + index + 1);
      if (index === 0 || index === 9) {
        await page.screenshot({ path: testInfo.outputPath(`short-result-${height}-${index + 1}.png`) });
      }
      const geometry = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const id = document.getElementById('r4mDomain');
        return {
          identity: rect('#r4mDomain'), actions: rect('.r4m-route-actions'),
          open: rect('#r4mRoute [data-mobile-action="visit"]'), again: rect('#r4mRollAgain'),
          reel: rect('.r4m-reel-window'), scrollY, width: document.documentElement.scrollWidth,
          viewportWidth: innerWidth, viewportHeight: innerHeight,
          url: document.getElementById('r4mUrl').textContent,
          landedUrl: window.R4B1TRollReel.snapshot().landedUrl,
          transactionId: window.R4B1TRollProduction.snapshot().committedTransactionId,
          identityText: id.textContent,
        };
      });
      expect(geometry.identityText).toBeTruthy();
      expect(geometry.identity.top).toBeGreaterThanOrEqual(0);
      expect(geometry.identity.bottom, 'destination identity must clear KEEP/INSPECT without scrolling')
        .toBeLessThanOrEqual(geometry.actions.top - 8);
      expect(geometry.scrollY).toBe(0);
      expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.reel.height, 'preserve all three 64px reel rows').toBe(192);
      expect(geometry.url).toBe(geometry.landedUrl);
      expect(geometry.transactionId).toBeTruthy();
      expect(ids.has(geometry.transactionId)).toBe(false);
      ids.add(geometry.transactionId);
      for (const control of [geometry.open, geometry.again]) {
        expect(control.top).toBeGreaterThanOrEqual(0);
        expect(control.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(control.height).toBeGreaterThanOrEqual(44);
      }
    }
    const beforeInspect = await page.evaluate(async () => JSON.stringify(await window.getTrailManifest()));
    await page.locator('#r4mRoute [data-mobile-action="inspect"]').click();
    await expect(page.locator('#r4mInspectSheet')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#r4mInspectSheet [data-mobile-action="close-sheets"]').click();
    await expect(page.locator('#r4mBackdrop')).toBeHidden();
    expect(await page.evaluate(async () => JSON.stringify(await window.getTrailManifest()))).toBe(beforeInspect);
    await expect(page.locator('#r4mRollAgain')).toBeInViewport();
  });
}
