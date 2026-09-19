'use strict';

const { test, expect } = require('@playwright/test');

const NOTICE = 'Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.';

function bundle() {
  const digest = 'sha256:' + 'a'.repeat(64);
  const card = {
    format: 'r4b1t-trail-card/v0.1',
    source: {
      artifact_format: 'r4b1t-trail/v0.1',
      artifact_digest: digest,
    },
    verification: {
      state: 'VERIFIED',
      verified_digest: digest,
      verified_at: '2026-09-19T18:00:00.000Z',
      verifier: 'r4b1t-trail-verifier/v0.1',
      reason: null,
    },
    display: {
      kind: 'trail',
      trail_id: 'sha256:' + 'b'.repeat(64),
      manifest_format: 'r4b1t-trail/v0.1',
      genesis_id: null,
      stop_count: 0,
      concealed_count: 0,
      revealed_count: 0,
      parent: null,
      stops: [],
    },
    notice: NOTICE,
  };

  return {
    card,
    files: {
      'source.json': new TextEncoder().encode('{"example":true}\n'),
      'trail-card.json': new TextEncoder().encode(JSON.stringify(card) + '\n'),
      'README.txt': new TextEncoder().encode('presentation only\n'),
    },
  };
}

test('Trail Card handoff module loads without creating share UI', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);
  await expect(page.locator('.trail-card-handoff')).toHaveCount(0);
});

test('handoff controls expose only download, copy digest, and platform share', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  await page.evaluate((value) => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {},
    });
    const host = document.createElement('div');
    host.id = 'handoffHost';
    document.body.prepend(host);
    window.R4b1tTrailCardShare.controls(host, value);
  }, bundle());

  const labels = await page.locator('.trail-card-handoff-button').allTextContents();
  expect(labels).toEqual(['DOWNLOAD BUNDLE', 'COPY DIGEST', 'SHARE BUNDLE']);
});

test('download handoff creates exactly the three permitted bundle files', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  const result = await page.evaluate((value) => {
    const clicked = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;

    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {
      clicked.push(this.download);
    };

    try {
      const names = window.R4b1tTrailCardShare.download(value);
      return { names, clicked };
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  }, bundle());

  expect(result.names).toEqual(['README.txt', 'source.json', 'trail-card.json']);
  expect(result.clicked).toEqual(['README.txt', 'source.json', 'trail-card.json']);
});

test('copy digest copies only the canonical source digest', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  const copied = await page.evaluate(async (value) => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { captured = text; } },
    });
    const result = await window.R4b1tTrailCardShare.copyDigest(value);
    return { captured, result };
  }, bundle());

  expect(copied.result).toBe('sha256:' + 'a'.repeat(64));
  expect(copied.captured).toBe(copied.result);
});

test('platform share sends only the portable bundle files to the share sheet', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  const result = await page.evaluate(async (value) => {
    let payload = null;
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: ({ files }) => files.length === 3,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (next) => { payload = next; },
    });

    const status = await window.R4b1tTrailCardShare.share(value);
    return {
      status,
      payload: {
        title: payload.title,
        text: payload.text,
        names: payload.files.map((file) => file.name).sort(),
      },
    };
  }, bundle());

  expect(result.status.status).toBe('shared');
  expect(result.status.files.sort()).toEqual(['README.txt', 'source.json', 'trail-card.json']);
  expect(result.payload.names).toEqual(['README.txt', 'source.json', 'trail-card.json']);
  expect(result.payload.text).toContain('Re-verify source.json independently.');
});

test('unsupported platform share fails closed without alternate distribution surface', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  const result = await page.evaluate(async (value) => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    return window.R4b1tTrailCardShare.share(value);
  }, bundle());

  expect(result).toEqual({ status: 'unsupported', files: [] });
});

test('handoff rejects files outside the frozen portable bundle set', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  const message = await page.evaluate((value) => {
    value.files['recent-shares.json'] = new TextEncoder().encode('[]');
    try {
      window.R4b1tTrailCardShare.makeFiles(value);
      return null;
    } catch (error) {
      return error.message;
    }
  }, bundle());

  expect(message).toContain('unsupported file');
});

test('share controls are keyboard reachable and expose live status', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  await page.evaluate((value) => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    const host = document.createElement('div');
    document.body.prepend(host);
    window.R4b1tTrailCardShare.controls(host, value);
  }, bundle());

  const first = page.locator('.trail-card-handoff-button').first();
  await first.focus();
  await expect(first).toBeFocused();
  await expect(page.locator('.trail-card-handoff-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('.trail-card-handoff-status')).toHaveAttribute('aria-live', 'polite');
});

test('handoff source has no history, gallery, telemetry, account, ranking, or selection machinery', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const source = await page.evaluate(async () => (await fetch('./trail-card-share.js')).text());
  const lowered = source.toLowerCase();

  for (const forbidden of [
    'localstorage',
    'sessionstorage',
    'indexeddb',
    'recent shares',
    'share history',
    'gallery',
    'view_count',
    'view count',
    'like_count',
    'like count',
    'trending',
    'followers',
    'following',
    'analytics',
    'telemetry',
    'beacon',
    'account',
    'login',
    'popularity',
    'recommendation',
    'selection_weight',
    'sampler',
  ]) {
    expect(lowered).not.toContain(forbidden);
  }
});

test('handoff controls stay inside the mobile viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile-only assertion');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);

  await page.evaluate((value) => {
    const host = document.createElement('div');
    document.body.prepend(host);
    window.R4b1tTrailCardShare.controls(host, value);
  }, bundle());

  const overflow = await page.evaluate(() => {
    const controls = document.querySelector('.trail-card-handoff');
    return controls.getBoundingClientRect().right > window.innerWidth || controls.scrollWidth > controls.clientWidth;
  });
  expect(overflow).toBe(false);
});
