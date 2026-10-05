'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SiteKey = require('../site-key-v1.js');

const ROOT = path.join(__dirname, '..');
const PSL_PATH = path.join(ROOT, 'selection/site-key-v1/public_suffix_list.dat');
const OVERRIDE_PATH = path.join(ROOT, 'selection/site-key-v1/platform-overrides.json');
const VECTOR_PATH = path.join(__dirname, 'fixtures/selection-v3-vectors.json');
const CORPUS_PATH = path.join(ROOT, 'corpus/releases/experience-candidate-v0.4/urls.txt');

const pslText = fs.readFileSync(PSL_PATH, 'utf8');
const overrideText = fs.readFileSync(OVERRIDE_PATH, 'utf8');
const vectors = JSON.parse(fs.readFileSync(VECTOR_PATH, 'utf8'));
const psl = SiteKey.parsePsl(pslText);
const overrides = SiteKey.parseOverrides(overrideText);

function digest(text) {
  return 'sha256:' + crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

test('site-key/v1 pins exact PSL and override bytes', () => {
  assert.equal(digest(pslText), vectors.psl_sha256);
  assert.equal(digest(overrideText), vectors.overrides_sha256);
  assert.equal(SiteKey.SITE_KEY_VERSION, 'site-key/v1');
});

test('site-key/v1 normalization vectors are stable', () => {
  for (const vector of vectors.normalization) {
    assert.equal(
      SiteKey.siteKey(vector.url, psl, overrides),
      vector.site_key,
      vector.url
    );
  }
});

test('GitHub owners are separate sites while owner case is folded', () => {
  assert.equal(
    SiteKey.siteKey('https://github.com/OpenAI/alpha', psl, overrides),
    SiteKey.siteKey('https://github.com/openai/beta', psl, overrides)
  );
  assert.notEqual(
    SiteKey.siteKey('https://github.com/openai/alpha', psl, overrides),
    SiteKey.siteKey('https://github.com/other/alpha', psl, overrides)
  );
});

test('canonical grouping is independent of incoming corpus order', () => {
  const urls = [
    'https://github.com/Zed/z',
    'https://www.example.com/b',
    'https://github.com/zed/a',
    'https://example.com/a',
    'https://other.net/x'
  ];
  const forward = SiteKey.canonicalGroups(urls, psl, overrides);
  const reverse = SiteKey.canonicalGroups([...urls].reverse(), psl, overrides);
  assert.deepEqual(reverse, forward);
  assert.deepEqual(forward.map(group => group.site_key), [
    'example.com',
    'github.com/zed',
    'other.net'
  ]);
  assert.deepEqual(forward[1].urls, [
    'https://github.com/Zed/z',
    'https://github.com/zed/a'
  ]);
});

test('active experience-v0.4 resolves to 733 site-key/v1 groups', () => {
  const urls = fs.readFileSync(CORPUS_PATH, 'utf8')
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(Boolean);
  const groups = SiteKey.canonicalGroups(urls, psl, overrides);
  assert.equal(urls.length, 7033);
  assert.equal(groups.length, 733);
});


test('platform overrides reject syntactically invalid owner segments', () => {
  assert.equal(SiteKey.siteKey('https://github.com/@bad/repo', psl, overrides), 'github.com');
  assert.equal(SiteKey.siteKey('https://github.com/-bad/repo', psl, overrides), 'github.com');
  assert.equal(SiteKey.siteKey('https://gitlab.com/@bad/repo', psl, overrides), 'gitlab.com');
  assert.equal(SiteKey.siteKey('https://medium.com/not-an-at-user/post', psl, overrides), 'medium.com');
});
