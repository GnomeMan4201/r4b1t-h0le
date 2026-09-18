import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BoundaryError,
  callerOrigin,
  canonicalizeTarget,
  handleRequest,
  isAllowedCaller,
  isPublicIp,
  parseOpenGraph,
  safeFetch,
  validateTarget,
} from '../worker/r4b1t-proxy.mjs';

const ROOT = path.resolve('.');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const allowedOrigin = 'https://gnomeman4201.github.io';

function req(pathname, headers = {}) {
  return new Request('https://r4b1t-proxy.gnomeman4201.workers.dev' + pathname, { headers });
}

test('caller lock accepts the two published origins and rejects unknown or absent callers', () => {
  assert.equal(isAllowedCaller(req('/og', { Origin: allowedOrigin })), true);
  assert.equal(isAllowedCaller(req('/og', { Origin: 'https://r4b1t.badbananaresearch.com' })), true);
  assert.equal(isAllowedCaller(req('/og', { Origin: 'https://evil.example' })), false);
  assert.equal(isAllowedCaller(req('/og')), false);
});

test('referer fallback supports image requests that omit Origin', () => {
  const request = req('/proxy', { Referer: 'https://r4b1t.badbananaresearch.com/path' });
  assert.equal(callerOrigin(request), 'https://r4b1t.badbananaresearch.com');
  assert.equal(isAllowedCaller(request), true);
});

test('private, local, reserved, and link-local IP literals are rejected', () => {
  for (const host of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fd12::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ]) {
    assert.equal(isPublicIp(host), false, host);
  }
  assert.equal(isPublicIp('8.8.8.8'), true);
  assert.equal(isPublicIp('2606:4700:4700::1111'), true);
});

test('URL parser canonicalization blocks alternate loopback spellings and unsafe schemes', () => {
  for (const target of [
    'http://2130706433/',
    'http://0x7f000001/',
    'http://127.1/',
    'file:///etc/passwd',
    'gopher://example.com/',
    'http://localhost/',
    'http://user:pass@example.com/',
    'http://example.com:22/',
  ]) {
    assert.throws(() => canonicalizeTarget(target), BoundaryError, target);
  }
});

test('DNS results containing any non-public address are rejected', async () => {
  await assert.rejects(
    () => validateTarget('https://example.com/', {
      resolver: async () => { throw new BoundaryError('target DNS includes a non-public address', 403); },
    }),
    /non-public/,
  );
});

test('redirect destinations are revalidated before a second fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('', {
      status: 302,
      headers: { Location: 'http://127.0.0.1/' },
    });
  };
  const resolver = async (host) => {
    if (host === '127.0.0.1') throw new BoundaryError('non-public target address is not allowed', 403);
    return ['93.184.216.34'];
  };
  await assert.rejects(
    () => safeFetch('https://example.com/', { fetchImpl, resolver }),
    /non-public/,
  );
  assert.equal(calls, 1);
});

test('proxy route permits JSON but rejects HTML', async () => {
  const resolver = async () => ['93.184.216.34'];
  const goodFetch = async () => new Response('{"ok":true}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const good = await handleRequest(
    req('/proxy?url=' + encodeURIComponent('https://example.com/data.json'), { Origin: allowedOrigin }),
    {}, {}, { fetchImpl: goodFetch, resolver },
  );
  assert.equal(good.status, 200);
  assert.deepEqual(await good.json(), { ok: true });

  const htmlFetch = async () => new Response('<html></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
  const blocked = await handleRequest(
    req('/proxy?url=' + encodeURIComponent('https://example.com/'), { Origin: allowedOrigin }),
    {}, {}, { fetchImpl: htmlFetch, resolver },
  );
  assert.equal(blocked.status, 415);
});

test('proxy route enforces declared response-size limits', async () => {
  const resolver = async () => ['93.184.216.34'];
  const fetchImpl = async () => new Response('x', {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': '2000000',
    },
  });
  const response = await handleRequest(
    req('/proxy?url=' + encodeURIComponent('https://example.com/data.json'), { Origin: allowedOrigin }),
    {}, {}, { fetchImpl, resolver },
  );
  assert.equal(response.status, 413);
});

test('OG parser returns bounded metadata and resolves relative images', () => {
  const parsed = parseOpenGraph(
    '<html><head><title>Fallback</title><meta property="og:title" content="Example"><meta name="description" content="Desc"><meta property="og:image" content="/cover.png"><meta property="og:site_name" content="Site"></head></html>',
    'https://example.com/a/page',
  );
  assert.equal(parsed.title, 'Example');
  assert.equal(parsed.desc, 'Desc');
  assert.equal(parsed.image, 'https://example.com/cover.png');
  assert.equal(parsed.site_name, 'Site');
});

test('legacy /api route is explicitly gone', async () => {
  const response = await handleRequest(req('/api', { Origin: allowedOrigin }));
  assert.equal(response.status, 410);
});

test('current browser client no longer references the dead /api Worker route', () => {
  const index = read('index.html');
  assert.ok(!index.includes('Q=`${V}/api`'));
});

test('versioned Worker source contains no request logging of target URLs', () => {
  const source = read('worker/r4b1t-proxy.mjs');
  assert.ok(!source.includes('console.log'));
  assert.ok(!source.includes('console.error'));
});
