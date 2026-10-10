'use strict';

const { test, expect } = require('@playwright/test');

async function blockExternalNetwork(page) {
  await page.route('**/*', async route => {
    const raw = route.request().url();
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return route.continue();
    const url = new URL(raw);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
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
}

async function expectFit(page, label) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
  }));
  expect(geometry.scrollWidth, label + ' scroll width').toBe(geometry.clientWidth);
  expect(geometry.clientWidth, label + ' client/inner width').toBe(geometry.innerWidth);
}

// An absent animationstart must surface a diagnostic, not consume the entire
// 180-second lifecycle test timeout. Preserve the event-count contract.
async function waitForRabbitStart(page, target, cycle) {
  try {
    await page.waitForFunction(count => window.__webkitRabbit.starts >= count, target, { timeout: 12000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const rabbit = document.getElementById('r4h-roll-rabbit');
      const root = document.getElementById('r4h-root');
      const animation = rabbit ? getComputedStyle(rabbit) : null;
      return {
        rabbitMounted: Boolean(rabbit),
        markRootMounted: Boolean(root),
        markRootClass: root ? root.getAttribute('class') : null,
        htmlClass: document.documentElement.className,
        presentation: document.documentElement.getAttribute('data-r4m-presentation'),
        animationName: animation ? animation.animationName : null,
        animationDuration: animation ? animation.animationDuration : null,
        activeRabbitAnimations: rabbit ? rabbit.getAnimations().map(item => ({
          name: item.animationName || '',
          playState: item.playState,
          currentTime: item.currentTime,
        })) : [],
        counters: window.__webkitRabbit,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        rabbitDisplay: rabbit ? getComputedStyle(rabbit).display : null,
        rabbitVisibility: rabbit ? getComputedStyle(rabbit).visibility : null,
        lifecycleDiagnostics: window.__webkitRabbitDiag || null,
        reel: window.R4B1TRollReel.snapshot(),
        production: window.R4B1TRollProduction.snapshot(),
      };
    });
    throw new Error(`WebKit rabbit animationstart absent on ${cycle} (expected start ${target}): ${JSON.stringify(diagnostic)}; cause: ${error.message}`);
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.removeItem('r4b1t-roll-reel-sound'); } catch (_) {}
  });
  await blockExternalNetwork(page);
});

test('WebKit: 10 normal + 10 slammed rolls preserve rabbit lifecycle and authority', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__webkitRabbit = { starts: 0, ends: 0, cancels: 0 };
    // Diagnostics ONLY: no class writes, timing changes, or alternate pass path.
    const mark = document.getElementById('r4mProductionMark');
    const markRect = mark ? mark.getBoundingClientRect() : null;
    const rabbitRect = rabbit.getBoundingClientRect();
    const diag = window.__webkitRabbitDiag = {
      events: [], stateChanges: [],
      initialGeometry: {
        markTop: markRect ? markRect.top : null,
        markBottom: markRect ? markRect.bottom : null,
        rabbitTop: rabbitRect.top,
        rabbitBottom: rabbitRect.bottom,
        viewportHeight: innerHeight,
        scrollY: window.scrollY,
        visibilityState: document.visibilityState,
        markDisplay: mark ? getComputedStyle(mark).display : null,
        svgDisplay: getComputedStyle(rabbit.ownerSVGElement).display,
      },
    };
    const html = document.documentElement;
    new MutationObserver(records => {
      for (const record of records) {
        if (diag.stateChanges.length >= 150) break;
        diag.stateChanges.push({
          t: Math.round(performance.now()),
          field: record.attributeName,
          before: record.oldValue,
          after: html.getAttribute(record.attributeName),
        });
      }
    }).observe(html, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class', 'data-r4m-presentation'],
    });
    for (const kind of ['animationstart', 'animationend', 'animationcancel']) {
      rabbit.addEventListener(kind, event => {
        if (diag.events.length >= 80) return;
        diag.events.push({
          t: Math.round(performance.now()),
          kind,
          name: event.animationName,
          elapsedTime: event.elapsedTime,
          htmlClass: html.className,
          presentation: html.getAttribute('data-r4m-presentation'),
        });
      });
    }
    rabbit.addEventListener('animationstart', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__webkitRabbit.starts += 1;
    });
    rabbit.addEventListener('animationend', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__webkitRabbit.ends += 1;
    });
    rabbit.addEventListener('animationcancel', event => {
      if (event.animationName === 'r4h-roll-rabbit') window.__webkitRabbit.cancels += 1;
    });
  });

  for (let i = 1; i <= 10; i += 1) {
    const started = await page.evaluate(() => {
      document.documentElement.classList.remove('r4m-stage-result');
      return window.R4B1TRollReel.quickRoll();
    });
    expect(started, 'normal ROLL request accepted').toBe(true);
    await waitForRabbitStart(page, i, 'normal');
    await page.waitForFunction(() => {
      const reel = window.R4B1TRollReel.snapshot();
      const production = window.R4B1TRollProduction.snapshot();
      return reel.phase === 'revealed' && reel.landedUrl && production && !production.active;
    });
    await page.waitForFunction(target => window.__webkitRabbit.ends >= target, i);
    const bound = await page.evaluate(() => {
      const reel = window.R4B1TRollReel.snapshot();
      const rendered = document.getElementById('r4mUrl').textContent;
      const center = document.querySelector('#r4mRollReel .r4m-reel-row.is-payline');
      return reel.landedUrl === rendered && center && center.dataset.url === rendered;
    });
    expect(bound).toBe(true);
  }

  for (let i = 1; i <= 10; i += 1) {
    const target = 10 + i;
    const started = await page.evaluate(() => {
      document.documentElement.classList.remove('r4m-stage-result');
      return window.R4B1TRollReel.quickRoll();
    });
    expect(started, 'slammed ROLL request accepted').toBe(true);
    await page.waitForFunction(() => window.R4B1TRollReel.snapshot().phase === 'spin');
    await page.evaluate(() => {
      document.querySelector('#r4mRollReel .r4m-reel-window').dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 9,
        pointerType: 'touch',
        clientX: 40,
        clientY: 40,
      }));
    });
    await waitForRabbitStart(page, target, 'slammed');
    await page.waitForFunction(() => {
      const reel = window.R4B1TRollReel.snapshot();
      const production = window.R4B1TRollProduction.snapshot();
      return reel.phase === 'revealed' && reel.landedUrl && production && !production.active;
    });
    await page.waitForFunction(count => window.__webkitRabbit.ends >= count, target);
    const bound = await page.evaluate(() => {
      const reel = window.R4B1TRollReel.snapshot();
      const rendered = document.getElementById('r4mUrl').textContent;
      const center = document.querySelector('#r4mRollReel .r4m-reel-row.is-payline');
      return reel.landedUrl === rendered && center && center.dataset.url === rendered;
    });
    expect(bound).toBe(true);
  }

  expect(await page.evaluate(() => window.__webkitRabbit)).toEqual({
    starts: 20,
    ends: 20,
    cancels: 0,
  });
});

test('WebKit: reduced motion lands the authoritative result with no spin frames', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  await page.evaluate(() => {
    window.R4B1TRollReel.quickRoll();
  });

  await page.waitForFunction(() => {
    const reel = window.R4B1TRollReel.snapshot();
    const production = window.R4B1TRollProduction.snapshot();
    return reel.phase === 'revealed' && reel.landedUrl && production && !production.active;
  });

  const result = await page.evaluate(() => {
    const reel = window.R4B1TRollReel.snapshot();
    const rendered = document.getElementById('r4mUrl').textContent;
    const center = document.querySelector('#r4mRollReel .r4m-reel-row.is-payline');
    return {
      landed: reel.landedUrl,
      rendered,
      center: center && center.dataset.url,
      reelFrameActive: reel.reelFrameActive,
    };
  });
  expect(result.landed).toBe(result.rendered);
  expect(result.center).toBe(result.rendered);
  expect(result.reelFrameActive).toBe(false);
});

test('WebKit: layout width invariant and debug-off survive result, MENU and Blind', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);

  await expect(page.locator('#r4mMotionDebug')).toHaveCount(0);
  await expectFit(page, 'load');

  await page.locator('#r4mRoll').click();
  await page.waitForFunction(() => document.documentElement.dataset.r4mPresentation === 'revealed');
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expectFit(page, 'result');

  await page.locator('#r4mNavMenu').click();
  await expect(page.locator('#r4mMenuSheet')).toHaveAttribute('aria-hidden', 'false');
  await expectFit(page, 'menu-open');
  await page.locator('#r4mNavMenu').click();
  await expect(page.locator('#r4mMenuSheet')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#r4mBackdrop')).toBeHidden({ timeout: 1000 });
  await expectFit(page, 'menu-close');

  await page.evaluate(() => document.getElementById('r4mModeBlind').click());
  await expect(page.locator('#r4mDescentEntry')).toBeVisible();
  await expectFit(page, 'blind-ready');
  await page.evaluate(() => document.querySelector('#r4mDescentEntry [data-mobile-action="blind-descent"]').click());
  await expect(page.locator('#blindDescentOverlay')).toHaveClass(/open/);
  await expectFit(page, 'blind-descent');
  await expect(page.locator('#r4mMotionDebug')).toHaveCount(0);
});
