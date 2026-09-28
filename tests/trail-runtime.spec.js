'use strict';

const { test, expect } = require('@playwright/test');
const { expectFocusInside } = require('./focus-assertions');

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

async function rollAndWaitForTrail(page) {
  await rollAndWaitForTrail(page);
  await expect.poll(async () => page.evaluate(async () => {
    const snapshot = await window.getTrailManifest();
    return snapshot.manifest.routes.length;
  })).toBeGreaterThan(0);
}

test('exports a verifiable manifest and replays its exact route', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.getTrailManifest === 'function' && typeof window.roll === 'function');
  await rollAndWaitForTrail(page);

  const result = await page.evaluate(async () => {
    const exported = await window.getTrailManifest();
    const verified = await window.R4b1tTrail.verify(exported);
    const expected = verified.manifest.routes[0].url;
    await window.importTrailManifest(exported);
    const replayed = await window.replayTrailManifest(0);
    return {
      expected,
      replayed,
      visible: document.getElementById('previewUrl').textContent.trim(),
      trailId: exported.trail_id,
      corpusRevision: exported.manifest.corpus_revision,
    };
  });

  expect(result.replayed).toBe(result.expected);
  expect(result.visible).toBe(result.expected);
  expect(result.trailId).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(result.corpusRevision).toMatch(/^sha256:[0-9a-f]{64}$/);
});

test('rejects a tampered imported trail', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.getTrailManifest === 'function');
  await rollAndWaitForTrail(page);

  const message = await page.evaluate(async () => {
    const exported = await window.getTrailManifest();
    exported.manifest.routes[0].url = 'https://attacker.invalid/replaced';
    try {
      await window.importTrailManifest(exported);
      return 'accepted';
    } catch (error) {
      return error.message;
    }
  });

  expect(message).toMatch(/Route ID mismatch/);
});

test('forks a replayed trail with verifiable parent lineage', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.getTrailManifest === 'function' && typeof window.roll === 'function');
  await rollAndWaitForTrail(page);

  const result = await page.evaluate(async () => {
    const parent = await window.getTrailManifest();
    await window.importTrailManifest(parent);
    await window.replayTrailManifest(0);
    const child = await window.forkTrailManifest();
    const lineage = await window.R4b1tTrail.verifyLineage(child, parent);
    return {
      parentId: parent.trail_id,
      declaredParentId: child.manifest.parent.trail_id,
      forkAt: lineage.fork_at,
      inheritedRoute: child.manifest.routes[0].url,
      parentRoute: parent.manifest.routes[0].url,
      status: document.getElementById('trailLedgerStatus').textContent,
    };
  });

  expect(result.declaredParentId).toBe(result.parentId);
  expect(result.forkAt).toBe(1);
  expect(result.inheritedRoute).toBe(result.parentRoute);
  expect(result.status).toBe('FORKED / STEP 001');
});

test('Trail Ledger traps focus, closes with Escape, and restores opener', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailLedger === 'function');

  await page.evaluate(() => {
    const opener = document.createElement('button');
    opener.id = 'trailFocusOpener';
    opener.textContent = 'open trail';
    document.body.appendChild(opener);
    opener.focus();
    window.openTrailLedger();
  });

  const overlay = page.locator('#trailLedgerOverlay');
  await expect(overlay).toHaveCSS('display', 'flex');
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');

  await expectFocusInside(page, '#trailLedgerOverlay');

  const buttons = overlay.locator('button:visible');
  const last = buttons.last();
  await last.focus();
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => {
    const overlay = document.querySelector('#trailLedgerOverlay');
    const focusables = Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
    return document.activeElement === focusables[0];
  });
  expect(wrapped).toBe(true);

  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCSS('display', 'none');
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#trailFocusOpener')).toBeFocused();
});

test('Trail Ledger explains unavailable actions and exposes copy controls for identifiers', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openTrailLedger === 'function');
  await page.evaluate(() => window.openTrailLedger());

  const overlay = page.locator('#trailLedgerOverlay');
  await expect(overlay.locator('[data-trail-action="replay"]')).toBeDisabled();
  await expect(overlay.locator('[data-trail-action="fork"]')).toBeDisabled();
  await expect(overlay.locator('#trailLedgerHint')).toContainText('Import or export a trail to enable replay and fork.');
  await expect(overlay.locator('[data-copy-field="seed"]')).toHaveAccessibleName('Copy seed');
});


test('unstamped historical Trail drafts reset when typed corpus becomes active', async ({ page }) => {
  const legacyRoute = 'https://example.org/legacy-draft';
  await page.addInitScript(({ route }) => {
    localStorage.setItem('r4b1t_trail_draft_v1', JSON.stringify({
      seed: 'legacy-seed',
      createdAt: '2026-09-27T00:00:00.000Z',
      routes: [{ url: route, action: 'ROLL' }],
      parent: null,
    }));
  }, { route: legacyRoute });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.getTrailManifest === 'function');

  const result = await page.evaluate(async () => {
    const loaded = await window.R4b1tCorpusAuthority.loadActive();
    const exported = await window.getTrailManifest();
    const saved = JSON.parse(localStorage.getItem('r4b1t_trail_draft_v1'));
    return {
      active: window.R4b1tCorpusAuthority.active(),
      activeUrls: loaded.urls,
      exportedRevision: exported.manifest.corpus_revision,
      exportedRoutes: exported.manifest.routes.map(route => route.url),
      savedRevision: saved.corpusRevision,
      savedSourceId: saved.corpusSourceId,
      seed: exported.manifest.sampler.seed,
    };
  });

  expect(result.active.id).toBe('typed-candidate-v0.1');
  expect(result.exportedRoutes).not.toContain(legacyRoute);
  expect(result.exportedRoutes.every(url => result.activeUrls.includes(url))).toBe(true);
  expect(result.activeUrls).toHaveLength(841);
  expect(result.savedRevision).toBe(result.exportedRevision);
  expect(result.savedSourceId).toBe('typed-candidate-v0.1');
  expect(result.seed).not.toBe('legacy-seed');
});

test('Trail resets a restored draft whose corpus revision does not match active bytes', async ({ page }) => {
  const foreignRevision = 'sha256:' + '0'.repeat(64);
  await page.addInitScript(({ revision }) => {
    localStorage.setItem('r4b1t_trail_draft_v1', JSON.stringify({
      seed: 'foreign-seed',
      createdAt: '2026-09-27T00:00:00.000Z',
      corpusRevision: revision,
      corpusSourceId: 'legacy-urls-v1',
      routes: [{ url: 'https://example.org/foreign-route', action: 'ROLL' }],
      parent: null,
    }));
  }, { revision: foreignRevision });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.getTrailManifest === 'function');

  const result = await page.evaluate(async () => {
    const exported = await window.getTrailManifest();
    const saved = JSON.parse(localStorage.getItem('r4b1t_trail_draft_v1'));
    return {
      active: window.R4b1tCorpusAuthority.active(),
      routes: exported.manifest.routes,
      exportedRevision: exported.manifest.corpus_revision,
      savedRevision: saved.corpusRevision,
      savedSourceId: saved.corpusSourceId,
      seed: exported.manifest.sampler.seed,
    };
  });

  expect(result.routes).toEqual([]);
  expect(result.exportedRevision).not.toBe(foreignRevision);
  expect(result.savedRevision).toBe(result.exportedRevision);
  expect(result.savedSourceId).toBe(result.active.id);
  expect(result.seed).not.toBe('foreign-seed');
});

test('Trail replay may inspect a foreign-corpus artifact but fork rejects it', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    typeof window.importTrailManifest === 'function' &&
    typeof window.forkTrailManifest === 'function'
  ));

  const result = await page.evaluate(async () => {
    const active = await window.R4b1tCorpusAuthority.loadActive();
    const foreignRevision = 'sha256:' + '0'.repeat(64);
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: '2026-09-27T00:00:00.000Z',
      corpus_revision: foreignRevision,
      seed: 'foreign-seed',
      terrain: 'ALL',
      routes: [{ url: 'https://example.org/foreign-route', action: 'ROLL' }],
      parent: null,
    });
    const envelope = await window.R4b1tTrail.envelope(manifest);
    await window.importTrailManifest(envelope);
    const replayed = await window.replayTrailManifest(0);

    let forkResult = 'accepted';
    try {
      await window.forkTrailManifest(1);
    } catch (error) {
      forkResult = String(error && error.message || error);
    }

    return {
      activeRevision: active.revision,
      foreignRevision,
      replayed,
      forkResult,
    };
  });

  expect(result.replayed).toBe('https://example.org/foreign-route');
  expect(result.foreignRevision).not.toBe(result.activeRevision);
  expect(result.forkResult).toMatch(/corpus revision mismatch/i);
});
