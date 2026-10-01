'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const CORPUS = [
  'https://github.com/example/alpha',
  'https://gist.github.com/example/bravo',
  'https://gitlab.com/example/charlie',
  'https://codeberg.org/example/delta',
  'https://sourceforge.net/projects/example-echo',
  'https://medium.com/@example/foxtrot',
  'https://dev.to/example/golf',
];

const CODE_POOL = CORPUS.slice(0, 5);
const BLOG_POOL = CORPUS.slice(5);
const FIXTURE_BYTES = Buffer.from(CORPUS.join('\n') + '\n', 'utf8');
const FIXTURE_DIGEST = (
  'sha256:' + crypto.createHash('sha256').update(FIXTURE_BYTES).digest('hex')
);
const AUTHORITY_PATH = path.resolve(__dirname, '..', 'corpus-authority.js');
const AUTHORITY_SOURCE = fs.readFileSync(AUTHORITY_PATH, 'utf8');
const ACTIVE_DIGEST = 'sha256:ba52be7e2fc9120f3bd1ac2a6bacbc61fc937764e6d4637df8711ec2212bf75c';
const FIXTURE_AUTHORITY_SOURCE = AUTHORITY_SOURCE.replace(
  ACTIVE_DIGEST,
  FIXTURE_DIGEST,
);

if (FIXTURE_AUTHORITY_SOURCE === AUTHORITY_SOURCE) {
  throw new Error('CF-1 fixture could not bind corpus-authority.js to fixture digest');
}

// PR 1: terrain membership comes from a registry-anchored terrain index bound to the active release.
// The fixture corpus gets a matching fixture index: CODE_POOL → repository, BLOG_POOL → reference.
const CODE_TERRAIN = 'REPOSITORY';
const BLOG_TERRAIN = 'REFERENCE';
const ACTIVE_RESOURCES_DIGEST = 'sha256:529a3bcf10b0933ce92428932035750ae0fe93f1490aaa1a40c1384d7ec57aca';
const ACTIVE_INDEX_DIGEST = 'sha256:a9bbe4fc56020314a11195c9339fa3a04a14082d6b2f6c259c78be6ee38af5fd';
const cj1 = require(path.resolve(__dirname, '..', 'cj1.js'));
const FIXTURE_INDEX_BYTES = Buffer.from(cj1.serialize({
  schema: 'r4b1t-terrain-index-v1',
  release: { release_id: 'diverse-candidate-v0.2', urls_digest: FIXTURE_DIGEST, resources_digest: ACTIVE_RESOURCES_DIGEST },
  vocabulary: 'resource-type-identity-v1',
  terrains: [
    { id: 'reference', label: 'REFERENCE', rule: { resource_type: ['reference'] }, count: 2, members: [5, 6] },
    { id: 'repository', label: 'REPOSITORY', rule: { resource_type: ['repository'] }, count: 5, members: [0, 1, 2, 3, 4] },
  ],
}) + '\n', 'utf8');
const FIXTURE_INDEX_DIGEST = 'sha256:' + crypto.createHash('sha256').update(FIXTURE_INDEX_BYTES).digest('hex');
const TERRAIN_AUTHORITY_SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'terrain-authority.js'), 'utf8');
const FIXTURE_TERRAIN_AUTHORITY_SOURCE = TERRAIN_AUTHORITY_SOURCE
  .replace(ACTIVE_DIGEST, FIXTURE_DIGEST)
  .replace(ACTIVE_INDEX_DIGEST, FIXTURE_INDEX_DIGEST);
if (!FIXTURE_TERRAIN_AUTHORITY_SOURCE.includes(FIXTURE_DIGEST) || !FIXTURE_TERRAIN_AUTHORITY_SOURCE.includes(FIXTURE_INDEX_DIGEST)) {
  throw new Error('CF-1 fixture could not bind terrain-authority.js to the fixture release and index');
}

function independentSampler(seed) {
  const bytes = new TextEncoder().encode(String(seed));
  let state = 2166136261;
  for (const byte of bytes) {
    state ^= byte;
    state = Math.imul(state, 16777619);
  }
  state >>>= 0;
  return function nextFloat() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function independentlySelect(pool, seed, priorUrl) {
  const random = independentSampler(seed);
  let selected = null;
  let attempts = 0;
  do {
    selected = pool[Math.floor(random() * pool.length)];
    attempts += 1;
    if (selected !== priorUrl) break;
  } while (attempts < 30);
  return { selected, attempts };
}

async function configurePage(page) {
  await page.addInitScript(() => {
    // Test-only deterministic entropy. Production code and selection APIs are
    // untouched; this makes the declared trail seed stable and makes ambient
    // Math.random use observable when the production path bypasses that seed.
    const nativeGetRandomValues = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array) {
        if (array instanceof Uint8Array) {
          for (let index = 0; index < array.length; index += 1) array[index] = index + 1;
          return array;
        }
        return nativeGetRandomValues(array);
      },
    });
    Math.random = () => 0.999999;
  });

  await page.route('**/corpus-authority.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: FIXTURE_AUTHORITY_SOURCE,
  }));
  await page.route('**/terrain-authority.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: FIXTURE_TERRAIN_AUTHORITY_SOURCE,
  }));
  await page.route('**/corpus/terrains/diverse-candidate-v0.2/terrain-index-v1.json?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: FIXTURE_INDEX_BYTES,
  }));
  await page.route('**/corpus/releases/diverse-candidate-v0.2/urls.txt?*', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: FIXTURE_BYTES,
  }));
  await page.route('https://r4b1t-proxy.badbanana6969.workers.dev/**', route => route.abort('blockedbyclient'));
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function selectTerrain(page, surface, terrain) {
  if (surface === 'mobile') {
    await page.locator('#r4mNavMenu').click();
    await page.locator('#r4mMenuSheet [data-mobile-action="filter"]').click();
    await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: terrain }).click();
    await expect(page.locator('#r4mFilterLabel')).toHaveText(terrain);
    return;
  }
  const desktopFilter = page.locator('#catFilter');
  if (!(await desktopFilter.isVisible())) {
    await page.getByRole('button', { name: 'FILTER', exact: true }).click();
  }
  await expect(desktopFilter).toBeVisible();
  await desktopFilter.locator('button', { hasText: terrain }).click();
}

async function openTrailFile(page, surface) {
  if (surface === 'mobile') {
    await page.locator('#r4mNavMenu').click();
    await page.locator('#r4mMenuSheet [data-mobile-action="trail-file"]').click();
  } else {
    await page.getByRole('button', { name: 'trail file' }).click();
  }
  await expect(page.locator('#trailLedgerOverlay')).toHaveCSS('display', 'flex');
}

async function exportThroughRenderedLedger(page, surface) {
  await openTrailFile(page, surface);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#trailLedgerOverlay [data-trail-action="export"]').click();
  const artifact = await readDownload(await downloadEvent);
  await page.locator('#trailLedgerOverlay [data-trail-action="close"]').click();
  return artifact;
}

async function exerciseProductionRoll(page, surface) {
  await configurePage(page);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    typeof window.getTrailManifest === 'function' &&
    typeof window.resetReproducibleTrail === 'function' &&
    document.getElementById('r4mShellHost'));

  const initialUrl = (await page.locator('#previewUrl').textContent()).trim();
  await page.evaluate(() => window.resetReproducibleTrail());
  await selectTerrain(page, surface, CODE_TERRAIN);

  const seed = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('r4b1t_trail_draft_v1'));
    return saved.seed;
  });
  const independentCodeSelection = independentlySelect(CODE_POOL, seed, initialUrl);

  // Force ambient Math.random to a different eligible CODE route. Desktop's
  // production wrapper should ignore this and consume its declared sampler;
  // mobile's production integration is under test for whether it does so.
  const forcedIndex = CODE_POOL.findIndex(url =>
    url !== initialUrl && url !== independentCodeSelection.selected);
  const forcedUrl = CODE_POOL[forcedIndex];
  await page.evaluate(value => { Math.random = () => value; }, (forcedIndex + 0.1) / CODE_POOL.length);

  if (surface === 'mobile') {
    await page.locator('#r4mRoll').click();
    await expect(page.locator('#r4mUrl')).toHaveText(independentCodeSelection.selected, { timeout: 5_000 });
  } else {
    await page.locator('#btnGo').click();
    await expect(page.locator('#previewUrl')).toHaveText(independentCodeSelection.selected);
  }

  const selectedUrl = (await page.locator('#previewUrl').textContent()).trim();
  await expect.poll(async () => page.evaluate(async url => {
    const artifact = await window.getTrailManifest();
    return artifact.manifest.routes.some(route => route.url === url);
  }, selectedUrl)).toBe(true);
  const beforeTerrainChange = await exportThroughRenderedLedger(page, surface);

  await selectTerrain(page, surface, BLOG_TERRAIN);
  const afterTerrainChange = await exportThroughRenderedLedger(page, surface);

  const beforeRoute = beforeTerrainChange.manifest.routes[0];
  const afterRoute = afterTerrainChange.manifest.routes[0];
  const independentDeclaredCode = independentlySelect(CODE_POOL, beforeTerrainChange.manifest.sampler.seed, initialUrl);
  const independentClaimedBlog = independentlySelect(BLOG_POOL, afterTerrainChange.manifest.sampler.seed, initialUrl);
  const verification = await page.evaluate(async artifact => {
    try {
      const verified = await window.R4b1tTrail.verify(artifact);
      return { accepted: true, trailId: verified.trail_id };
    } catch (error) {
      return { accepted: false, error: String(error && error.message || error) };
    }
  }, afterTerrainChange);

  return {
    surface,
    productionEntry: surface === 'mobile' ? '#r4mRoll' : '#btnGo',
    initialUrl,
    selectionTerrain: CODE_TERRAIN,
    selectedUrl,
    forcedAmbientUrl: forcedUrl,
    beforeTerrainChange: {
      action: beforeRoute.action,
      claimedTerrain: beforeTerrainChange.manifest.terrain,
      declaredSampler: beforeTerrainChange.manifest.sampler,
      independentlyReproducedUrl: independentDeclaredCode.selected,
      independentAttempts: independentDeclaredCode.attempts,
      trailId: beforeTerrainChange.trail_id,
      routeId: beforeRoute.route_id,
    },
    afterTerrainChange: {
      action: afterRoute.action,
      claimedTerrain: afterTerrainChange.manifest.terrain,
      declaredSampler: afterTerrainChange.manifest.sampler,
      independentlyReproducedUrlFromClaimedTerrain: independentClaimedBlog.selected,
      trailId: afterTerrainChange.trail_id,
      routeId: afterRoute.route_id,
    },
    verification,
  };
}

test('CF-1: rendered mobile and desktop ROLL exports truthful equivalent provenance', async ({ browser }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chromium') test.skip();

  const mobileContext = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobilePage = await mobileContext.newPage();
  const desktopPage = await desktopContext.newPage();

  const mobile = await exerciseProductionRoll(mobilePage, 'mobile');
  const desktop = await exerciseProductionRoll(desktopPage, 'desktop');
  const evidence = {
    auditedCommit: '188277993ff3e723ef65e8bd1030ed1df458d408',
    fixtureCorpus: CORPUS,
    fixtureCorpusDigest: FIXTURE_DIGEST,
    callTrace: {
      mobile: [
        'rendered #r4mRoll click',
        'dual-shell.js runRollTransition("roll")',
        'R4B1TRollProduction.roll()',
        'window.__r4b1tCommitRoll()',
        'ROLL disclosure boundary',
        'window.__r4b1tRevealRoll()',
        'previewUrl mutation',
        'trail-runtime.js watchSelections() -> record()',
        'rendered Trail Ledger EXPORT JSON',
      ],
      desktop: [
        'rendered #btnGo click',
        'wrapped window.roll()',
        'bundled production commit/reveal',
        'previewUrl mutation',
        'trail-runtime.js watchSelections() -> record()',
        'rendered Trail Ledger EXPORT JSON',
      ],
    },
    mobile,
    desktop,
  };

  await testInfo.attach('cf1-provenance-evidence.json', {
    body: Buffer.from(JSON.stringify(evidence, null, 2) + '\n'),
    contentType: 'application/json',
  });

  expect.soft(mobile.beforeTerrainChange.action, 'mobile production ROLL must export action ROLL').toBe('ROLL');
  expect.soft(mobile.beforeTerrainChange.claimedTerrain, 'mobile artifact must claim the selection-time terrain').toBe(mobile.selectionTerrain);
  expect.soft(
    mobile.beforeTerrainChange.independentlyReproducedUrl,
    'mobile declared sampler/seed must reproduce the selected route from the declared CODE pool',
  ).toBe(mobile.selectedUrl);
  expect.soft(mobile.afterTerrainChange.claimedTerrain, 'later filter changes must not rewrite prior route provenance').toBe(mobile.selectionTerrain);
  expect.soft(mobile.afterTerrainChange.trailId, 'unchanged recorded routes must retain the same artifact identity after presentation-only filter changes').toBe(mobile.beforeTerrainChange.trailId);
  expect.soft(mobile.afterTerrainChange.routeId, 'changing terrain must not change URL/hash integrity').toBe(mobile.beforeTerrainChange.routeId);
  expect.soft(mobile.verification.accepted, 'existing v0.1 verification still accepts the exported artifact').toBe(true);

  expect.soft(desktop.beforeTerrainChange.action, 'desktop production ROLL must export action ROLL').toBe('ROLL');
  expect.soft(
    desktop.beforeTerrainChange.independentlyReproducedUrl,
    'desktop declared sampler/seed must reproduce the selected route from the declared CODE pool',
  ).toBe(desktop.selectedUrl);
  expect.soft(mobile.beforeTerrainChange.action, 'mobile and desktop production ROLL must have equivalent action provenance').toBe(desktop.beforeTerrainChange.action);
  expect.soft(mobile.beforeTerrainChange.declaredSampler, 'mobile and desktop must declare equivalent sampler semantics').toEqual(desktop.beforeTerrainChange.declaredSampler);

  await mobileContext.close();
  await desktopContext.close();
});
