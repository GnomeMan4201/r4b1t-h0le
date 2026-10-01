'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BLIND = fs.readFileSync(path.join(ROOT, 'blind-runtime.js'), 'utf8');
const TRAIL = fs.readFileSync(path.join(ROOT, 'trail-runtime.js'), 'utf8');

test('corpus authority loads before every production corpus consumer', () => {
  const authority = INDEX.indexOf('<script src="corpus-authority.js"></script>');
  const trail = INDEX.indexOf('<script src="trail-runtime.js"');
  const blind = INDEX.indexOf('<script src="blind-runtime.js"');
  const primaryLoader = INDEX.indexOf('async function Z()');

  assert.notEqual(authority, -1);
  assert.ok(authority < trail);
  assert.ok(authority < blind);
  assert.ok(authority < primaryLoader);
});

test('ROLL, Blind Descent, and Trail consume one shared verified active load', () => {
  assert.match(INDEX, /window\.R4b1tCorpusAuthority/);
  assert.match(INDEX, /\.loadActive\(\)/);
  assert.match(BLIND, /window\.R4b1tCorpusAuthority/);
  assert.match(BLIND, /\.loadActive\(\)/);
  assert.match(TRAIL, /window\.R4b1tCorpusAuthority/);
  assert.match(TRAIL, /\.loadActive\(\)/);
});

test('production consumers do not perform their own active corpus fetch', () => {
  assert.doesNotMatch(INDEX, /activeFetchUrl\(/);
  assert.doesNotMatch(BLIND, /activeFetchUrl\(/);
  assert.doesNotMatch(TRAIL, /activeFetchUrl\(/);
  assert.doesNotMatch(INDEX, /fetch\(["']urls\.txt\?v=/);
  assert.doesNotMatch(BLIND, /fetch\(["']urls\.txt\?v=/);
  assert.doesNotMatch(TRAIL, /fetch\(["']urls\.txt\?v=/);
});


test('typed candidate path is defined only by the authority registry', () => {
  const candidatePath = 'corpus/releases/strange-candidate-v0.3/urls.txt';
  assert.equal(INDEX.includes(candidatePath), false);
  assert.equal(BLIND.includes(candidatePath), false);
  assert.equal(TRAIL.includes(candidatePath), false);
});
