'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__R4B1T_TEST__ = { markRollMs: 5 };
    try { localStorage.removeItem('r4b1t-roll-reel-sound'); } catch (_) {}
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' ? route.continue() : route.abort('blockedbyclient');
  });
});

test('WebKit: injected 5ms first-roll fallback preserves canonical lifecycle', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.R4B1TRollReel && window.R4B1TRollProduction &&
    window.R4B1TRollReel.isMounted() &&
    window.__r4b1tCommitRoll && window.__r4b1tCommitRoll.__r4b1tAuthority);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__fiveMsEvents = { starts: 0, ends: 0, cancels: 0 };
    for (const [name, field] of [['animationstart','starts'],['animationend','ends'],['animationcancel','cancels']]) {
      rabbit.addEventListener(name, event => {
        if (event.animationName === 'r4h-roll-rabbit') window.__fiveMsEvents[field]++;
      });
    }
  });

  expect(await page.evaluate(() => window.R4B1TRollReel.quickRoll())).toBe(true);
  await page.waitForFunction(() => window.__r4b1tTestSoftDelayApplied === 5, null, { timeout: 5000 });

  try {
    await page.waitForFunction(() => window.__fiveMsEvents.starts === 1, null, { timeout: 4500 });
    await page.waitForFunction(() => window.__fiveMsEvents.ends === 1, null, { timeout: 4500 });
  } catch (err) {
    const d = await page.evaluate(() => ({
      firstFailingRollIndex: 1,
      effectiveSoftDeadlineMs: window.__r4b1tTestSoftDelayApplied,
      events: window.__fiveMsEvents,
      rolling: document.documentElement.classList.contains('rolling'),
      rabbitTrace: window.__r4b1tRabbitFallbackTrace || null,
      reel: window.R4B1TRollReel.snapshot(),
      production: window.R4B1TRollProduction.snapshot()
    }));
    throw new Error('5MS_FIRST_ROLL_LIFECYCLE_FAILURE: ' + JSON.stringify(d) + '; ' + err.message);
  }

  await page.waitForFunction(() => {
    const reel = window.R4B1TRollReel.snapshot(), machine = window.R4B1TRollProduction.snapshot();
    return reel.phase === 'revealed' && reel.landedUrl && machine && !machine.active;
  });
  const proof = await page.evaluate(() => ({
    events: window.__fiveMsEvents,
    landed: window.R4B1TRollReel.snapshot().landedUrl,
    rendered: document.getElementById('r4mUrl').textContent,
    center: document.querySelector('#r4mRollReel .r4m-reel-row.is-payline')?.dataset.url
  }));
  expect(proof.events).toEqual({ starts: 1, ends: 1, cancels: 0 });
  expect(proof.landed).toBe(proof.rendered);
  expect(proof.landed).toBe(proof.center);
});