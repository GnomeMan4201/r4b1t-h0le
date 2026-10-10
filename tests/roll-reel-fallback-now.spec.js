'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__R4B1T_TEST__ = { fallbackNow: true };
    try { localStorage.removeItem('r4b1t-roll-reel-sound'); } catch (_) {}
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1'
      ? route.continue() : route.abort('blockedbyclient');
  });
});

test('WebKit: synchronous pre-frame fallback must preserve authoritative first ROLL', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4B1TRollReel && window.R4B1TRollProduction &&
    window.R4B1TRollReel.isMounted() && window.__r4b1tCommitRoll &&
    window.__r4b1tCommitRoll.__r4b1tAuthority);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__syncRabbitEvents = { starts: 0, ends: 0, cancels: 0 };
    for (const [eventName, key] of [
      ['animationstart', 'starts'], ['animationend', 'ends'], ['animationcancel', 'cancels']
    ]) {
      rabbit.addEventListener(eventName, e => {
        if (e.animationName === 'r4h-roll-rabbit') window.__syncRabbitEvents[key]++;
      });
    }
  });
  expect(await page.evaluate(() => window.R4B1TRollReel.quickRoll())).toBe(true);
  const injected = await page.evaluate(() => window.__r4b1tSyncFallbackRecord);
  expect(injected, 'test hook must fire exactly on first ROLL').toBeTruthy();
  expect(injected.wasRolling).toBe(true);
  expect(injected.hadFrame).toBe(false);
  try {
    await page.waitForFunction(() => window.__syncRabbitEvents.starts === 1, null, { timeout: 4300 });
    await page.waitForFunction(() => window.__syncRabbitEvents.ends === 1, null, { timeout: 4300 });
  } catch (error) {
    const detail = await page.evaluate(() => ({
      firstRollIndex: 1, injected: window.__r4b1tSyncFallbackRecord,
      events: window.__syncRabbitEvents,
      rolling: document.documentElement.classList.contains('rolling'),
      trace: window.__r4b1tRabbitFallbackTrace || null,
      production: window.R4B1TRollProduction.snapshot(),
      reel: window.R4B1TRollReel.snapshot()
    }));
    throw new Error('SYNC_FALLBACK_LIFECYCLE: ' + JSON.stringify(detail) + '; ' + error.message);
  }
  await page.waitForFunction(() => {
    const r = window.R4B1TRollReel.snapshot(), p = window.R4B1TRollProduction.snapshot();
    return r.phase === 'revealed' && r.landedUrl && p && !p.active;
  });
  const outcome = await page.evaluate(() => ({
    events: window.__syncRabbitEvents,
    landed: window.R4B1TRollReel.snapshot().landedUrl,
    rendered: document.getElementById('r4mUrl').textContent,
    payline: document.querySelector('#r4mRollReel .r4m-reel-row.is-payline')?.dataset.url
  }));
  expect(outcome.events).toEqual({ starts: 1, ends: 1, cancels: 0 });
  expect(outcome.landed).toBe(outcome.rendered);
  expect(outcome.landed).toBe(outcome.payline);
});