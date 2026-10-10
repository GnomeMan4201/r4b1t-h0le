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

// Exercise a real iPhone-style tap alongside the strict programmatic 20-roll suite.
test('WebKit: physical ROLL tap produces one complete canonical rabbit run', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  const rabbit = page.locator('#r4h-roll-rabbit');
  await expect(rabbit).toBeAttached();
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    window.__gestureRabbit = { starts: 0, ends: 0, cancels: 0 };
    const element = document.getElementById('r4h-roll-rabbit');
    for (const [name, counter] of [
      ['animationstart', 'starts'],
      ['animationend', 'ends'],
      ['animationcancel', 'cancels'],
    ]) {
      element.addEventListener(name, event => {
        if (event.animationName === 'r4h-roll-rabbit') window.__gestureRabbit[counter] += 1;
      });
    }
  });
  await page.locator('#r4mRoll').tap();
  await page.waitForFunction(() => document.documentElement.dataset.r4mPresentation === 'revealed');
  await page.waitForFunction(() => window.__gestureRabbit.ends === 1, null, { timeout: 12000 });
  const state = await page.evaluate(() => ({
    events: window.__gestureRabbit,
    rendered: document.getElementById('r4mUrl').textContent,
    landed: window.R4B1TRollReel.snapshot().landedUrl,
  }));
  expect(state.events).toEqual({ starts: 1, ends: 1, cancels: 0 });
  expect(state.rendered).toBe(state.landed);
});

test('WebKit: 10 normal + 10 slammed rolls preserve rabbit lifecycle and authority', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    window.__webkitRabbit = { starts: 0, ends: 0, cancels: 0 };
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

test('WebKit: canonical rabbit visibly descends and returns over its CSS ROLL', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);

  const initial = await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    const transform = getComputedStyle(rabbit).transform;
    return transform;
  });
  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    const readY = () => {
      const transform = getComputedStyle(rabbit).transform;
      if (transform === 'none') return 0;
      try { return new DOMMatrix(transform).m42; } catch (_) { return null; }
    };
    window.__rabbitVisual = { starts: 0, ends: 0, cancels: 0,
      samples: [], startedAt: null, endedAt: null, cssDuration: null,
      startElapsedSec: null, endElapsedSec: null, startCssTime: null, endCssTime: null };
    const trace = window.__rabbitVisual;
    let canonicalAnimation = null;
    const getCanonical = () => {
      if (canonicalAnimation) return canonicalAnimation;
      canonicalAnimation = rabbit.getAnimations().find(a => a.animationName === 'r4h-roll-rabbit') || null;
      return canonicalAnimation;
    };
    const timeline = () => {
      const animation = getCanonical();
      return {
        currentTime: animation ? Number(animation.currentTime) : null,
        playState: animation?.playState || null
      };
    };
    const sample = stamp => {
      if (trace.ends || trace.cancels) return;
      if (trace.samples.length < 200) {
        // Browser timestamp is only diagnostic; phase comes from the actual
        // CSSAnimation.currentTime, read in the SAME rAF as computed transform.
        trace.samples.push({ t: stamp, wallNow: performance.now(), ...timeline(), y: readY() });
        requestAnimationFrame(sample);
      }
    };
    rabbit.addEventListener('animationstart', event => {
      if (event.animationName !== 'r4h-roll-rabbit') return;
      trace.starts++;
      trace.startedAt = performance.now();
      trace.startElapsedSec = event.elapsedTime;
      trace.startCssTime = timeline();
      trace.cssDuration = getComputedStyle(rabbit).animationDuration;
      requestAnimationFrame(sample);
    });
    rabbit.addEventListener('animationend', event => {
      if (event.animationName === 'r4h-roll-rabbit') {
        trace.ends++;
        trace.endedAt = performance.now();
        trace.endElapsedSec = event.elapsedTime;
        trace.endCssTime = timeline();
      }
    });
    rabbit.addEventListener('animationcancel', event => {
      if (event.animationName === 'r4h-roll-rabbit') trace.cancels++;
    });
  });
  expect(await page.evaluate(() => window.R4B1TRollReel.quickRoll())).toBe(true);
  await page.waitForFunction(() => window.__rabbitVisual.ends === 1, null, { timeout: 15000 });
  const evidence = await page.evaluate(() => {
    const trace = window.__rabbitVisual;
    const rabbit = document.getElementById('r4h-roll-rabbit');
    const final = getComputedStyle(rabbit).transform;
    const values = trace.samples.map(x => x.y).filter(Number.isFinite);
    return {
      starts: trace.starts, ends: trace.ends, cancels: trace.cancels,
      cssDuration: trace.cssDuration, elapsedMs: trace.endedAt - trace.startedAt,
      samples: trace.samples.length, validSamples: values.length,
      animationSamples: trace.samples,
      startElapsedSec: trace.startElapsedSec, endElapsedSec: trace.endElapsedSec,
      startCssTime: trace.startCssTime, endCssTime: trace.endCssTime,
      // A sparse maxY is not evidence of a deficient CSS trajectory unless
      // an rAF actually observed the expected middle (310–560ms) phase.
      middlePhaseCoverage: trace.samples.filter(x => Number.isFinite(x.currentTime) &&
        x.currentTime >= 310 && x.currentTime <= 560),
      maxY: values.length ? Math.max(...values) : null,
      minY: values.length ? Math.min(...values) : null,
      lastY: values.length ? values[values.length - 1] : null,
      finalTransform: final,
      rolling: document.documentElement.classList.contains('rolling')
    };
  });
  expect(evidence.starts).toBe(1);
  expect(evidence.ends).toBe(1);
  expect(evidence.cancels).toBe(0);
  expect(evidence.cssDuration).toMatch(/^(1s|1000ms)$/);
  expect(evidence.validSamples, JSON.stringify(evidence)).toBeGreaterThanOrEqual(3);
  // Actual canonical SVG @keyframes descend to +640 viewBox units.
  expect(evidence.maxY, JSON.stringify(evidence)).toBeGreaterThan(200);
  expect(evidence.minY, JSON.stringify(evidence)).toBeGreaterThan(-30);
  expect(evidence.finalTransform).toBe('none');
  expect(evidence.rolling).toBe(false);
  expect(initial).toBe('none');
});

test('WebKit: two rapid physical ROLL taps cannot steal the next rabbit run', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    const roll = document.getElementById('r4mRoll');
    window.__rapidRabbit = { starts: 0, ends: 0, cancels: 0, pointerDownAt: [] };
    roll.addEventListener('pointerdown', () => {
      window.__rapidRabbit.pointerDownAt.push(performance.now());
    });
    rabbit.addEventListener('animationstart', e => {
      if (e.animationName === 'r4h-roll-rabbit') window.__rapidRabbit.starts++;
    });
    rabbit.addEventListener('animationend', e => {
      if (e.animationName === 'r4h-roll-rabbit') window.__rapidRabbit.ends++;
    });
    rabbit.addEventListener('animationcancel', e => {
      if (e.animationName === 'r4h-roll-rabbit') window.__rapidRabbit.cancels++;
    });
  });

  const box = await page.locator('#r4mRoll').boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);

  const gestures = await page.evaluate(() => window.__rapidRabbit.pointerDownAt);
  expect(gestures.length, 'two browser-touch ROLL attempts').toBe(2);
  // Check the interval to prove this actually exercised the rapid-tap case.
  expect(gestures[1] - gestures[0], 'two taps must be within 300ms').toBeLessThan(300);

  await page.waitForFunction(() => {
    const reel = window.R4B1TRollReel.snapshot();
    const production = window.R4B1TRollProduction.snapshot();
    return reel.phase === 'revealed' && reel.landedUrl && production && !production.active;
  });
  await page.waitForFunction(() => window.__rapidRabbit.ends >= 1);
  const afterRapid = await page.evaluate(() => ({
    lifecycle: { starts: window.__rapidRabbit.starts, ends: window.__rapidRabbit.ends, cancels: window.__rapidRabbit.cancels },
    committed: window.R4B1TRollProduction.snapshot().committedTransactionId,
  }));
  expect(afterRapid.lifecycle).toEqual({ starts: 1, ends: 1, cancels: 0 });
  expect(afterRapid.committed).toBe(1);

  // An overlap is not an authorized second selection. Require the *next
  // accepted* ROLL to get its own complete rabbit lifecycle, without stale
  // timers from the first attempt removing html.rolling.
  const accepted = await page.evaluate(() => {
    document.documentElement.classList.remove('r4m-stage-result');
    return window.R4B1TRollReel.quickRoll();
  });
  expect(accepted).toBe(true);
  await page.waitForFunction(() => window.__rapidRabbit.starts >= 2);
  await page.waitForFunction(() => {
    const reel = window.R4B1TRollReel.snapshot();
    const production = window.R4B1TRollProduction.snapshot();
    return reel.phase === 'revealed' && reel.landedUrl && production && !production.active
      && window.__rapidRabbit.ends >= 2;
  });
  const final = await page.evaluate(() => ({
    lifecycle: { starts: window.__rapidRabbit.starts, ends: window.__rapidRabbit.ends, cancels: window.__rapidRabbit.cancels },
    committed: window.R4B1TRollProduction.snapshot().committedTransactionId,
    rendered: document.getElementById('r4mUrl').textContent,
    landed: window.R4B1TRollReel.snapshot().landedUrl,
  }));
  expect(final.lifecycle).toEqual({ starts: 2, ends: 2, cancels: 0 });
  expect(final.committed).toBe(2);
  expect(final.rendered).toBe(final.landed);
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
