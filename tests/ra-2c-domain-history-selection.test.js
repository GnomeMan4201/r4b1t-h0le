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

test('RA-2C: mechanical immediate-repeat guard is explicit and supplied by trail authority', () => {
  const body = selectorBody();
  assert.match(
    body,
    /function ee\(e,rng,reference\)/,
    'the selector must receive its immediate-repeat reference explicitly',
  );
  assert.match(
    body,
    /t!==reference/,
    'ADR 0001 permits the documented mechanical immediate-repeat constraint',
  );
  assert.doesNotMatch(
    body,
    /s\.last/,
    'page/session bookkeeping must not supply the sampler repeat guard',
  );
});

test('RA-2C: domainCount may remain diagnostic state but cannot be a sampler input', () => {
  assert.match(INDEX, /domainCount\s*:\s*\{\}/, 'diagnostic domain-count state may remain');
  assert.match(INDEX, /function te\([^)]*\)[\s\S]*?domainCount/, 'selection bookkeeping may continue recording domain counts');
  assert.doesNotMatch(selectorBody(), /domainCount/, 'recorded domain counts must not feed back into selection');
});
