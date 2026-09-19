'use strict';

const { test, expect } = require('@playwright/test');

const NOTICE = 'Proof Session organizes independently verified source artifacts and derived comparison projections. It does not replace any source artifact. Re-verify sources and recompute comparisons to confirm current validity.';

function summary(counts) {
  const labels = [
    'SOURCES',
    'VERIFIED',
    'REJECTED',
    'UNVERIFIED',
    'VERIFIED PAIRS',
    'DIRECT RELATIONSHIPS',
    'DIVERGENT PAIRS',
    'IDENTICAL TRAIL PAIRS',
    'SHARED PREFIX ONLY PAIRS',
    'NO SHARED PREFIX PAIRS'
  ];
  return labels.map((label) => ({ label, count: counts[label] || 0 }));
}

function source(slot, digestChar, state, options = {}) {
  const digest = 'sha256:' + digestChar.repeat(64);
  const verified = state === 'VERIFIED';
  return {
    slot_id: slot,
    artifact_format: options.format || (state === 'UNVERIFIED' ? 'r4b1t-trail/v9.9' : 'r4b1t-trail/v0.1'),
    artifact_digest: digest,
    canonical_trail_id: verified ? 'sha256:' + (options.trailChar || digestChar).repeat(64) : null,
    supplied_count: options.supplied_count || 1,
    verification: {
      state,
      verified_digest: verified ? digest : null,
      verified_at: state === 'UNVERIFIED' ? null : '2026-09-19T23:50:00.000Z',
      verifier: options.verifier || (state === 'UNVERIFIED' ? 'r4b1t-proof-session-verifier/v0.1' : 'r4b1t-trail-verifier/v0.1'),
      reason: verified ? null : (options.reason || (state === 'REJECTED' ? 'Canonical verification failed' : 'Unsupported source artifact format')),
    },
  };
}

function verifiedProjection() {
  return {
    format: 'r4b1t-proof-session/v0.1',
    sources: [
      source('S1', '1', 'VERIFIED', { trailChar: 'a' }),
      source('S2', '2', 'VERIFIED', { trailChar: 'b' }),
      source('S3', '3', 'VERIFIED', { trailChar: 'c' }),
    ],
    pairs: [
      { left_slot: 'S1', right_slot: 'S2', comparison_format: 'r4b1t-trail-comparison/v0.1', comparison_projection_digest: 'sha256:' + '4'.repeat(64) },
      { left_slot: 'S1', right_slot: 'S3', comparison_format: 'r4b1t-trail-comparison/v0.1', comparison_projection_digest: 'sha256:' + '5'.repeat(64) },
      { left_slot: 'S2', right_slot: 'S3', comparison_format: 'r4b1t-trail-comparison/v0.1', comparison_projection_digest: 'sha256:' + '6'.repeat(64) },
    ],
    relationships: [
      { type: 'DIRECT_PARENT', parent_slot: 'S1', child_slot: 'S2', comparison_projection_digest: 'sha256:' + '4'.repeat(64) },
      { type: 'DIRECT_PARENT', parent_slot: 'S2', child_slot: 'S3', comparison_projection_digest: 'sha256:' + '6'.repeat(64) },
    ],
    summary: summary({
      SOURCES: 3,
      VERIFIED: 3,
      'VERIFIED PAIRS': 3,
      'DIRECT RELATIONSHIPS': 2,
      'DIVERGENT PAIRS': 2,
      'SHARED PREFIX ONLY PAIRS': 1,
    }),
    notice: NOTICE,
  };
}

function diagnosticProjection() {
  return {
    format: 'r4b1t-proof-session/v0.1',
    sources: [
      source('S1', '7', 'VERIFIED'),
      source('S2', '8', 'REJECTED'),
      source('S3', '9', 'UNVERIFIED'),
    ],
    pairs: [],
    relationships: [],
    summary: summary({
      SOURCES: 3,
      VERIFIED: 1,
      REJECTED: 1,
      UNVERIFIED: 1,
    }),
    notice: NOTICE,
  };
}

async function render(page, projection) {
  await page.evaluate((value) => {
    const host = document.createElement('div');
    host.id = 'proofSessionTestHost';
    document.body.prepend(host);
    window.R4b1tProofSessionRenderer.render(host, value);
  }, projection);
}

test('Proof Sessions renderer loads without auto-mounting or changing the shell', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  await expect(page.locator('.proof-session')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.R4b1tProofSessionRenderer.render)).toBe('function');
});

test('renderer is deterministic and displays the closed summary vocabulary in order', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  const value = verifiedProjection();

  const serialized = await page.evaluate((projection) => ({
    first: window.R4b1tProofSessionRenderer.serialize(projection),
    second: window.R4b1tProofSessionRenderer.serialize(projection),
  }), value);
  expect(serialized.first).toBe(serialized.second);

  await render(page, value);
  const labels = await page.locator('.proof-session-summary-label').allTextContents();
  expect(labels).toEqual([
    'SOURCES',
    'VERIFIED',
    'REJECTED',
    'UNVERIFIED',
    'VERIFIED PAIRS',
    'DIRECT RELATIONSHIPS',
    'DIVERGENT PAIRS',
    'IDENTICAL TRAIL PAIRS',
    'SHARED PREFIX ONLY PAIRS',
    'NO SHARED PREFIX PAIRS',
  ]);
});

test('verified sources and diagnostic sources are structurally distinct and textual', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  await render(page, diagnosticProjection());

  const root = page.locator('.proof-session');
  await expect(root.locator('.proof-session-source[data-proof-state="VERIFIED"]')).toHaveCount(1);
  await expect(root.locator('.proof-session-diagnostic-source[data-proof-state="REJECTED"]')).toHaveCount(1);
  await expect(root.locator('.proof-session-diagnostic-source[data-proof-state="UNVERIFIED"]')).toHaveCount(1);
  await expect(root).toContainText('REJECTED');
  await expect(root).toContainText('UNVERIFIED');
  await expect(root).toContainText('Canonical verification failed');
  await expect(root).toContainText('Unsupported source artifact format');
});

test('relationship graph renders only supplied direct parent edges and never manufactures transitive edge', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  await render(page, verifiedProjection());

  const edges = page.locator('.proof-session-relationship');
  await expect(edges).toHaveCount(2);
  await expect(page.locator('[data-parent-slot="S1"][data-child-slot="S2"]')).toHaveCount(1);
  await expect(page.locator('[data-parent-slot="S2"][data-child-slot="S3"]')).toHaveCount(1);
  await expect(page.locator('[data-parent-slot="S1"][data-child-slot="S3"]')).toHaveCount(0);
  await expect(page.locator('.proof-session-relationships')).toContainText('DIRECT PARENT');
});

test('pair list renders digest-bound references without inventing comparison semantics', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  await render(page, verifiedProjection());

  const pairs = page.locator('.proof-session-pair');
  await expect(pairs).toHaveCount(3);
  await expect(pairs.nth(0)).toContainText('S1');
  await expect(pairs.nth(0)).toContainText('S2');
  await expect(pairs.nth(0)).toContainText('r4b1t-trail-comparison/v0.1');

  const text = await page.locator('.proof-session').innerText();
  for (const forbidden of ['FIRST DIVERGENCE INDEX', 'SIMILARITY', 'WINNER', 'RECOMMENDED']) {
    expect(text.toUpperCase()).not.toContain(forbidden);
  }
});

test('source blocks expose digest, format, multiplicity, and canonical identity without URLs', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  const value = verifiedProjection();
  value.sources[0].supplied_count = 2;
  await render(page, value);

  const s1 = page.locator('[data-source-slot="S1"]');
  await expect(s1).toContainText('VERIFIED');
  await expect(s1).toContainText('r4b1t-trail/v0.1');
  await expect(s1).toContainText('SUPPLIED');
  await expect(s1).toContainText('2');
  await expect(s1).toContainText('TRAIL');
  expect((await s1.innerText()).includes('https://')).toBe(false);
});

test('renderer remains usable at phone width with no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  await render(page, verifiedProjection());

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  await expect(page.locator('.proof-session')).toHaveAttribute('tabindex', '0');
});

test('renderer rejects invalid projections instead of presenting unvalidated session facts', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tProofSessionRenderer);
  const invalid = verifiedProjection();
  invalid.summary[0].label = 'BEST SOURCE';

  const message = await page.evaluate((projection) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      window.R4b1tProofSessionRenderer.render(host, projection);
      return 'NO ERROR';
    } catch (error) {
      return error.message;
    }
  }, invalid);

  expect(message).toMatch(/summary/i);
  await expect(page.locator('.proof-session')).toHaveCount(0);
});
