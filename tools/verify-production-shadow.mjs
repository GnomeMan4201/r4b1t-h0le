#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveCname } from 'node:dns/promises';

const ROOT = path.resolve('.');
const APP = 'https://gnomeman4201.github.io/r4b1t-h0le/';
const PUBLISHED_BRANCH = 'https://raw.githubusercontent.com/GnomeMan4201/r4b1t-h0le/gh-pages/';
const SITE = 'https://r4b1t.badbananaresearch.com/';
const WORKER = 'https://r4b1t-proxy.badbanana6969.workers.dev';
const EXPECTED_CNAME = 'gnomeman4201.github.io';

const CRITICAL_ASSETS = [
  'index.html',
  'r4b1t.html',
  'dual-shell.js',
  'dual-shell.css',
  'trail-runtime.js',
  'trail-manifest.js',
  'blind-runtime.js',
  'blind-manifest.js',
  'topology-runtime.js',
  'trail-topology.js',
  'trail-card.js',
  'trail-card-renderer.js',
  'trail-card-share.js',
  'trail-card.css',
  'trail-card-share.css',
  'trail-comparison.js',
  'trail-comparison-renderer.js',
  'trail-comparison-import.js',
  'trail-comparison.css',
  'trail-comparison-import.css',
  'proof-session.js',
  'proof-session-renderer.js',
  'proof-session-import.js',
  'proof-session.css',
  'proof-session-import.css',
  'replay-inspection.js',
  'replay-inspection-renderer.js',
  'replay-inspection-import.js',
  'replay-inspection-overlay.js',
  'replay-inspection.css',
  'trail-wear.js',
  'trail-wear.css',
  'sw.js',
  'manifest.json',
];

const ROOT_MARKERS = [
  'proof-session-import.js',
  'trail-comparison-import.js',
  'trail-card-share.js',
  'trail-topology.js',
  'replay-inspection-overlay.js',
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: init.redirect || 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

function logServingHeaders(label, response) {
  const headers = {
    'cache-control': response.headers.get('cache-control') || 'missing',
    etag: response.headers.get('etag') || 'missing',
    'last-modified': response.headers.get('last-modified') || 'missing',
  };
  console.log(
    `SERVING ${label} url=${response.url} cache-control="${headers['cache-control']}" etag="${headers.etag}" last-modified="${headers['last-modified']}"`,
  );
}

async function verifyCustomDomainDns() {
  const hostname = new URL(SITE).hostname;
  let records;

  try {
    records = await resolveCname(hostname);
  } catch (error) {
    fail(`custom-domain DNS: CNAME lookup failed for ${hostname}: ${error?.code || error?.message || error}`);
    return;
  }

  const normalized = records.map((record) => record.toLowerCase().replace(/\.$/, ''));
  console.log(`DNS CNAME ${hostname} -> ${normalized.join(', ') || 'none'}`);

  if (normalized.length !== 1 || normalized[0] !== EXPECTED_CNAME) {
    fail(`custom-domain DNS: expected CNAME ${EXPECTED_CNAME}, got ${normalized.join(', ') || 'none'}`);
  }
}

async function verifyHttpRedirect() {
  const httpUrl = SITE.replace(/^https:/, 'http:');
  const response = await fetchWithTimeout(httpUrl, { redirect: 'manual' });
  const location = response.headers.get('location');

  if (![301, 302, 307, 308].includes(response.status)) {
    fail(`custom-domain redirect: expected HTTP redirect from ${httpUrl}, got ${response.status}`);
    return;
  }

  if (!location) {
    fail('custom-domain redirect: missing Location header');
    return;
  }

  const resolved = new URL(location, httpUrl);
  if (resolved.protocol !== 'https:') {
    fail(`custom-domain redirect: expected HTTPS target, got ${resolved.href}`);
  }
  if (resolved.hostname !== new URL(SITE).hostname) {
    fail(`custom-domain redirect: unexpected host ${resolved.hostname}`);
  } else {
    console.log(`REDIRECT ${httpUrl} -> ${resolved.href}`);
  }
}

async function verifyPagesRedirect() {
  const response = await fetchWithTimeout(APP, { redirect: 'manual' });
  const location = response.headers.get('location');
  const expectedHost = new URL(SITE).hostname;

  if (![301, 302, 307, 308].includes(response.status)) {
    fail(`pages redirect: expected redirect from ${APP}, got HTTP ${response.status}`);
    return;
  }

  if (!location) {
    fail('pages redirect: missing Location header');
    return;
  }

  const resolved = new URL(location, APP);
  if (resolved.hostname !== expectedHost) {
    fail(`pages redirect: expected custom-domain host, got ${resolved.hostname}`);
    return;
  }

  console.log(`PAGES REDIRECT ${APP} -> ${resolved.href}`);

  const finalResponse = await fetchWithTimeout(APP);
  const finalUrl = new URL(finalResponse.url);

  if (!finalResponse.ok) {
    fail(`pages redirect: final custom-domain response returned HTTP ${finalResponse.status}`);
  }
  if (finalUrl.protocol !== 'https:') {
    fail(`pages redirect: redirect chain did not terminate on HTTPS (${finalUrl.href})`);
  }
  if (finalUrl.hostname !== expectedHost) {
    fail(`pages redirect: redirect chain terminated on unexpected host ${finalUrl.hostname}`);
  } else if (finalUrl.protocol === 'https:') {
    console.log(`PAGES FINAL ${APP} -> ${finalUrl.href}`);
  }
}

async function fetchAsset(origin, file, label) {
  const assetUrl = new URL(file, origin);
  // raw.githubusercontent.com can briefly serve a cached pre-deploy branch object
  // after gh-pages moves. A per-run query forces parity to inspect current branch bytes.
  if (origin === PUBLISHED_BRANCH) {
    assetUrl.searchParams.set('shadow', String(Date.now()));
  }
  const response = await fetchWithTimeout(assetUrl);

  if (!response.ok) {
    fail(`${file}: ${label} returned HTTP ${response.status}`);
    return null;
  }

  if (!response.url.startsWith('https://')) {
    fail(`${file}: ${label} did not terminate on HTTPS (${response.url})`);
  }

  const expectedHost = new URL(origin).hostname;
  if (new URL(response.url).hostname !== expectedHost) {
    fail(`${file}: ${label} unexpectedly redirected to ${response.url}`);
  }

  logServingHeaders(`${label}:${file}`, response);

  return Buffer.from(await response.arrayBuffer());
}

async function verifyAssetParity() {
  for (const file of CRITICAL_ASSETS) {
    const local = fs.readFileSync(path.join(ROOT, file));
    const [published, site] = await Promise.all([
      fetchAsset(PUBLISHED_BRANCH, file, 'published-branch'),
      fetchAsset(SITE, file, 'custom-domain'),
    ]);

    if (!published || !site) continue;

    const localHash = sha256(local);
    const publishedHash = sha256(published);
    const siteHash = sha256(site);

    if (localHash !== publishedHash) {
      fail(`${file}: published-branch hash ${publishedHash} != repository hash ${localHash}`);
    }
    if (localHash !== siteHash) {
      fail(`${file}: custom-domain hash ${siteHash} != repository hash ${localHash}`);
    }
    if (publishedHash !== siteHash) {
      fail(`${file}: published-branch hash ${publishedHash} != custom-domain hash ${siteHash}`);
    }

    if (localHash === publishedHash && publishedHash === siteHash) {
      console.log(`PARITY ${file} ${siteHash}`);
    }
  }
}

async function verifyFrontDoor() {
  const response = await fetchWithTimeout(SITE);

  if (!response.ok) {
    fail(`custom-domain root: expected 2xx, got HTTP ${response.status}`);
    return;
  }

  if (!response.url.startsWith('https://')) {
    fail(`custom-domain root: HTTPS termination failed at ${response.url}`);
  }

  if (new URL(response.url).hostname !== new URL(SITE).hostname) {
    fail(`custom-domain root: unexpected redirect to ${response.url}`);
  }

  logServingHeaders('custom-domain:root', response);

  const html = await response.text();
  for (const marker of ROOT_MARKERS) {
    if (!html.includes(marker)) {
      fail(`custom-domain root: release-critical entry point missing: ${marker}`);
    }
  }
}

async function verifyWorkerHeaders() {
  const response = await fetchWithTimeout(
    WORKER + '/og?url=' + encodeURIComponent('https://example.com'),
    { headers: { Origin: 'https://gnomeman4201.github.io' } },
  );

  if (response.status !== 200) {
    fail(`Worker health: expected 200, got HTTP ${response.status}`);
    return;
  }

  const nosniff = response.headers.get('x-content-type-options');
  const referrer = response.headers.get('referrer-policy');

  if ((nosniff || '').toLowerCase() !== 'nosniff') {
    fail(`Worker header drift: x-content-type-options=${nosniff || 'missing'}`);
  }
  if ((referrer || '').toLowerCase() !== 'no-referrer') {
    fail(`Worker header drift: referrer-policy=${referrer || 'missing'}`);
  }
}

try {
  await verifyCustomDomainDns();
  await verifyHttpRedirect();
  await verifyPagesRedirect();
  await verifyFrontDoor();
  await verifyAssetParity();
  await verifyWorkerHeaders();
} catch (error) {
  fail(`production-shadow exception: ${error?.message || error}`);
}

if (failures.length) {
  console.error(`Production-shadow verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production-shadow verification passed for ${CRITICAL_ASSETS.length} release-critical assets.`);
