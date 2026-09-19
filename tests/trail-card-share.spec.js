'use strict';

const { createHash } = require('node:crypto');
const { test, expect } = require('@playwright/test');

const trail = require('../trail-manifest.js');
const portableBundle = require('../trail-card-bundle.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);

async function sourceEnvelope() {
  const manifest = await trail.createManifest({
    created_at: '2026-09-19T18:00:00.000Z',
    corpus_revision: CORPUS,
    seed: 'point-to-point-handoff',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.org/handoff', action: 'ROLL' }],
    parent: null,
  });
  return trail.envelope(manifest);
}

async function bundle(state = 'VERIFIED') {
  let source;
  if (state === 'UNVERIFIED') {
    source = JSON.stringify({ format: 'unsupported-evidence/v9', value: true }) + '\n';
  } else {
    const envelope = await sourceEnvelope();
    if (state === 'REJECTED') envelope.manifest.routes[0].url = 'https://tampered.invalid/';
    source = JSON.stringify(envelope, null, 2) + '\n';
  }

  return portableBundle.create(source, {
    verified_at: '2026-09-19T18:01:00.000Z',
  });
}

async function loadShare(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrailCardShare);
}

test('valid fixture binds exact source bytes and stores the exact projected card', async () => {
  const value = await bundle();
  const sourceBytes = Buffer.from(value.files['source.json']);
  const storedCard = JSON.parse(Buffer.from(value.files['trail-card.json']).toString('utf8'));
  const exactDigest = 'sha256:' + createHash('sha256').update(sourceBytes).digest('hex');

  expect(value.card.verification.state).toBe('VERIFIED');
  expect(value.card.source.artifact_digest).toBe(exactDigest);
  expect(value.card.verification.verified_digest).toBe(exactDigest);
  expect(storedCard).toEqual(value.card);
  expect(Buffer.from(value.files['README.txt']).toString('utf8')).toContain('The Trail Card is not evidence authority.');
});

test('Trail Card handoff module loads without creating share UI', async ({ page }) => {
  await loadShare(page);
  await expect(page.locator('.trail-card-handoff')).toHaveCount(0);
});

test('production share-card button opens a user-reachable handoff UI', async ({ page }) => {
  await loadShare(page);

  const trigger = page.getByRole('button', { name: 'share card', exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const handoff = page.locator('.trail-card-handoff');
  await expect(handoff).toBeVisible();
  await expect(handoff.getByRole('button', { name: 'DOWNLOAD BUNDLE' })).toBeVisible();
  await expect(handoff.getByRole('button', { name: 'COPY DIGEST' })).toBeVisible();
  await expect(handoff.locator('button:focus')).toHaveCount(1);
  await expect(page.getByRole('feed')).toHaveCount(0);
  await expect(page.getByText(/recent shares/i)).toHaveCount(0);
});

test('handoff controls expose only download, copy digest, and optional platform share', async ({ page }) => {
  await loadShare(page);

  await page.evaluate(async (value) => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
    const host = document.createElement('div');
    host.id = 'handoffHost';
    document.body.prepend(host);
    window.R4b1tTrailCardShare.controls(host, value);
  }, await bundle());

  const labels = await page.locator('.trail-card-handoff-button').allTextContents();
  expect(labels).toEqual(['DOWNLOAD BUNDLE', 'COPY DIGEST', 'SHARE BUNDLE']);
});

test('download handoff creates exactly the three bound portable-bundle files', async ({ page }) => {
  await loadShare(page);

  const result = await page.evaluate(async (value) => {
    const clicked = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;

    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () { clicked.push(this.download); };

    try {
      const names = await window.R4b1tTrailCardShare.download(value);
      return { names, clicked };
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  }, await bundle());

  expect(result.names).toEqual(['README.txt', 'source.json', 'trail-card.json']);
  expect(result.clicked).toEqual(['README.txt', 'source.json', 'trail-card.json']);
});

test('copy digest copies only the canonical source digest', async ({ page }) => {
  await loadShare(page);
  const value = await bundle();

  const copied = await page.evaluate(async (input) => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { captured = text; } },
    });
    const result = await window.R4b1tTrailCardShare.copyDigest(input);
    return { captured, result };
  }, value);

  expect(copied.result).toBe(value.card.source.artifact_digest);
  expect(copied.captured).toBe(copied.result);
});

test('platform share sends only the exact portable bundle to the chosen share sheet', async ({ page }) => {
  await loadShare(page);

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
    const files = {};
    for (const file of payload.files) files[file.name] = await file.text();
    return {
      status,
      text: payload.text,
      names: payload.files.map((file) => file.name).sort(),
      files,
    };
  }, await bundle());

  expect(result.status.status).toBe('shared');
  expect(result.status.files.sort()).toEqual(['README.txt', 'source.json', 'trail-card.json']);
  expect(result.names).toEqual(['README.txt', 'source.json', 'trail-card.json']);
  expect(result.text).toContain('Re-verify source.json independently.');
  expect(JSON.parse(result.files['trail-card.json']).source.artifact_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
});

test('tampered source and mismatched card are rejected before every handoff side effect', async ({ page }) => {
  await loadShare(page);
  const valid = await bundle();

  const result = await page.evaluate(async (original) => {
    function copy(value) {
      return {
        card: JSON.parse(JSON.stringify(value.card)),
        files: Object.fromEntries(Object.entries(value.files).map(([name, bytes]) => [name, new Uint8Array(bytes)])),
      };
    }

    const tamperedSource = copy(original);
    tamperedSource.files['source.json'] = new TextEncoder().encode(
      new TextDecoder().decode(tamperedSource.files['source.json']) + ' ',
    );
    const mismatchedCard = copy(original);
    mismatchedCard.card.notice = 'edited presentation claim';

    const sideEffects = { downloads: 0, clipboard: 0, shares: 0 };
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = () => { sideEffects.downloads += 1; return 'blob:test'; };
    URL.revokeObjectURL = () => {};
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { sideEffects.clipboard += 1; } },
    });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { sideEffects.shares += 1; },
    });

    const errors = [];
    for (const candidate of [tamperedSource, mismatchedCard]) {
      for (const action of ['download', 'copyDigest', 'share']) {
        try {
          await window.R4b1tTrailCardShare[action](candidate);
          errors.push(null);
        } catch (error) {
          errors.push(error.message);
        }
      }
    }
    URL.createObjectURL = originalCreate;
    return { errors, sideEffects };
  }, valid);

  expect(result.errors).toHaveLength(6);
  for (const error of result.errors) expect(error).toMatch(/digest|card|bundle|source/i);
  expect(result.sideEffects).toEqual({ downloads: 0, clipboard: 0, shares: 0 });
});

test('README is mandatory for download, copy, and share', async ({ page }) => {
  await loadShare(page);
  const result = await page.evaluate(async (value) => {
    delete value.files['README.txt'];
    const errors = [];
    for (const action of ['download', 'copyDigest', 'share']) {
      try {
        await window.R4b1tTrailCardShare[action](value);
        errors.push(null);
      } catch (error) {
        errors.push(error.message);
      }
    }
    return errors;
  }, await bundle());

  for (const error of result) expect(error).toMatch(/missing|required|README/i);
});

for (const state of ['REJECTED', 'UNVERIFIED']) {
  test(`${state} cards remain diagnostic through point-to-point sharing`, async ({ page }) => {
    await loadShare(page);
    const value = await bundle(state);
    expect(value.card.verification.state).toBe(state);
    expect(value.card.display).toBeNull();

    const sharedCard = await page.evaluate(async (input) => {
      let payload;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (next) => { payload = next; },
      });
      await window.R4b1tTrailCardShare.share(input);
      const file = payload.files.find((candidate) => candidate.name === 'trail-card.json');
      return JSON.parse(await file.text());
    }, value);

    expect(sharedCard.verification.state).toBe(state);
    expect(sharedCard.display).toBeNull();
    expect(sharedCard.diagnostic_notice).toBe('THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.');
  });
}

test('handoff actions issue no network request and create no share history', async ({ page }) => {
  await loadShare(page);

  const result = await page.evaluate(async (value) => {
    const before = {
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
    };
    const network = [];
    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalCreate = URL.createObjectURL;

    window.fetch = (...args) => { network.push(['fetch', String(args[0])]); return Promise.reject(new Error('blocked')); };
    XMLHttpRequest.prototype.open = function (method, url) { network.push(['xhr', String(url)]); };
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: (url) => { network.push(['beacon', String(url)]); return false; },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} },
    });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {};

    try {
      await window.R4b1tTrailCardShare.download(value);
      await window.R4b1tTrailCardShare.copyDigest(value);
      await window.R4b1tTrailCardShare.share(value);
    } finally {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
      URL.createObjectURL = originalCreate;
      HTMLAnchorElement.prototype.click = originalClick;
    }

    return {
      network,
      before,
      after: {
        local: JSON.stringify({ ...localStorage }),
        session: JSON.stringify({ ...sessionStorage }),
      },
    };
  }, await bundle());

  expect(result.network).toEqual([]);
  expect(result.after).toEqual(result.before);
});

test('unsupported platform share fails closed without alternate distribution surface', async ({ page }) => {
  await loadShare(page);

  const result = await page.evaluate(async (value) => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    return window.R4b1tTrailCardShare.share(value);
  }, await bundle());

  expect(result).toEqual({ status: 'unsupported', files: [] });
});

test('handoff rejects files outside the frozen portable bundle set', async ({ page }) => {
  await loadShare(page);

  const message = await page.evaluate(async (value) => {
    value.files['recent-shares.json'] = new TextEncoder().encode('[]');
    try {
      await window.R4b1tTrailCardShare.makeFiles(value);
      return null;
    } catch (error) {
      return error.message;
    }
  }, await bundle());

  expect(message).toContain('unsupported file');
});

test('handoff controls have accessible names, status semantics, and keyboard focus order', async ({ page }) => {
  await loadShare(page);

  await page.evaluate(async (value) => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const host = document.createElement('div');
    document.body.prepend(host);
    window.R4b1tTrailCardShare.controls(host, value);
  }, await bundle());

  const handoff = page.locator('.trail-card-handoff');
  await expect(handoff).toHaveAccessibleName('Trail Card handoff');
  const download = handoff.getByRole('button', { name: 'DOWNLOAD BUNDLE' });
  const copy = handoff.getByRole('button', { name: 'COPY DIGEST' });
  await download.focus();
  await expect(download).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(copy).toBeFocused();
  await expect(page.locator('.trail-card-handoff-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('.trail-card-handoff-status')).toHaveAttribute('aria-live', 'polite');
});

test('handoff source has no history, gallery, telemetry, account, ranking, or selection machinery', async ({ page }) => {
  await loadShare(page);
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

test('mobile without Web Share still exposes download and copy fallback', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile-only assertion');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await loadShare(page);

  await page.getByRole('button', { name: 'share card', exact: true }).click();
  const handoff = page.locator('.trail-card-handoff');
  await expect(handoff.getByRole('button', { name: 'DOWNLOAD BUNDLE' })).toBeVisible();
  await expect(handoff.getByRole('button', { name: 'COPY DIGEST' })).toBeVisible();
  await expect(handoff.getByRole('button', { name: 'SHARE BUNDLE' })).toHaveCount(0);

  const overflow = await handoff.evaluate((controls) => (
    controls.getBoundingClientRect().right > window.innerWidth || controls.scrollWidth > controls.clientWidth
  ));
  expect(overflow).toBe(false);
});
