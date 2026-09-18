'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('browser shell ships without analytics or remote UI font beacons', () => {
  const index = read('index.html');
  assert.ok(!index.includes('static.cloudflareinsights.com/beacon.min.js'));
  assert.ok(!index.includes('fonts.googleapis.com'));
});

test('browser shell does not call Google favicon or Microlink services directly', () => {
  const index = read('index.html');
  assert.ok(!index.includes('www.google.com/s2/favicons'));
  assert.ok(!index.includes('api.microlink.io'));
});

test('automatic Wikipedia enrichment is routed through the controlled Worker', () => {
  const index = read('index.html');
  assert.doesNotMatch(index, /fetch\("https:\/\/en\.wikipedia\.org\/w\/api\.php/);
  assert.match(index, /fetch\(Ge\+encodeURIComponent\("https:\/\/en\.wikipedia\.org\/w\/api\.php/);
});

test('favicon and preview images are loaded through the controlled Worker proxy', () => {
  const index = read('index.html');
  assert.ok(index.includes('l.src=Ge+encodeURIComponent(E.origin+"/favicon.ico")'));
  assert.ok(index.includes('n.src=Ge+encodeURIComponent(p)'));
  assert.ok(index.includes('m.src=Ge+encodeURIComponent(i)'));
});

test('privacy documentation states the controlled network boundary', () => {
  const readme = read('README.md');
  assert.ok(readme.includes('No r4b1t analytics, profile, or engagement tracking is used.'));
  assert.ok(readme.includes('origin-locked Worker'));
});
