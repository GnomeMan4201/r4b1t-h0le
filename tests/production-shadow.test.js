'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'tools', 'verify-production-shadow.mjs'), 'utf8');

test('production shadow includes Prove & Show proof-critical assets', () => {
  for (const asset of [
    'index.html',
    'trail-topology.js',
    'trail-card.js',
    'trail-card-renderer.js',
    'trail-card-share.js',
    'trail-comparison.js',
    'trail-comparison-renderer.js',
    'trail-comparison-import.js',
    'proof-session.js',
    'proof-session-renderer.js',
    'proof-session-import.js',
    'sw.js',
  ]) {
    assert.match(source, new RegExp(asset.replaceAll('.', '\\.'), 'i'), asset);
  }
});

test('production shadow compares GitHub Pages and custom-domain bytes for every critical asset', () => {
  assert.match(source, /fetchAsset\(APP, file, ['"]pages['"]\)/);
  assert.match(source, /fetchAsset\(SITE, file, ['"]custom-domain['"]\)/);
  assert.match(source, /pagesHash/);
  assert.match(source, /siteHash/);
  assert.match(source, /pagesHash\s*!==\s*siteHash/);
});

test('production shadow records serving-layer headers and redirect identity before functional checks', () => {
  assert.match(source, /cache-control/i);
  assert.match(source, /etag/i);
  assert.match(source, /last-modified/i);
  assert.match(source, /response\.url/);
  assert.match(source, /https:/i);
  assert.match(source, /redirect/i);
});

test('custom-domain root must contain the same release-critical entry points as Pages', () => {
  for (const marker of [
    'proof-session-import.js',
    'trail-comparison-import.js',
    'trail-card-share.js',
    'trail-topology.js',
  ]) {
    assert.match(source, new RegExp(marker.replaceAll('.', '\\.'), 'i'));
  }
});

test('production shadow does not expand parity to corpus or decorative media', () => {
  for (const forbidden of [
    'links.txt',
    'corpus.json',
    'banana.webp',
    'rabbit-aperture.svg',
    'favicon.ico',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
