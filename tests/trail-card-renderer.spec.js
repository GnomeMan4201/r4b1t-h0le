'use strict';

const { test, expect } = require('@playwright/test');

const NOTICE = 'Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.';
const DIAGNOSTIC_NOTICE = 'THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.';

function verifiedTrailCard() {
  return {
    format: 'r4b1t-trail-card/v0.1',
    source: {
      artifact_format: 'r4b1t-trail/v0.2',
      artifact_digest: 'sha256:' + '1'.repeat(64),
    },
    verification: {
      state: 'VERIFIED',
      verified_digest: 'sha256:' + '1'.repeat(64),
      verified_at: '2026-09-19T16:40:00.000Z',
      verifier: 'r4b1t-blind-verifier/v0.2',
      reason: null,
    },
    display: {
      kind: 'trail',
      trail_id: 'sha256:' + '2'.repeat(64),
      manifest_format: 'r4b1t-trail/v0.2',
      genesis_id: 'sha256:' + '3'.repeat(64),
      stop_count: 2,
      concealed_count: 1,
      revealed_count: 1,
      parent: null,
      stops: [
        { index: 0, state: 'revealed' },
        { index: 1, state: 'concealed' },
      ],
    },
    notice: NOTICE,
  };
}

function rejectedCard() {
  return {
    format: 'r4b1t-trail-card/v0.1',
    source: {
      artifact_format: 'r4b1t-topology-export/v0.1',
      artifact_digest: 'sha256:' + '4'.repeat(64),
    },
    verification: {
      state: 'REJECTED',
      verified_digest: null,
      verified_at: '2026-09-19T16:41:00.000Z',
      verifier: 'r4b1t-topology-verifier/v0.1',
      reason: 'Topology node stop derivation mismatch',
    },
    display: null,
    notice: NOTICE,
    diagnostic_notice: DIAGNOSTIC_NOTICE,
  };
}

function parentAbsentCard() {
  return {
    format: 'r4b1t-trail-card/v0.1',
    source: {
      artifact_format: 'r4b1t-topology-export/v0.1',
      artifact_digest: 'sha256:' + '5'.repeat(64),
    },
    verification: {
      state: 'VERIFIED',
      verified_digest: 'sha256:' + '5'.repeat(64),
      verified_at: '2026-09-19T16:42:00.000Z',
      verifier: 'r4b1t-topology-verifier/v0.1',
      reason: null,
    },
    display: {
      kind: 'topology',
      node_count: 1,
      edge_count: 1,
      stop_count: 0,
      concealed_count: 0,
      revealed_count: 0,
      parent_absent_count: 1,
      branch_diagram: {
        nodes: [{
          trail_id: 'sha256:' + '6'.repeat(64),
          manifest_format: 'r4b1t-trail/v0.1',
          relationship_state: 'PARENT ABSENT',
          stop_count: 0,
          concealed_count: 0,
          revealed_count: 0,
          parent: {
            trail_id: 'sha256:' + '7'.repeat(64),
            fork_at: 0,
          },
        }],
        edges: [{
          from: 'sha256:' + '7'.repeat(64),
          to: 'sha256:' + '6'.repeat(64),
          fork_at: 0,
          relationship_state: 'PARENT ABSENT',
        }],
      },
    },
    notice: NOTICE,
  };
}

async function render(page, card) {
  await page.evaluate((value) => {
    const host = document.createElement('div');
    host.id = 'trailCardTestHost';
    document.body.prepend(host);
    window.R4b1tTrailCardRenderer.render(host, value);
  }, card);
}

test('Trail Card renderer loads without creating a card or mutating the shell', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  await expect(page.locator('.trail-card')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.R4b1tTrailCardRenderer.render)).toBe('function');
});

test('VERIFIED card renders deterministic textual and structural proof cues', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  const card = verifiedTrailCard();

  const serialized = await page.evaluate((value) => {
    const first = window.R4b1tTrailCardRenderer.serialize(value);
    const second = window.R4b1tTrailCardRenderer.serialize(value);
    return { first, second };
  }, card);
  expect(serialized.first).toBe(serialized.second);

  await render(page, card);
  const root = page.locator('.trail-card');
  await expect(root).toHaveAttribute('data-proof-state', 'VERIFIED');
  await expect(root).toHaveAttribute('aria-label', 'Trail Card — VERIFIED');
  await expect(root.locator('.trail-card-state')).toHaveText('VERIFIED');
  await expect(root.locator('.trail-card-state-marker')).toHaveText('✓');
  await expect(root.locator('.trail-card-stop-concealed')).toHaveCount(1);
  await expect(root).toContainText('CONCEALED');
  await expect(root).toContainText(NOTICE);
});

test('REJECTED card uses a structurally distinct diagnostic layout', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  await render(page, rejectedCard());

  const root = page.locator('.trail-card');
  await expect(root).toHaveAttribute('data-proof-state', 'REJECTED');
  await expect(root.locator('.trail-card-body-diagnostic')).toHaveCount(1);
  await expect(root.locator('.trail-card-display')).toHaveCount(0);
  await expect(root.locator('.trail-card-diagnostic-title')).toHaveText(DIAGNOSTIC_NOTICE);
  await expect(root).toContainText('Topology node stop derivation mismatch');
  await expect(root).toContainText('CONFIRMED DIGEST');
  await expect(root).toContainText('NONE');
});

test('proof state remains legible without stylesheet or color information', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  await render(page, rejectedCard());

  await page.evaluate(() => {
    document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());
    document.querySelectorAll('style').forEach((node) => node.remove());
  });

  const root = page.locator('.trail-card');
  await expect(root).toContainText('REJECTED');
  await expect(root).toContainText(DIAGNOSTIC_NOTICE);
  await expect(root).toContainText('Topology node stop derivation mismatch');
});

test('PARENT ABSENT remains a relationship cue inside a VERIFIED card', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  await render(page, parentAbsentCard());

  const root = page.locator('.trail-card');
  await expect(root).toHaveAttribute('data-proof-state', 'VERIFIED');
  const branch = root.locator('.trail-card-branch');
  await expect(branch).toHaveAttribute('data-relationship-state', 'PARENT ABSENT');
  await expect(branch.locator('.trail-card-relationship-state')).toHaveText('PARENT ABSENT');
  await expect(root).toContainText('PARENT ABSENT');
});

test('concealed card presentation cannot leak route identity because renderer consumes projection fields only', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  const card = verifiedTrailCard();
  card.untrusted_extra = { url: 'https://secret.invalid/leak' };
  await render(page, card);

  const html = await page.locator('#trailCardTestHost').innerHTML();
  expect(html).not.toContain('secret.invalid');
  expect(html).not.toContain('url');
  expect(html).toContain('CONCEALED');
});

test('card is keyboard focusable and exposes its state in the accessible name', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  await render(page, verifiedTrailCard());

  const root = page.locator('.trail-card');
  await root.focus();
  await expect(root).toBeFocused();
  await expect(root).toHaveAttribute('tabindex', '0');
  await expect(root).toHaveAttribute('aria-label', 'Trail Card — VERIFIED');
});

test('Trail Card renderer stays inside the mobile viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile-only layout assertion');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardRenderer);
  await render(page, parentAbsentCard());

  const overflow = await page.evaluate(() => {
    const card = document.querySelector('.trail-card');
    return card.getBoundingClientRect().right > window.innerWidth || card.scrollWidth > card.clientWidth;
  });
  expect(overflow).toBe(false);
});

test('renderer source contains no verification, persistence, sharing, network, or selection hooks', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const source = await page.evaluate(async () => (await fetch('./trail-card-renderer.js')).text());
  for (const forbidden of [
    'verifyExport(',
    '.verify(',
    'localStorage',
    'sessionStorage',
    'navigator.share',
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'sampler',
    'selection_weight',
    'popularity',
    'engagement',
    'recommendation',
  ]) {
    expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
});
