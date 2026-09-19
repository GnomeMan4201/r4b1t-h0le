'use strict';

const { test, expect } = require('@playwright/test');

test('Trail Card share handoff uses the same independent verifier and sends only bundle files', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.R4b1tTrail &&
    window.R4b1tTopologyIndependentVerifier &&
    window.R4b1tTrailCard &&
    window.R4b1tTrailCardShare &&
    window.openTrailTopology
  );

  const result = await page.evaluate(async () => {
    const trail = window.R4b1tTrail;
    const manifest = await trail.createManifest({
      created_at: '2026-09-19T18:00:00.000Z',
      corpus_revision: 'sha256:' + 'a'.repeat(64),
      seed: 'share-handoff',
      terrain: 'RESEARCH',
      routes: [{ url: 'https://example.org/share', action: 'ROLL' }],
      parent: null,
    });
    const snapshot = await trail.envelope(manifest);
    await window.openTrailTopology(snapshot);

    const beforeKeys = Object.keys(localStorage).sort();
    let shared = null;
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        shared = {
          title: data.title,
          text: data.text,
          names: data.files.map((file) => file.name),
          contents: await Promise.all(data.files.map((file) => file.text())),
        };
      },
    });

    const output = await window.shareCard('2026-09-19T18:01:00.000Z');
    const afterKeys = Object.keys(localStorage).sort();

    const source = JSON.parse(shared.contents[0]);
    const card = JSON.parse(shared.contents[1]);
    return {
      method: output.method,
      names: shared.names,
      title: shared.title,
      sourceFormat: source.format,
      cardState: card.verification.state,
      sourceDigest: card.source.artifact_digest,
      verifiedDigest: card.verification.verified_digest,
      verifiedAt: card.verification.verified_at,
      verifier: card.verification.verifier,
      cardSourceFormat: card.source.artifact_format,
      readme: shared.contents[2],
      beforeKeys,
      afterKeys,
    };
  });

  expect(result.method).toBe('share-sheet');
  expect(result.names).toEqual(['source.json', 'trail-card.json', 'README.txt']);
  expect(result.sourceFormat).toBe('r4b1t-topology-export/v0.1');
  expect(result.cardState).toBe('VERIFIED');
  expect(result.sourceDigest).toBe(result.verifiedDigest);
  expect(result.verifiedAt).toBe('2026-09-19T18:01:00.000Z');
  expect(result.verifier).toBe('r4b1t-topology-verifier/v0.1');
  expect(result.cardSourceFormat).toBe('r4b1t-topology-export/v0.1');
  expect(result.readme).toContain('Evidence authority: source.json');
  expect(result.readme).toContain('The Trail Card is not evidence authority.');
  expect(result.afterKeys).toEqual(result.beforeKeys);
});

test('Trail Card share handoff preserves PARENT ABSENT inside a VERIFIED card', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R4b1tTrail && window.R4b1tTrailCardShare);

  const result = await page.evaluate(async () => {
    const trail = window.R4b1tTrail;
    const manifest = await trail.createManifest({
      created_at: '2026-09-19T18:02:00.000Z',
      corpus_revision: 'sha256:' + 'b'.repeat(64),
      seed: 'share-parent-absent',
      terrain: 'RESEARCH',
      routes: [],
      parent: { trail_id: 'sha256:' + 'c'.repeat(64), fork_at: 0 },
    });
    const snapshot = await trail.envelope(manifest);
    await window.openTrailTopology(snapshot);
    const built = await window.R4b1tTrailCardShare.buildCurrent('2026-09-19T18:03:00.000Z');
    return {
      state: built.card.verification.state,
      parentAbsent: built.card.display.parent_absent_count,
      relationship: built.card.display.branch_diagram.nodes[0].relationship_state,
    };
  });

  expect(result).toEqual({
    state: 'VERIFIED',
    parentAbsent: 1,
    relationship: 'PARENT ABSENT',
  });
});

test('Trail Card share handoff has no collection, telemetry, ranking, or server distribution path', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const source = await page.evaluate(async () => (await fetch('./trail-card-share.js')).text());
  const lowered = source.toLowerCase();

  for (const banned of [
    'localstorage',
    'sessionstorage',
    'recent shares',
    'recent_shares',
    'gallery',
    'view_count',
    'viewcount',
    'like_count',
    'trending',
    'popularity',
    'recommendation',
    'sampler',
    'selection_weight',
    'fetch(',
    'xmlhttprequest',
    'websocket',
  ]) {
    expect(lowered).not.toContain(banned);
  }

  expect(lowered).toContain('navigator.share');
  expect(lowered).toContain('source.json');
  expect(lowered).toContain('trail-card.json');
});

test('legacy SHARE CARD label is replaced by SHARE BUNDLE', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const buttons = page.locator('.btn-share-trail');
  await expect(buttons.filter({ hasText: 'share bundle' })).toHaveCount(1);
  await expect(buttons.filter({ hasText: 'share card' })).toHaveCount(0);
});
