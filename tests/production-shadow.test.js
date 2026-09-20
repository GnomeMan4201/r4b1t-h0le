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

test('production shadow compares repository, published gh-pages branch, and custom-domain bytes', () => {
  assert.match(source, /PUBLISHED_BRANCH/);
  assert.match(source, /fetchAsset\(PUBLISHED_BRANCH, file, ['"]published-branch['"]\)/);
  assert.match(source, /fetchAsset\(SITE, file, ['"]custom-domain['"]\)/);
  assert.match(source, /publishedHash/);
  assert.match(source, /siteHash/);
  assert.match(source, /publishedHash\s*!==\s*siteHash/);
});

test('default GitHub Pages project URL must redirect to the registered custom domain and terminate on HTTPS', () => {
  assert.match(source, /verifyPagesRedirect/);
  assert.match(source, /redirect:\s*['"]manual['"]/);
  assert.match(source, /new URL\(SITE\)\.hostname/);
  assert.match(source, /const finalResponse = await fetchWithTimeout\(APP\)/);
  assert.match(source, /new URL\(finalResponse\.url\)/);
  assert.match(source, /finalUrl\.protocol\s*!==\s*['"]https:['"]/);
  assert.match(source, /finalUrl\.hostname\s*!==\s*expectedHost/);
});

test('production shadow records serving-layer headers and redirect identity before functional checks', () => {
  assert.match(source, /cache-control/i);
  assert.match(source, /etag/i);
  assert.match(source, /last-modified/i);
  assert.match(source, /response\.url/);
  assert.match(source, /https:/i);
  assert.match(source, /redirect/i);
});

test('custom-domain root must expose all release-critical entry points', () => {
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

test('production shadow requires the custom-domain CNAME to target GitHub Pages', () => {
  assert.match(source, /node:dns\/promises/);
  assert.match(source, /resolveCname/);
  assert.match(source, /EXPECTED_CNAME\s*=\s*['"]gnomeman4201\.github\.io['"]/);
  assert.match(source, /verifyCustomDomainDns/);
});
