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

  await page.locator('[data-mobile-action="filter"]').first().click();
  await expect(page.locator('#r4mFilterSheet')).toHaveClass(/\bopen\b/);
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'CODE' }).click();
  await expect(page.locator('#r4mFilterLabel')).toHaveText('CODE');
  await expect(page.locator('#r4mRollScope')).toHaveText('CODE ROUTES');

  await page.locator('[data-mobile-action="filter"]').first().click();
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

  const mapTrails = page.locator('.r4m-descent-actions [data-mobile-action="topology"]');
  await expect(mapTrails).toBeVisible();
  await expect(mapTrails).toContainText('MAP TRAILS');
  await expect(page.locator('.r4m-descent-actions [data-mobile-action="wear-sample"]')).toHaveCount(0);
  await expect(page.locator('#trailTopologyOverlay .topology-sample')).toHaveText('VIEW SAMPLE');

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

test('mobile redesign keeps contract language and existing capability actions reachable', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#r4mHero')).toContainText('A DOOR.');
  await expect(page.locator('#r4mHero')).toContainText('NOT A FEED.');
  await expect(page.locator('#r4mHero h1')).toContainText('NO PROFILE.');
  await expect(page.locator('#r4mHero h1')).toContainText('NO TRACKING.');
  await expect(page.locator('#r4mHero h1')).toContainText('NO RANKING.');
  await expect(page.locator('#r4mRoll')).toContainText('COMMIT → REVEAL → EXPLORE');

  await page.locator('#r4mNavMenu').click();
  for (const action of ['filter', 'branch', 'history', 'inspect', 'replay-inspection', 'trail-file', 'comparison', 'proof-session']) {
    await expect(page.locator('#r4mMenuSheet [data-mobile-action="' + action + '"]')).toBeVisible();
  }
});


test('revealed mobile route uses descent framing without changing canonical route actions', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#r4mRoute')).toHaveCount(0);
  await page.locator('#r4mRoll').click();

  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible({ timeout: 2000 });
  await expect(route.locator('.r4m-route-kicker')).toHaveText('DESCENT COMPLETE');
  await expect(route.locator('.r4m-route-label')).toHaveText('A NEW PLACE');
  await expect(route.locator('[data-mobile-action="sprout"]')).toHaveText('SPROUT ×4');
  await expect(route.locator('[data-mobile-action="share"]')).toHaveText('SHARE');
  await expect(route.locator('[data-mobile-action="cut"]')).toHaveText('CUT CARD');
  await expect(route.locator('[data-mobile-action="visit"]')).toHaveText('FOLLOW THE RABBIT ↗');
  await expect(route.locator('[data-mobile-action="next"]')).toHaveText('REJECT / NEXT');
});



test('mobile route observation does not claim Trail Card authority', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#r4mRoll').click();

  const route = page.locator('#r4mRoute');
  await expect(route).toBeVisible({ timeout: 2000 });
  const label = await route.locator('.r4m-route-wear').evaluate((node) =>
    getComputedStyle(node, '::before').content
  );
  expect(label).toContain('TRAIL / OBSERVATION');
  expect(label).not.toContain('TRAIL CARD');
  await expect(route).not.toContainText(/VERIFIED|REJECTED|UNVERIFIED/);
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
  await expect(route).not.toContainText('TOR');
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

  const theme = page.locator('#r4mTheme');
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
  await expect(page.locator('#r4mRollAgain')).toBeVisible();
  await page.locator('#r4mRollAgain').click();
  const liveTrail = page.locator('.r4m-trail-scroll');
  await expect(liveTrail).toBeVisible();
  await expect(liveTrail.locator('.r4m-trail-chip').first()).toBeVisible();
  await expect(liveTrail).toHaveCSS('display', 'grid');
});


test('P3-2 mobile Trail and observation topology remain readable and touchable', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRoute')).toBeVisible({ timeout: 2000 });

  const metrics = await page.evaluate(() => {
    const trail = document.querySelector('.r4m-trail-chip');
    const ledger = document.querySelector('.r4m-ledger');
    const wear = document.querySelector('.r4m-route-wear .wear-step');
    const readout = document.querySelector('.r4m-route-wear .wear-readout');
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    return {
      trail: rect(trail),
      trailFont: trail ? parseFloat(getComputedStyle(trail).fontSize) : 0,
      ledger: rect(ledger),
      wear: rect(wear),
      readoutFont: readout ? parseFloat(getComputedStyle(readout).fontSize) : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  expect(metrics.overflow).toBeLessThanOrEqual(1);
  if (metrics.trail) {
    expect(metrics.trail.height).toBeGreaterThanOrEqual(48);
    expect(metrics.trailFont).toBeGreaterThanOrEqual(8);
  }
  expect(metrics.ledger?.height || 0).toBeGreaterThanOrEqual(48);
  if (metrics.wear) expect(metrics.wear.height).toBeGreaterThanOrEqual(60);
  if (metrics.readoutFont) expect(metrics.readoutFont).toBeGreaterThanOrEqual(8);
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

test('mobile primary mode switch changes the primary instrument while legacy Blind Descent remains reachable', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.locator('#r4mModeBlind').click();
  await expect(page.locator('html')).toHaveClass(/r4m-stage-blind/);
  await expect(page.locator('#r4mDescentEntry')).toBeVisible();
  await expect(page.locator('#r4mRoll')).toBeHidden();

  await page.locator('#r4mModeRoll').click();
  await expect(page.locator('html')).not.toHaveClass(/r4m-stage-blind/);
  await expect(page.locator('#r4mModeRoll')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#r4mModeBlind')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#r4mRoll')).toBeVisible();

  // Compatibility checkpoint: the established Blind Descent entry remains
  // visibly reachable until Part 2 deliberately migrates it into MENU.
  const legacyBlindEntry = page.locator('#r4mDescentEntry');
  await expect(legacyBlindEntry).toBeVisible();
  await expect(legacyBlindEntry.locator('[data-mobile-action="blind-descent"]')).toBeEnabled();
});
