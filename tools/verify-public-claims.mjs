#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const LIVE = process.argv.includes('--live');

const REPO = 'https://github.com/GnomeMan4201/r4b1t-h0le';
const PROJECT_SITE = 'https://r4b1t.badbananaresearch.com';
const APP = 'https://gnomeman4201.github.io/r4b1t-h0le/';
const WORKER = 'https://r4b1t-proxy.badbanana6969.workers.dev';
const OLD_REPO = 'https://github.com/GnomeMan4201/r4b1t.git';
const OLD_WORKER = 'https://r4b1t-proxy.gnomeman4201.workers.dev';

const failures = [];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function claim(ok, message) {
  if (!ok) failures.push(message);
}

function includes(content, value, label) {
  claim(content.includes(value), `${label}: missing ${value}`);
}

function excludes(content, value, label) {
  claim(!content.includes(value), `${label}: stale value still present: ${value}`);
}

function corpusMetricsFromText(content) {
  const lines = content.split(/\r?\n/);
  let validUrls = 0;
  const hosts = new Set();

  for (const rawLine of lines) {
    const value = rawLine.trim();
    if (!value) continue;

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) continue;
      validUrls += 1;
      hosts.add(parsed.hostname.replace(/\.$/, '').toLowerCase());
    } catch {
      // Invalid entries are accounted for by corpus-health CI.
    }
  }

  return { validUrls, uniqueHosts: hosts.size };
}

function verifyCorpusClaims(readme) {
  const legacyEvidence = read('docs/evidence/legacy-corpus-evidence.md');
  const legacy = corpusMetricsFromText(read('urls.txt'));
  const releaseManifest = JSON.parse(
    read('corpus/releases/typed-candidate-v0.1/manifest.json'),
  );
  const promotion = JSON.parse(read('corpus/runtime/active-v1.json'));

  const activeCount = releaseManifest.counts.resources;
  const activeHosts = releaseManifest.counts.unique_hosts;
  const activeTypes = Object.keys(releaseManifest.counts.resource_types || {}).length;

  claim(
    promotion.active.source_id === 'typed-candidate-v0.1' &&
      promotion.active.selection_authority === true &&
      promotion.active.expected_digest === releaseManifest.urls_digest,
    'runtime promotion drift: active typed release does not match release manifest',
  );
  claim(
    promotion.release_assertion.selection_authority === false,
    'runtime promotion drift: historical release assertion must remain non-authoritative',
  );

  claim(
    readme.includes(`**${activeCount.toLocaleString('en-US')} resources across ${activeHosts.toLocaleString('en-US')} hosts**`),
    `README active corpus count drift: expected ${activeCount.toLocaleString('en-US')} typed resources`,
  );
  claim(
    readme.includes('./corpus/runtime/active-v1.json') &&
      readme.includes('./corpus/releases/typed-candidate-v0.1/manifest.json'),
    'README must link active corpus authority and release evidence',
  );
  claim(
    readme.includes(`**${activeTypes.toLocaleString('en-US')} resource types**`),
    `README active type count drift: expected ${activeTypes.toLocaleString('en-US')} resource types`,
  );

  const legacyValidLabel = legacy.validUrls.toLocaleString('en-US');
  const legacyHostLabel = legacy.uniqueHosts.toLocaleString('en-US');
  claim(
    legacyEvidence.includes(`Structurally valid URLs | **${legacyValidLabel}**`),
    `legacy evidence drift: expected ${legacyValidLabel} structurally valid URLs`,
  );
  claim(
    legacyEvidence.includes(`Unique hosts | **${legacyHostLabel}**`),
    `legacy evidence drift: expected ${legacyHostLabel} unique hosts`,
  );
  claim(
    legacyEvidence.includes('legacy 50,109-URL audit baseline') &&
      legacyEvidence.includes('It is no longer the active production selection corpus') &&
      readme.includes('./docs/evidence/legacy-corpus-evidence.md'),
    'README must distinguish legacy frozen evidence from current runtime authority',
  );
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

function verifyStaticClaims() {
  const readme = read('README.md');
  const index = read('index.html');
  const workerDoc = read('docs/WORKER_TRUST_BOUNDARY.md');
  const deployWorkflow = read('.github/workflows/deploy-worker.yml');
  const auditTool = read('tools/audit-worker-boundary.mjs');
  const wrangler = read('wrangler.toml');

  includes(readme, REPO, 'README');
  includes(readme, PROJECT_SITE, 'README');
  includes(readme, APP, 'README');
  excludes(readme, OLD_REPO, 'README');
  excludes(readme, OLD_WORKER, 'README');
  verifyCorpusClaims(readme);

  includes(index, WORKER, 'index.html');
  excludes(index, OLD_WORKER, 'index.html');

  includes(workerDoc, WORKER, 'Worker trust-boundary documentation');
  includes(workerDoc, 'production-equivalent', 'Worker trust-boundary documentation');
  excludes(workerDoc, 'Tracking issue: #38.', 'Worker trust-boundary documentation');
  excludes(workerDoc, 'not claimed to match production', 'Worker trust-boundary documentation');
  excludes(workerDoc, 'custom-domain Origin is rejected', 'Worker trust-boundary documentation');

  includes(deployWorkflow, WORKER, 'Worker deployment workflow');
  includes(auditTool, WORKER, 'Worker audit tool');

  includes(wrangler, 'global_fetch_strictly_public', 'wrangler.toml');
  includes(wrangler, 'REQUIRE_RATE_LIMIT = "true"', 'wrangler.toml');
  includes(wrangler, 'limit = 60', 'wrangler.toml');
  includes(wrangler, 'period = 60', 'wrangler.toml');
}

async function verifyLiveClaims() {
  const site = await fetchWithTimeout(PROJECT_SITE);
  claim(site.ok, `project site: expected 2xx, got ${site.status}`);

  const app = await fetchWithTimeout(APP);
  claim(app.ok, `GitHub Pages app: expected 2xx, got ${app.status}`);
  const appHtml = await app.text();
  claim(appHtml.includes(WORKER), 'GitHub Pages app: deployed client does not reference the current Worker hostname');
  claim(!appHtml.includes(OLD_WORKER), 'GitHub Pages app: stale Worker hostname is still deployed');

  const og = await fetchWithTimeout(
    WORKER + '/og?url=' + encodeURIComponent('https://example.com'),
    { headers: { Origin: 'https://gnomeman4201.github.io' } },
  );
  claim(og.status === 200, `Worker pages Origin: expected 200, got ${og.status}`);
  if (og.status === 200) {
    const body = await og.json().catch(() => null);
    claim(body && typeof body.title === 'string' && body.title.length > 0, 'Worker OG response: missing title');
  }

  const custom = await fetchWithTimeout(
    WORKER + '/og?url=' + encodeURIComponent('https://example.com'),
    { headers: { Origin: PROJECT_SITE } },
  );
  claim(custom.status === 200, `Worker custom-domain Origin: expected 200, got ${custom.status}`);

  const evil = await fetchWithTimeout(
    WORKER + '/og?url=' + encodeURIComponent('https://example.com'),
    { headers: { Origin: 'https://evil.example' } },
  );
  claim(evil.status === 403, `Worker unknown Origin: expected 403, got ${evil.status}`);

  const legacy = await fetchWithTimeout(
    WORKER + '/api',
    { headers: { Origin: 'https://gnomeman4201.github.io' } },
  );
  claim(legacy.status === 410, `Worker legacy /api: expected 410, got ${legacy.status}`);
}

verifyStaticClaims();
if (LIVE) {
  try {
    await verifyLiveClaims();
  } catch (error) {
    failures.push(`live verifier exception: ${error?.message || error}`);
  }
}

if (failures.length) {
  console.error(`Public-claim verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public-claim verification passed (${LIVE ? 'static + live' : 'static'}).`);
