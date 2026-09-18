'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');

test('Worker deployment config keeps public-only global fetch routing', () => {
  assert.ok(config.includes('compatibility_flags = ["global_fetch_strictly_public"]'));
});

test('Worker deployment config requires the production rate-limit binding', () => {
  assert.ok(config.includes('REQUIRE_RATE_LIMIT = "true"'));
  assert.ok(config.includes('name = "R4B1T_RATE_LIMITER"'));
  assert.ok(config.includes('limit = 60'));
  assert.ok(config.includes('period = 60'));
});

test('Worker deployment config keeps exact GitHub Pages Origin as the default allowlist', () => {
  assert.ok(config.includes('ALLOWED_ORIGINS = "https://gnomeman4201.github.io"'));
});
