'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__r4b1tFaultFirstRollBlockMs = 1500;
    try { localStorage.removeItem('r4b1t-roll-reel-sound'); } catch (_) {}
  });
  await page.route('**/*', route => {
    const raw = route.request().url();
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return route.continue();
    const uri = new URL(raw);
    return ['127.0.0.1', 'localhost'].includes(uri.hostname)
      ? route.continue() : route.abort('blockedbyclient');
  });
});

test('fault: 1500ms blocking task after arming yields one canonical first ROLL', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4B1TRollReel && window.R4B1TRollProduction &&
    window.R4B1TRollReel.isMounted() && window.__r4b1tCommitRoll &&
    window.__r4b1tCommitRoll.__r4b1tAuthority);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__faultRabbitEvents = { starts: 0, ends: 0, cancels: 0 };
    for (const [name, field] of [
      ['animationstart','starts'],['animationend','ends'],['animationcancel','cancels']
    ]) {
      rabbit.addEventListener(name, event => {
        if (event.animationName === 'r4h-roll-rabbit') window.__faultRabbitEvents[field]++;
      });
    }
  });
  expect(await page.evaluate(() => window.R4B1TRollReel.quickRoll())).toBe(true);
  await page.waitForFunction(() => window.__r4b1tFaultRecord?.endedAt > 0, null, { timeout: 10000 });
  try {
    await page.waitForFunction(() => window.__faultRabbitEvents.starts === 1, null, { timeout: 5500 });
    await page.waitForFunction(() => window.__faultRabbitEvents.ends === 1, null, { timeout: 5500 });
  } catch (error) {
    const evidence = await page.evaluate(() => ({
      rollIndex: 1,
      hold: window.__r4b1tFaultRecord,
      counters: window.__faultRabbitEvents,
      rolling: document.documentElement.classList.contains('rolling'),
      trace: window.__r4b1tRabbitFallbackTrace || null,
      reel: window.R4B1TRollReel.snapshot(),
      production: window.R4B1TRollProduction.snapshot()
    }));
    throw new Error('INJECTED_FIRST_ROLL_LIFECYCLE: ' + JSON.stringify(evidence) + '; ' + error.message);
  }
  await page.waitForFunction(() => {
    const reel = window.R4B1TRollReel.snapshot();
    const production = window.R4B1TRollProduction.snapshot();
    return reel.phase === 'revealed' && reel.landedUrl && production && !production.active;
  });
  const result = await page.evaluate(() => ({
    hold: window.__r4b1tFaultRecord,
    counters: window.__faultRabbitEvents,
    reel: window.R4B1TRollReel.snapshot().landedUrl,
    rendered: document.getElementById('r4mUrl')?.textContent,
    payline: document.querySelector('#r4mRollReel .r4m-reel-row.is-payline')?.dataset.url
  }));
  expect(result.hold.durationMs).toBe(1500);
  expect(result.hold.endedAt - result.hold.startedAt).toBeGreaterThanOrEqual(1500);
  expect(result.counters).toEqual({ starts: 1, ends: 1, cancels: 0 });
  expect(result.reel).toBe(result.rendered);
  expect(result.reel).toBe(result.payline);
});