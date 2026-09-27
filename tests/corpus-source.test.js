'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function digest(bytes) {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function response(text) {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

test('shared corpus authority loads legacy bytes once per runtime', async () => {
  const calls = [];
  const { createCorpusSource } = require('../corpus-source.js');
  const runtime = createCorpusSource({
    fetchImpl: async (url) => {
      calls.push(url);
      return response('https://example.org/a\nhttps://example.net/b\n');
    },
    sha256Hex: digest,
  });

  const first = await runtime.loadAuthority();
  const second = await runtime.loadAuthority();

  assert.strictEqual(first, second);
  assert.deepEqual(first.urls, [
    'https://example.org/a',
    'https://example.net/b',
  ]);
  assert.match(first.revision, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.source.id, 'legacy-urls-v1');
  assert.equal(first.source.url, 'urls.txt?v=authority-v1');
  assert.deepEqual(calls, ['urls.txt?v=authority-v1']);
});

test('shadow candidate is independently loadable and cannot replace authority', async () => {
  const calls = [];
  const { createCorpusSource } = require('../corpus-source.js');
  const runtime = createCorpusSource({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('typed-candidate-v0.1')) {
        return response('https://candidate.example/tool\n');
      }
      return response('https://legacy.example/a\n');
    },
    sha256Hex: digest,
  });

  const authorityBefore = await runtime.loadAuthority();
  const shadow = await runtime.loadShadow();
  const authorityAfter = await runtime.loadAuthority();

  assert.strictEqual(authorityBefore, authorityAfter);
  assert.equal(authorityAfter.urls[0], 'https://legacy.example/a');
  assert.equal(shadow.urls[0], 'https://candidate.example/tool');
  assert.equal(shadow.source.id, 'typed-candidate-v0.1');
  assert.equal(runtime.policy.selectionAuthority, 'legacy-urls-v1');
  assert.equal(runtime.policy.shadow.selectionAuthority, false);
  assert.deepEqual(calls, [
    'urls.txt?v=authority-v1',
    'corpus/releases/typed-candidate-v0.1/urls.txt?v=shadow-v1',
  ]);
});

test('invalid corpus bytes fail closed and do not become cached authority', async () => {
  let count = 0;
  const { createCorpusSource } = require('../corpus-source.js');
  const runtime = createCorpusSource({
    fetchImpl: async () => {
      count += 1;
      if (count === 1) return response('not-a-url\n');
      return response('https://example.org/recovered\n');
    },
    sha256Hex: digest,
  });

  await assert.rejects(runtime.loadAuthority(), /no usable routes/i);
  const recovered = await runtime.loadAuthority();

  assert.equal(recovered.urls[0], 'https://example.org/recovered');
  assert.equal(count, 2);
});

test('ROLL, Blind Descent, and Trail consume the shared authority loader', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const blind = fs.readFileSync(path.join(ROOT, 'blind-runtime.js'), 'utf8');
  const trail = fs.readFileSync(path.join(ROOT, 'trail-runtime.js'), 'utf8');

  const sourceScript = index.indexOf('<script src="corpus-source.js"></script>');
  const trailScript = index.indexOf('<script src="trail-runtime.js" defer></script>');
  const blindScript = index.indexOf('<script src="blind-runtime.js" defer></script>');

  assert.notEqual(sourceScript, -1);
  assert.ok(sourceScript < trailScript);
  assert.ok(sourceScript < blindScript);

  assert.match(index, /R4b1tCorpusSource\.loadAuthority\(\)/);
  assert.match(blind, /R4b1tCorpusSource\.loadAuthority\(\)/);
  assert.match(trail, /R4b1tCorpusSource\.loadAuthority\(\)/);

  assert.doesNotMatch(index, /fetch\(["']urls\.txt\?v=dev/);
  assert.doesNotMatch(blind, /fetch\(["']urls\.txt/);
  assert.doesNotMatch(trail, /fetch\(["']urls\.txt/);
});

test('shadow route is diagnostic only and selection still consumes authority pool', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const source = fs.readFileSync(path.join(ROOT, 'corpus-source.js'), 'utf8');

  assert.match(
    source,
    /selectionAuthority\s*:\s*['"]legacy-urls-v1['"]/,
  );
  assert.match(
    source,
    /typed-candidate-v0\.1[\s\S]*selectionAuthority\s*:\s*false/,
  );

  const commitStart = index.indexOf('function _commitRollSelection');
  const commitEnd = index.indexOf('function _revealRollSelection', commitStart);
  const commitBody = index.slice(commitStart, commitEnd);
  assert.match(commitBody, /buildEligiblePool\(y,constraint\)/);
  assert.doesNotMatch(commitBody, /loadShadow|typed-candidate/);
});

test('service worker bypasses authority and candidate corpus network reads', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  assert.ok(sw.includes("'./corpus-source.js'"));
  assert.ok(sw.includes("url.pathname.endsWith('/urls.txt')"));
  assert.ok(sw.includes("url.pathname.includes('/corpus/releases/')"));
});
