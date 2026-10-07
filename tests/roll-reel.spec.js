'use strict';

const { test, expect } = require('@playwright/test');

async function blockExternalNetwork(page) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' ||
        route.request().url().startsWith('data:') || route.request().url().startsWith('blob:')) {
      await route.continue();
      return;
    }
    await route.abort('blockedbyclient');
  });
}

async function ready(page) {
  await page.waitForFunction(() => (
    window.R4B1TRollReel &&
    window.R4B1TRollProduction &&
    window.R4B1TRollReel.isMounted &&
    window.R4B1TRollReel.isMounted() &&
    window.__r4b1tCommitRoll &&
    window.__r4b1tCommitRoll.__r4b1tAuthority
  ));
  await page.waitForSelector('#r4mRoll', { state: 'visible' });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.removeItem('r4b1t-roll-reel-sound'); } catch (_) {}
  });
  await blockExternalNetwork(page);
});

test('REEL lands on the exact authoritative result and slam does not re-pick', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/^Failed to load resource:/.test(message.text())) return;
    consoleErrors.push(message.text());
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__reelRabbit = { starts: 0, ends: 0 };
    rabbit.addEventListener('animationstart', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__reelRabbit.starts += 1;
    });
    rabbit.addEventListener('animationend', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__reelRabbit.ends += 1;
    });
    window.R4B1TRollReel.quickRoll();
  });

  await page.waitForFunction(() => window.R4B1TRollReel.snapshot().phase === 'spin');
  await page.locator('#r4mRollReel .r4m-reel-window').click({ position: { x: 40, y: 40 } });

  await page.waitForFunction(() => {
    const reel = window.R4B1TRollReel.snapshot();
    const production = window.R4B1TRollProduction.snapshot();
    return reel.landedUrl && production && !production.active;
  });
  await expect(page.locator('#r4mRoute')).toBeAttached();

  const result = await page.evaluate(() => {
    const reel = window.R4B1TRollReel.snapshot();
    const center = document.querySelector('#r4mRollReel .r4m-reel-row.is-payline');
    return {
      landed: reel.landedUrl,
      rendered: document.getElementById('r4mUrl').textContent,
      center: center && center.dataset.url,
      rabbit: window.__reelRabbit,
      transaction: window.R4B1TRollProduction.snapshot().committedTransactionId
    };
  });

  expect(result.landed).toBe(result.rendered);
  expect(result.center).toBe(result.rendered);
  expect(result.transaction).not.toBeNull();
  await expect(page.locator('#r4mRollReel .r4m-reel-row.is-payline .r4m-reel-type')).toHaveText(/^(TOOL|REFERENCE|RULES|WRITEUPS|FRAMEWORK|TESTS|DATASET|LABS)$/);
  await expect(page.locator('#r4mRollReel .r4m-reel-row.is-payline .r4m-reel-name')).not.toHaveText('');
  expect(result.rabbit.starts).toBe(1);
  await page.waitForFunction(() => window.__reelRabbit.ends === 1);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('rapid second ROLL re-arms the unchanged rabbit animation while preserving result authority', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__rapidRabbitStarts = 0;
    rabbit.addEventListener('animationstart', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__rapidRabbitStarts += 1;
    });
    window.R4B1TRollReel.quickRoll();
  });
  await page.waitForFunction(() => window.R4B1TRollReel.snapshot().phase === 'spin');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const p = window.R4B1TRollProduction.snapshot();
    return p && !p.active && window.R4B1TRollReel.snapshot().landedUrl;
  });

  const first = await page.locator('#r4mUrl').textContent();
  await page.evaluate(() => {
    document.documentElement.classList.remove('r4m-stage-result');
    window.R4B1TRollReel.quickRoll();
  });
  await page.waitForFunction(() => window.__rapidRabbitStarts >= 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const p = window.R4B1TRollProduction.snapshot();
    return p && !p.active && window.R4B1TRollReel.snapshot().landedUrl;
  });
  const second = await page.locator('#r4mUrl').textContent();

  expect(await page.evaluate(() => window.__rapidRabbitStarts)).toBeGreaterThanOrEqual(2);
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();
  expect(await page.evaluate(() => window.R4B1TRollReel.snapshot().landedUrl))
    .toBe(second);
});

test('focused ROLL supports keyboard hold/release and visible focus', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const roll = page.locator('#r4mRoll');
  await roll.focus();
  await expect(roll).toBeFocused();

  await page.keyboard.down('Space');
  await page.waitForTimeout(260);
  const charging = await page.evaluate(() => window.R4B1TRollReel.snapshot());
  expect(charging.phase).toBe('charging');
  expect(charging.charge).toBeGreaterThan(0.2);
  const focusOutline = await roll.evaluate(node => getComputedStyle(node).outlineStyle);
  expect(focusOutline).not.toBe('none');

  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.R4B1TRollReel.snapshot().landedUrl);
  await expect(page.locator('#r4mRoute')).toBeAttached();
});

test('reduced motion resolves in about 250ms and 50 rolls leave no live loops', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const elapsed = await page.evaluate(async () => {
    const start = performance.now();
    window.R4B1TRollReel.quickRoll();
    while (!window.R4B1TRollReel.snapshot().landedUrl) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    return performance.now() - start;
  });
  expect(elapsed).toBeGreaterThanOrEqual(120);
  expect(elapsed).toBeLessThan(450);
  expect(await page.evaluate(() => window.R4B1TRollReel.snapshot().reelFrameActive)).toBe(false);
  await page.waitForFunction(() => {
    const production = window.R4B1TRollProduction.snapshot();
    return production && !production.active && window.R4B1TRollReel.snapshot().phase === 'revealed';
  });

  for (let i = 1; i < 50; i += 1) {
    await page.evaluate(() => {
      document.documentElement.classList.remove('r4m-stage-result');
      window.R4B1TRollReel.quickRoll();
    });
    await page.waitForFunction(() => {
      const production = window.R4B1TRollProduction.snapshot();
      return production && !production.active && window.R4B1TRollReel.snapshot().phase === 'revealed';
    });
    const bound = await page.evaluate(() => {
      const landed = window.R4B1TRollReel.snapshot().landedUrl;
      const rendered = document.getElementById('r4mUrl').textContent;
      const center = document.querySelector('#r4mRollReel .r4m-reel-row.is-payline');
      return Boolean(landed && landed === rendered && center && center.dataset.url === rendered);
    });
    expect(bound).toBe(true);
  }

  const diagnostic = await page.evaluate(() => window.R4B1TRollReel.snapshot());
  expect(diagnostic.chargeFrameActive).toBe(false);
  expect(diagnostic.reelFrameActive).toBe(false);
  expect(diagnostic.fxFrameActive).toBe(false);
  expect(diagnostic.particleCount).toBe(0);
  expect(diagnostic.audioNodeCount).toBe(0);
  expect(diagnostic.soundOn).toBe(false);
});

test('REEL stays inside portrait and short-landscape mobile viewports', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  async function dimensions() {
    return page.evaluate(() => {
      const reel = document.getElementById('r4mRollReel').getBoundingClientRect();
      return {
        left: reel.left,
        right: reel.right,
        top: reel.top,
        width: reel.width,
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      };
    });
  }

  let box = await dimensions();
  expect(box.left).toBeGreaterThanOrEqual(-1);
  expect(box.right).toBeLessThanOrEqual(box.innerWidth + 1);
  expect(box.scrollWidth).toBeLessThanOrEqual(box.innerWidth + 1);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(100);
  box = await dimensions();
  expect(box.left).toBeGreaterThanOrEqual(-1);
  expect(box.right).toBeLessThanOrEqual(box.innerWidth + 1);
  expect(box.scrollWidth).toBeLessThanOrEqual(box.innerWidth + 1);
});


test('rabbit lifecycle completes 10 normal REEL rolls without cancellation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  test.setTimeout(120_000);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__rabbitLifecycle = { starts: 0, ends: 0, cancels: 0 };
    rabbit.addEventListener('animationstart', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__rabbitLifecycle.starts += 1;
    });
    rabbit.addEventListener('animationend', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__rabbitLifecycle.ends += 1;
    });
    rabbit.addEventListener('animationcancel', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__rabbitLifecycle.cancels += 1;
    });
  });

  for (let i = 1; i <= 10; i += 1) {
    await page.evaluate(() => window.R4B1TRollReel.quickRoll());
    await page.waitForFunction(target => window.__rabbitLifecycle.starts >= target, i);
    await page.waitForFunction(() => {
      const reel = window.R4B1TRollReel.snapshot();
      const production = window.R4B1TRollProduction.snapshot();
      return reel.phase === 'revealed' && reel.landedUrl && production && !production.active;
    });
    await page.waitForFunction(target => window.__rabbitLifecycle.ends >= target, i);
  }

  expect(await page.evaluate(() => window.__rabbitLifecycle)).toEqual({
    starts: 10,
    ends: 10,
    cancels: 0,
  });
});

test('rabbit lifecycle completes 10 slammed REEL rolls without cancellation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  test.setTimeout(120_000);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__rabbitLifecycle = { starts: 0, ends: 0, cancels: 0 };
    rabbit.addEventListener('animationstart', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__rabbitLifecycle.starts += 1;
    });
    rabbit.addEventListener('animationend', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__rabbitLifecycle.ends += 1;
    });
    rabbit.addEventListener('animationcancel', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__rabbitLifecycle.cancels += 1;
    });
  });

  for (let i = 1; i <= 10; i += 1) {
    await page.evaluate(() => window.R4B1TRollReel.quickRoll());
    await page.waitForFunction(() => window.R4B1TRollReel.snapshot().phase === 'spin');
    await page.evaluate(() => {
      const reelWindow = document.querySelector('#r4mRollReel .r4m-reel-window');
      reelWindow.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'touch',
        clientX: 40,
        clientY: 40,
      }));
    });
    await page.waitForFunction(target => window.__rabbitLifecycle.starts >= target, i);
    await page.waitForFunction(() => {
      const reel = window.R4B1TRollReel.snapshot();
      const production = window.R4B1TRollProduction.snapshot();
      return reel.phase === 'revealed' && reel.landedUrl && production && !production.active;
    });
    await page.waitForFunction(target => window.__rabbitLifecycle.ends >= target, i);
  }

  expect(await page.evaluate(() => window.__rabbitLifecycle)).toEqual({
    starts: 10,
    ends: 10,
    cancels: 0,
  });
});


test('Heavy Roll REEL uses three visible 64px rows, triangular payline marks, and a round 208px ROLL well', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const geometry = await page.evaluate(() => {
    const win = document.querySelector('#r4mRollReel .r4m-reel-window').getBoundingClientRect();
    const row = document.querySelector('#r4mRollReel .r4m-reel-row').getBoundingClientRect();
    const roll = document.getElementById('r4mRoll').getBoundingClientRect();
    const pay = getComputedStyle(document.querySelector('#r4mRollReel .r4m-reel-payline'), '::before');
    return {
      windowHeight: win.height,
      rowHeight: row.height,
      rollWidth: roll.width,
      rollHeight: roll.height,
      paylineBorderLeft: pay.borderLeftWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(geometry.windowHeight).toBe(192);
  expect(geometry.rowHeight).toBe(64);
  expect(geometry.rollWidth).toBe(208);
  expect(geometry.rollHeight).toBe(208);
  expect(geometry.paylineBorderLeft).toBe('9px');
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
});
