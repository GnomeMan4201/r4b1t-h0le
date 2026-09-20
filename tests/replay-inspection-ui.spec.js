'use strict';

const { test, expect } = require('@playwright/test');

async function loadReplaySurface(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrail && window.R4b1tBlind);
  await page.addStyleTag({ url: './replay-inspection.css' });
  await page.addScriptTag({ url: './replay-inspection.js' });
  await page.addScriptTag({ url: './replay-inspection-renderer.js' });
  await page.addScriptTag({ url: './replay-inspection-delegation.js' });
  await page.addScriptTag({ url: './replay-inspection-import.js' });
  await page.waitForFunction(() => window.R4b1tReplayInspectionImport);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'replayInspectionTestHost';
    document.body.prepend(host);
    window.__replayController = window.R4b1tReplayInspectionImport.mount(host);
  });
}

async function makeV01(page, urls, seed = 'replay-ui') {
  return page.evaluate(async ({ urls, seed }) => {
    const manifest = await window.R4b1tTrail.createManifest({
      created_at: '2026-09-20T09:45:00.000Z',
      corpus_revision: 'sha256:' + 'c'.repeat(64),
      seed,
      terrain: 'RESEARCH',
      routes: urls.map((url) => ({ url, action: 'ROLL' })),
      parent: null,
    });
    return JSON.stringify(await window.R4b1tTrail.envelope(manifest), null, 2) + '\n';
  }, { urls, seed });
}

async function makeV02(page) {
  return page.evaluate(async () => {
    const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const NONCE_A = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
    const NONCE_B = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';
    let manifest = await window.R4b1tBlind.create({
      created_at: '2026-09-20T09:46:00.000Z',
      corpus_revision: 'sha256:' + 'c'.repeat(64),
      terrain: 'RESEARCH',
      trail_salt: SALT,
      parent: null,
    });
    const first = await window.R4b1tBlind.commit(manifest, 'https://secret.example/first', NONCE_A);
    manifest = first.manifest;
    const second = await window.R4b1tBlind.commit(manifest, 'https://example.org/revealed', NONCE_B);
    manifest = await window.R4b1tBlind.reveal(second.manifest, second.secret);
    return JSON.stringify(await window.R4b1tBlind.envelope(manifest), null, 2) + '\n';
  });
}

test('Replay UI modules do not auto-mount or alter the production shell', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: './replay-inspection.js' });
  await page.addScriptTag({ url: './replay-inspection-renderer.js' });
  await page.addScriptTag({ url: './replay-inspection-import.js' });

  await expect(page.locator('.replay-inspection-import')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.R4b1tReplayInspectionImport.mount)).toBe('function');
});

test('pre-verification rendering is neutral and contains no evidentiary source content', async ({ page }) => {
  await loadReplaySurface(page);
  const source = await makeV01(page, ['https://example.org/private-before-verify']);

  const during = await page.evaluate((value) => {
    const bytes = new TextEncoder().encode(value);
    window.__pendingReplay = window.__replayController.loadBytes(bytes);
    const host = document.getElementById('replayInspectionTestHost');
    return {
      text: host.innerText,
      html: host.innerHTML,
      snapshot: window.__replayController.snapshot(),
    };
  }, source);

  expect(during.snapshot.phase).toBe('VERIFYING');
  expect(during.text).toContain('VERIFYING SOURCE');
  expect(during.text).not.toContain('private-before-verify');
  expect(during.html).not.toContain('private-before-verify');

  await page.evaluate(() => window.__pendingReplay);
  await expect(page.locator('.replay-inspection')).toHaveAttribute('data-proof-state', 'VERIFIED');
});

test('verified source exposes proof state, position, digest and deterministic navigation only after verification', async ({ page }) => {
  await loadReplaySurface(page);
  const source = await makeV01(page, ['https://example.org/a', 'https://example.org/b'], 'verified-ui');

  await page.evaluate((value) => window.__replayController.loadBytes(new TextEncoder().encode(value)), source);

  const root = page.locator('.replay-inspection');
  await expect(root).toHaveAttribute('data-proof-state', 'VERIFIED');
  await expect(root).toContainText('1 / 2');
  await expect(root).toContainText('REVEALED');
  await expect(root).toContainText('https://example.org/a');
  await expect(root).toContainText('sha256:');

  await root.getByRole('button', { name: 'Next' }).click();
  await expect(root).toContainText('2 / 2');
  await expect(root).toContainText('https://example.org/b');
  await expect(root).not.toContainText('https://example.org/a');

  await root.getByRole('button', { name: 'Previous' }).click();
  await expect(root).toContainText('1 / 2');
  await expect(root).toContainText('https://example.org/a');
});

test('concealed historical position leaks no later revealed route through visible, hidden, attribute, or accessibility text', async ({ page }) => {
  await loadReplaySurface(page);
  const source = await makeV02(page);

  await page.evaluate((value) => window.__replayController.loadBytes(new TextEncoder().encode(value)), source);
  const root = page.locator('.replay-inspection');

  await expect(root).toContainText('CONCEALED');
  await expect(root).not.toContainText('https://example.org/revealed');

  await root.getByRole('button', { name: 'Next' }).click();
  await expect(root).toContainText('https://example.org/revealed');

  await root.getByRole('button', { name: 'Previous' }).click();
  const surfaces = await root.evaluate((node) => ({
    text: node.textContent,
    html: node.innerHTML,
    aria: Array.from(node.querySelectorAll('*')).map((el) => [
      el.getAttribute('aria-label'),
      el.getAttribute('aria-description'),
      el.getAttribute('title'),
      el.getAttribute('data-route-id'),
      el.getAttribute('data-url'),
    ].filter(Boolean).join(' ')).join(' '),
  }));

  expect(surfaces.text).not.toContain('https://example.org/revealed');
  expect(surfaces.html).not.toContain('https://example.org/revealed');
  expect(surfaces.aria).not.toContain('https://example.org/revealed');
  await expect(root).toContainText('Route identity is not disclosed');
});

test('focus and verification-detail controls do not trigger reveal or navigation', async ({ page }) => {
  await loadReplaySurface(page);
  const source = await makeV02(page);
  await page.evaluate((value) => window.__replayController.loadBytes(new TextEncoder().encode(value)), source);

  const root = page.locator('.replay-inspection');
  const details = root.getByRole('button', { name: 'Verification details' });
  await details.focus();
  await expect(root).toContainText('1 / 2');
  await expect(root).toContainText('CONCEALED');

  await details.press('Enter');
  await expect(root.locator('[data-replay-details]')).toBeVisible();
  await expect(root).toContainText('FULL DIGEST');
  await expect(root).toContainText('1 / 2');
  await expect(root).toContainText('CONCEALED');
  await expect(root).not.toContainText('https://example.org/revealed');
});

test('keyboard navigation works while historical concealment remains position-scoped', async ({ page }) => {
  await loadReplaySurface(page);
  const source = await makeV02(page);
  await page.evaluate((value) => window.__replayController.loadBytes(new TextEncoder().encode(value)), source);

  const shell = page.locator('.replay-inspection-import');
  await shell.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.replay-inspection')).toContainText('https://example.org/revealed');

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.replay-inspection')).toContainText('CONCEALED');
  await expect(page.locator('.replay-inspection')).not.toContainText('https://example.org/revealed');
});

test('REJECTED and UNVERIFIED inputs remain diagnostic and never render source route facts', async ({ page }) => {
  await loadReplaySurface(page);
  const valid = await makeV01(page, ['https://example.org/original'], 'tamper-ui');
  const tampered = JSON.parse(valid);
  tampered.manifest.routes[0].url = 'https://attacker.invalid/';

  await page.evaluate((value) => window.__replayController.loadBytes(
    new TextEncoder().encode(JSON.stringify(value))
  ), tampered);

  let root = page.locator('.replay-inspection');
  await expect(root).toHaveAttribute('data-proof-state', 'REJECTED');
  await expect(root).not.toContainText('https://attacker.invalid/');

  await page.evaluate(() => window.__replayController.loadBytes(
    new TextEncoder().encode(JSON.stringify({
      trail_id: 'sha256:' + 'f'.repeat(64),
      manifest: { format: 'r4b1t-trail/v9.9' },
    }))
  ));

  root = page.locator('.replay-inspection');
  await expect(root).toHaveAttribute('data-proof-state', 'UNVERIFIED');
  await expect(root).toContainText('Unsupported source artifact format');
});

test('reset and Escape discard transient replay state and selected presentation', async ({ page }) => {
  await loadReplaySurface(page);
  const source = await makeV01(page, ['https://example.org/a'], 'reset-ui');
  await page.evaluate((value) => window.__replayController.loadBytes(new TextEncoder().encode(value)), source);
  await expect(page.locator('.replay-inspection')).toContainText('https://example.org/a');

  await page.locator('.replay-inspection-reset').click();
  await expect(page.locator('.replay-inspection')).toContainText('NO SOURCE LOADED');
  expect(await page.evaluate(() => window.__replayController.snapshot().source)).toBeNull();

  await page.evaluate((value) => window.__replayController.loadBytes(new TextEncoder().encode(value)), source);
  await page.locator('.replay-inspection-import').press('Escape');
  await expect(page.locator('.replay-inspection')).toContainText('NO SOURCE LOADED');
  expect(await page.evaluate(() => window.__replayController.snapshot().source)).toBeNull();
});

test('phone-width primary view exposes proof state and navigation without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadReplaySurface(page);
  const source = await makeV01(page, ['https://example.org/a', 'https://example.org/b'], 'mobile-ui');
  await page.evaluate((value) => window.__replayController.loadBytes(new TextEncoder().encode(value)), source);

  const root = page.locator('.replay-inspection');
  await expect(root).toContainText('VERIFIED');
  await expect(root).toContainText('1 / 2');
  await expect(root).toContainText('REVEALED');
  await expect(root.getByRole('button', { name: 'Previous' })).toBeVisible();
  await expect(root.getByRole('button', { name: 'Next' })).toBeVisible();
  await expect(root.getByRole('button', { name: 'Verification details' })).toBeVisible();

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
});

test('multi-file selection delegates exact bytes in order and renders duplicate-aware slots', async ({ page }) => {
  await loadReplaySurface(page);
  const a = await makeV01(page, ['https://example.org/a'], 'multi-a');
  const b = await makeV01(page, ['https://example.org/b'], 'multi-b');
  const input = page.locator('.replay-inspection-file-input');
  await expect(input).toHaveAttribute('multiple', '');
  await input.setInputFiles([
    { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(b) },
    { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'b-copy.json', mimeType: 'application/json', buffer: Buffer.from(b) },
  ]);

  const root = page.locator('.replay-inspection');
  await expect(root).toHaveAttribute('data-replay-mode', 'multi-source');
  await expect(root).toContainText('2 UNIQUE / 3 SUPPLIED');
  await expect(root).toContainText('S1');
  await expect(root).toContainText('SUPPLIED 2×');
  await expect(root).toContainText('S2');
  await expect(root).not.toContainText('https://example.org/a');
  await expect(root).not.toContainText('https://example.org/b');
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
});

test('multi-source view keeps rejected diagnostics separate from verified slots', async ({ page }) => {
  await loadReplaySurface(page);
  const good = await makeV01(page, ['https://example.org/good'], 'diagnostic-good');
  const altered = JSON.parse(await makeV01(page, ['https://example.org/original'], 'diagnostic-bad'));
  altered.manifest.routes[0].url = 'https://attacker.invalid/';
  await page.locator('.replay-inspection-file-input').setInputFiles([
    { name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(good) },
    { name: 'altered.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(altered)) },
  ]);
  const slots = page.locator('.replay-inspection-source-slot');
  await expect(slots).toHaveCount(2);
  await expect(slots.nth(0)).toContainText('VERIFIED');
  await expect(slots.nth(1)).toContainText('REJECTED');
  await expect(page.locator('.replay-inspection')).toContainText('VERIFIED PAIRS0');
  await expect(page.locator('.replay-inspection')).not.toContainText('https://attacker.invalid/');
});

test('multi-source verification stays neutral until delegation resolves and reset destroys state', async ({ page }) => {
  await loadReplaySurface(page);
  const a = await makeV01(page, ['https://example.org/private-a'], 'neutral-a');
  const b = await makeV01(page, ['https://example.org/private-b'], 'neutral-b');
  await page.evaluate(() => {
    const original = window.R4b1tReplayInspectionDelegation.inspectSources;
    let release;
    window.__releaseDelegation = () => release();
    const host = document.getElementById('replayInspectionTestHost');
    window.__replayController.destroy();
    window.__replayController = window.R4b1tReplayInspectionImport.mount(host, {
      delegation: {
        inspectSources: async (...args) => {
          await new Promise((resolve) => { release = resolve; });
          return original(...args);
        },
      },
    });
  });
  await page.locator('.replay-inspection-file-input').setInputFiles([
    { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(a) },
    { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(b) },
  ]);
  const root = page.locator('.replay-inspection');
  await expect(root).toContainText('VERIFYING SOURCES');
  await expect(root).not.toContainText('private-a');
  await expect(root).not.toContainText('private-b');
  await page.evaluate(() => window.__releaseDelegation());
  await expect(root).toContainText('2 UNIQUE / 2 SUPPLIED');
  await page.locator('.replay-inspection-reset').click();
  await expect(root).toContainText('NO SOURCE LOADED');
  expect(await page.evaluate(() => window.__replayController.multiSnapshot())).toBeNull();
});

test('Replay UI shell contains no persistence, remote transfer, telemetry, ranking, sampler, or corpus hooks', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const sources = await page.evaluate(async () => Promise.all([
    fetch('./replay-inspection-delegation.js').then((r) => r.text()),
    fetch('./replay-inspection-renderer.js').then((r) => r.text()),
    fetch('./replay-inspection-import.js').then((r) => r.text()),
  ]));
  const combined = sources.join('\n');

  for (const forbidden of [
    'localStorage', 'sessionStorage', 'indexedDB', 'caches.',
    'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
    'analytics', 'telemetry', 'recommendation', 'popularity',
    'selection_weight', 'sampler_weight', 'createSampler(', 'corpus_revision',
  ]) {
    expect(combined.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
});
