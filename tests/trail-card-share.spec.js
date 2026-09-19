'use strict';

const { test, expect } = require('@playwright/test');

async function loadShare(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: './trail-card-share.js' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);
}

async function makePair(page, state) {
  return page.evaluate(async (proofState) => {
    const text = JSON.stringify({ format: 'r4b1t-trail/v0.1', example: 'handoff' });
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const digest = 'sha256:' + Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
    return {
      source_bytes: Array.from(bytes),
      card: {
        format: 'r4b1t-trail-card/v0.1',
        source: { artifact_format: 'r4b1t-trail/v0.1', artifact_digest: digest },
        verification: {
          state: proofState,
          verified_digest: proofState === 'VERIFIED' ? digest : null,
          verified_at: proofState === 'UNVERIFIED' ? null : '2026-09-19T18:00:00.000Z',
          verifier: 'test-verifier/v0.1',
          reason: proofState === 'VERIFIED' ? null : 'test diagnostic',
        },
        display: proofState === 'VERIFIED' ? {
          kind: 'trail',
          trail_id: 'sha256:' + 'a'.repeat(64),
          manifest_format: 'r4b1t-trail/v0.1',
          genesis_id: null,
          stop_count: 0,
          concealed_count: 0,
          revealed_count: 0,
          parent: null,
          stops: [],
        } : null,
        notice: 'Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.',
        ...(proofState === 'VERIFIED' ? {} : { diagnostic_notice: 'THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.' }),
      },
    };
  }, state).then((pair) => ({
    source_bytes: Uint8Array.from(pair.source_bytes),
    card: pair.card,
  }));
}

test('handoff validates exact source/card digest binding and emits only the three portable bundle files', async ({ page }) => {
  await loadShare(page);
  const pair = await makePair(page, 'VERIFIED');
  const result = await page.evaluate(async ({ source, card }) => {
    const files = await window.R4b1tTrailCardShare.bundleFiles({
      source_bytes: Uint8Array.from(source),
      card,
    });
    return files.map((file) => ({ name: file.name, text: new TextDecoder().decode(file.bytes) }));
  }, { source: Array.from(pair.source_bytes), card: pair.card });

  expect(result.map((x) => x.name)).toEqual(['source.json', 'trail-card.json', 'README.txt']);
  expect(result[0].text).toBe(JSON.stringify({ format: 'r4b1t-trail/v0.1', example: 'handoff' }));
  expect(result[2].text).toContain('Evidence authority: source.json');
  expect(result[2].text).toContain('creates no server-side share record');
});

test('tampered source cannot be exported or shared', async ({ page }) => {
  await loadShare(page);
  const pair = await makePair(page, 'VERIFIED');
  pair.source_bytes = new Uint8Array([...pair.source_bytes, 32]);

  const message = await page.evaluate(async ({ source, card }) => {
    try {
      await window.R4b1tTrailCardShare.bundleFiles({
        source_bytes: Uint8Array.from(source),
        card,
      });
      return 'unexpected-success';
    } catch (error) {
      return error.message;
    }
  }, { source: Array.from(pair.source_bytes), card: pair.card });

  expect(message).toMatch(/source digest mismatch/);
});

test('diagnostic cards remain diagnostic through handoff and are never upgraded', async ({ page }) => {
  await loadShare(page);
  const pair = await makePair(page, 'REJECTED');
  await page.evaluate(({ source, card }) => {
    const host = document.createElement('div');
    host.id = 'handoff-host';
    document.body.prepend(host);
    window.R4b1tTrailCardShare.mount(host, {
      source_bytes: Uint8Array.from(source),
      card,
    });
  }, { source: Array.from(pair.source_bytes), card: pair.card });

  const root = page.locator('.trail-card-handoff');
  await expect(root).toHaveAttribute('data-proof-state', 'REJECTED');
  await expect(root).toContainText('POINT-TO-POINT HANDOFF — REJECTED');

  const stored = await page.evaluate(async ({ source, card }) => {
    const files = await window.R4b1tTrailCardShare.bundleFiles({ source_bytes: Uint8Array.from(source), card });
    return JSON.parse(new TextDecoder().decode(files.find((x) => x.name === 'trail-card.json').bytes));
  }, { source: Array.from(pair.source_bytes), card: pair.card });

  expect(stored.verification.state).toBe('REJECTED');
  expect(stored.verification.verified_digest).toBeNull();
  expect(stored.display).toBeNull();
});

test('share action creates no network request or persistent share history', async ({ page }) => {
  await loadShare(page);
  const pair = await makePair(page, 'VERIFIED');

  const requests = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.evaluate(({ source, card }) => {
    const writes = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      writes.push([key, value]);
      return original.call(this, key, value);
    };
    window.__handoffStorageWrites = writes;
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const host = document.createElement('div');
    host.id = 'handoff-host';
    document.body.prepend(host);
    window.R4b1tTrailCardShare.mount(host, { source_bytes: Uint8Array.from(source), card });
  }, { source: Array.from(pair.source_bytes), card: pair.card });

  await page.getByRole('button', { name: 'Share directly' }).click();
  await expect(page.getByRole('status')).toContainText('Local download fallback ready');
  await expect(page.locator('.trail-card-handoff-downloads button')).toHaveCount(3);

  expect(await page.evaluate(() => window.__handoffStorageWrites)).toEqual([]);
  expect(requests).toEqual([]);
  await expect(page.locator('.trail-card-handoff')).toHaveCount(1);
  await expect(page.locator('[class*="recent-share"],[class*="gallery"],[class*="feed"],[class*="trending"]')).toHaveCount(0);
});

test('platform share receives only the point-to-point files when supported', async ({ page }) => {
  await loadShare(page);
  const pair = await makePair(page, 'VERIFIED');

  const payload = await page.evaluate(async ({ source, card }) => {
    let captured = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (value) => {
        captured = {
          title: value.title,
          text: value.text,
          names: value.files.map((file) => file.name),
        };
      },
    });
    const result = await window.R4b1tTrailCardShare.share({
      source_bytes: Uint8Array.from(source),
      card,
    });
    return { result, captured };
  }, { source: Array.from(pair.source_bytes), card: pair.card });

  expect(payload.result.shared).toBe(true);
  expect(payload.captured.names).toEqual(['source.json', 'trail-card.json', 'README.txt']);
  expect(payload.captured.text).toContain('Re-verify source.json locally');
});

test('handoff controls are keyboard reachable and mobile fallback stays within viewport', async ({ page }, testInfo) => {
  await loadShare(page);
  const pair = await makePair(page, 'VERIFIED');
  await page.evaluate(({ source, card }) => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const host = document.createElement('div');
    document.body.prepend(host);
    window.R4b1tTrailCardShare.mount(host, { source_bytes: Uint8Array.from(source), card });
  }, { source: Array.from(pair.source_bytes), card: pair.card });

  const exportButton = page.getByRole('button', { name: 'Export bundle' });
  await exportButton.focus();
  await expect(exportButton).toBeFocused();
  await exportButton.press('Enter');
  await expect(page.locator('.trail-card-handoff-downloads button')).toHaveCount(3);

  if (testInfo.project.name.startsWith('mobile')) {
    const overflow = await page.evaluate(() => {
      const root = document.querySelector('.trail-card-handoff');
      return root.getBoundingClientRect().right > window.innerWidth || root.scrollWidth > root.clientWidth;
    });
    expect(overflow).toBe(false);
  }
});

test('handoff implementation contains no persistence, telemetry, ranking, discovery, or selection hooks', async ({ page }) => {
  await loadShare(page);
  const source = await page.evaluate(async () => (await fetch('./trail-card-share.js')).text());
  for (const forbidden of [
    'localStorage',
    'sessionStorage',
    'XMLHttpRequest',
    'WebSocket',
    'view_count',
    'like_count',
    'follower',
    'trending',
    'popularity',
    'recommendation',
    'sampler',
    'selection_weight',
    'share_history',
    'recent_shares',
  ]) {
    expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
});
