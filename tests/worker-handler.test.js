'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

async function workerModule() {
  return import('../worker/src/index.mjs');
}

const allowedOrigin = 'https://gnomeman4201.github.io';

function request(path, init = {}) {
  return new Request('https://worker.example' + path, {
    ...init,
    headers: {
      Origin: allowedOrigin,
      ...(init.headers || {})
    }
  });
}

test('Worker rejects unknown origins and write methods', async () => {
  const { handleRequest } = await workerModule();
  const env = { ALLOWED_ORIGINS: allowedOrigin, REQUIRE_RATE_LIMIT: 'false' };

  const badOrigin = await handleRequest(new Request('https://worker.example/og?url=https://example.com', {
    headers: { Origin: 'https://evil.example' }
  }), env, { fetch: async () => { throw new Error('must not fetch'); } });
  assert.equal(badOrigin.status, 403);

  const post = await handleRequest(request('/og?url=https://example.com', { method: 'POST' }), env, {
    fetch: async () => { throw new Error('must not fetch'); }
  });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD, OPTIONS');
});

test('/api remains explicitly disabled', async () => {
  const { handleRequest } = await workerModule();
  const env = { ALLOWED_ORIGINS: allowedOrigin, REQUIRE_RATE_LIMIT: 'false' };
  const response = await handleRequest(request('/api'), env, {
    fetch: async () => { throw new Error('must not fetch'); }
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { type: 'disabled', message: 'API route disabled' });
});

test('Worker rejects private targets before outbound fetch', async () => {
  const { handleRequest } = await workerModule();
  const env = { ALLOWED_ORIGINS: allowedOrigin, REQUIRE_RATE_LIMIT: 'false' };
  let fetches = 0;
  const response = await handleRequest(request('/proxy?url=http%3A%2F%2F127.0.0.1%2F'), env, {
    fetch: async () => { fetches++; throw new Error('must not fetch'); }
  });
  assert.equal(response.status, 403);
  assert.equal(fetches, 0);
});

test('manual redirect handling refuses a public-to-private hop', async () => {
  const { fetchBounded } = await workerModule();
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    return new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1/' }
    });
  };
  await assert.rejects(
    () => fetchBounded('https://example.com/start', {
      fetch: fakeFetch,
      resolveHost: async () => ['93.184.216.34']
    }, { maxBytes: 1024, maxRedirects: 3, timeoutMs: 1000 }),
    /blocked|private|redirect/i
  );
  assert.equal(calls, 1);
});

test('bounded fetch rejects oversized responses before returning a body', async () => {
  const { fetchBounded } = await workerModule();
  const fakeFetch = async () => new Response('x'.repeat(2048), {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Content-Length': '2048' }
  });
  await assert.rejects(
    () => fetchBounded('https://example.com/', {
      fetch: fakeFetch,
      resolveHost: async () => ['93.184.216.34']
    }, { maxBytes: 1024, maxRedirects: 1, timeoutMs: 1000 }),
    /size|large|limit/i
  );
});

test('rate-limit binding is mandatory when production enforcement is enabled', async () => {
  const { handleRequest } = await workerModule();
  const response = await handleRequest(request('/api'), {
    ALLOWED_ORIGINS: allowedOrigin,
    REQUIRE_RATE_LIMIT: 'true'
  }, { fetch: async () => { throw new Error('must not fetch'); } });
  assert.equal(response.status, 503);
});
