'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BLIND = fs.readFileSync(path.join(ROOT, 'blind-runtime.js'), 'utf8');
const TRAIL = fs.readFileSync(path.join(ROOT, 'trail-runtime.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('ROLL, Blind Descent, and Trail consume the same cached active corpus load', () => {
  assert.match(INDEX, /R4b1tCorpusAuthority\.loadActive\(\)/);
  assert.match(BLIND, /R4b1tCorpusAuthority\.loadActive\(\)/);
  assert.match(TRAIL, /R4b1tCorpusAuthority\.loadActive\(\)/);

  assert.doesNotMatch(INDEX, /fetch\([^)]*activeFetchUrl/);
  assert.doesNotMatch(BLIND, /fetch\([^)]*activeFetchUrl/);
  assert.doesNotMatch(TRAIL, /fetch\([^)]*activeFetchUrl/);
});

test('candidate shadow remains registry-owned and absent from selection commit body', () => {
  const candidatePath = 'corpus/releases/typed-candidate-v0.1/urls.txt';
  assert.equal(INDEX.includes(candidatePath), false);
  assert.equal(BLIND.includes(candidatePath), false);
  assert.equal(TRAIL.includes(candidatePath), false);

  const start = INDEX.indexOf('function _commitRollSelection');
  const end = INDEX.indexOf('function _revealRollSelection', start);
  const body = INDEX.slice(start, end);
  assert.match(body, /buildEligiblePool\(y,constraint\)/);
  assert.doesNotMatch(body, /loadCandidateShadow|typed-candidate/);
});

test('service worker keeps both active and release corpus bytes on explicit network policy', () => {
  assert.ok(SW.includes("'./corpus-authority.js'"));
  assert.ok(SW.includes("url.pathname.endsWith('/urls.txt')"));
  assert.ok(SW.includes("url.pathname.includes('/corpus/releases/')"));
});
