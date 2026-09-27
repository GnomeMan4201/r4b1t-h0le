'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const authority = require('../corpus-authority.js');

test('runtime corpus authority keeps legacy corpus active', () => {
  assert.equal(authority.schema, 'r4b1t-runtime-corpus-authority-v1');
  assert.deepEqual(authority.active(), {
    id: 'legacy-urls-v1',
    url: 'urls.txt',
    status: 'active',
    selectionAuthority: true,
  });
  assert.equal(authority.activeFetchUrl('roll-v1'), 'urls.txt?v=roll-v1');
});

test('typed candidate remains explicitly non-authoritative', () => {
  assert.deepEqual(authority.candidate(), {
    id: 'typed-candidate-v0.1',
    url: 'corpus/releases/typed-candidate-v0.1/urls.txt',
    resourcesUrl: 'corpus/releases/typed-candidate-v0.1/resources.json',
    manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json',
    status: 'candidate',
    selectionAuthority: false,
  });
});

test('authority descriptors cannot be mutated into a corpus promotion', () => {
  const active = authority.active();
  const candidate = authority.candidate();

  assert.equal(Object.isFrozen(authority), true);
  assert.equal(Object.isFrozen(active), true);
  assert.equal(Object.isFrozen(candidate), true);

  assert.throws(() => {
    candidate.selectionAuthority = true;
  }, TypeError);
  assert.equal(authority.candidate().selectionAuthority, false);
  assert.equal(authority.active().id, 'legacy-urls-v1');
});

test('cache tags are encoded and do not change source identity', () => {
  assert.equal(
    authority.activeFetchUrl('blind/v02'),
    'urls.txt?v=blind%2Fv02',
  );
  assert.equal(authority.active().url, 'urls.txt');
});
