'use strict';

const { test, expect } = require('@playwright/test');
const { expectFocusInside } = require('./focus-assertions');

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) {
      await route.continue();
      return;
    }

    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      await route.continue();
      return;
    }
    await route.abort('blockedbyclient');
  });
}

async function waitForApplicationReady(page) {
  await page.waitForFunction(() => (
    typeof window.roll === 'function'
    && typeof window.toggleHelp === 'function'
  ));
  await page.waitForSelector('#r4mShellHost', { state: 'attached' });
}

async function rollFromVisibleShell(page, testInfo) {
  if (testInfo.project.name === 'mobile-chromium') {
    await page.locator('#r4mRoll').click();
  } else {
    await page.locator('#btnGo').click();
  }
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test('loads the correct application shell without runtime errors', async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  expect(response).not.toBeNull();
  expect(response.status()).toBe(200);
  await expect(page).toHaveTitle('r4b1t');
  await expect(page.locator('#trailItems')).toBeAttached();
  await expect(page.locator('#counter')).toBeAttached();

  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'mobile');
    await expect(page.locator('.r4m-shell')).toBeVisible();
    await expect(page.locator('#r4mRoll')).toBeEnabled();
  } else {
    await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
    await expect(page.locator('.wordmark')).toBeVisible();
    await expect(page.locator('#btnGo')).toBeVisible();
    await expect(page.locator('#btnGo')).toBeEnabled();
  }

  expect(pageErrors).toEqual([]);
});

test('a fresh session waits for an explicit ROLL before selecting or loading resource metadata', async ({ page }) => {
  const resourceRequests = [];
  page.on('request', request => {
    if (request.url().includes('/resources.json')) resourceRequests.push(request.url());
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  await expect(page.locator('#previewUrl')).toHaveText('—');
  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  expect(resourceRequests).toHaveLength(0);
});

test('a roll selects a corpus URL through either shell', async ({ page }, testInfo) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);
  await rollFromVisibleShell(page, testInfo);

  await expect(page.locator('#previewDomain')).not.toHaveText('—');
  await expect(page.locator('#previewUrl')).toHaveText(/^https?:\/\//);

  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.locator('#r4mRoute')).toBeVisible();
    await expect(page.locator('#r4mRouteWear')).toHaveCount(0);
    await expect(page.locator('#r4mDomain')).not.toHaveText('—');
    await expect(page.locator('#r4mUrl')).toHaveText(/^https?:\/\//);
    await expect(page.locator('[data-mobile-action="visit"]')).toBeEnabled();
    await expect(page.locator('[data-mobile-action="keep"]')).toBeEnabled();
    await expect(page.locator('#r4mRoute [data-mobile-action="inspect"]')).toBeEnabled();
  } else {
    await expect(page.locator('#preview')).toBeVisible();
    await expect(page.locator('#btnVisitMain')).toBeVisible();
    await expect(page.locator('#btnVisitMain')).toBeEnabled();
  }
});

test('keyboard help opens and closes without navigation', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  await page.keyboard.press('KeyH');
  await expect(page.locator('#helpOverlay')).toHaveClass(/\bopen\b/);
  await expect(page.locator('.help-modal')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#helpOverlay')).not.toHaveClass(/\bopen\b/);
});

test('the initial viewport does not overflow horizontally', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));

  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('mobile viewport exposes one-thumb controls', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  await expect(page.locator('#r4mRoll')).toBeVisible();
  await expect(page.locator('.r4m-nav')).toBeVisible();
  await expect(page.locator('.r4m-filter-strip')).toHaveCount(0);
  await page.locator('#r4mNavMenu').click();
  await expect(page.locator('#r4mMenuSheet [data-mobile-action="filter"]')).toBeVisible();
  await page.locator('#r4mNavRoll').click();
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('[data-mobile-action="visit"]')).toBeVisible();
});


test('desktop Blind Descent navigation opens without committing', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);
  await page.waitForFunction(() => typeof window.getBlindManifest === 'function');

  const before = await page.evaluate(() => window.getBlindManifest());

  await page.getByRole('button', { name: 'trail file', exact: true }).click();
  await expect(page.locator('#trailLedgerOverlay')).toBeVisible();
  await expect(page.locator('#trailLedgerOverlay')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('[data-trail-action="blind"]').click();

  await expect(page.locator('#blindDescentOverlay')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#blindStatus')).toContainText('READY');

  const after = await page.evaluate(() => window.getBlindManifest());
  expect(after.trail_id).toBe(before.trail_id);
  expect(after.manifest.steps).toEqual(before.manifest.steps);
});

test('mobile DESCEND BLIND commits once and an internal descent commits once more', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);
  await page.waitForFunction(() => typeof window.getBlindManifest === 'function');

  const before = await page.evaluate(() => window.getBlindManifest());
  await page.locator('#r4mModeBlind').click();
  await expect(page.locator('#r4mDescentEntry')).toBeVisible();

  const entry = page.locator('[data-mobile-action="blind-descent"]');
  await expect(entry).toBeVisible();
  await entry.click();

  await expect(page.locator('#blindDescentOverlay')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#blindStatus')).toContainText('CONCEALED');
  await expect(page.locator('#blindCard')).toHaveClass(/\bmotion-descend-card\b/);
  await expect(page.locator('#blindWear .wear-step.concealed').last()).toBeVisible();

  const afterMobileAction = await page.evaluate(() => window.getBlindManifest());
  expect(afterMobileAction.manifest.steps).toHaveLength(before.manifest.steps.length + 1);

  const firstNewStep = afterMobileAction.manifest.steps.at(-1);
  expect(firstNewStep.state).toBe('concealed');
  expect(Object.keys(firstNewStep).sort()).toEqual(['commitment', 'index', 'state']);
  expect(firstNewStep.commitment).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(JSON.stringify(firstNewStep)).not.toMatch(/route|url|nonce|seed|sampler/i);

  await page.locator('[data-blind-action="descend"]').click();
  await expect(page.locator('#blindStatus')).toContainText('CONCEALED');

  const afterInternalAction = await page.evaluate(() => window.getBlindManifest());
  expect(afterInternalAction.manifest.steps).toHaveLength(afterMobileAction.manifest.steps.length + 1);

  const secondNewStep = afterInternalAction.manifest.steps.at(-1);
  expect(secondNewStep.index).toBe(firstNewStep.index + 1);
  expect(secondNewStep.state).toBe('concealed');
  expect(Object.keys(secondNewStep).sort()).toEqual(['commitment', 'index', 'state']);
  expect(secondNewStep.commitment).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(JSON.stringify(secondNewStep)).not.toMatch(/route|url|nonce|seed|sampler/i);
});


test('mobile blind descent uses real and distinct timed transitions', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  await page.locator('#r4mModeBlind').click();
  await expect(page.locator('#r4mDescentEntry')).toBeVisible();

  const entry = page.locator('[data-mobile-action="blind-descent"]');
  await expect(entry).toBeVisible();
  await entry.click();

  await expect(page.locator('#blindDescentOverlay')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#blindStatus')).toContainText('CONCEALED');
  const concealedStep = page.locator('#blindWear .wear-step.concealed').last();
  await expect(concealedStep).toBeVisible();

  const descendMotion = await concealedStep.evaluate((element) => {
    const style = getComputedStyle(element);
    const animation = element.getAnimations()[0];
    return {
      name: style.animationName,
      duration: animation && animation.effect.getTiming().duration,
      curve: style.animationTimingFunction,
    };
  });
  expect(descendMotion.name).toContain('wearExtend');
  expect(descendMotion.duration).toBe(360);

  await page.locator('[data-blind-action="reveal"]').click();
  await expect(page.locator('#blindStatus')).toContainText('COMMITMENT VERIFIED');
  const revealedContent = page.locator('#blindWear .wear-step.ink-reveal .wear-step-label').last();
  await expect(revealedContent).toBeVisible();

  const revealMotion = await revealedContent.evaluate((element) => {
    const style = getComputedStyle(element);
    const animation = element.getAnimations()[0];
    return {
      name: style.animationName,
      duration: animation && animation.effect.getTiming().duration,
      curve: style.animationTimingFunction,
    };
  });
  expect(revealMotion.name).toContain('stepRadialResolve');
  expect(revealMotion.duration).toBe(680);
  await expect(page.locator('#blindWear .ink-radial-origin').last()).toBeAttached();

  await page.locator('[data-blind-action="return"]').click();
  const retractedStep = page.locator('#blindWear .wear-step.return-leave').last();
  await expect(retractedStep).toBeAttached();

  const returnMotion = await retractedStep.evaluate((element) => {
    const style = getComputedStyle(element);
    const animation = element.getAnimations()[0];
    return {
      name: style.animationName,
      duration: animation && animation.effect.getTiming().duration,
      curve: style.animationTimingFunction,
    };
  });
  expect(returnMotion.name).toContain('wearRetract');
  expect(returnMotion.duration).toBe(340);
  expect(new Set([descendMotion.curve, revealMotion.curve, returnMotion.curve]).size).toBe(3);
});

test('mobile wear sample exposes revealed concealed and forked states', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);
  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="topology"]').click();
  await expect(page.locator('#trailTopologyOverlay')).toHaveClass(/\bopen\b/);
  await page.locator('#trailTopologyOverlay .topology-sample').click();

  await expect(page.locator('#trailTopologyMap .wear-step.revealed').first()).toBeVisible();
  await expect(page.locator('#trailTopologyMap .wear-step.concealed').first()).toBeVisible();
  await expect(page.locator('#trailTopologyMap .wear-fork-mark').first()).toBeVisible();
});


test('ROLL AGAIN keeps the production mark above fixed controls while the result is cleared', async ({ page }, testInfo) => {
  if (!testInfo.project.name.startsWith('mobile-')) test.skip();

  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);
  await page.waitForSelector('#r4mProductionMark svg');
  await page.locator('#r4mRoll').click();
  await expect(page.locator('html')).toHaveAttribute('data-r4m-presentation', 'revealed');
  await expect(page.locator('html')).toHaveClass(/\bresult-ready\b/);

  await page.evaluate(() => {
    // Keep this fixture short so a jump to the header cannot pass unnoticed.
    document.querySelector('#ogTitle').textContent = 'A committed destination';
    document.querySelector('#ogDesc').textContent = '';
    window.__r4b1tSyncMobileRoute();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.__settledMarkTop = document.querySelector('#r4mProductionMark').getBoundingClientRect().top;
    window.__emptyResultFrames = [];
    window.__emptyResultObserver = new MutationObserver(() => {
      if (document.querySelector('#r4mRouteMount').childElementCount) return;
      const mark = document.querySelector('#r4mProductionMark').getBoundingClientRect();
      const header = document.querySelector('.r4m-header').getBoundingClientRect();
      const again = document.querySelector('#r4mRollAgain').getBoundingClientRect();
      window.__emptyResultFrames.push({
        phase: document.documentElement.dataset.r4mPresentation,
        markTop: mark.top,
        markBottom: mark.bottom,
        settledMarkTop: window.__settledMarkTop,
        headerBottom: header.bottom,
        controlsTop: again.top,
      });
    });
    window.__emptyResultObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-r4m-presentation'],
    });
  });
  await page.locator('#r4mRollAgain').click();
  await expect(page.locator('html')).toHaveAttribute('data-r4m-presentation', 'revealed');
  const frames = await page.evaluate(() => {
    window.__emptyResultObserver.disconnect();
    return window.__emptyResultFrames;
  });
  expect(frames.length).toBeGreaterThan(0);
  for (const frame of frames) {
    expect(frame.markTop, frame.phase).toBeGreaterThanOrEqual(frame.headerBottom - 1);
    expect(frame.markBottom, frame.phase).toBeLessThanOrEqual(frame.controlsTop + 1);
    expect(Math.abs(frame.markTop - frame.settledMarkTop), frame.phase).toBeLessThanOrEqual(1);
  }
});

test('ordinary mobile controls execute visible timed motion', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  const roll = page.locator('#r4mRoll');
  await roll.click();
  await expect(roll).toHaveAttribute('aria-busy', 'true');
  await expect(roll).toHaveClass(/\broll-(release|accelerate|decelerate|seat)\b/);

  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible({ timeout: 1500 });
  await expect(roll).not.toHaveAttribute('aria-busy', 'true', { timeout: 1500 });

  // ROLL AGAIN runs the authoritative ROLL sequence. Capture the short card
  // entrance animation before clicking so polling cannot miss its 110ms window.
  await page.locator('#r4mRouteMount').evaluate((mount) => {
    window.__repeatRouteMotion = null;
    mount.addEventListener('animationstart', (event) => {
      if (event.target.id !== 'r4mRoute' || event.animationName !== 'r4mRollCardEnter') return;
      window.__repeatRouteMotion = {
        name: event.animationName,
        duration: Number.parseFloat(getComputedStyle(event.target).animationDuration) * 1000,
      };
    });
  });
  await page.locator('#r4mRollAgain').click();
  await expect(roll).toHaveAttribute('aria-busy', 'true');
  await expect(roll).toHaveClass(/\broll-(release|accelerate|decelerate|seat)\b/);
  await expect(route).toHaveCount(0);
  await expect(route).toBeVisible({ timeout: 1500 });
  await expect.poll(() => page.evaluate(() => window.__repeatRouteMotion)).toEqual({
    name: 'r4mRollCardEnter',
    duration: 110,
  });
  await expect(roll).not.toHaveAttribute('aria-busy', 'true', { timeout: 1500 });

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  const filterSheet = page.locator('#r4mFilterSheet');
  await expect(filterSheet).toHaveClass(/\bopen\b/);
  const sheetTiming = await filterSheet.evaluate((element) => ({
    property: getComputedStyle(element).transitionProperty,
    duration: getComputedStyle(element).transitionDuration,
  }));
  expect(sheetTiming.property).toContain('transform');
  expect(sheetTiming.duration).toContain('0.36s');

  await filterSheet.locator('[data-mobile-action="close-sheets"]').click();
  await expect(page.locator('#r4mBackdrop')).toBeHidden({ timeout: 1000 });

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  const history = page.locator('#historyOverlay');
  await expect(history).toHaveClass(/\bledger-open\b/);
});
test('motion debug overlay reports the real mobile animation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./?debug-motion=1', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);
  await expect(page.locator('#r4mMotionDebug')).toContainText('MOTION DEBUG');

  await page.locator('#r4mRoll').click();
  const debug = page.locator('#r4mMotionDebug');
  await expect(debug).toContainText('MOTION DEBUG');
  await expect(page.locator('#r4mRoll')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#r4mRoute')).toBeVisible({ timeout: 1500 });
  await expect(page.locator('#r4mRoll')).not.toHaveAttribute('aria-busy', 'true', { timeout: 1500 });
});
test('mobile connective motion covers press authority reveal ledger and copy states', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./?debug-motion=1', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  await page.locator('#r4mNavMenu').click();
  const filterButton = page.locator('#r4mMenuSheet [data-mobile-action="filter"]');
  await filterButton.dispatchEvent('pointerdown');
  await expect(filterButton).toHaveClass(/\bmotion-pressed\b/);
  await filterButton.dispatchEvent('pointerup');
  await expect(filterButton).toHaveClass(/\bmotion-released\b/);

  const rollButton = page.locator('#r4mRoll');
  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await page.locator('#r4mNavRoll').click();
  await expect(page.locator('#r4mMenuSheet')).toHaveAttribute('aria-hidden', 'true');
  await rollButton.click();
  await expect(rollButton).toHaveAttribute('aria-busy', 'true');
  await expect(rollButton).toHaveClass(/\broll-(release|accelerate|decelerate|seat)\b/);

  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible({ timeout: 1500 });
  await expect(rollButton).not.toHaveAttribute('aria-busy', 'true', { timeout: 1500 });
  await expect(page.locator('#r4mRouteNo .r4m-route-digit')).toHaveCount(3);

  const keepButton = page.locator('.r4m-route-actions [data-mobile-action="keep"]');
  await keepButton.click();
  await expect(keepButton).toHaveClass(/\bcopied-flash\b/);

  // ROLL disclosure already owns the History record. OPEN is intentionally
  // unnecessary here and must not be required for ledger-entry motion.

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  await expect(page.locator('#historyOverlay')).toHaveClass(/\bledger-open\b/);
  await expect(page.locator('#historyList > .r4m-ledger-row.row-in').first()).toBeVisible();
});
test('desktop focused controls keep native Enter behavior', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  const theme = page.locator('#themeBtn');
  await theme.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveClass(/\blight\b/);

  await page.keyboard.press('Enter');
  await expect(page.locator('html')).not.toHaveClass(/\blight\b/);
});

test('desktop Help dialog traps focus, closes with Escape, and restores opener focus', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  const theme = page.locator('#themeBtn');
  await theme.focus();
  await expect(theme).toBeFocused();

  await page.evaluate(() => window.toggleHelp());
  const help = page.locator('#helpOverlay');
  await expect(help).toHaveClass(/\bopen\b/);
  await expect(help).toHaveAttribute('role', 'dialog');
  await expect(help).toHaveAttribute('aria-modal', 'true');
  await expect(help).toHaveAttribute('aria-hidden', 'false');

  await expectFocusInside(page, '#helpOverlay');

  const close = page.locator('#helpOverlay .help-close');
  await close.focus();
  await page.keyboard.press('Tab');
  const wrappedToFirst = await page.evaluate(() => {
    const overlay = document.querySelector('#helpOverlay');
    const focusables = Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
    return document.activeElement === focusables[0];
  });
  expect(wrappedToFirst).toBe(true);

  await page.keyboard.press('Escape');
  await expect(help).not.toHaveClass(/\bopen\b/);
  await expect(help).toHaveAttribute('aria-hidden', 'true');
  await expect(theme).toBeFocused();
});

test('desktop Session History opens empty, traps focus, and restores opener', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);

  const historyButton = page.locator('button', { hasText: 'history' }).first();
  await historyButton.focus();
  await expect(historyButton).toBeFocused();

  await historyButton.press('Enter');
  const history = page.locator('#historyOverlay');
  await expect(history).toHaveCSS('display', 'flex');
  await expect(history).toHaveAttribute('role', 'dialog');
  await expect(history).toHaveAttribute('aria-modal', 'true');
  await expect(history).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#historyList')).toContainText('no history yet');

  await expectFocusInside(page, '#historyOverlay');

  const close = page.locator('#historyOverlay button').last();
  await close.focus();
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => {
    const overlay = document.querySelector('#historyOverlay');
    const focusables = Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
    return document.activeElement === focusables[0];
  });
  expect(wrapped).toBe(true);

  await page.keyboard.press('Escape');
  await expect(history).toHaveCSS('display', 'none');
  await expect(history).toHaveAttribute('aria-hidden', 'true');
  await expect(historyButton).toBeFocused();
});

test('desktop Tor modal traps focus and restores the visit control', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForApplicationReady(page);
  await page.waitForFunction(() => typeof window.selectUrl === 'function' && typeof window.visit === 'function');

  await page.evaluate(() => window.selectUrl('http://ra4-focus-probe.onion/'));

  const visit = page.locator('#btnVisitMain');
  await expect(visit).toBeVisible();
  await visit.focus();
  await expect(visit).toBeFocused();

  await visit.press('Enter');

  const tor = page.locator('#torModal');
  await expect(tor).toHaveClass(/\bopen\b/);
  await expect(tor).toHaveAttribute('role', 'dialog');
  await expect(tor).toHaveAttribute('aria-modal', 'true');
  await expect(tor).toHaveAttribute('aria-hidden', 'false');
  await expectFocusInside(page, '#torModal');

  const last = tor.locator('button:visible').last();
  await last.focus();
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => {
    const overlay = document.querySelector('#torModal');
    const focusables = Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
    return document.activeElement === focusables[0];
  });
  expect(wrapped).toBe(true);

  await page.keyboard.press('Escape');
  await expect(tor).not.toHaveClass(/\bopen\b/);
  await expect(tor).toHaveAttribute('aria-hidden', 'true');
  await expect(visit).toBeFocused();
});
