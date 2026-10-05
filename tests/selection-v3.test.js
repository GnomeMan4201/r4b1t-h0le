'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SiteKey = require('../site-key-v1.js');
const SelectionV3 = require('../selection-v3.js');

const ROOT = path.join(__dirname, '..');
const pslText = fs.readFileSync(path.join(ROOT, 'selection/site-key-v1/public_suffix_list.dat'), 'utf8');
const overridesText = fs.readFileSync(path.join(ROOT, 'selection/site-key-v1/platform-overrides.json'), 'utf8');
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/selection-v3-vectors.json'), 'utf8'));
const psl = SiteKey.parsePsl(pslText);
const overrides = SiteKey.parseOverrides(overridesText);
const siteKey = url => SiteKey.siteKey(url, psl, overrides);

function optionsFor(vector) {
  return {
    eligibleUrls: vector.urls,
    siteKey,
    seed: vector.seed,
    drawStart: vector.draw_start,
    weightMode: vector.mode,
    repeatGuardReference: vector.repeat_guard_reference,
    sequence: 1,
    constraint: {
      terrain: 'ALL',
      terrainIndex: null,
      protocolPolicy: { version: 1, excludeOnion: false }
    },
    corpusRevision: 'sha256:' + '1'.repeat(64),
    pslSha256: vectors.psl_sha256,
    overridesSha256: vectors.overrides_sha256
  };
}

test('normative selection-v3 vectors reproduce exact transaction bytes', () => {
  for (const vector of vectors.vectors) {
    const actual = SelectionV3.select(optionsFor(vector));
    assert.deepEqual(actual, vector.expected_transaction, vector.name);
    assert.equal(
      SelectionV3.canonicalJson(actual),
      vector.expected_canonical_json,
      vector.name + ' canonical JSON'
    );
  }
});

test('v3 selection is invariant to eligible URL input order', () => {
  const vector = vectors.vectors[0];
  const normal = SelectionV3.select(optionsFor(vector));
  const reversed = SelectionV3.select({
    ...optionsFor(vector),
    eligibleUrls: [...vector.urls].reverse()
  });
  assert.deepEqual(reversed, normal);
});

test('weight functions are exact integer definitions', () => {
  assert.equal(SelectionV3.siteWeight(918, 'UNIFORM_SITE'), 1n);
  assert.equal(SelectionV3.siteWeight(918, 'UNIFORM_URL'), 918n);
  assert.equal(
    SelectionV3.siteWeight(918, 'SQRT_DEPTH'),
    SelectionV3.isqrt(918n << 32n)
  );
  assert.equal(SelectionV3.isqrt(0n), 0n);
  assert.equal(SelectionV3.isqrt(1n), 1n);
  assert.equal(SelectionV3.isqrt(15n), 3n);
  assert.equal(SelectionV3.isqrt(16n), 4n);
});

test('site guard reference is derived from previous successful ROLL route', () => {
  const previousV2 = {
    transaction_version: 'r4b1t-selection-transaction/v2',
    action: 'ROLL',
    route: { url: 'https://github.com/OpenAI/previous' }
  };
  const previousV3 = {
    transaction_version: 'r4b1t-selection-transaction/v3',
    action: 'ROLL',
    route: { url: 'https://WWW.Example.COM:443/previous' }
  };
  assert.equal(
    SelectionV3.deriveRepeatGuardReference(previousV2, siteKey),
    'github.com/openai'
  );
  assert.equal(
    SelectionV3.deriveRepeatGuardReference(previousV3, siteKey),
    'example.com'
  );
  assert.equal(SelectionV3.deriveRepeatGuardReference(null, siteKey), null);
});

test('guard redraw, bypass, and exhaustion semantics are pinned by vectors', () => {
  const byName = Object.fromEntries(vectors.vectors.map(vector => [vector.name, vector]));
  assert.equal(byName['site-redraw'].expected_transaction.sampler.site_draw_count, 2);
  assert.equal(
    byName['single-site-bypass'].expected_transaction.sampler.repeat_guard.mode,
    'single-site-bypass'
  );
  assert.equal(
    byName['guard-exhaustion'].expected_transaction.sampler.repeat_guard.exhausted,
    true
  );
  assert.equal(byName['guard-exhaustion'].expected_transaction.sampler.site_draw_count, 30);
});

test('current URL-uniform distribution is skewed while UNIFORM_SITE is near 1/10', () => {
  const urls = [];
  for (let index = 0; index < 900; index += 1) urls.push('https://a.example/' + index);
  for (let index = 0; index < 9; index += 1) urls.push('https://s' + index + '.example' + index + '/x');

  const currentRng = SelectionV3.createSampler('distribution-current');
  let currentA = 0;
  for (let draw = 0; draw < 20000; draw += 1) {
    const u32 = currentRng();
    const index = Number((BigInt(u32) * BigInt(urls.length)) >> 32n);
    if (index < 900) currentA += 1;
  }
  assert.ok(currentA / 20000 > 0.95);

  const prepared = SelectionV3.prepareSites(urls, siteKey, 'UNIFORM_SITE');
  assert.equal(prepared.groups.length, 10);
  const siteRng = SelectionV3.createSampler('distribution-site');
  let siteA = 0;
  for (let draw = 0; draw < 20000; draw += 1) {
    const selected = SelectionV3.drawSite(prepared, siteRng, null);
    if (selected.selection.group.site_key === 'a.example') siteA += 1;
  }
  assert.ok(siteA / 20000 >= 0.08 && siteA / 20000 <= 0.12);
});

test('tampering with authoritative v3 evidence is rejected', () => {
  const vector = vectors.vectors[0];
  const original = vector.expected_transaction;
  const cases = [
    tx => { tx.corpus_revision = 'sha256:' + '2'.repeat(64); },
    tx => { tx.grouping.site_key_version = 'site-key/v999'; },
    tx => { tx.grouping.psl_sha256 = 'sha256:' + '2'.repeat(64); },
    tx => { tx.grouping.overrides_sha256 = 'sha256:' + '3'.repeat(64); },
    tx => { tx.grouping.weight_mode = 'UNIFORM_URL'; },
    tx => { tx.sampler.draw_start += 1; },
    tx => { tx.sampler.draw_count += 1; },
    tx => { tx.sampler.repeat_guard.reference = 'tampered.example'; },
    tx => { tx.selection.site_index += 1; },
    tx => { tx.selection.site_key = 'tampered.example'; },
    tx => { tx.selection.url_index += 1; },
    tx => { tx.selection.site_draw_u32 ^= 1; },
    tx => { tx.selection.url_draw_u32 ^= 1; },
    tx => { tx.route.url = 'https://tampered.example/'; }
  ];

  for (const mutate of cases) {
    const tampered = structuredClone(original);
    mutate(tampered);
    assert.throws(
      () => SelectionV3.verifyTransaction(tampered, optionsFor(vector)),
      /SELECTION_V3_MISMATCH/
    );
  }
});
