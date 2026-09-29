'use strict';

const { test, expect } = require('@playwright/test');

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => typeof window.roll === 'function');
  await page.waitForSelector('#r4mShellHost', { state: 'attached' });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test('desktop keeps the native r4b1t shell', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
  await expect(page.locator('.rig')).toBeVisible();
  await expect(page.locator('#r4mShellHost')).toBeHidden();
});

test('mobile production mark stays visible and in viewport across landing, ROLL result, and BLIND stage', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const mark = page.locator('#r4mProductionMark > svg[role="img"]');
  await expect(mark).toBeVisible();

  const assertMarkReachable = async () => {
    const geometry = await mark.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.width).toBeGreaterThan(0);
    expect(geometry.height).toBeGreaterThan(0);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.top).toBeLessThan(geometry.viewportHeight);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  };

  await assertMarkReachable();

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(mark).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/\bresult-ready\b/);
  await assertMarkReachable();

  await page.locator('#r4mModeBlind').click();
  await expect(page.locator('#r4mDescentEntry')).toBeVisible();
  await expect(mark).toBeVisible();
  await assertMarkReachable();
});

test('mobile selects the dedicated shell and rolls through the shared engine', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'mobile');
  await expect(page.locator('.r4m-shell')).toBeVisible();
  await expect(page.locator('#r4mRoll')).toBeVisible();
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('#r4mDomain')).not.toHaveText('—');
  await expect(page.locator('#r4mUrl')).toHaveText(/^https?:\/\//);
  await expect(page.locator('#previewDomain')).not.toHaveText('—');

  const mirrored = await page.evaluate(() => ({
    route: document.getElementById('r4mUrl').textContent.trim(),
    domain: document.getElementById('r4mDomain').textContent.trim(),
  }));
  const expectedHost = new URL(mirrored.route).hostname.replace(/^www\./, '').toUpperCase();
  expect(mirrored.domain).toBe(expectedHost);
});

test('mobile terrain filter can select and return to all signals', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  await expect(page.locator('#r4mFilterSheet')).toHaveClass(/\bopen\b/);
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'CODE' }).click();
  await expect(page.locator('#r4mFilterLabel')).toHaveText('CODE');
  await expect(page.locator('#r4mRollScope')).toHaveText('CODE ROUTES');

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'ALL SIGNALS' }).click();
  await expect(page.locator('#r4mFilterLabel')).toHaveText('ALL SIGNALS');
  await expect(page.locator('#r4mRollScope')).toHaveText('FULL CORPUS');
});

test('mobile navigation opens filter and inspect sheets without horizontal overflow', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  await expect(page.locator('#r4mFilterSheet')).toHaveClass(/\bopen\b/);
  await page.locator('#r4mFilterSheet [data-mobile-action="close-sheets"]').click();

  await page.locator('#r4mNavMenu').click();
  const routeInfo = page.locator('#r4mMenuSheet [data-mobile-action="inspect"]');
  await expect(routeInfo).toContainText('ROUTE INFO');
  await expect(page.locator('#r4mMenuSheet [data-mobile-action="replay-inspection"]')).toContainText('REPLAY');
  await routeInfo.click();
  await expect(page.locator('#r4mInspectSheet')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#r4mInspectSheet .r4m-sheet-head strong')).toHaveText('INSPECT ROUTE');
  await expect(page.locator('#replayInspectionOverlay')).toBeHidden();

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('mobile branch sheet explains the empty state and offers a recovery action', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.evaluate(() => {
    document.getElementById('previewUrl').textContent = '—';
    document.getElementById('branchGrid').replaceChildren();
    document.getElementById('btnModeBranch').classList.add('active');
  });

  await page.locator('#r4mNavMenu').click();
  const menuIdleMotion = await page.locator('#r4h-root').evaluate((root) => ({
    blink: getComputedStyle(root.querySelector('.r4h-idle-blink')).animationName,
    ear: getComputedStyle(root.querySelector('#r4h-idle-ear')).animationName,
  }));
  expect(menuIdleMotion.blink).toBe('none');
  expect(menuIdleMotion.ear).toBe('none');
  await page.locator('#r4mMenuSheet [data-mobile-action="branch"]').click();
  const empty = page.locator('#r4mBranchOptions .r4m-branch-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toHaveAttribute('role', 'status');
  await expect(empty.locator('strong')).toHaveText('NO CURRENT ROUTE');
  await expect(empty).toContainText('Roll a route before generating directions.');
  await expect(empty.getByRole('button', { name: 'ROLL A ROUTE' })).toBeVisible();
});


test('mobile can explicitly return from Branch to Random mode without rolling', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const routeBefore = await page.locator('#previewUrl').textContent();

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="branch"]').click();
  await expect(page.locator('#r4mBranchSheet')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#btnModeBranch')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#btnModeRandom')).not.toHaveClass(/\bactive\b/);
  await expect(page.locator('#r4mModeLabel')).toHaveText('BRANCH');

  const randomMode = page.locator('#r4mBranchSheet [data-mobile-action="random-mode"]');
  await expect(randomMode).toBeVisible();
  await randomMode.click();

  await expect(page.locator('#btnModeRandom')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#btnModeBranch')).not.toHaveClass(/\bactive\b/);
  await expect(page.locator('#r4mModeLabel')).toHaveText('UNBOUNDED');
  await expect(page.locator('#r4mBranchSheet')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#previewUrl')).toHaveText(routeBefore);
});

test('mobile promotes current trail topology instead of the wear sample', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.evaluate(() => {
    const snapshot = { trail_id: 'current-trail-probe', marker: 'current-canonical-snapshot' };
    window.__mobileTopologyProbe = { snapshot, opened: null, sampleCalls: 0 };
    window.getTrailManifest = () => Promise.resolve(snapshot);
    window.openTrailTopology = (value) => { window.__mobileTopologyProbe.opened = value; };
    window.openTrailWearSample = () => { window.__mobileTopologyProbe.sampleCalls += 1; };
  });

  await page.locator('#r4mModeBlind').click();
  await expect(page.locator('#r4mDescentEntry')).toBeVisible();
  await expect(page.locator('#r4mDescentEntry [data-mobile-action="topology"]')).toHaveCount(0);
  await expect(page.locator('#r4mDescentEntry [data-mobile-action="wear-sample"]')).toHaveCount(0);
  await expect(page.locator('#trailTopologyOverlay .topology-sample')).toHaveText('VIEW SAMPLE');

  await page.locator('#r4mNavMenu').click();
  const mapTrails = page.locator('#r4mMenuSheet [data-mobile-action="topology"]');
  await expect(mapTrails).toBeVisible();
  await expect(mapTrails).toContainText('MAP TRAILS');

  await mapTrails.click();
  await page.waitForFunction(() => window.__mobileTopologyProbe && window.__mobileTopologyProbe.opened);

  const probe = await page.evaluate(() => ({
    openedMarker: window.__mobileTopologyProbe.opened && window.__mobileTopologyProbe.opened.marker,
    sampleCalls: window.__mobileTopologyProbe.sampleCalls,
  }));
  expect(probe.openedMarker).toBe('current-canonical-snapshot');
  expect(probe.sampleCalls).toBe(0);
});

test('changing viewport width switches shells without reloading', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'mobile');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'desktop');
});


test('mobile ROLL keeps route-specific result DOM absent until reveal boundary', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('#r4mUrl')).toHaveText(/^https?:\/\//);
});

test('mobile repeated ROLL activation cannot create a second active transaction', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await page.locator('#r4mRoll').click({ force: true });
  const snapshot = await page.evaluate(() => window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot());
  expect(snapshot).toBeTruthy();
  expect(snapshot.transactionId).toBe(1);
  await expect(page.locator('#r4mRoute')).toBeVisible();
});

test('mobile reduced motion preserves deferred disclosure without strip travel', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('#r4mRoll .r4m-roll-strip')).toBeAttached();
});


test('mobile persisted pageshow preserves an already revealed settled route', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  const before = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    route: document.getElementById('r4mUrl').textContent.trim(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
  }));

  await page.evaluate(() => {
    const route = document.getElementById('r4mRoute');
    if (route) route.removeAttribute('data-motion');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(50);

  const after = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    route: document.getElementById('r4mUrl').textContent.trim(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
    routeMotion: document.getElementById('r4mRoute').getAttribute('data-motion'),
  }));

  expect(after.route).toBe(before.route);
  expect(after.trail).toEqual(before.trail);
  expect(after.snapshot.transactionId).toBe(before.snapshot.transactionId);
  expect(after.snapshot.state).toBe(before.snapshot.state);
  expect(after.routeMotion).toBeNull();
});

test('mobile persisted pageshow resumes without rebuilding settled presentation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  const result = await page.evaluate(() => {
    const before = {
      filterOptions: document.getElementById('r4mFilterOptions'),
      trail: document.getElementById('r4mTrailItems'),
      route: document.getElementById('r4mRoute'),
    };
    const filterChildren = Array.from(before.filterOptions.children);
    const trailChildren = Array.from(before.trail.children);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    return {
      filterHostSame: document.getElementById('r4mFilterOptions') === before.filterOptions,
      filterChildrenSame:
        filterChildren.length === before.filterOptions.children.length &&
        filterChildren.every((node, index) => node === before.filterOptions.children[index]),
      trailHostSame: document.getElementById('r4mTrailItems') === before.trail,
      trailChildrenSame:
        trailChildren.length === before.trail.children.length &&
        trailChildren.every((node, index) => node === before.trail.children[index]),
      routeSame: document.getElementById('r4mRoute') === before.route,
    };
  });

  expect(result.routeSame).toBe(true);
  expect(result.filterHostSame).toBe(true);
  expect(result.filterChildrenSame).toBe(true);
  expect(result.trailHostSame).toBe(true);
  expect(result.trailChildrenSame).toBe(true);
});

test('mobile non-persisted pageshow keeps ordinary synchronization for an already revealed route', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  const before = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    route: document.getElementById('r4mUrl').textContent.trim(),
    domain: document.getElementById('r4mDomain').textContent.trim(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
  }));

  await page.evaluate(() => {
    document.getElementById('r4mUrl').textContent = 'STALE';
    document.getElementById('r4mDomain').textContent = 'STALE';
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
  });

  await expect(page.locator('#r4mUrl')).toHaveText(before.route);
  await expect(page.locator('#r4mDomain')).toHaveText(before.domain);

  const after = await page.evaluate(() => ({
    snapshot: window.R4B1TRollProduction && window.R4B1TRollProduction.snapshot(),
    trail: Array.from(document.querySelectorAll('#trailItems .trail-item')).map((item) => item.textContent.trim()),
  }));
  expect(after.trail).toEqual(before.trail);
  expect(after.snapshot.transactionId).toBe(before.snapshot.transactionId);
  expect(after.snapshot.state).toBe(before.snapshot.state);
});


test('P2-1 mobile Route Info delegates URL suggestion to the existing desktop engine', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  await page.evaluate(() => {
    window.__p21SubmitCalls = 0;
    window.submitUrl = function () { window.__p21SubmitCalls += 1; };
  });

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="inspect"]').click();
  const suggest = page.locator('#r4mInspectSheet [data-mobile-action="suggest-url"]');
  await expect(suggest).toBeVisible();
  await expect(suggest).toHaveText('SUGGEST THIS URL ↗');
  await suggest.click();

  await expect.poll(() => page.evaluate(() => window.__p21SubmitCalls)).toBe(1);
});

test('P2-1 desktop describes the existing issue handoff as suggestion, not submission', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const suggest = page.locator('.trail-bar button[onclick="submitUrl()"]');
  await expect(suggest).toHaveText('suggest url');
});


test('mobile reference shell fits supported phone widths without clipping fixed navigation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  for (const width of [375, 390, 393, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', 'mobile');
    await expect(page.locator('#r4mRoll')).toBeVisible();
    await expect(page.locator('.r4m-nav')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const roll = document.getElementById('r4mRoll').getBoundingClientRect();
      const nav = document.querySelector('.r4m-nav').getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        rollLeft: roll.left,
        rollRight: roll.right,
        rollHeight: roll.height,
        navLeft: nav.left,
        navRight: nav.right,
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
    expect(geometry.rollLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.rollRight).toBeLessThanOrEqual(geometry.innerWidth + 1);
    expect(geometry.rollHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.navLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.navRight).toBeLessThanOrEqual(geometry.innerWidth + 1);
  }
});

test('mobile redesign survives portrait-landscape-portrait without overflow or lost navigation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const mobile = viewport.width <= 900;
    await expect(page.locator('html')).toHaveAttribute('data-r4b1t-interface', mobile ? 'mobile' : 'desktop');
    const geometry = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
  }

  await expect(page.locator('#r4mRoll')).toBeVisible();
  await expect(page.locator('.r4m-nav')).toBeVisible();
});

test('mobile landing keeps one primary decision while MENU retains secondary capabilities', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#r4mHero h1')).toHaveText('A HOLE, NOT A FEED.');
  await expect(page.locator('#r4mHero p')).toHaveText('NO PROFILE. NO RANKING. COMMITTED BEFORE REVEAL.');
  await expect(page.locator('#r4mRoll')).toContainText('ROLL');
  await expect(page.locator('#r4mProductionMark > svg[role="img"]')).toBeVisible();
  await expect(page.locator('.r4m-header-actions')).toHaveCount(0);
  await expect(page.locator('.r4m-filter-strip')).toHaveCount(0);
  await expect(page.locator('.r4m-status')).toHaveCount(0);
  await expect(page.locator('#r4mDescentEntry')).toBeHidden();

  await page.locator('#r4mNavMenu').click();
  for (const action of ['filter', 'branch', 'history', 'inspect', 'replay-inspection', 'trail-file', 'comparison', 'proof-session', 'topology', 'help', 'theme']) {
    await expect(page.locator('#r4mMenuSheet [data-mobile-action="' + action + '"]')).toBeVisible();
  }
  await expect(page.locator('#r4mMenuZip')).toBeVisible();
});


test('fresh session stays unselected until an explicit ROLL', async ({ page }, testInfo) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#previewUrl')).toHaveText('—');
  await expect(page.locator('#typedResourceMeta')).toHaveAttribute('data-state', 'idle');

  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.locator('#r4mRoute')).toHaveCount(0);
    await expect(page.locator('#r4mRoll')).toBeVisible();
  } else {
    await expect(page.locator('#preview')).toBeHidden();
    await expect(page.locator('#btnGo')).toBeVisible();
  }
});


test('revealed mobile route prioritizes open keep inspect and roll again', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await page.locator('#r4mRoll').click();

  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible({ timeout: 2000 });
  await expect(route.locator('.r4m-route-kicker')).toHaveText('SELECTED / COMMITTED');
  await expect(route.locator('.r4m-route-label')).toHaveText('RANDOM CYBERSECURITY RESOURCE');
  await expect(route.locator('[data-mobile-action="visit"]')).toHaveText('OPEN DESTINATION ↗');
  await expect(route.locator('[data-mobile-action="keep"]')).toHaveText('KEEP CARD');
  await expect(route.locator('[data-mobile-action="inspect"]')).toHaveText('INSPECT');
  await expect(route.locator('[data-mobile-action="next"]')).toHaveText('ROLL AGAIN');

  await expect(route.locator('[data-mobile-action="sprout"]')).toHaveCount(0);
  await expect(route.locator('[data-mobile-action="share"]')).toHaveCount(0);
  await expect(route.locator('[data-mobile-action="cut"]')).toHaveCount(0);
  await expect(route.locator('.r4m-route-wear')).toHaveCount(0);
});



test('mobile result stays a discovery surface rather than a proof surface', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#r4mRoll').click();

  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible({ timeout: 2000 });
  await expect(route).not.toContainText(/VERIFIED|REJECTED|UNVERIFIED|PROVENANCE|ELIGIBILITY/);
  await expect(route).not.toContainText('TRAIL CARD');
  await expect(route.locator('.r4m-route-wear')).toHaveCount(0);
});

test('mobile reveal does not synthesize route metadata when source metadata is absent', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible({ timeout: 2000 });

  // Construct the missing-metadata condition after selection has populated the
  // canonical desktop presentation, then invoke the normal mobile projection.
  await page.evaluate(() => {
    const title = document.getElementById('ogTitle');
    const desc = document.getElementById('ogDesc');
    const tag = document.getElementById('tagBadge');
    if (title) title.textContent = '';
    if (desc) desc.textContent = '';
    if (tag) {
      tag.textContent = '';
      tag.style.display = 'none';
    }
    window.__r4b1tSyncMobileRoute();
  });

  await expect(route.locator('#r4mDescription')).toBeHidden();
  await expect(route.locator('#r4mTag')).toBeHidden();
  await expect(route).not.toContainText('A route selected from the corpus.');
});


test('mobile exposes COPY TRAIL through the existing desktop shareTrail engine', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.evaluate(() => {
    window.__p22ShareTrailCalls = 0;
    window.shareTrail = () => { window.__p22ShareTrailCalls += 1; };
  });

  await page.locator('#r4mNavMenu').click();
  const copyTrail = page.locator('#r4mMenuSheet [data-mobile-action="copy-trail"]');
  await expect(copyTrail).toBeVisible();
  await expect(copyTrail).toHaveText('COPY TRAIL');
  await copyTrail.click();
  await expect.poll(() => page.evaluate(() => window.__p22ShareTrailCalls)).toBe(1);
});

test('desktop COPY TRAIL remains wired to shareTrail', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const copyTrail = page.locator('#shareTrailBtn');
  await expect(copyTrail).toHaveText('copy trail');
  await expect(copyTrail).toHaveAttribute('onclick', 'shareTrail()');
});


test('P2-3 mobile help is a touch guide, not desktop keyboard shortcuts', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mNavMenu').click();
  const help = page.locator('#r4mMenuSheet [data-mobile-action="help"]');
  await expect(help).toBeVisible();
  await help.click();

  const guide = page.locator('#r4mHelpSheet');
  await expect(guide).toHaveAttribute('aria-hidden', 'false');
  await expect(guide).toContainText('TOUCH GUIDE');
  await expect(guide).toContainText('ROLL');
  await expect(guide).toContainText('FILTER');
  await expect(guide).toContainText('BRANCH');
  await expect(guide).toContainText('ROUTE INFO');
  await expect(guide).toContainText('TRAIL');
  await expect(guide).toContainText('BLIND DESCENT / MAP TRAILS');
  await expect(guide).not.toContainText('KEYBOARD SHORTCUTS');
});

test('P2-3 desktop keyboard shortcut help remains unchanged', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#btnHelp').click();
  const help = page.locator('#helpOverlay');
  await expect(help).toHaveClass(/\bopen\b/);
  await expect(help).toContainText('KEYBOARD SHORTCUTS');
});


test('P2-4 mobile theme control reuses the persisted cross-shell preference', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mNavMenu').click();
  const theme = page.locator('#r4mMenuTheme');
  await expect(theme).toBeVisible();
  const startedLight = await page.locator('html').evaluate((el) => el.classList.contains('light'));
  await theme.click();
  await expect.poll(() => page.locator('html').evaluate((el) => el.classList.contains('light'))).toBe(!startedLight);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('r4b1t_theme'))).toBe(startedLight ? 'dark' : 'light');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect.poll(() => page.locator('html').evaluate((el) => el.classList.contains('light'))).toBe(!startedLight);
});

test('P2-4 desktop theme control remains available', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('#themeBtn')).toBeVisible();
});


test('P2-5 mobile exposes History and Replay once while retaining trail tools', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mNavMenu').click();
  for (const action of ['history', 'replay-inspection', 'trail-file', 'copy-trail', 'comparison', 'proof-session']) {
    await expect(page.locator('#r4mMenuSheet [data-mobile-action="' + action + '"]')).toBeVisible();
  }
});


test('P3-1 mobile landscape uses the available viewport without horizontal overflow', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('.r4m-shell');
    const roll = document.querySelector('.r4m-roll');
    const trail = document.querySelector('.r4m-trail-scroll');
    const shellRect = shell.getBoundingClientRect();
    const rollRect = roll.getBoundingClientRect();
    return {
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      shellWidth: shellRect.width,
      rollWidth: rollRect.width,
      trailDisplay: getComputedStyle(trail).display,
      trailRows: getComputedStyle(trail).gridTemplateRows
    };
  });

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.shellWidth).toBeGreaterThan(metrics.viewport * 0.9);
  expect(metrics.rollWidth).toBeGreaterThan(metrics.viewport * 0.85);
  expect(metrics.trailDisplay).toBe('grid');
  expect(metrics.trailRows.split(' ').length).toBe(2);

  // Current IA must remain usable in the constrained landscape height.
  await page.locator('#r4mNavMenu').click();
  const menuSheet = page.locator('#r4mMenuSheet');
  await expect(menuSheet).toHaveClass(/\bopen\b/);
  await expect(menuSheet).toHaveAttribute('aria-hidden', 'false');

  // The open class is applied before the 360ms sheet transform settles. Assert
  // final geometry, not an in-flight translated bounding box.
  await expect.poll(() => menuSheet.evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    return rect.bottom <= document.documentElement.clientHeight + 1;
  })).toBe(true);
  const menuGeometry = await menuSheet.evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: document.documentElement.clientHeight,
      scrollHeight: sheet.scrollHeight,
      clientHeight: sheet.clientHeight
    };
  });
  expect(menuGeometry.top).toBeGreaterThanOrEqual(0);
  expect(menuGeometry.scrollHeight).toBeGreaterThanOrEqual(menuGeometry.clientHeight);

  // #176 contract: ROLL remains a one-tap home action above an open MENU/backdrop.
  await page.locator('#r4mNavRoll').click();
  await expect(menuSheet).toHaveAttribute('aria-hidden', 'true');
  await expect(menuSheet).not.toHaveClass(/\bopen\b/);

  // Landscape trail rules must still target the live trail DOM after the IA migration.
  // A revealed route is recorded into Trail on the next committed selection, so
  // exercise two rolls rather than assuming the current reveal is already history.
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible({ timeout: 2000 });
  await page.locator('[data-mobile-action="visit"]').click();
  const liveTrail = page.locator('.r4m-trail-scroll');
  await expect(liveTrail).toBeVisible();
  await expect(liveTrail.locator('.r4m-trail-chip').first()).toBeVisible();
  await expect(liveTrail).toHaveCSS('display', 'grid');
});


test('P3-2 mobile Trail controls remain readable and touchable outside the primary result', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible({ timeout: 2000 });
  await page.locator('#r4mRoute [data-mobile-action="visit"]').click();

  const metrics = await page.evaluate(() => {
    const trail = document.querySelector('.r4m-trail-chip');
    const ledger = document.querySelector('.r4m-ledger');
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    return {
      trail: rect(trail),
      trailFont: trail ? parseFloat(getComputedStyle(trail).fontSize) : 0,
      ledger: rect(ledger),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  expect(metrics.overflow).toBeLessThanOrEqual(1);
  if (metrics.trail) {
    expect(metrics.trail.height).toBeGreaterThanOrEqual(48);
    expect(metrics.trailFont).toBeGreaterThanOrEqual(8);
  }
  expect(metrics.ledger?.height || 0).toBeGreaterThanOrEqual(48);
});

test('document body has no rendered literal escaped-newline text node', async ({ page }) => {
  await page.goto('./index.html');
  const escapedNewlineNodes = await page.evaluate(() =>
    Array.from(document.body.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.includes('\\n'))
      .map((node) => node.textContent)
  );
  expect(escapedNewlineNodes).toEqual([]);
});



test('Part 2 mobile IA exposes secondary instruments through MENU and keeps ROLL as home', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const nav = page.locator('.r4m-nav');
  await expect(nav.locator('button')).toHaveCount(2);
  await expect(page.locator('#r4mNavRoll')).toBeVisible();
  await expect(page.locator('#r4mNavMenu')).toBeVisible();

  await page.locator('#r4mNavMenu').click();
  await expect(page.locator('#r4mMenuSheet')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#r4mNavMenu')).toHaveAttribute('aria-expanded', 'true');

  for (const action of ['history', 'trail-file', 'copy-trail', 'comparison', 'proof-session', 'replay-inspection', 'filter', 'branch', 'inspect', 'topology', 'help']) {
    await expect(page.locator('#r4mMenuSheet [data-mobile-action="' + action + '"]')).toBeVisible();
  }

  await page.locator('#r4mNavRoll').click();
  await expect(page.locator('#r4mMenuSheet')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#r4mNavMenu')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#r4mRoll')).toBeVisible();
  await expect(page.locator('#r4mModeRoll')).toHaveAttribute('aria-pressed', 'true');
});

test('mobile primary stage swaps ROLL for the disclosed result without auto-scroll', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const before = await page.evaluate(() => window.scrollY);
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/r4m-stage-result/);
  await expect(page.locator('#r4mRoll')).toBeHidden();
  await expect(page.locator('#r4mRollAgain')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await page.locator('#r4mRollAgain').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/r4m-stage-result/);
});

test('mobile primary mode switch gives exactly one exploration instrument the stage', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#r4mRoll')).toBeVisible();
  await expect(page.locator('#r4mDescentEntry')).toBeHidden();

  await page.locator('#r4mModeBlind').click();
  await expect(page.locator('html')).toHaveClass(/r4m-stage-blind/);
  await expect(page.locator('#r4mDescentEntry')).toBeVisible();
  await expect(page.locator('#r4mDescentEntry [data-mobile-action="blind-descent"]')).toBeEnabled();
  await expect(page.locator('#r4mRoll')).toBeHidden();

  await page.locator('#r4mModeRoll').click();
  await expect(page.locator('html')).not.toHaveClass(/r4m-stage-blind/);
  await expect(page.locator('#r4mModeRoll')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#r4mModeBlind')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#r4mRoll')).toBeVisible();
  await expect(page.locator('#r4mDescentEntry')).toBeHidden();
});


test('mobile KEEP CARD delegates to the existing local card download capability', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  await page.evaluate(() => {
    window.__keepCardCalls = 0;
    window.shareCard = () => { window.__keepCardCalls += 1; };
  });

  const keep = page.locator('#r4mRoute [data-mobile-action="keep"]');
  await expect(keep).toBeVisible();
  await keep.click();
  await expect.poll(() => page.evaluate(() => window.__keepCardCalls)).toBe(1);
});

test('mobile result shows source title when available but keeps proof detail in Inspect', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  await page.evaluate(() => {
    document.getElementById('ogTitle').textContent = 'Example Security Resource';
    document.getElementById('ogDesc').textContent = 'A concise source-provided description.';
    window.__r4b1tSyncMobileRoute();
  });

  const route = page.locator('#r4mRoute');
  await expect(route.locator('#r4mTitle')).toHaveText('Example Security Resource');
  await expect(route.locator('#r4mDescription')).toHaveText('A concise source-provided description.');
  await expect(route).not.toContainText('PROVENANCE');
  await expect(route).not.toContainText('ELIGIBILITY');

  await route.locator('[data-mobile-action="inspect"]').click();
  await expect(page.locator('#r4mInspectSheet')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#r4mInspectEligibility')).not.toHaveText('UNAVAILABLE');
  await expect(page.locator('#r4mInspectProvenance')).not.toHaveText('UNAVAILABLE');
});

test('mobile Branch capability remains reachable after result action simplification', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  await page.locator('#r4mNavMenu').click();
  const branch = page.locator('#r4mMenuSheet [data-mobile-action="branch"]');
  await expect(branch).toBeVisible();
  await branch.click();
  await expect(page.locator('#r4mBranchSheet')).toHaveAttribute('aria-hidden', 'false');
});

test('desktop result uses the same open keep roll-again vocabulary', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#btnGo').click();
  await expect(page.locator('#previewUrl')).toHaveText(/^https?:\/\//);

  const preview = page.locator('#preview');
  await expect(preview.locator('#btnVisitMain')).toHaveText('OPEN DESTINATION ↗');
  await expect(preview.locator('#btnKeepMain')).toHaveText('KEEP CARD');
  await expect(preview.locator('#btnRollAgainMain')).toHaveText('ROLL AGAIN');
  await expect(preview.getByRole('button', { name: 'SPROUT' })).toHaveCount(0);
});

test('desktop KEEP CARD delegates to the existing local card download capability', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#btnGo').click();

  await page.evaluate(() => {
    window.__keepCardCalls = 0;
    window.shareCard = () => { window.__keepCardCalls += 1; };
  });

  await page.locator('#btnKeepMain').click();
  await expect.poll(() => page.evaluate(() => window.__keepCardCalls)).toBe(1);
});


test('fresh mobile landing keeps ROLL above persistent navigation at phone height', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const geometry = await page.evaluate(() => {
    const roll = document.getElementById('r4mRoll').getBoundingClientRect();
    const nav = document.querySelector('.r4m-nav').getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      rollTop: roll.top,
      rollBottom: roll.bottom,
      navTop: nav.top,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(geometry.scrollY).toBe(0);
  expect(geometry.rollTop).toBeGreaterThanOrEqual(0);
  expect(geometry.rollBottom).toBeLessThanOrEqual(geometry.navTop + 1);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});


test('mobile Blind mode presents one primary descent action while advanced tools stay in MENU', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.waitForFunction(() => typeof window.getBlindManifest === 'function');

  const before = await page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return {
      steps: snapshot.manifest.steps.length,
      preview: document.getElementById('previewUrl').textContent.trim(),
    };
  });

  expect(before.steps).toBe(0);
  expect(before.preview).toBe('—');

  await page.locator('#r4mModeBlind').click();

  const entry = page.locator('#r4mDescentEntry');
  await expect(entry).toBeVisible();
  await expect(entry.locator('small')).toHaveText('COMMIT FIRST / SEE LATER');
  await expect(entry.locator('strong')).toHaveText('BLIND DESCENT');
  await expect(entry.locator('p')).toHaveText('Lock one route before it is shown.');
  await expect(entry.locator('[data-mobile-action="blind-descent"]')).toHaveText('DESCEND BLIND ↓');
  await expect(entry.locator('[data-mobile-action="topology"]')).toHaveCount(0);

  const afterModeSwitch = await page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return snapshot.manifest.steps.length;
  });
  expect(afterModeSwitch).toBe(0);

  await entry.locator('[data-mobile-action="blind-descent"]').click();

  const overlay = page.locator('#blindDescentOverlay');
  await expect(overlay).toHaveClass(/open/);
  await expect(page.locator('#blindDepth')).toContainText('001');
  await expect(page.locator('#blindStatus')).toHaveText('CONCEALED / COMMITMENT PRESENT');

  const afterDescend = await page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return {
      steps: snapshot.manifest.steps,
      preview: document.getElementById('previewUrl').textContent.trim(),
    };
  });

  expect(afterDescend.steps).toHaveLength(1);
  expect(afterDescend.steps[0].state).toBe('concealed');
  expect(afterDescend.preview).toBe('—');

  await page.keyboard.press('Escape');
  await page.locator('#r4mNavMenu').click();
  await expect(page.locator('#r4mMenuSheet [data-mobile-action="topology"]')).toBeVisible();
});




test('mobile v3 MENU groups the existing capabilities by the object they act on', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mNavMenu').click();
  const menu = page.locator('#r4mMenuSheet');
  await expect(menu.locator('[data-menu-group="from-here"] > h3')).toHaveText('FROM HERE');
  await expect(menu.locator('[data-menu-group="trail"] > h3')).toHaveText('YOUR TRAIL');
  await expect(menu.locator('[data-menu-group="proof"] > h3')).toHaveText('TRAIL FILES & PROOF');
  await expect(menu.locator('[data-menu-group="app"] > h3')).toHaveText('THIS APP');

  const expectedActions = [
    'filter', 'branch', 'inspect',
    'topology', 'history', 'copy-trail',
    'trail-file', 'comparison', 'proof-session', 'replay-inspection',
    'help', 'theme'
  ];
  for (const action of expectedActions) {
    await expect(menu.locator('[data-mobile-action="' + action + '"]')).toHaveCount(1);
  }
  await expect(menu.locator('#r4mMenuZip')).toHaveCount(1);

  await page.locator('#r4mNavMenu').click();
  await expect(menu).toHaveAttribute('aria-hidden', 'true');
});

test('mobile v3 History presents stored disclosures oldest to newest without appending on revisit', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const urls = [
    'https://one.example/alpha',
    'https://two.example/bravo',
    'https://three.example/charlie',
  ];

  await page.evaluate((values) => {
    values.forEach((value) => window.__r4b1tRecordHistorySelection(value, 'PRESENTATION_FIXTURE'));
  }, urls);

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();

  const rows = page.locator('#historyList .r4m-ledger-row');
  await expect(rows).toHaveCount(3);
  const before = await rows.evaluateAll((nodes) => nodes.map((node) => node.textContent.replace(/\s+/g, ' ').trim()));
  expect(before[0]).toContain('one.example');
  expect(before[1]).toContain('two.example');
  expect(before[2]).toContain('three.example');
  await expect(rows.nth(0).locator('span').first()).toHaveText('001');
  await expect(rows.nth(2).locator('span').first()).toHaveText('003');
  await expect(rows.nth(2)).toHaveAttribute('data-history-latest', 'true');

  await rows.nth(0).click();
  await expect(page.locator('#previewUrl')).toHaveText('https://one.example/alpha');

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  await expect(page.locator('#historyList .r4m-ledger-row')).toHaveCount(3);
});


test('History records ROLL disclosure before OPEN and OPEN does not duplicate it', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  await expect(page.locator('#historyList button')).toHaveCount(1);

  await page.evaluate(() => window.toggleHistory());
  await page.locator('#r4mRoute [data-mobile-action="visit"]').click();
  await page.evaluate(() => {
    if (typeof window.closeIframe === 'function') window.closeIframe();
  });

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  await expect(page.locator('#historyList button')).toHaveCount(1);
});

test('History revisit and direct selectUrl projection do not append discovery records', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible();

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  const first = page.locator('#historyList button').first();
  await expect(first).toBeVisible();
  await first.click();

  await page.evaluate(() => window.selectUrl('https://projection.example/not-a-discovery'));

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  await expect(page.locator('#historyList button')).toHaveCount(1);
  await expect(page.locator('#historyList')).not.toContainText('projection.example');
});

test('explicit Branch direction selection records one disclosed History entry', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.evaluate(() => {
    window.selectUrl('https://github.com/');
    window.setMode('branch');
  });

  const branch = page.locator('#branchGrid .branch-item').first();
  await expect(branch).toBeVisible({ timeout: 5000 });
  await branch.click();

  await page.evaluate(() => window.toggleHistory());
  await expect(page.locator('#historyList button')).toHaveCount(1);
});




test('mobile revealed result uses an aperture mouth without vertical result rails', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible();
  const mouth = route.locator('.r4m-route-mouth');
  await expect(mouth).toBeVisible();
  await expect(mouth).toHaveAttribute('aria-hidden', 'true');
  await expect(mouth).toHaveText('');

  const stagePseudo = await page.locator('#r4mPrimaryStage').evaluate((node) => ({
    before: getComputedStyle(node, '::before').content,
    after: getComputedStyle(node, '::after').content,
  }));
  expect(stagePseudo.before).toBe('none');
  expect(stagePseudo.after).toBe('none');

  const domainBorder = await route.locator('#r4mDomain').evaluate((node) => getComputedStyle(node).borderLeftWidth);
  expect(domainBorder).toBe('0px');
});

test('mobile ROLL AGAIN and bottom ROLL use distinct aperture glyphs for action versus navigation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const navRoll = page.locator('#r4mNavRoll');
  await expect(navRoll.locator('.r4m-nav-aperture')).toBeVisible();
  const navAperture = navRoll.locator('.r4m-nav-aperture');
  await expect(navAperture).toHaveAttribute('data-aperture-role', 'navigation');
  await expect(navRoll.locator('.r4m-nav-door')).toHaveCount(0);
  await expect(navAperture.locator('.r4m-ap-depth-ring')).toHaveCount(0);
  const navStyle = await navAperture.evaluate((node) => ({
    fill: getComputedStyle(node).backgroundColor,
    border: getComputedStyle(node).borderTopColor,
  }));
  expect(navStyle.fill).toBe('rgba(0, 0, 0, 0)');

  await page.locator('#r4mRoll').click();
  const rollAgain = page.locator('#r4mRoute [data-mobile-action="next"]');
  await expect(rollAgain).toBeVisible();
  await expect(rollAgain.locator('.r4m-next-aperture')).toHaveAttribute('data-aperture-role', 'selection');
  await expect(rollAgain.locator('.r4m-next-aperture .r4m-ap-depth-ring')).toHaveCount(1);
});




test('revealed result is free of legacy red rail, generated DESCENT label, and red CTA override', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 512, height: 1108 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible();

  const visual = await page.locator('#r4mRouteMount').evaluate((mount) => {
    const style = getComputedStyle(mount);
    const before = getComputedStyle(mount, '::before');
    const title = mount.querySelector('#r4mTitle');
    const domain = mount.querySelector('#r4mDomain');
    const open = mount.querySelector('[data-mobile-action="visit"]');
    return {
      boxShadow: style.boxShadow,
      paddingLeft: style.paddingLeft,
      beforeContent: before.content,
      beforeDisplay: before.display,
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
      domainSize: Number.parseFloat(getComputedStyle(domain).fontSize),
      openBackground: getComputedStyle(open).backgroundColor,
    };
  });

  expect(visual.boxShadow).toBe('none');
  expect(visual.paddingLeft).toBe('0px');
  expect(['none', 'normal', '""']).toContain(visual.beforeContent);
  expect(visual.beforeDisplay).toBe('none');
  expect(visual.titleSize).toBeLessThan(visual.domainSize * 0.55);
  expect(visual.openBackground).not.toBe('rgb(227, 29, 39)');
});

test('revealed result uses the production red rule instead of the retired aperture mouth', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  const mark = page.locator('#r4mRoute .r4m-route-mouth');
  await expect(mark).toBeVisible();

  const result = await page.locator('#r4mRouteMount').evaluate((mount) => {
    const style = getComputedStyle(mount);
    const route = getComputedStyle(mount.querySelector('#r4mRoute'));
    const mark = getComputedStyle(mount.querySelector('.r4m-route-mouth'));
    return {
      mountBorderLeft: style.borderLeftWidth,
      routeBorderLeft: route.borderLeftWidth,
      markBackground: mark.backgroundColor,
      markBorderTopWidth: mark.borderTopWidth,
      markBorderRadius: mark.borderRadius,
      markHeight: mark.height,
    };
  });

  expect(result.mountBorderLeft).toBe('0px');
  expect(result.routeBorderLeft).toBe('0px');
  expect(result.markBackground).toBe('rgb(251, 1, 24)');
  expect(result.markBorderTopWidth).toBe('0px');
  expect(result.markBorderRadius).toBe('0px');
  expect(result.markHeight).toBe('5px');
});








test('secondary production mark poses return to canonical wrappers', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.waitForTimeout(1150);

  const transformOf = async (selector) => page.locator(selector).evaluate((node) => getComputedStyle(node).transform);
  const expectMoved = async (selector) => {
    const value = await transformOf(selector);
    expect(value).not.toBe('none');
    expect(value).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  };
  const expectHome = async (selector) => {
    const value = await transformOf(selector);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(value);
  };
  const setState = async (state, on) => page.evaluate(({ state, on }) => {
    document.documentElement.classList.remove('result-ready', 'rolling', 'blind-descending');
    document.documentElement.classList.toggle(state, on);
  }, { state, on });

  for (const item of [
    ['branch-open', '#r4h-act-head', 340],
    ['trail-open', '#r4h-act-card', 560],
    ['topology-open', '#r4h-act-rabbit', 520],
  ]) {
    await setState(item[0], true);
    await page.waitForTimeout(item[2]);
    await expectMoved(item[1]);
    await setState(item[0], false);
    await page.waitForTimeout(500);
    await expectHome(item[1]);
  }

  await setState('replay-open', true);
  await page.waitForTimeout(940);
  await expectMoved('#r4h-act-card');
  await expectMoved('#r4h-act-eyes');
  await setState('replay-open', false);
  await page.waitForTimeout(80);
  await expectMoved('#r4h-act-eyes');
  await page.waitForTimeout(420);
  await expectHome('#r4h-act-card');
  await expectHome('#r4h-act-eyes');

  await setState('history-open', true);
  await page.waitForTimeout(340);
  await expectMoved('#r4h-act-head');
  await page.waitForTimeout(650);
  await expectHome('#r4h-act-head');
  await setState('history-open', false);

  await setState('copy-trail', true);
  await page.waitForTimeout(230);
  await expectMoved('#r4h-copy-card');
  await page.waitForTimeout(260);
  await expectHome('#r4h-copy-card');
  await setState('copy-trail', false);

  await setState('branch-open', true);
  await page.waitForTimeout(340);
  await expectMoved('#r4h-act-head');
  await page.evaluate(() => document.documentElement.classList.add('rolling'));
  await page.waitForTimeout(420);
  await expectHome('#r4h-act-head');
  await page.evaluate(() => document.documentElement.classList.remove('rolling', 'branch-open'));
});

test('mobile secondary actions project and clear presentation-only state classes', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const html = page.locator('html');

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="branch"]').click();
  await expect(html).toHaveClass(/\bbranch-open\b/);
  await page.locator('#r4mBranchSheet [data-mobile-action="close-sheets"]').click();
  await expect(html).not.toHaveClass(/\bbranch-open\b/);

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="copy-trail"]').click();
  await expect(html).toHaveClass(/\bcopy-trail\b/);
  await page.waitForTimeout(500);
  await expect(html).not.toHaveClass(/\bcopy-trail\b/);
  await page.locator('#r4mNavMenu').click();

  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="history"]').click();
  await expect(html).toHaveClass(/\bhistory-open\b/);
  await expect(page.locator('#historyOverlay')).toBeVisible();
  await page.locator('#historyOverlay button').last().click();
  await expect(html).not.toHaveClass(/\bhistory-open\b/);
});

test('reduced motion uses semantic secondary poses without travel', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const read = async (selector) => page.locator(selector).evaluate((node) => getComputedStyle(node).transform);
  const moved = async (selector) => {
    const value = await read(selector);
    expect(value).not.toBe('none');
    expect(value).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  };
  const home = async (selector) => {
    const value = await read(selector);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(value);
  };

  await page.evaluate(() => document.documentElement.classList.add('menu-open'));
  await moved('#r4h-menu-ear');
  await page.evaluate(() => document.documentElement.classList.remove('menu-open'));
  await home('#r4h-menu-ear');

  await page.evaluate(() => document.documentElement.classList.add('branch-open'));
  await moved('#r4h-act-head');
  await page.evaluate(() => document.documentElement.classList.remove('branch-open'));
  await home('#r4h-act-head');

  await page.evaluate(() => document.documentElement.classList.add('history-open'));
  await moved('#r4h-act-head');
  await page.waitForTimeout(260);
  await home('#r4h-act-head');
  await page.evaluate(() => document.documentElement.classList.remove('history-open'));

  await page.evaluate(() => document.documentElement.classList.add('copy-trail'));
  await moved('#r4h-copy-card');
  await page.evaluate(() => document.documentElement.classList.remove('copy-trail'));
  await home('#r4h-copy-card');
});
