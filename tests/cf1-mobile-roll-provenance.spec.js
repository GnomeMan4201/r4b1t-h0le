'use strict';

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

  await page.route('**/urls.txt?*', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: CORPUS.join('\n') + '\n',
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
    await page.locator('[data-mobile-action="filter"]').first().click();
    await page.locator('#r4mFilterOptions .r4m-filter-proxy', { hasText: terrain }).click();
    await expect(page.locator('#r4mFilterLabel')).toHaveText(terrain);
    return;
  }
  await page.locator('#catFilter button', { hasText: terrain }).click();
}

async function openTrailFile(page, surface) {
  if (surface === 'mobile') {
    await page.locator('[data-mobile-action="trail-file"]').click();
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
  await selectTerrain(page, surface, 'CODE');

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
    await expect(page.locator('#r4mUrl')).toHaveText(forcedUrl, { timeout: 5_000 });
  } else {
    await page.locator('#btnGo').click();
    await expect(page.locator('#previewUrl')).toHaveText(independentCodeSelection.selected);
  }

  const selectedUrl = (await page.locator('#previewUrl').textContent()).trim();
  const beforeTerrainChange = await exportThroughRenderedLedger(page, surface);

  await selectTerrain(page, surface, 'BLOG');
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
    selectionTerrain: 'CODE',
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
    callTrace: {
      mobile: [
        'rendered #r4mRoll click',
        'dual-shell.js runRollTransition("roll")',
        'R4B1TRollProduction.roll()',
        'window.__r4b1tCommitRoll()',
        'ROLL disclosure boundary',
        'window.__r4b1tRevealRoll()',
