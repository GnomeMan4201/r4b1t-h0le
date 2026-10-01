'use strict';

// PR 1 — Terrain authority: production-page evidence for T1-04 … T1-12 and T1-15.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const URLS = fs.readFileSync(path.join(ROOT, 'corpus/releases/typed-candidate-v0.1/urls.txt'), 'utf8').slice(0, -1).split('\n');
const INDEX_PATH = path.join(ROOT, 'corpus/terrains/typed-candidate-v0.1/terrain-index-v1.json');
const INDEX_DIGEST = 'sha256:8bddd48835eeb2a2a17be2966ff02965e3d7f50b1721f7e1a54b1a898189acfb';
const ACTIVE_DIGEST = 'sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1';
const BASELINE = require('./fixtures/selection/all-roll-baseline-main-c29d6bd.json');
const COUNTS = { dataset: 22, documentation: 1, lab: 10, reference: 123, repository: 470, security_tool: 203, training_resource: 12 };

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    const host = new URL(url).hostname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

async function seedDraft(page, seed) {
  await page.addInitScript(({ seed, revision }) => {
    if (sessionStorage.getItem('__t1Seeded')) return;
    sessionStorage.setItem('__t1Seeded', '1');
    localStorage.setItem('r4b1t_trail_draft_v1', JSON.stringify({
      seed, createdAt: '2026-10-01T12:00:00.000Z', corpusRevision: revision,
      corpusSourceId: 'typed-candidate-v0.1', routes: [], parent: null,
    }));
  }, { seed, revision: ACTIVE_DIGEST });
}

// Test-only: make the eligibility core report an empty pool for listed terrains (DRY / EMPTY states).
async function installEmptyTerrainHook(page, initial) {
  await page.addInitScript((initialEmpty) => {
    window.__t1Empty = initialEmpty;
    let real;
    Object.defineProperty(window, 'R4b1tSelectionCore', {
      configurable: true,
      get() { return real; },
      set(value) {
        real = Object.freeze(Object.assign({}, value, {
          eligiblePool(urls, index, constraint) {
            if (constraint && window.__t1Empty.includes(constraint.terrain)) return [];
            return value.eligiblePool(urls, index, constraint);
          },
        }));
      },
    });
  }, initial);
}

async function ready(page) {
  await page.waitForFunction(() => typeof window.roll === 'function' &&
    window.__r4b1tCommitRoll && window.__r4b1tCommitRoll.__r4b1tAuthority);
  await page.evaluate(async () => { await window.R4b1tCorpusAuthority.loadActive(); await new Promise(r => setTimeout(r, 50)); });
}

async function terrainsReady(page) {
  await ready(page);
  await page.waitForSelector('#catFilter button[data-terrain-id="security_tool"]', { state: 'attached', timeout: 8000 });
}

async function openDesktopFilter(page) {
  const filter = page.locator('#catFilter');
  if (!(await filter.isVisible())) await page.getByRole('button', { name: 'FILTER', exact: true }).click();
  await expect(filter).toBeVisible();
}

const control = (page, id) => page.locator(`#catFilter button[data-terrain-id="${id}"]`);
const capture = page => page.evaluate(() => window.__r4b1tCaptureSelectionConstraint());
const commit = page => page.evaluate(() => { const r = window.__r4b1tCommitRoll(); return r && r.transaction; });
const draftRoutes = page => page.evaluate(() => JSON.parse(localStorage.getItem('r4b1t_trail_draft_v1')).routes.length);

test.beforeEach(async ({ page }) => { await blockExternalNetwork(page); });

test('T1-04: every terrain commits only index members, with the index bound into the constraint', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await seedDraft(page, '7e44a1000000000000000000000000a1');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await openDesktopFilter(page);
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  for (const terrain of index.terrains) {
    await control(page, terrain.id).click();
    await expect(control(page, terrain.id)).toHaveAttribute('aria-pressed', 'true');
    const c = await capture(page);
    expect(c.terrain).toBe(terrain.id);
    expect(c.terrainIndex).toEqual({ schema: 'r4b1t-terrain-index-v1', digest: INDEX_DIGEST });
    const members = new Set(terrain.members.map(i => URLS[i]));
    const seen = new Set();
    for (let i = 0; i < Math.min(60, terrain.count * 6); i++) {
      const t = await commit(page);
      expect(members.has(t.route.url), `${terrain.id}: ${t.route.url}`).toBe(true);
      expect(t.eligible_count).toBe(terrain.count);
      seen.add(t.route.url);
    }
    if (terrain.count <= 12) expect(seen.size).toBe(terrain.count);
    await control(page, terrain.id).click();
    await expect(control(page, terrain.id)).toHaveAttribute('aria-pressed', 'false');
  }
});

test('T1-05: eligible counts are visible before ROLL on desktop, including ALL and single-route honesty', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await openDesktopFilter(page);
  await expect(control(page, 'ALL')).toHaveText('ALL · 841');
  await expect(control(page, 'ALL')).toHaveAttribute('aria-pressed', 'true');
  for (const [id, count] of Object.entries(COUNTS)) {
    await expect(control(page, id)).toHaveAttribute('data-eligible-count', String(count));
    await expect(control(page, id)).toContainText(`· ${count}`);
  }
  await expect(control(page, 'documentation')).toHaveText('DOCUMENTATION · 1 · SINGLE ROUTE');
  await expect(control(page, 'security_tool')).toHaveText('SECURITY TOOL · 203');
  const order = await page.locator('#catFilter button[data-terrain-id]').evaluateAll(b => b.map(x => x.dataset.terrainId));
  expect(order).toEqual(['ALL', ...Object.keys(COUNTS).sort()]);
});

test('T1-05: mobile filter shows counts, labels the armed terrain, and scopes ROLL with its count', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await page.waitForSelector('#r4mShellHost', { state: 'attached' });
  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  await expect(page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'ALL SIGNALS · 841' })).toBeVisible();
  await expect(page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'DOCUMENTATION · 1 · SINGLE ROUTE' })).toBeVisible();
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'SECURITY TOOL' }).click();
  await expect(page.locator('#r4mFilterLabel')).toHaveText('SECURITY TOOL');
  await expect(page.locator('#r4mRollScope')).toHaveText('SECURITY TOOL · 203 ROUTES');
  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'ALL SIGNALS' }).click();
  await expect(page.locator('#r4mRollScope')).toHaveText('FULL CORPUS · 841 ROUTES');
});

test('T1-06: tampered terrain index → UNAVAILABLE, no typed terrains, ALL still rolls, no pre-reveal metadata', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  const requests = [];
  page.on('request', r => requests.push(r.url()));
  const tampered = fs.readFileSync(INDEX_PATH, 'utf8').replace('"lab"', '"lbb"');
  await page.route('**/corpus/terrains/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: tampered }));
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await openDesktopFilter(page);
  await expect(page.locator('#terrainStatus')).toContainText('TERRAIN AUTHORITY UNAVAILABLE · TERRAIN_INDEX_DIGEST_MISMATCH');
  await expect(page.locator('#catFilter button[data-terrain-id]:not([data-terrain-id="ALL"])')).toHaveCount(0);
  expect(requests.some(u => u.includes('resources.json'))).toBe(false);
  const c = await capture(page);
  expect(c).toEqual({ terrain: 'ALL', terrainIndex: null, protocolPolicy: { version: 1, excludeOnion: false } });
  await page.evaluate(() => window.roll());
  await expect(page.locator('#previewUrl')).toHaveText(/^https?:\/\//);
});

test('T1-07: a DRY terrain is disabled with a reason and cannot be armed', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await installEmptyTerrainHook(page, ['lab']);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await openDesktopFilter(page);
  const lab = control(page, 'lab');
  await expect(lab).toBeDisabled();
  await expect(lab).toHaveAttribute('aria-disabled', 'true');
  await expect(lab).toHaveText('LAB · 0 ELIGIBLE');
  await lab.click({ force: true });
  await expect(lab).toHaveAttribute('aria-pressed', 'false');
  expect((await capture(page)).terrain).toBe('ALL');
});

test('T1-08: EMPTY at commit — explicit status, no draw, no transaction, terrain stays armed (desktop)', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await installEmptyTerrainHook(page, []);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await openDesktopFilter(page);
  await control(page, 'security_tool').click();
  const first = await commit(page);
  const routesBefore = await draftRoutes(page);
  await page.evaluate(() => { window.__t1Empty = ['security_tool']; });
  const before = await page.locator('#previewUrl').textContent();
  await page.evaluate(() => window.roll());
  await expect(page.locator('#rollStatus')).toHaveText('NO ELIGIBLE ROUTES IN SECURITY TOOL UNDER CURRENT PROTOCOL POLICY');
  await expect(page.locator('#rollStatus')).toHaveAttribute('data-state', 'EMPTY');
  expect(await page.locator('#previewUrl').textContent()).toBe(before);
  expect(await draftRoutes(page)).toBe(routesBefore);
  await expect(control(page, 'security_tool')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { window.__t1Empty = []; });
  const next = await commit(page);
  expect(next.sequence).toBe(first.sequence + 1);
  expect(next.sampler.draw_start).toBe(first.sampler.draw_start + first.sampler.draw_count);
  await expect(page.locator('#rollStatus')).toBeHidden();
});

test('T1-08: EMPTY at commit is explicit on the mobile ROLL apparatus', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await installEmptyTerrainHook(page, []);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await page.waitForSelector('#r4mShellHost', { state: 'attached' });
  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: 'SECURITY TOOL' }).click();
  await page.evaluate(() => { window.__t1Empty = ['security_tool']; });
  await page.locator('#r4mRoll').click();
  await expect(page.locator('#r4mRollScope')).toHaveText('NO ELIGIBLE ROUTES IN SECURITY TOOL UNDER CURRENT PROTOCOL POLICY');
  await expect(page.locator('#r4mRollScope')).toHaveAttribute('data-selection-status', 'EMPTY');
});

test('T1-09: ROLL commits selection transaction v2 with index binding, eligible count, and the guard reference used', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await openDesktopFilter(page);
  await control(page, 'security_tool').click();
  const a = await commit(page);
  const b = await commit(page);
  expect(a.transaction_version).toBe('r4b1t-selection-transaction/v2');
  expect(a.constraint).toEqual({ terrain: 'security_tool', terrainIndex: { schema: 'r4b1t-terrain-index-v1', digest: INDEX_DIGEST }, protocolPolicy: { version: 1, excludeOnion: false } });
  expect(a.eligible_count).toBe(203);
  expect(a.sampler.repeat_guard).toEqual({ reference: null, max_draws: 30 });
  expect(b.sampler.repeat_guard).toEqual({ reference: a.route.url, max_draws: 30 });
  expect(Object.keys(a).sort()).toEqual(['action', 'constraint', 'corpus_revision', 'eligible_count', 'route', 'sampler', 'sequence', 'transaction_version']);
  await control(page, 'ALL').click();
  const c = await commit(page);
  expect(c.constraint.terrain).toBe('ALL');
  expect(c.constraint.terrainIndex).toBeNull();
  expect(c.eligible_count).toBe(841);
});

test('T1-10: rewriting control styles, text, and hint copy does not change the captured constraint', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await openDesktopFilter(page);
  await control(page, 'security_tool').click();
  const before = await capture(page);
  await page.evaluate(() => {
    document.querySelectorAll('#catFilter button').forEach(b => { b.style.color = '#cc1111'; b.style.borderColor = 'rgb(204, 17, 17)'; });
    document.querySelector('#catFilter button[data-terrain-id="lab"]').textContent = 'CODE';
    const t = document.getElementById('ogTitle'); if (t) t.textContent = 'OSS repos — tools, exploits, frameworks, research';
  });
  expect(await capture(page)).toEqual(before);
  const t = await commit(page);
  expect(t.constraint.terrain).toBe('security_tool');
});

test('T1-11: without the trail selection authority, ROLL selects nothing and says so', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.addInitScript(() => {
    let current;
    Object.defineProperty(window, '__r4b1tCommitRoll', {
      configurable: true,
      get() { return current; },
      set(value) { if (value && value.__r4b1tAuthority) return; current = value; },
    });
  });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.roll === 'function');
  await page.evaluate(async () => { await window.R4b1tCorpusAuthority.loadActive(); await new Promise(r => setTimeout(r, 50)); });
  const before = await page.locator('#previewUrl').textContent();
  await page.evaluate(() => { Math.random = () => 0.5; window.roll(); });
  await expect(page.locator('#rollStatus')).toHaveText('SELECTION AUTHORITY UNAVAILABLE');
  expect(await page.locator('#previewUrl').textContent()).toBe(before);
});

test('T1-12: ALL ROLL outcomes are unchanged from main for a fixed seed (300 rolls)', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await seedDraft(page, BASELINE.seed);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  const rolls = await page.evaluate(n => {
    const out = [];
    for (let i = 0; i < n; i++) { const t = window.__r4b1tCommitRoll().transaction; out.push({ url: t.route.url, draw_start: t.sampler.draw_start, draw_count: t.sampler.draw_count }); }
    return out;
  }, BASELINE.rolls.length);
  expect(rolls).toEqual(BASELINE.rolls);
});

test('T1-15: the hostname tag badge is labelled as a non-authoritative site hint', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.evaluate(() => window.selectUrl('https://github.com/sullo/nikto'));
  const badge = page.locator('#tagBadge');
  await expect(badge).toHaveText('SITE HINT · CODE');
  await expect(badge).toHaveAttribute('title', /not a terrain/i);
});

test('T1-16: every mobile terrain proxy is reachable above the bottom navigation', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await terrainsReady(page);
  await page.waitForSelector('#r4mShellHost', { state: 'attached' });
  await page.locator('#r4mNavMenu').click();
  await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
  await expect(page.locator('#r4mFilterOptions .r4m-filter-proxy')).toHaveCount(8);
  await expect(page.locator('#r4mFilterSheet')).toHaveClass(/\bopen\b/);
  // Measure only after the sheet's slide-in and option-reveal animations have settled.
  await page.waitForFunction(() => document.getElementById('r4mFilterSheet').getAnimations({ subtree: true }).every(a => a.playState !== 'running'));
  const blocked = await page.evaluate(async () => {
    const out = [];
    for (const b of document.querySelectorAll('#r4mFilterOptions .r4m-filter-proxy')) {
      b.scrollIntoView({ block: 'end' });
      await new Promise(r => requestAnimationFrame(r));
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!(hit === b || b.contains(hit))) out.push(b.textContent.trim() + ' ← ' + (hit ? (hit.id || hit.className || hit.tagName) : 'none'));
    }
    return out;
  });
  expect(blocked).toEqual([]);
});
