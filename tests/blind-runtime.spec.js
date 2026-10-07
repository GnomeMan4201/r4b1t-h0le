'use strict';

const { test, expect } = require('@playwright/test');
const { expectFocusInside } = require('./focus-assertions');

async function blockExternalNetwork(page) {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
    const parsed = new URL(requestUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test('mobile Blind fits fallback type and restores the rabbit after Map closes without changing commitments', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function' && document.querySelector('#r4mProductionMark svg'));
  await page.addStyleTag({ content: '.blind-title,.blind-message,.blind-depth{font-family:Arial,sans-serif!important}' });
  await page.locator('#r4mModeBlind').click();
  await page.locator('[data-mobile-action="blind-descent"]').click();
  await expect(page.locator('#blindDepth')).toContainText('001');
  await page.evaluate(async () => { for (let i = 0; i < 4; i++) await window.blindDescend(); });
  await page.waitForTimeout(700);
  const geometry = await page.locator('#blindDescentOverlay').evaluate((overlay) => {
    const card = document.querySelector('#blindCard').getBoundingClientRect();
    const depth = document.querySelector('#blindDepth').getBoundingClientRect();
    return { width: overlay.clientWidth, scrollWidth: overlay.scrollWidth, cardLeft: card.left, cardRight: card.right, depthRight: depth.right };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.cardLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.cardRight).toBeLessThanOrEqual(320);
  expect(geometry.depthRight).toBeLessThanOrEqual(320);
  const saved = await page.evaluate(() => ({ public: localStorage.getItem('r4b1t_blind_public_v02'), private: localStorage.getItem('r4b1t_blind_private_v02') }));
  await page.locator('[data-blind-action="topology"]').click();
  await expect(page.locator('#trailTopologyOverlay')).toHaveClass(/\bopen\b/);
  await page.locator('.topology-inspect').first().click();
  await expect(page.locator('#trailTopologyInspector')).toBeVisible();
  const inspector = await page.locator('#trailTopologyInspector').evaluate((panel) => ({ width: panel.clientWidth, scrollWidth: panel.scrollWidth }));
  expect(inspector.scrollWidth).toBeLessThanOrEqual(inspector.width + 1);
  await page.locator('.topology-close').click();
  await expect(page.locator('#blindDescentOverlay')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#trailTopologyOverlay')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('html')).not.toHaveClass(/\bblind-descending\b/);
  await expect.poll(() => page.locator('#r4h-blind-rabbit').evaluate(node => getComputedStyle(node).transform)).toBe('none');
  expect(await page.evaluate(() => ({ public: localStorage.getItem('r4b1t_blind_public_v02'), private: localStorage.getItem('r4b1t_blind_private_v02') }))).toEqual(saved);
  await page.evaluate(() => window.openBlindDescent());
  await expect(page.locator('#blindDepth')).toContainText('005');
  await expect(page.locator('html')).toHaveClass(/\bblind-descending\b/);
  await page.locator('[data-blind-action="close"]').click();
  await expect(page.locator('html')).not.toHaveClass(/\bblind-descending\b/);
  expect(await page.evaluate(() => ({ public: localStorage.getItem('r4b1t_blind_public_v02'), private: localStorage.getItem('r4b1t_blind_private_v02') }))).toEqual(saved);
});

test('blind descent commits without changing or exposing the visible route', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.blindDescend === 'function' && typeof window.getBlindManifest === 'function');

  const result = await page.evaluate(async () => {
    const visibleBefore = document.getElementById('previewUrl').textContent.trim();
    await window.openBlindDescent();
    await window.blindDescend();
    await window.blindDescend();
    const snapshot = await window.getBlindManifest();
    return {
      visibleBefore,
      visibleAfter: document.getElementById('previewUrl').textContent.trim(),
      steps: snapshot.manifest.steps,
      publicJson: JSON.stringify(snapshot),
      status: document.getElementById('blindStatus').textContent,
      depth: document.getElementById('blindDepth').textContent,
    };
  });

  expect(result.visibleAfter).toBe(result.visibleBefore);
  expect(result.steps).toHaveLength(2);
  expect(result.steps.every((step) => step.state === 'concealed')).toBe(true);
  expect(result.steps.every((step) => Object.keys(step).sort().join(',') === 'commitment,index,state')).toBe(true);
  expect(result.publicJson).not.toContain('nonce');
  expect(result.status).toBe('CONCEALED / COMMITMENT PRESENT');
  expect(result.depth).toContain('002');
});

test('reveal discloses the committed route without rerolling it', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.blindDescend === 'function');

  const result = await page.evaluate(async () => {
    await window.openBlindDescent();
    const committed = await window.blindDescend();
    const commitment = committed.manifest.steps[0].commitment;
    const url = await window.blindReveal(0);
    const revealed = await window.getBlindManifest();
    const verification = await window.R4b1tBlind.verify(revealed);
    return {
      url,
      visible: document.getElementById('previewUrl').textContent.trim(),
      commitment,
      revealedCommitment: revealed.manifest.steps[0].commitment,
      verification: verification.statuses[0].status,
      status: document.getElementById('blindStatus').textContent,
    };
  });

  expect(result.visible).toBe(result.url);
  expect(result.revealedCommitment).toBe(result.commitment);
  expect(result.verification).toBe('COMMITMENT VERIFIED');
  expect(result.status).toBe('REVEALED / COMMITMENT VERIFIED');
});

test('blind interface remains within the mobile viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile-only layout assertion');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function');
  await page.evaluate(() => window.openBlindDescent());
  await expect(page.locator('#blindDescentOverlay')).toHaveClass(/open/);
  const overflow = await page.evaluate(() => document.getElementById('blindDescentOverlay').scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('Blind primary controls expose only transitions valid for the current state', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function');
  await page.evaluate(() => window.openBlindDescent());

  const descend = page.locator('[data-blind-action="descend"]');
  const reveal = page.locator('[data-blind-action="reveal"]');
  const back = page.locator('[data-blind-action="return"]');

  await expect(descend).toBeEnabled();
  await expect(descend).toHaveText('DESCEND BLIND');
  await expect(reveal).toBeDisabled();
  await expect(back).toBeDisabled();

  await page.evaluate(() => window.blindDescend());

  await expect(descend).toBeEnabled();
  await expect(descend).toHaveText('DESCEND DEEPER');
  await expect(reveal).toBeEnabled();
  await expect(back).toBeEnabled();

  const committed = await page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return snapshot.manifest.steps;
  });
  expect(committed).toHaveLength(1);
  expect(committed[0].state).toBe('concealed');

  await page.evaluate(() => window.blindReveal(0));

  await expect(descend).toBeEnabled();
  await expect(descend).toHaveText('DESCEND DEEPER');
  await expect(reveal).toBeDisabled();
  await expect(back).toBeEnabled();

  await page.evaluate(() => window.blindReturn());
  await expect(back).toBeDisabled();

  for (const action of ['export', 'topology', 'reset', 'close']) {
    await expect(page.locator('[data-blind-action="' + action + '"]')).toBeEnabled();
  }
});

test('wear is persistent and descend, return, and reveal remain visually distinct', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.blindDescend === 'function' && typeof window.R4b1tWear === 'object');
  const result = await page.evaluate(async () => {
    await window.openBlindDescent();
    await window.blindDescend();
    await window.blindDescend();
    await window.blindDescend();
    const afterDescend = {
      motion: document.querySelector('#blindWear .trail-wear').className,
      depth: document.querySelector('#blindWear .trail-wear').dataset.depth,
      creases: document.querySelectorAll('#blindWear .wear-crease').length,
      concealed: document.querySelectorAll('#blindWear .wear-step.concealed').length,
    };
    await window.blindReturn();
    const afterReturn = document.querySelector('#blindWear .trail-wear').className;
    await window.blindReveal(2);
    return {
      afterDescend,
      afterReturn,
      revealWear: document.querySelector('#blindWear .trail-wear').className,
      inkSegment: document.querySelectorAll('#blindWear .wear-step.ink-reveal').length,
      inkCard: document.getElementById('blindCard').classList.contains('ink-reveal-card'),
      revealed: document.querySelectorAll('#blindWear .wear-step.revealed').length,
    };
  });
  expect(result.afterDescend.motion).toContain('motion-descend');
  expect(result.afterDescend.depth).toBe('3');
  expect(result.afterDescend.creases).toBe(3);
  expect(result.afterDescend.concealed).toBe(3);
  expect(result.afterReturn).toContain('motion-return');
  expect(result.revealWear).not.toContain('motion-descend');
  expect(result.revealWear).not.toContain('motion-return');
  expect(result.inkSegment).toBe(1);
  expect(result.inkCard).toBe(true);
  expect(result.revealed).toBe(1);
});

test('desktop Blind Descent traps focus, restores opener, and keeps focused buttons native', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function');

  await page.evaluate(async () => {
    const opener = document.createElement('button');
    opener.id = 'blindFocusOpener';
    opener.textContent = 'open blind';
    document.body.appendChild(opener);
    opener.focus();
    await window.openBlindDescent();
  });

  const overlay = page.locator('#blindDescentOverlay');
  await expect(overlay).toHaveClass(/open/);
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');

  await expectFocusInside(page, '#blindDescentOverlay');

  const descend = overlay.locator('[data-blind-action="descend"]');
  await descend.focus();
  await descend.press('Enter');
  await expect(page.locator('#blindDepth')).toContainText('001');
  await expect(page.locator('#blindStatus')).toHaveText('CONCEALED / COMMITMENT PRESENT');

  const last = overlay.locator('button:visible').last();
  await last.focus();
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => {
    const overlay = document.querySelector('#blindDescentOverlay');
    const focusables = Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
    return document.activeElement === focusables[0];
  });
  expect(wrapped).toBe(true);

  await page.keyboard.press('Escape');
  await expect(overlay).not.toHaveClass(/open/);
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#blindFocusOpener')).toBeFocused();
});


test('Blind Descent discards saved state from a different corpus revision', async ({ page }) => {
  const foreignRevision = 'sha256:' + '0'.repeat(64);

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.R4b1tBlind));

  await page.evaluate(async revision => {
    const manifest = await window.R4b1tBlind.create({
      corpus_revision: revision,
      terrain: 'ALL SIGNALS',
      parent: null,
    });
    localStorage.setItem('r4b1t_blind_public_v02', JSON.stringify({
      manifest,
      currentDepth: 0,
    }));
    localStorage.setItem('r4b1t_blind_private_v02', '{}');
  }, foreignRevision);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function');

  const result = await page.evaluate(async () => {
    await window.openBlindDescent();
    const loaded = await window.R4b1tCorpusAuthority.loadActive();
    const snapshot = await window.getBlindManifest();
    return {
      activeRevision: loaded.revision,
      manifestRevision: snapshot.manifest.genesis.corpus_revision,
      steps: snapshot.manifest.steps.length,
      depth: document.getElementById('blindDepth').textContent,
    };
  });

  expect(result.manifestRevision).toBe(result.activeRevision);
  expect(result.manifestRevision).not.toBe(foreignRevision);
  expect(result.steps).toBe(0);
  expect(result.depth).toContain('000');
});

test('Blind Descent preserves saved state when corpus revision still matches', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.R4b1tBlind));

  const originalTrailId = await page.evaluate(async () => {
    const loaded = await window.R4b1tCorpusAuthority.loadActive();
    const manifest = await window.R4b1tBlind.create({
      corpus_revision: loaded.revision,
      terrain: 'ALL SIGNALS',
      parent: null,
    });
    const envelope = await window.R4b1tBlind.envelope(manifest);
    localStorage.setItem('r4b1t_blind_public_v02', JSON.stringify({
      manifest,
      currentDepth: 0,
    }));
    localStorage.setItem('r4b1t_blind_private_v02', '{}');
    return envelope.trail_id;
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function');

  const restoredTrailId = await page.evaluate(async () => {
    await window.openBlindDescent();
    const snapshot = await window.getBlindManifest();
    return snapshot.trail_id;
  });

  expect(restoredTrailId).toBe(originalTrailId);
});


test('mobile Blind stage leaves the persistent ROLL and MENU rail operable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function');

  await page.locator('#r4mModeBlind').click();
  await page.evaluate(() => window.openBlindDescent());

  const overlay = page.locator('#blindDescentOverlay');
  const nav = page.locator('.r4m-nav-minimal');
  await expect(overlay).toHaveClass(/open/);
  await expect(nav).toBeVisible();
  await expect(overlay).toHaveAttribute('aria-modal', 'false');

  const geometry = await page.evaluate(() => {
    const overlay = document.getElementById('blindDescentOverlay').getBoundingClientRect();
    const nav = document.querySelector('.r4m-nav-minimal').getBoundingClientRect();
    return {
      overlayBottom: overlay.bottom,
      navTop: nav.top,
      overlayZ: Number.parseInt(getComputedStyle(document.getElementById('blindDescentOverlay')).zIndex || '0', 10),
      navZ: Number.parseInt(getComputedStyle(document.querySelector('.r4m-nav-minimal')).zIndex || '0', 10),
    };
  });
  expect(geometry.overlayBottom).toBeLessThanOrEqual(geometry.navTop + 1);
  expect(geometry.navZ).toBeGreaterThan(geometry.overlayZ);

  await page.locator('#r4mNavMenu').click();
  await expect(page.locator('#r4mMenuSheet')).toHaveAttribute('aria-hidden', 'false');
  await expect(overlay).toHaveClass(/open/);
});

test('mobile bottom ROLL exits Blind without selecting or committing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.getBlindManifest === 'function');

  await page.locator('#r4mModeBlind').click();
  await page.evaluate(() => window.openBlindDescent());

  const before = await page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return {
      steps: snapshot.manifest.steps.length,
      preview: document.getElementById('previewUrl').textContent.trim(),
    };
  });

  await page.locator('#r4mNavRoll').click();

  await expect(page.locator('#blindDescentOverlay')).not.toHaveClass(/open/);
  await expect(page.locator('#r4mModeRoll')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#r4mRoll')).toBeVisible();

  const after = await page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return {
      steps: snapshot.manifest.steps.length,
      preview: document.getElementById('previewUrl').textContent.trim(),
    };
  });

  expect(after).toEqual(before);
});

test('mobile Blind separates current depth from the last concealed reveal target after RETURN', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.blindDescend === 'function');

  await page.evaluate(async () => {
    await window.openBlindDescent();
    await window.blindDescend();
    await window.blindDescend();
    await window.blindDescend();
    await window.blindReturn();
  });

  const current = page.locator('#blindStrata [data-blind-depth="2"]');
  const revealTarget = page.locator('#blindStrata [data-blind-depth="3"]');
  await expect(current).toHaveAttribute('data-current-depth', 'true');
  await expect(current).not.toHaveAttribute('data-reveal-target', 'true');
  await expect(revealTarget).toHaveAttribute('data-reveal-target', 'true');
  await expect(page.locator('#blindRevealTarget')).toHaveText('LAST CONCEALED · 03');

  await page.locator('[data-blind-action="reveal"]').click();
  await expect.poll(async () => page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return snapshot.manifest.steps.map((step) => step.state);
  })).toEqual(['concealed', 'concealed', 'revealed']);
});

test('mobile Blind keeps manifest position and current depth distinct after RETURN then DESCEND', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.blindDescend === 'function');

  await page.evaluate(async () => {
    await window.openBlindDescent();
    await window.blindDescend();
    await window.blindDescend();
    await window.blindDescend();
    await window.blindReturn();
    await window.blindDescend();
  });

  await expect(page.locator('#blindStrata [data-blind-depth="3"]')).toHaveAttribute('data-current-depth', 'true');
  await expect(page.locator('#blindStrata [data-blind-depth="4"]')).toHaveAttribute('data-reveal-target', 'true');
  await expect(page.locator('#blindRevealTarget')).toHaveText('LAST CONCEALED · 04');

  const states = await page.evaluate(async () => {
    const snapshot = await window.getBlindManifest();
    return snapshot.manifest.steps.map((step) => step.state);
  });
  expect(states).toEqual(['concealed', 'concealed', 'concealed', 'concealed']);
});


test('Blind concealed descent stays out of History until explicit reveal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.blindDescend === 'function' && typeof window.toggleHistory === 'function');

  await page.evaluate(async () => {
    await window.openBlindDescent();
    await window.blindDescend();
    window.closeBlindDescent();
    window.toggleHistory();
  });

  await expect(page.locator('#historyList button')).toHaveCount(0);
  await expect(page.locator('#historyList')).toContainText('no history yet');

  await page.evaluate(async () => {
    window.toggleHistory();
    await window.openBlindDescent();
    await window.blindReveal();
    window.closeBlindDescent();
    window.toggleHistory();
  });

  await expect(page.locator('#historyList button')).toHaveCount(1);
});


test('mobile Blind keeps the active strata and action rail visually connected', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.setViewportSize({ width: 512, height: 1108 });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.blindDescend === 'function');

  await page.evaluate(async () => {
    await window.openBlindDescent();
    await window.blindDescend();
    await window.blindDescend();
  });

  const gap = await page.evaluate(() => {
    const strata = document.getElementById('blindStrata').getBoundingClientRect();
    const actions = document.querySelector('#blindDescentOverlay .blind-actions').getBoundingClientRect();
    return actions.top - strata.bottom;
  });

  expect(gap).toBeLessThanOrEqual(180);
});


test('Blind Descent material state follows depth and rewinds deterministically on RETURN', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'desktop-chromium') test.skip();
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBlindDescent === 'function' && typeof window.blindDescend === 'function');

  await page.evaluate(async () => {
    await window.openBlindDescent();
    await window.blindDescend();
    await window.blindDescend();
    await window.blindDescend();
  });

  const overlay = page.locator('#blindDescentOverlay');
  await expect(overlay).toHaveAttribute('data-material-depth', '3');
  await expect(overlay).toHaveAttribute('data-material-band', 'creased');

  const atThree = await page.locator('#blindCard').evaluate((node) => ({
    intensity: Number.parseFloat(node.style.getPropertyValue('--blind-material-intensity')),
    register: node.style.getPropertyValue('--blind-register-x'),
    edge: node.style.getPropertyValue('--blind-edge-wear'),
  }));
  expect(atThree.intensity).toBeGreaterThan(0);
  expect(atThree.register).not.toBe('');
  expect(atThree.edge).not.toBe('');

  await page.evaluate(() => window.blindReturn());
  await expect(overlay).toHaveAttribute('data-material-depth', '2');
  await expect(overlay).toHaveAttribute('data-material-band', 'scuffed');

  const atTwo = await page.locator('#blindCard').evaluate((node) => ({
    intensity: Number.parseFloat(node.style.getPropertyValue('--blind-material-intensity')),
    register: node.style.getPropertyValue('--blind-register-x'),
    edge: node.style.getPropertyValue('--blind-edge-wear'),
  }));
  expect(atTwo.intensity).toBeLessThan(atThree.intensity);

  await page.evaluate(() => window.blindDescend());
  await expect(overlay).toHaveAttribute('data-material-depth', '3');
  const atThreeAgain = await page.locator('#blindCard').evaluate((node) => ({
    intensity: Number.parseFloat(node.style.getPropertyValue('--blind-material-intensity')),
    register: node.style.getPropertyValue('--blind-register-x'),
    edge: node.style.getPropertyValue('--blind-edge-wear'),
  }));
  expect(atThreeAgain).toEqual(atThree);
});
