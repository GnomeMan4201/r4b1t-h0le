#!/usr/bin/env node

const BASE = process.env.R4B1T_WORKER_URL || 'https://r4b1t-proxy.gnomeman4201.workers.dev';
const PAGES_ORIGIN = 'https://gnomeman4201.github.io';
const CUSTOM_ORIGIN = 'https://r4b1t.badbananaresearch.com';
const REQUIRE_CUSTOM = process.argv.includes('--require-custom-origin');
const JSON_OUTPUT = process.argv.includes('--json');
const TIMEOUT_MS = Number.parseInt(process.env.R4B1T_WORKER_AUDIT_TIMEOUT_MS || '8000', 10);
const DELAY_MS = Number.parseInt(process.env.R4B1T_WORKER_AUDIT_DELAY_MS || '200', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function route(path, target) {
  return `${path}?url=${encodeURIComponent(target)}`;
}

async function request(path, origin) {
  const headers = {};
  if (origin !== undefined) headers.Origin = origin;

  try {
    const response = await fetch(BASE + path, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.text()).slice(0, 180).replace(/\s+/g, ' ').trim();
    return {
      status: response.status,
      acao: response.headers.get('access-control-allow-origin'),
      contentType: response.headers.get('content-type'),
      location: response.headers.get('location'),
      body,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function evaluate(expectation, result, origin) {
  if (result.error) return { pass: false, reason: result.error };

  if (expectation === 'allow') {
    const pass = result.status >= 200 && result.status < 400 && result.acao === origin;
    return {
      pass,
      reason: pass ? 'allowed with exact ACAO' : `expected 2xx/3xx + ACAO ${origin}; got ${result.status} / ${result.acao || 'none'}`,
    };
  }

  if (expectation === 'reject-origin') {
    const pass = result.status === 403 && !result.acao;
    return {
      pass,
      reason: pass ? 'origin rejected' : `expected 403 without ACAO; got ${result.status} / ${result.acao || 'none'}`,
    };
  }

  if (expectation === 'block-target') {
    const pass = result.status >= 400;
    return {
      pass,
      reason: pass ? `blocked with HTTP ${result.status}` : `expected blocked target; got HTTP ${result.status}`,
    };
  }

  if (expectation === 'api-disabled') {
    const pass = result.status === 200 && result.acao === origin && /disabled/i.test(result.body || '');
    return {
      pass,
      reason: pass ? 'disabled API contract observed' : `expected disabled API response; got HTTP ${result.status}: ${result.body || ''}`,
    };
  }

  if (expectation === 'custom-origin') {
    if (!REQUIRE_CUSTOM) {
      return {
        pass: true,
        informational: true,
        reason: result.status === 403
          ? 'custom Origin remains rejected (current documented behavior)'
          : `custom Origin response changed: HTTP ${result.status} / ACAO ${result.acao || 'none'}`,
      };
    }
    const pass = result.status >= 200 && result.status < 400 && result.acao === origin;
    return {
      pass,
      reason: pass ? 'custom Origin allowed' : `custom Origin required but got HTTP ${result.status} / ACAO ${result.acao || 'none'}`,
    };
  }

  return { pass: false, reason: `unknown expectation: ${expectation}` };
}

const cases = [
  { name: 'pages /proxy public HTTPS', path: route('/proxy', 'https://example.com'), origin: PAGES_ORIGIN, expect: 'allow' },
  { name: 'pages /og public HTTPS', path: route('/og', 'https://example.com'), origin: PAGES_ORIGIN, expect: 'allow' },
  { name: 'pages /api disabled contract', path: route('/api', 'https://example.com'), origin: PAGES_ORIGIN, expect: 'api-disabled' },

  { name: 'missing Origin', path: route('/proxy', 'https://example.com'), origin: undefined, expect: 'reject-origin' },
  { name: 'null Origin', path: route('/proxy', 'https://example.com'), origin: 'null', expect: 'reject-origin' },
  { name: 'unrelated Origin', path: route('/proxy', 'https://example.com'), origin: 'https://evil.example', expect: 'reject-origin' },
  { name: 'prefix-confusion Origin', path: route('/proxy', 'https://example.com'), origin: 'https://gnomeman4201.github.io.evil.example', expect: 'reject-origin' },

  { name: 'custom /proxy Origin', path: route('/proxy', 'https://example.com'), origin: CUSTOM_ORIGIN, expect: 'custom-origin' },
  { name: 'custom /og Origin', path: route('/og', 'https://example.com'), origin: CUSTOM_ORIGIN, expect: 'custom-origin' },
  { name: 'custom /api Origin', path: route('/api', 'https://example.com'), origin: CUSTOM_ORIGIN, expect: 'custom-origin' },

  { name: 'loopback IPv4', path: route('/proxy', 'http://127.0.0.1/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'link-local metadata IPv4', path: route('/proxy', 'http://169.254.169.254/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'loopback IPv6', path: route('/proxy', 'http://[::1]/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'decimal loopback', path: route('/proxy', 'http://2130706433/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'hex loopback', path: route('/proxy', 'http://0x7f000001/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'octal loopback', path: route('/proxy', 'http://0177.0.0.1/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'RFC1918 10/8', path: route('/proxy', 'http://10.0.0.1/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'RFC1918 172.16/12', path: route('/proxy', 'http://172.16.0.1/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'RFC1918 192.168/16', path: route('/proxy', 'http://192.168.0.1/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'zero address', path: route('/proxy', 'http://0.0.0.0/'), origin: PAGES_ORIGIN, expect: 'block-target' },

  { name: 'file scheme', path: route('/proxy', 'file:///etc/passwd'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'data scheme', path: route('/proxy', 'data:text/plain,hello'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'javascript scheme', path: route('/proxy', 'javascript:alert(1)'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'ftp scheme', path: route('/proxy', 'ftp://example.com/'), origin: PAGES_ORIGIN, expect: 'block-target' },
  { name: 'gopher scheme', path: route('/proxy', 'gopher://example.com/'), origin: PAGES_ORIGIN, expect: 'block-target' },

  {
    name: 'redirect toward loopback',
    path: route('/proxy', 'https://httpbin.org/redirect-to?url=http://127.0.0.1/'),
    origin: PAGES_ORIGIN,
    expect: 'block-target',
  },
  { name: '/og loopback', path: route('/og', 'http://127.0.0.1/'), origin: PAGES_ORIGIN, expect: 'block-target' },
];

const results = [];
for (const testCase of cases) {
  const observed = await request(testCase.path, testCase.origin);
  const verdict = evaluate(testCase.expect, observed, testCase.origin);
  results.push({ ...testCase, ...observed, ...verdict });
  await sleep(DELAY_MS);
}

const failures = results.filter((result) => !result.pass);

if (JSON_OUTPUT) {
  process.stdout.write(JSON.stringify({
    worker: BASE,
    requireCustomOrigin: REQUIRE_CUSTOM,
    passed: failures.length === 0,
    results,
  }, null, 2) + '\n');
} else {
  console.log(`r4b1t Worker boundary audit: ${BASE}`);
  console.log(`custom Origin required: ${REQUIRE_CUSTOM ? 'yes' : 'no'}\n`);

  for (const result of results) {
    const mark = result.pass ? (result.informational ? 'INFO' : 'PASS') : 'FAIL';
    console.log(`${mark.padEnd(4)}  ${result.name} — ${result.reason}`);
  }

  console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
}

if (failures.length) process.exitCode = 1;
