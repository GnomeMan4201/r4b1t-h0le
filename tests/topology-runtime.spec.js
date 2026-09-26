'use strict';

const { test, expect } = require('@playwright/test');
const { expectFocusInside } = require('./focus-assertions');
const fs = require('node:fs/promises');

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

  await expectFocusInside(page, '#trailTopologyOverlay');

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


test('proof inspector exposes categorical artifact, relationship, and stop facts only', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailWearSample === 'function');

  await page.evaluate(async () => window.openTrailWearSample());
  await page.locator('.topology-inspect').first().click();

  const state = await page.evaluate(() => {
    const panel = document.getElementById('trailTopologyInspector');
    return {
      hidden: panel.hidden,
      proofState: panel.getAttribute('data-proof-state'),
      text: panel.textContent,
      stopStates: Array.from(panel.querySelectorAll('.topology-inspector-stop'))
        .map((node) => node.getAttribute('data-proof-state')),
    };
  });

  expect(state.hidden).toBe(false);
  expect(state.proofState).toBe('VERIFIED');
  expect(state.text).toContain('ARTIFACT');
  expect(state.text).toContain('VERIFIED');
  expect(state.stopStates.length).toBeGreaterThan(0);
  expect(state.stopStates.every((value) => value === 'CONCEALED' || value === 'REVEALED')).toBe(true);

  const lowered = state.text.toLowerCase();
  for (const banned of ['confidence', 'percent', 'score', 'recommended', 'interesting']) {
    expect(lowered.includes(banned)).toBe(false);
  }
});

test('rejected local artifacts stay out of the graph and surface only as diagnostics', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrail && typeof window.openTrailTopology === 'function');

  const state = await page.evaluate(async () => {
    const trail = window.R4b1tTrail;
    const manifest = await trail.createManifest({
      created_at: '2026-09-18T19:00:00.000Z',
      corpus_revision: 'sha256:' + 'a'.repeat(64),
      seed: 'rejected-local',
      terrain: 'RESEARCH',
      routes: [{ url: 'https://example.org/original', action: 'ROLL' }],
      parent: null,
    });
    const snapshot = await trail.envelope(manifest);
    snapshot.manifest.routes[0].url = 'https://attacker.invalid/';
    localStorage.setItem('r4b1t_topology_atlas_v1', JSON.stringify([snapshot]));

    await window.openTrailTopology();

    const diagnostics = document.getElementById('trailTopologyDiagnostics');
    return {
      diagnosticHidden: diagnostics.hidden,
      diagnosticText: diagnostics.textContent,
      rejectedCount: diagnostics.querySelectorAll('[data-proof-state="REJECTED"]').length,
      graphCards: document.querySelectorAll('.topology-card').length,
      savedAtlas: JSON.parse(localStorage.getItem('r4b1t_topology_atlas_v1') || '[]').length,
    };
  });

  expect(state.diagnosticHidden).toBe(false);
  expect(state.diagnosticText).toContain('REJECTED ARTIFACTS');
  expect(state.diagnosticText).toContain('Route ID mismatch');
  expect(state.rejectedCount).toBe(1);
  expect(state.graphCards).toBe(0);
  expect(state.savedAtlas).toBe(0);
});


test('topology export stays disabled without local atlas evidence and for unsaved sample', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailTopology === 'function');

  await page.evaluate(async () => window.openTrailTopology());
  let state = await page.locator('.topology-export').evaluate((button) => ({
    disabled: button.disabled,
    ariaDisabled: button.getAttribute('aria-disabled'),
  }));
  expect(state).toEqual({ disabled: true, ariaDisabled: 'true' });

  await page.evaluate(async () => window.openTrailWearSample());
  state = await page.locator('.topology-export').evaluate((button) => ({
    disabled: button.disabled,
    ariaDisabled: button.getAttribute('aria-disabled'),
  }));
  expect(state).toEqual({ disabled: true, ariaDisabled: 'true' });
});

test('programmatic topology export is deterministic for fixed explicit metadata', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrail && typeof window.openTrailTopology === 'function');

  const result = await page.evaluate(async () => {
    const trail = window.R4b1tTrail;
    const manifest = await trail.createManifest({
      created_at: '2026-09-19T03:30:00.000Z',
      corpus_revision: 'sha256:' + 'a'.repeat(64),
      seed: 'export-ux-determinism',
      terrain: 'RESEARCH',
      routes: [{ url: 'https://example.org/export', action: 'ROLL' }],
      parent: null,
    });
    const snapshot = await trail.envelope(manifest);
    await window.openTrailTopology(snapshot);

    const original = window.URL.createObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    window.URL.createObjectURL = () => 'blob:test';
    HTMLAnchorElement.prototype.click = function () {};
    try {
      const first = await window.exportTrailTopology('2026-09-19T03:31:00.000Z');
      const second = await window.exportTrailTopology('2026-09-19T03:31:00.000Z');
      return {
        first: JSON.stringify(first),
        second: JSON.stringify(second),
        format: first.format,
        nodes: first.nodes.length,
        diagnostics: first.diagnostics.length,
      };
    } finally {
      window.URL.createObjectURL = original;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  expect(result.first).toBe(result.second);
  expect(result.format).toBe('r4b1t-topology-export/v0.1');
  expect(result.nodes).toBe(1);
  expect(result.diagnostics).toBe(0);
});

test('EXPORT TOPOLOGY downloads canonical JSON and keeps rejected input diagnostics-only', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrail && typeof window.openTrailTopology === 'function');

  const setup = await page.evaluate(async () => {
    const trail = window.R4b1tTrail;
    const manifest = await trail.createManifest({
      created_at: '2026-09-19T03:40:00.000Z',
      corpus_revision: 'sha256:' + 'b'.repeat(64),
      seed: 'export-ux-download',
      terrain: 'RESEARCH',
      routes: [{ url: 'https://example.net/export', action: 'ROLL' }],
      parent: null,
    });
    const valid = await trail.envelope(manifest);
    const rejected = JSON.parse(JSON.stringify(valid));
    rejected.manifest.routes[0].url = 'https://attacker.invalid/';
    localStorage.setItem('r4b1t_topology_atlas_v1', JSON.stringify([valid, rejected]));
    await window.openTrailTopology();

    return {
      cards: document.querySelectorAll('.topology-card').length,
      diagnostics: document.querySelectorAll('#trailTopologyDiagnostics [data-proof-state="REJECTED"]').length,
      savedAtlas: JSON.parse(localStorage.getItem('r4b1t_topology_atlas_v1') || '[]').length,
      exportDisabled: document.querySelector('.topology-export').disabled,
    };
  });

  expect(setup.cards).toBe(1);
  expect(setup.diagnostics).toBe(1);
  expect(setup.savedAtlas).toBe(1);
  expect(setup.exportDisabled).toBe(false);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.topology-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^r4b1t-topology-.*\.json$/);

  const downloadPath = await download.path();
  const artifact = JSON.parse(await fs.readFile(downloadPath, 'utf8'));

  expect(artifact.format).toBe('r4b1t-topology-export/v0.1');
  expect(artifact.nodes).toHaveLength(1);
  expect(artifact.nodes[0].proof_state).toBe('VERIFIED');
  expect(artifact.diagnostics).toHaveLength(1);
  expect(artifact.diagnostics[0].proof_state).toBe('REJECTED');
  expect(artifact.diagnostics[0].reason).toContain('Route ID mismatch');
  expect(JSON.stringify(artifact)).not.toContain('attacker.invalid');
});


test('topology tree uses roving tabindex and deterministic keyboard traversal', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailWearSample === 'function');

  await page.evaluate(async () => window.openTrailWearSample());

  const items = page.locator('[role="treeitem"]');
  await expect(items).toHaveCount(2);

  const initial = await items.evaluateAll((nodes) => nodes.map((node) => ({
    tabindex: node.getAttribute('tabindex'),
    selected: node.getAttribute('aria-selected'),
    level: node.getAttribute('aria-level'),
  })));

  expect(initial).toEqual([
    { tabindex: '0', selected: 'true', level: '1' },
    { tabindex: '-1', selected: 'false', level: '2' },
  ]);

  await items.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await expect(items.nth(1)).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowUp');
  await expect(items.nth(0)).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(items.nth(1)).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(items.nth(0)).toBeFocused();

  await page.keyboard.press('End');
  await expect(items.nth(1)).toBeFocused();

  await page.keyboard.press('Home');
  await expect(items.nth(0)).toBeFocused();
});

test('topology tree Enter opens proof inspector and moves focus into it', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailWearSample === 'function');

  await page.evaluate(async () => window.openTrailWearSample());

  const first = page.locator('[role="treeitem"]').first();
  await first.focus();
  await page.keyboard.press('Enter');

  const inspector = page.locator('#trailTopologyInspector');
  await expect(inspector).toBeVisible();
  await expect(inspector).toBeFocused();
  await expect(inspector).toHaveAttribute('data-proof-state', 'VERIFIED');
  await expect(inspector).toHaveAttribute('data-trail-id', /sha256:/);
});

test('topology tree Space opens the selected node proof inspector without changing graph order', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailWearSample === 'function');

  await page.evaluate(async () => window.openTrailWearSample());

  const before = await page.locator('[role="treeitem"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-trail-id'))
  );

  const second = page.locator('[role="treeitem"]').nth(1);
  await second.focus();
  await page.keyboard.press('Space');

  const inspector = page.locator('#trailTopologyInspector');
  await expect(inspector).toBeFocused();

  const selectedId = await inspector.getAttribute('data-trail-id');
  expect(selectedId).toBe(before[1]);

  const after = await page.locator('[role="treeitem"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-trail-id'))
  );
  expect(after).toEqual(before);
});
