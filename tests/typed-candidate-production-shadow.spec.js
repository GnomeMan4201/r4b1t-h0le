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
  'experience-candidate-v0.4',
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
  expect(MANIFEST.release_id).toBe('experience-candidate-v0.4');
  expect(MANIFEST.status).toBe('candidate');
  expect(MANIFEST.selection_authority).toBe(false);
  expect(MANIFEST.urls_digest).toBe(CANDIDATE_REVISION);
  expect(MANIFEST.counts.resources).toBe(CANDIDATE_URLS.length);
  expect(CANDIDATE_URLS.length).toBe(7033);
});

test('runtime promotion grants authority without rewriting candidate release evidence', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.R4b1tCorpusAuthority));

  const result = await page.evaluate(async () => {
    const loaded = await window.R4b1tCorpusAuthority.loadActive();
    return {
      active: window.R4b1tCorpusAuthority.active(),
      candidate: window.R4b1tCorpusAuthority.candidate(),
      promotion: window.R4b1tCorpusAuthority.promotion(),
      revision: loaded.revision,
      count: loaded.urls.length,
    };
  });

  expect(result.active.id).toBe('experience-candidate-v0.4');
  expect(result.active.selectionAuthority).toBe(true);
  expect(result.active.expectedDigest).toBe(CANDIDATE_REVISION);
  expect(result.candidate.selectionAuthority).toBe(false);
  expect(result.candidate.expectedDigest).toBe(CANDIDATE_REVISION);
  expect(result.promotion.id).toBe('experience-candidate-v0.4-active-v1');
  expect(result.revision).toBe(CANDIDATE_REVISION);
  expect(result.count).toBe(7033);
});
