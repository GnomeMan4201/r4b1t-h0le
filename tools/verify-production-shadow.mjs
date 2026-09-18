#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve('.');
const APP = 'https://gnomeman4201.github.io/r4b1t-h0le/';
const SITE = 'https://r4b1t.badbananaresearch.com/';
const WORKER = 'https://r4b1t-proxy.badbanana6969.workers.dev';

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
  'trail-wear.js',
  'trail-wear.css',
  'sw.js',
  'manifest.json',
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
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

async function verifyAssetParity() {
  for (const file of CRITICAL_ASSETS) {
    const local = fs.readFileSync(path.join(ROOT, file));
    const response = await fetchWithTimeout(new URL(file, APP));
    if (!response.ok) {
      fail(`${file}: live asset returned HTTP ${response.status}`);
      continue;
    }

    const live = Buffer.from(await response.arrayBuffer());
    const localHash = sha256(local);
    const liveHash = sha256(live);

    if (localHash !== liveHash) {
      fail(`${file}: production hash ${liveHash} != repository hash ${localHash}`);
    } else {
      console.log(`PARITY ${file} ${liveHash}`);
    }
  }
}

async function verifyFrontDoor() {
  const response = await fetchWithTimeout(SITE);
  if (!response.ok) {
    fail(`project site: expected 2xx, got HTTP ${response.status}`);
    return;
  }

  const html = await response.text();
  for (const marker of ['R4B1T_HOL3', 'NOT SEARCH', 'RABBIT HOLE']) {
    if (!html.toUpperCase().includes(marker)) {
      fail(`project site: expected marker missing: ${marker}`);
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
  await verifyAssetParity();
  await verifyFrontDoor();
  await verifyWorkerHeaders();
} catch (error) {
  fail(`production-shadow exception: ${error?.message || error}`);
}

if (failures.length) {
  console.error(`Production-shadow verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production-shadow verification passed for ${CRITICAL_ASSETS.length} critical assets.`);
