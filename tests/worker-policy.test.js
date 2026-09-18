'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

async function policy() {
  return import('../worker/src/policy.mjs');
}

test('target policy accepts ordinary public HTTP(S) URLs', async () => {
  const { validateTargetUrl } = await policy();
  assert.equal(validateTargetUrl('https://example.com/path').hostname, 'example.com');
  assert.equal(validateTargetUrl('http://93.184.216.34/').hostname, '93.184.216.34');
});

test('target policy rejects credentials and non-HTTP schemes', async () => {
  const { validateTargetUrl } = await policy();
  for (const value of [
    'file:///etc/passwd',
    'data:text/plain,hello',
    'javascript:alert(1)',
    'ftp://example.com/',
    'gopher://example.com/',
    'https://user:pass@example.com/'
  ]) {
    assert.throws(() => validateTargetUrl(value));
  }
});

test('target policy rejects private, loopback, link-local, reserved and encoded IPv4 targets', async () => {
  const { validateTargetUrl } = await policy();
  for (const value of [
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://0177.0.0.1/',
    'http://10.0.0.1/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/',
    'http://0.0.0.0/',
    'http://100.64.0.1/',
    'http://192.0.2.1/',
    'http://198.51.100.1/',
    'http://203.0.113.1/'
  ]) {
    assert.throws(() => validateTargetUrl(value), value);
  }
});

test('target policy rejects local/private IPv6 targets', async () => {
  const { validateTargetUrl } = await policy();
  for (const value of [
    'http://[::]/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[fd12:3456::1]/',
    'http://[fe80::1]/',
    'http://[ff02::1]/',
    'http://[2001:db8::1]/',
    'http://[::ffff:127.0.0.1]/'
  ]) {
    assert.throws(() => validateTargetUrl(value), value);
  }
});

test('browser Origin policy uses exact matches rather than prefixes', async () => {
  const { isAllowedOrigin } = await policy();
  const allowed = new Set(['https://gnomeman4201.github.io']);
  assert.equal(isAllowedOrigin('https://gnomeman4201.github.io', allowed), true);
  assert.equal(isAllowedOrigin('https://gnomeman4201.github.io.evil.example', allowed), false);
  assert.equal(isAllowedOrigin('null', allowed), false);
  assert.equal(isAllowedOrigin(null, allowed), false);
});

test('resolved-address policy rejects any private answer and fails closed without address answers', async () => {
  const { assertPublicDnsAnswers } = await policy();
  assert.doesNotThrow(() => assertPublicDnsAnswers(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']));
  assert.throws(() => assertPublicDnsAnswers(['93.184.216.34', '127.0.0.1']));
  assert.throws(() => assertPublicDnsAnswers([]));
});

test('redirect policy re-validates every hop and rejects private redirect destinations', async () => {
  const { resolveRedirectTarget } = await policy();
  assert.equal(
    resolveRedirectTarget('https://example.com/a', '/next').href,
    'https://example.com/next'
  );
  assert.throws(() => resolveRedirectTarget('https://example.com/a', 'http://127.0.0.1/'));
});
