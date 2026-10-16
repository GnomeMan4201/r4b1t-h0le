'use strict';
const { test, expect } = require('@playwright/test');

test('WebKit: first-roll stress verifies rabbit and authoritative landing', async ({ page }) => {
  await page.route('**/*', route => {
    const raw = route.request().url();
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return route.continue();
    const url = new URL(raw);
    return ['127.0.0.1','localhost'].includes(url.hostname) ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { try { localStorage.removeItem('r4b1t-roll-reel-sound'); } catch (_) {} });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.R4B1TRollReel && window.R4B1TRollProduction && window.R4B1TRollReel.isMounted() &&
    window.__r4b1tCommitRoll && window.__r4b1tCommitRoll.__r4b1tAuthority
  );
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__stressRabbit = { starts: 0, ends: 0, cancels: 0 };
    for (const [eventName, key] of [['animationstart','starts'],['animationend','ends'],['animationcancel','cancels']]) {
      rabbit.addEventListener(eventName, event => {
        if (event.animationName === 'r4h-roll-rabbit') window.__stressRabbit[key]++;
      });
    }
  });
  const accepted = await page.evaluate(() => window.R4B1TRollReel.quickRoll());
  expect(accepted, 'first ROLL accepted').toBe(true);
  try {
    await page.waitForFunction(() => window.__stressRabbit.starts === 1, null, { timeout: 12000 });
    await page.waitForFunction(() => window.__stressRabbit.ends === 1, null, { timeout: 12000 });
  } catch (err) {
    const evidence = await page.evaluate(() => ({
      firstFailingRollIndex: 1, events: window.__stressRabbit,
      rolling: document.documentElement.classList.contains('rolling'),
      presentation: document.documentElement.dataset.r4mPresentation,
      trace: window.__r4b1tRabbitFallbackTrace || null,
      reel: window.R4B1TRollReel.snapshot(),
      production: window.R4B1TRollProduction.snapshot()
    }));
    throw new Error('FIRST_ROLL_FAILURE: ' + JSON.stringify(evidence) + ' ' + err.message);
  }
  await page.waitForFunction(() => {
    const reel = window.R4B1TRollReel.snapshot(), p = window.R4B1TRollProduction.snapshot();
    return reel.phase === 'revealed' && reel.landedUrl && p && !p.active;
  });
  const final = await page.evaluate(() => ({
    events: window.__stressRabbit,
    landed: window.R4B1TRollReel.snapshot().landedUrl,
    rendered: document.getElementById('r4mUrl').textContent,
    center: document.querySelector('#r4mRollReel .r4m-reel-row.is-payline')?.dataset.url
  }));
  expect(final.events).toEqual({ starts: 1, ends: 1, cancels: 0 });
  expect(final.landed).toBe(final.rendered);
  expect(final.landed).toBe(final.center);
});