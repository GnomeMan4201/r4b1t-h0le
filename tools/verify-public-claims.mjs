#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
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

// ADR 0006 / TERRAIN_AUTHORITY_CONTRACT.md: promotion → registry → runtime pins → index bytes → README.
function verifyTerrainAuthorityClaims(readme) {
  const promotion = JSON.parse(read('corpus/runtime/active-v1.json'));
  // The release is whatever the promotion record names; nothing release-specific is hard-coded here.
  const releaseManifest = JSON.parse(read(promotion.active.manifest_url));
  claim(releaseManifest.release_id === promotion.active.release_id, 'terrain authority drift: promotion manifest is not the active release');
  const registry = JSON.parse(read('corpus/runtime/eligibility-profiles-v1.json'));
  const pins = read('terrain-authority.js');
  claim(registry.schema === 'r4b1t-eligibility-profiles-v1', 'eligibility profile registry schema drift');
  const active = (registry.profiles || []).filter(p => p.status === 'active' && p.release.release_id === promotion.active.release_id);
  claim(active.length === 1, 'eligibility profile registry must hold exactly one active profile for the active release');
  if (active.length !== 1) return;
  const profile = active[0];
  claim(profile.release.urls_digest === promotion.active.expected_digest, 'terrain authority drift: profile release is not the active promotion');
  claim(profile.release.resources_digest === releaseManifest.resources_digest, 'terrain authority drift: profile resources digest');
  claim(profile.release.release_id === releaseManifest.release_id, 'terrain authority drift: profile release id');
  claim(profile.promotion_id === promotion.promotion_id, 'terrain authority drift: profile promotion id');
  const bytes = fs.readFileSync(path.join(ROOT, profile.terrain_index.path));
  const digest = 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
  claim(digest === profile.terrain_index.digest, 'terrain authority drift: index bytes do not match the registry digest');
  for (const value of [profile.profile_id, profile.terrain_index.path, profile.terrain_index.digest, profile.release.urls_digest, profile.release.resources_digest]) {
    includes(pins, value, 'terrain-authority.js pins');
  }
  const index = JSON.parse(bytes.toString('utf8'));
  claim(readme.includes('./corpus/runtime/eligibility-profiles-v1.json'), 'README must link the eligibility profile registry');
  for (const terrain of index.terrains) {
    includes(readme, `| \`${terrain.id}\` | ${terrain.label} | ${terrain.count} |`, 'README terrain table');
  }
}

// POST_SELECTION_RESOURCE_METADATA_CONTRACT.md follows the active source; it never pins a release snapshot.
// promotion → runtime activeSource → release manifest → resources.json bytes, and the contract names only
// the binding (activeSource.*), never any checked-in release's ID, digests or count.
function verifyMetadataContractClaims() {
  const promotion = JSON.parse(read('corpus/runtime/active-v1.json'));
  const corpusAuthority = createRequire(import.meta.url)(path.join(ROOT, 'corpus-authority.js'));
  const active = corpusAuthority.active();
  claim(
    active.releaseId === promotion.active.release_id &&
      active.url === promotion.active.url &&
      active.resourcesUrl === promotion.active.resources_url &&
      active.manifestUrl === promotion.active.manifest_url &&
      active.expectedDigest === promotion.active.expected_digest &&
      active.promotionId === promotion.promotion_id,
    'metadata source drift: runtime activeSource does not match the promotion record',
  );
  const manifest = JSON.parse(read(promotion.active.manifest_url));
  claim(
    manifest.release_id === active.releaseId &&
      manifest.resources_digest === active.expectedResourcesDigest &&
      manifest.counts.resources === active.expectedResourceCount,
    'metadata source drift: runtime activeSource does not match the active release manifest',
  );
  const resourceBytes = fs.readFileSync(path.join(ROOT, active.resourcesUrl));
  claim(
    'sha256:' + crypto.createHash('sha256').update(resourceBytes).digest('hex') === active.expectedResourcesDigest,
    'metadata source drift: active resources.json bytes do not match expectedResourcesDigest',
  );

  const label = 'POST_SELECTION_RESOURCE_METADATA_CONTRACT.md';
  const contract = read(label);
  for (const binding of ["active source's `resourcesUrl`", 'activeSource.expectedResourcesDigest', 'activeSource.releaseId', 'activeSource.expectedResourceCount']) {
    includes(contract, binding, `${label} (active-source binding)`);
  }
  const releasesDir = path.join(ROOT, 'corpus', 'releases');
  for (const entry of fs.readdirSync(releasesDir, { withFileTypes: true })) {
    const manifestPath = path.join(releasesDir, entry.name, 'manifest.json');
    if (!entry.isDirectory() || !fs.existsSync(manifestPath)) continue;
    const release = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const pinned of [release.release_id, release.urls_digest, release.resources_digest]) {
      if (pinned) excludes(contract, pinned, `${label} (release snapshot pinned)`);
    }
    const count = release.counts && release.counts.resources;
    if (Number.isSafeInteger(count)) {
      for (const form of new Set([String(count), count.toLocaleString('en-US')])) {
        claim(!new RegExp(`(^|[^0-9,])${form}(?![0-9,])`).test(contract),
          `${label} (release snapshot pinned): resource count ${form} of ${release.release_id}`);
      }
    }
  }
}

function verifyCorpusClaims(readme) {
  const legacyEvidence = read('docs/readme/legacy-corpus-evidence.md');
  const legacy = corpusMetricsFromText(read('urls.txt'));
  const releaseManifest = JSON.parse(
    read('corpus/releases/diverse-candidate-v0.2/manifest.json'),
  );
  const promotion = JSON.parse(read('corpus/runtime/active-v1.json'));

  const activeCount = releaseManifest.counts.resources;
  const activeHosts = releaseManifest.counts.unique_hosts;
  const activeTypes = Object.keys(releaseManifest.counts.resource_types || {}).length;

  claim(
    promotion.active.source_id === 'diverse-candidate-v0.2' &&
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
      readme.includes('./corpus/releases/diverse-candidate-v0.2/manifest.json'),
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
      readme.includes('./docs/readme/legacy-corpus-evidence.md'),
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
  verifyTerrainAuthorityClaims(readme);
  verifyMetadataContractClaims();

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
