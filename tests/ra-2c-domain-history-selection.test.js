'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INDEX = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function selectorBody() {
  const start = INDEX.indexOf('function ee(');
  const end = INDEX.indexOf('function te(', start);
  assert.notEqual(start, -1, 'canonical ROLL selector ee() must exist');
  assert.notEqual(end, -1, 'selector boundary must be locatable');
  return INDEX.slice(start, end);
}

test('RA-2C: canonical ROLL selector does not read session domain history', () => {
  const body = selectorBody();
  assert.doesNotMatch(
    body,
    /domainCount/,
    'ADR 0001 permits only immediate-repeat suppression; accumulated domain history must not condition ROLL',
  );
});

test('RA-2C: mechanical immediate-repeat guard remains explicit', () => {
  const body = selectorBody();
  assert.match(
    body,
    /s\.last/,
    'ADR 0001 explicitly permits a documented mechanical constraint preventing an immediate repeat',
  );
});

test('RA-2C: domainCount may remain diagnostic state but cannot be a sampler input', () => {
  assert.match(INDEX, /domainCount\s*:\s*\{\}/, 'diagnostic domain-count state may remain');
  assert.match(INDEX, /function te\([^)]*\)[\s\S]*?domainCount/, 'selection bookkeeping may continue recording domain counts');
  assert.doesNotMatch(selectorBody(), /domainCount/, 'recorded domain counts must not feed back into selection');
});
