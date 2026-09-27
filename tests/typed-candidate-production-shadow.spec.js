'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(
  ROOT,
  'corpus',
  'releases',
  'typed-candidate-v0.1',
);
const CANDIDATE_BYTES = fs.readFileSync(path.join(RELEASE_DIR, 'urls.txt'));
const CANDIDATE_TEXT = CANDIDATE_BYTES.toString('utf8');
const CANDIDATE_URLS = CANDIDATE_TEXT
  .split(/\r?\n/)
  .map(value => value.trim())
  .filter(Boolean);
const CANDIDATE_SET = new Set(CANDIDATE_URLS);
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(RELEASE_DIR, 'manifest.json'), 'utf8'),
);
const CANDIDATE_REVISION = (
  'sha256:' + crypto.createHash('sha256').update(CANDIDATE_BYTES).digest('hex')
);

test('typed candidate manifest binds the exact shadow bytes', () => {
  expect(MANIFEST.release_id).toBe('typed-candidate-v0.1');
  expect(MANIFEST.status).toBe('candidate');
  expect(MANIFEST.selection_authority).toBe(false);
  expect(MANIFEST.urls_digest).toBe(CANDIDATE_REVISION);
  expect(MANIFEST.counts.resources).toBe(CANDIDATE_URLS.length);
  expect(CANDIDATE_URLS.length).toBe(841);
});

test('production ROLL, Trail, and Blind accept the exact typed candidate bytes', async ({ page }) => {
  let corpusRequests = 0;

  await page.route('**/urls.txt?*', route => {
    corpusRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: CANDIDATE_BYTES,
    });
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    window.R4b1tCorpusAuthority &&
    typeof window.roll === 'function' &&
    typeof window.getTrailManifest === 'function' &&
    typeof window.getBlindManifest === 'function'
  ));

  await expect.poll(() => corpusRequests).toBeGreaterThan(0);

  const result = await page.evaluate(async () => {
    window.roll();
    const selected = document.getElementById('previewUrl').textContent.trim();
    const trail = await window.getTrailManifest();
    const blind = await window.getBlindManifest();
    return {
      authority: window.R4b1tCorpusAuthority.active(),
      candidate: window.R4b1tCorpusAuthority.candidate(),
      selected,
      trailRevision: trail.manifest.corpus_revision,
      blindRevision: blind.manifest.corpus_revision,
    };
  });

  expect(result.authority.id).toBe('legacy-urls-v1');
  expect(result.candidate.selectionAuthority).toBe(false);
  expect(CANDIDATE_SET.has(result.selected)).toBe(true);
  expect(result.trailRevision).toBe(CANDIDATE_REVISION);
  expect(result.blindRevision).toBe(CANDIDATE_REVISION);
  expect(result.trailRevision).toBe(result.blindRevision);
  expect(corpusRequests).toBeGreaterThanOrEqual(3);
});
