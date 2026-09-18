'use strict';

const { test, expect } = require('@playwright/test');

test('local topology maps verified snapshots and opens revealed stops', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailTopology === 'function' && typeof window.roll === 'function');
  await page.evaluate(() => window.roll());
  const result = await page.evaluate(async () => {
    const snapshot = await window.getTrailManifest();
    await window.openTrailTopology(snapshot);
    return {
      open: document.getElementById('trailTopologyOverlay').classList.contains('open'),
      cards: document.querySelectorAll('.topology-card').length,
      stops: document.querySelectorAll('.topology-wear .wear-step[data-url]').length,
      title: document.getElementById('trailTopologyTitle').textContent,
    };
  });
  expect(result.open).toBe(true);
  expect(result.cards).toBe(1);
  expect(result.stops).toBeGreaterThan(0);
  expect(result.title).toBe('TRAIL TOPOLOGY');
});

test('topology remains inside the mobile viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile-only layout assertion');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailTopology === 'function');
  await page.evaluate(async () => window.openTrailTopology());
  const overflow = await page.evaluate(() => document.getElementById('trailTopologyOverlay').scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('sample topology shows revealed, concealed, inherited, and divergent wear together', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailWearSample === 'function');
  const state = await page.evaluate(async () => {
    await window.openTrailWearSample();
    return {
      cards: document.querySelectorAll('.topology-card').length,
      revealed: document.querySelectorAll('.topology-wear .wear-step.revealed').length,
      concealed: document.querySelectorAll('.topology-wear .wear-step.concealed').length,
      inherited: document.querySelectorAll('.topology-wear .wear-step.inherited').length,
      divergent: document.querySelectorAll('.topology-wear .wear-step.divergent').length,
      forks: document.querySelectorAll('.topology-wear .wear-fork-mark').length,
      creases: document.querySelectorAll('.topology-wear .wear-crease').length,
      sampleStatus: document.getElementById('trailTopologyMap').textContent,
    };
  });
  expect(state.cards).toBe(2);
  expect(state.revealed).toBeGreaterThan(1);
  expect(state.concealed).toBeGreaterThan(0);
  expect(state.inherited).toBeGreaterThan(0);
  expect(state.divergent).toBeGreaterThan(0);
  expect(state.forks).toBeGreaterThan(0);
  expect(state.creases).toBeGreaterThan(0);
  expect(state.sampleStatus).toContain('NOT SAVED TO LOCAL ATLAS');
});

test('Trail Topology traps focus, closes with Escape, and restores opener', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailTopology === 'function');

  await page.evaluate(async () => {
    const opener = document.createElement('button');
    opener.id = 'topologyFocusOpener';
    opener.textContent = 'open topology';
    document.body.appendChild(opener);
    opener.focus();
    await window.openTrailTopology();
  });

  const overlay = page.locator('#trailTopologyOverlay');
  await expect(overlay).toHaveClass(/open/);
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');

  const focusInside = await page.evaluate(() => document.querySelector('#trailTopologyOverlay').contains(document.activeElement));
  expect(focusInside).toBe(true);

  const last = overlay.locator('button:visible').last();
  await last.focus();
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => {
    const overlay = document.querySelector('#trailTopologyOverlay');
    const focusables = Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
    return document.activeElement === focusables[0];
  });
  expect(wrapped).toBe(true);

  await page.keyboard.press('Escape');
  await expect(overlay).not.toHaveClass(/open/);
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#topologyFocusOpener')).toBeFocused();
});


test('sample topology renders deterministic verified lineage depth', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailWearSample === 'function');
  const state = await page.evaluate(async () => {
    await window.openTrailWearSample();
    const forest = document.querySelector('.topology-forest');
    const branches = Array.from(document.querySelectorAll('.topology-branch'));
    return {
      treeRole: forest && forest.getAttribute('role'),
      depths: branches.map((node) => Number(node.getAttribute('data-depth'))),
      ariaLevels: branches.map((node) => Number(node.getAttribute('aria-level'))),
      nestedChildren: document.querySelectorAll('.topology-children > .topology-branch').length,
      verifiedCards: document.querySelectorAll('.topology-card[data-proof-state="VERIFIED"]').length,
      legacyLines: document.querySelectorAll('.topology-line').length,
    };
  });

  expect(state.treeRole).toBe('tree');
  expect(state.depths).toEqual([0, 1]);
  expect(state.ariaLevels).toEqual([1, 2]);
  expect(state.nestedChildren).toBe(1);
  expect(state.verifiedCards).toBe(2);
  expect(state.legacyLines).toBe(0);
});

test('topology renders PARENT ABSENT as an explicit structural stub', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrail && window.openTrailTopology);

  const state = await page.evaluate(async () => {
    const trail = window.R4b1tTrail;
    const manifest = await trail.createManifest({
      created_at: '2026-09-18T18:00:00.000Z',
      corpus_revision: 'sha256:' + 'a'.repeat(64),
      seed: 'missing-parent-browser',
      terrain: 'RESEARCH',
      routes: [{ url: 'https://example.org/child', action: 'ROLL' }],
      parent: { trail_id: 'sha256:' + 'b'.repeat(64), fork_at: 1 },
    });
    const snapshot = await trail.envelope(manifest);
    await window.openTrailTopology(snapshot);
    const stub = document.querySelector('.topology-parent-stub');
    const branch = document.querySelector('.topology-branch');
    return {
      stubText: stub && stub.textContent,
      stubState: stub && stub.getAttribute('data-proof-state'),
      branchDepth: branch && branch.getAttribute('data-depth'),
    };
  });

  expect(state.stubState).toBe('PARENT ABSENT');
  expect(state.stubText).toContain('PARENT ABSENT');
  expect(state.branchDepth).toBe('0');
});

test('topology renderer contains no ranking or force-layout semantics', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const source = await page.evaluate(async () => (await fetch('./topology-runtime.js')).text());
  const lowered = source.toLowerCase();

  for (const banned of [
    'force-directed',
    'force simulation',
    'interestingness',
    'recommended next',
    'popularity score',
    'engagement score',
  ]) {
    expect(lowered.includes(banned)).toBe(false);
  }

  expect(lowered).toContain('lineageforest');
  expect(lowered).toContain('data-depth');
  expect(lowered).toContain('relationship_state');
});
