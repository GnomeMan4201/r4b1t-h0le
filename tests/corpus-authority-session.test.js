'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const authority = require('../corpus-authority.js');

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

test('active corpus bytes are fetched and hashed exactly once per runtime', async () => {
  const calls = [];
  const runtime = authority.createRuntime({
    fetchImpl: async (url) => {
      calls.push(url);
      return response('https://example.org/a\nhttps://example.net/b\n');
    },
    sha256Hex: digest,
  });

  const first = await runtime.loadActive();
  const second = await runtime.loadActive();

  assert.strictEqual(first, second);
  assert.equal(first.source.id, 'legacy-urls-v1');
  assert.deepEqual(first.urls, [
    'https://example.org/a',
    'https://example.net/b',
  ]);
  assert.match(first.revision, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(calls, ['urls.txt?v=authority-v1']);
});

test('candidate shadow has an independent cache and cannot replace active authority', async () => {
  const calls = [];
  const runtime = authority.createRuntime({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('typed-candidate-v0.1')) {
        return response('https://candidate.example/tool\n');
      }
      return response('https://legacy.example/a\n');
    },
    sha256Hex: digest,
  });

  const activeBefore = await runtime.loadActive();
  const shadow = await runtime.loadCandidateShadow();
  const activeAfter = await runtime.loadActive();

  assert.strictEqual(activeBefore, activeAfter);
  assert.equal(activeAfter.urls[0], 'https://legacy.example/a');
  assert.equal(shadow.urls[0], 'https://candidate.example/tool');
  assert.equal(runtime.active().selectionAuthority, true);
  assert.equal(runtime.candidate().selectionAuthority, false);
  assert.deepEqual(calls, [
    'urls.txt?v=authority-v1',
    'corpus/releases/typed-candidate-v0.1/urls.txt?v=shadow-v1',
  ]);
});

test('failed active load is not cached as authority', async () => {
  let count = 0;
  const runtime = authority.createRuntime({
    fetchImpl: async () => {
      count += 1;
      return count === 1
        ? response('not-a-url\n')
        : response('https://example.org/recovered\n');
    },
    sha256Hex: digest,
  });

  await assert.rejects(runtime.loadActive(), /no usable routes/i);
  const recovered = await runtime.loadActive();

  assert.equal(recovered.urls[0], 'https://example.org/recovered');
  assert.equal(count, 2);
});
