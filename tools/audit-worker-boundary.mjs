#!/usr/bin/env node

const BASE = process.env.R4B1T_WORKER_URL || 'https://r4b1t-proxy.badbanana6969.workers.dev';
const PAGES_ORIGIN = 'https://gnomeman4201.github.io';
const CUSTOM_ORIGIN = 'https://r4b1t.badbananaresearch.com';
const JSON_OUTPUT = process.argv.includes('--json');
const contractArg = process.argv.find((arg) => arg.startsWith('--contract='));
const CONTRACT = contractArg ? contractArg.split('=', 2)[1] : 'deployed';
const TIMEOUT_MS = Number.parseInt(process.env.R4B1T_WORKER_AUDIT_TIMEOUT_MS || '8000', 10);
const DELAY_MS = Number.parseInt(process.env.R4B1T_WORKER_AUDIT_DELAY_MS || '200', 10);

if (!['deployed', 'versioned'].includes(CONTRACT)) {
  console.error('Usage: node tools/audit-worker-boundary.mjs [--contract=deployed|versioned] [--json]');
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function route(path, target) {
  return `${path}?url=${encodeURIComponent(target)}`;
}

async function request({ path, origin, method = 'GET' }) {
  const headers = {};
  if (origin !== undefined) headers.Origin = origin;

  try {
    const response = await fetch(BASE + path, {
      method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = method === 'HEAD'
      ? ''
      : (await response.text()).slice(0, 180).replace(/\s+/g, ' ').trim();

    return {
      status: response.status,
      acao: response.headers.get('access-control-allow-origin'),
      allowMethods: response.headers.get('access-control-allow-methods'),
      cacheControl: response.headers.get('cache-control'),
      contentType: response.headers.get('content-type'),
      nosniff: response.headers.get('x-content-type-options'),
      referrerPolicy: response.headers.get('referrer-policy'),
      location: response.headers.get('location'),
      body,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function allowedAcao(acao, origin) {
  return acao === origin || acao === '*';
}

function evaluate(expectation, result, origin) {
  if (result.error) return { pass: false, reason: result.error };

  if (expectation === 'allow') {
    const pass = result.status >= 200 && result.status < 400 && allowedAcao(result.acao, origin);
    return {
      pass,
      reason: pass
        ? `allowed with ACAO ${result.acao}`
        : `expected 2xx/3xx + readable CORS response; got ${result.status} / ${result.acao || 'none'}`,
    };
  }

  if (expectation === 'reject-origin') {
    const pass = result.status === 403;
    return {
      pass,
      reason: pass ? 'origin rejected' : `expected 403; got HTTP ${result.status}`,
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
    const pass = result.status === 200 && /disabled/i.test(result.body || '');
    return {
      pass,
      reason: pass ? 'legacy API disabled response observed' : `expected disabled response; got HTTP ${result.status}: ${result.body || ''}`,
    };
  }

  if (expectation === 'api-gone') {
    const pass = result.status === 410;
    return {
      pass,
      reason: pass ? 'legacy API returns 410' : `expected HTTP 410; got ${result.status}`,
    };
  }

  if (expectation === 'method-not-allowed') {
    const pass = result.status === 405;
    return {
      pass,
      reason: pass ? 'method rejected' : `expected HTTP 405; got ${result.status}`,
    };
  }

  if (expectation === 'preflight') {
    const pass = result.status === 204 && allowedAcao(result.acao, origin);
    return {
      pass,
      reason: pass ? 'preflight accepted' : `expected 204 preflight; got ${result.status} / ${result.acao || 'none'}`,
    };
  }

  if (expectation === 'security-headers') {
    const pass = result.status === 200 &&
      result.nosniff?.toLowerCase() === 'nosniff' &&
      result.referrerPolicy?.toLowerCase() === 'no-referrer';
    return {
      pass,
      reason: pass
        ? 'security headers present'
        : `expected nosniff + no-referrer; got ${result.nosniff || 'none'} / ${result.referrerPolicy || 'none'}`,
    };
  }

  return { pass: false, reason: `unknown expectation: ${expectation}` };
}

const SAFE_IMAGE = 'https://github.githubassets.com/favicons/favicon.png';
const SAFE_HTML = 'https://example.com';

const cases = [
  { name: 'pages /proxy public image', path: route('/proxy', SAFE_IMAGE), origin: PAGES_ORIGIN, expect: 'allow' },
  { name: 'pages /og public HTML', path: route('/og', SAFE_HTML), origin: PAGES_ORIGIN, expect: 'allow' },

  { name: 'missing Origin', path: route('/og', SAFE_HTML), origin: undefined, expect: 'reject-origin' },
  { name: 'null Origin', path: route('/og', SAFE_HTML), origin: 'null', expect: 'reject-origin' },
  { name: 'unrelated Origin', path: route('/og', SAFE_HTML), origin: 'https://evil.example', expect: 'reject-origin' },
  { name: 'prefix-confusion Origin', path: route('/og', SAFE_HTML), origin: 'https://gnomeman4201.github.io.evil.example', expect: 'reject-origin' },

  {
    name: 'custom-domain Origin',
    path: route('/og', SAFE_HTML),
    origin: CUSTOM_ORIGIN,
    expect: CONTRACT === 'versioned' ? 'allow' : 'reject-origin',
  },

  {
    name: 'legacy /api contract',
    path: '/api',
    origin: PAGES_ORIGIN,
    expect: CONTRACT === 'versioned' ? 'api-gone' : 'api-disabled',
  },

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

if (CONTRACT === 'versioned') {
  cases.push(
    { name: 'allowed preflight', path: route('/og', SAFE_HTML), origin: PAGES_ORIGIN, method: 'OPTIONS', expect: 'preflight' },
    { name: 'POST is rejected', path: route('/og', SAFE_HTML), origin: PAGES_ORIGIN, method: 'POST', expect: 'method-not-allowed' },
    { name: 'security headers', path: route('/og', SAFE_HTML), origin: PAGES_ORIGIN, expect: 'security-headers' },
  );
}

const results = [];
for (const testCase of cases) {
  const observed = await request(testCase);
  const verdict = evaluate(testCase.expect, observed, testCase.origin);
  results.push({ ...testCase, ...observed, ...verdict });
  await sleep(DELAY_MS);
}

const failures = results.filter((result) => !result.pass);

if (JSON_OUTPUT) {
  process.stdout.write(JSON.stringify({
    worker: BASE,
    contract: CONTRACT,
    passed: failures.length === 0,
    results,
  }, null, 2) + '\n');
} else {
  console.log(`r4b1t Worker boundary audit: ${BASE}`);
  console.log(`expected contract: ${CONTRACT}\n`);

  for (const result of results) {
    const mark = result.pass ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${result.name} — ${result.reason}`);
  }

  console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
}

if (failures.length) process.exitCode = 1;
