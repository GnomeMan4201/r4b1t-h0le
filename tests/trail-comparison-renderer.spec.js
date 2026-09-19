'use strict';

const { test, expect } = require('@playwright/test');

const NOTICE = 'Comparison describes two independently verified source artifacts identified by their digests. It does not replace either source artifact. Re-verify both sources to confirm current validity.';
const DIAGNOSTIC = 'THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.';

function verifiedComparison() {
  return {
    format: 'r4b1t-trail-comparison/v0.1',
    sources: {
      left: { artifact_format: 'r4b1t-trail/v0.2', artifact_digest: 'sha256:' + '1'.repeat(64) },
      right: { artifact_format: 'r4b1t-trail/v0.2', artifact_digest: 'sha256:' + '2'.repeat(64) },
    },
    verification: {
      left: { state: 'VERIFIED', verified_digest: 'sha256:' + '1'.repeat(64), verified_at: '2026-09-19T22:40:00.000Z', verifier: 'r4b1t-blind-verifier/v0.2', reason: null },
      right: { state: 'VERIFIED', verified_digest: 'sha256:' + '2'.repeat(64), verified_at: '2026-09-19T22:40:00.000Z', verifier: 'r4b1t-blind-verifier/v0.2', reason: null },
    },
    comparison: {
      left_trail_id: 'sha256:' + 'a'.repeat(64),
      right_trail_id: 'sha256:' + 'b'.repeat(64),
      lineage_state: 'SHARED_ANCESTRY_NOT_PROVEN',
      direct_fork_at: null,
      shared_prefix_length: 1,
      first_divergence_index: 1,
      left_stop_count: 3,
      right_stop_count: 3,
      positions: [
        {
          index: 0,
          state: 'MATCH_REVEALED',
          left: { state: 'REVEALED', route_id: 'sha256:' + '3'.repeat(64), commitment: null },
          right: { state: 'REVEALED', route_id: 'sha256:' + '3'.repeat(64), commitment: null },
        },
        {
          index: 1,
          state: 'LEFT_CONCEALED',
          left: { state: 'CONCEALED', route_id: null, commitment: 'sha256:' + '4'.repeat(64) },
          right: { state: 'REVEALED', route_id: 'sha256:' + '5'.repeat(64), commitment: 'sha256:' + '6'.repeat(64) },
        },
        {
          index: 2,
          state: 'BOTH_CONCEALED_DIFFERENT_COMMITMENT',
          left: { state: 'CONCEALED', route_id: null, commitment: 'sha256:' + '7'.repeat(64) },
          right: { state: 'CONCEALED', route_id: null, commitment: 'sha256:' + '8'.repeat(64) },
        },
      ],
    },
    notice: NOTICE,
  };
}

function diagnosticComparison() {
  return {
    format: 'r4b1t-trail-comparison/v0.1',
    sources: {
      left: { artifact_format: 'r4b1t-trail/v0.1', artifact_digest: 'sha256:' + '9'.repeat(64) },
      right: { artifact_format: 'r4b1t-trail/v9.9', artifact_digest: 'sha256:' + '0'.repeat(64) },
    },
    verification: {
      left: { state: 'VERIFIED', verified_digest: 'sha256:' + '9'.repeat(64), verified_at: '2026-09-19T22:41:00.000Z', verifier: 'r4b1t-trail-verifier/v0.1', reason: null },
      right: { state: 'UNVERIFIED', verified_digest: null, verified_at: null, verifier: 'r4b1t-comparison-verifier/v0.1', reason: 'Unsupported source artifact format' },
    },
    comparison: null,
    notice: NOTICE,
    diagnostic_notice: DIAGNOSTIC,
  };
}

async function render(page, projection) {
  await page.evaluate((value) => {
    const host = document.createElement('div');
    host.id = 'comparisonTestHost';
    document.body.prepend(host);
    window.R4b1tTrailComparisonRenderer.render(host, value);
  }, projection);
}

test('comparison renderer loads without auto-mounting or changing the shell', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonRenderer);
  await expect(page.locator('.trail-comparison')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.R4b1tTrailComparisonRenderer.render)).toBe('function');
});

test('verified comparison renders deterministic structural divergence facts', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonRenderer);
  const value = verifiedComparison();

  const serialized = await page.evaluate((projection) => ({
    first: window.R4b1tTrailComparisonRenderer.serialize(projection),
    second: window.R4b1tTrailComparisonRenderer.serialize(projection),
  }), value);
  expect(serialized.first).toBe(serialized.second);

  await render(page, value);
  const root = page.locator('.trail-comparison');
  await expect(root).toHaveAttribute('data-comparison-state', 'VERIFIED');
  await expect(root).toHaveAttribute('aria-label', 'Trail Comparison — VERIFIED');
  await expect(root).toContainText('SHARED_ANCESTRY_NOT_PROVEN');
  await expect(root).toContainText('SHARED PREFIX');
  await expect(root).toContainText('FIRST DIVERGENCE');
  await expect(root.locator('.trail-comparison-position')).toHaveCount(3);
  await expect(root.locator('[data-position-state="LEFT_CONCEALED"]')).toHaveCount(1);
  await expect(root.locator('[data-position-state="BOTH_CONCEALED_DIFFERENT_COMMITMENT"]')).toHaveCount(1);
  await expect(root).toContainText(NOTICE);
});

test('renderer shows both source digests and verification states textually', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonRenderer);
  await render(page, verifiedComparison());

  const root = page.locator('.trail-comparison');
  await expect(root.locator('.trail-comparison-source')).toHaveCount(2);
  await expect(root).toContainText('LEFT');
  await expect(root).toContainText('RIGHT');
  await expect(root).toContainText('VERIFIED');
  await expect(root).toContainText('sha256:111111111111…11111111');
  await expect(root).toContainText('sha256:222222222222…22222222');
});

test('diagnostic comparison is structurally distinct and emits no divergence facts', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonRenderer);
  await render(page, diagnosticComparison());

  const root = page.locator('.trail-comparison');
  await expect(root).toHaveAttribute('data-comparison-state', 'DIAGNOSTIC');
  await expect(root.locator('.trail-comparison-diagnostic')).toHaveCount(1);
  await expect(root.locator('.trail-comparison-positions')).toHaveCount(0);
  await expect(root).toContainText(DIAGNOSTIC);
  await expect(root).toContainText('Unsupported source artifact format');
  await expect(root).not.toContainText('SHARED PREFIX');
  await expect(root).not.toContainText('FIRST DIVERGENCE');
});

test('concealed sides never render route identity', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonRenderer);
  await render(page, verifiedComparison());

  const concealed = page.locator('.trail-comparison-side[data-side-state="CONCEALED"]');
  await expect(concealed).toHaveCount(3);
  for (let i = 0; i < await concealed.count(); i += 1) {
    await expect(concealed.nth(i)).toContainText('CONCEALED');
    await expect(concealed.nth(i)).not.toContainText('ROUTE');
  }
});

test('comparison semantics remain legible with styles removed', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonRenderer);
  await render(page, verifiedComparison());
  await page.evaluate(() => {
    document.querySelectorAll('link[rel="stylesheet"],style').forEach((node) => node.remove());
  });

  const root = page.locator('.trail-comparison');
  await expect(root).toContainText('VERIFIED');
  await expect(root).toContainText('MATCH_REVEALED');
  await expect(root).toContainText('LEFT_CONCEALED');
  await expect(root).toContainText('BOTH_CONCEALED_DIFFERENT_COMMITMENT');
});

test('comparison renderer is keyboard focusable and mobile-safe', async ({ page }, testInfo) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailComparisonRenderer);
  await render(page, verifiedComparison());

  const root = page.locator('.trail-comparison');
  await root.focus();
  await expect(root).toBeFocused();

  if (testInfo.project.name.startsWith('mobile')) {
    const overflow = await page.evaluate(() => {
      const node = document.querySelector('.trail-comparison');
      return node.getBoundingClientRect().right > window.innerWidth || node.scrollWidth > node.clientWidth;
    });
    expect(overflow).toBe(false);
  }
});

test('renderer source contains no verification, persistence, network, ranking, or selection hooks', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const source = await page.evaluate(async () => (await fetch('./trail-comparison-renderer.js')).text());

  for (const forbidden of [
    'trail.verify(', 'blind.verify(', 'verifyLineage(', 'localStorage', 'sessionStorage',
    'XMLHttpRequest', 'WebSocket', 'EventSource', 'createSampler(', 'nextFloat(',
    'selection_weight', 'sampler_weight', 'popularity', 'engagement', 'recommendation',
    'rankRoutes(', 'triggerSprout('
  ]) {
    expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
});
