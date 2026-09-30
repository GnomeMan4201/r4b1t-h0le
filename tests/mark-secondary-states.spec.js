'use strict';

// Secondary mark states: the shell only exposes which secondary surface is open.
// These tests prove state ownership, not pixels:
//   surface open  -> exactly its class on <html>      surface closed -> class removed
//   peer switch   -> old class removed, canonical gap, then the new class; never two
//   COPY TRAIL    -> short-lived event class           ROLL / BLIND -> sheet closes, authority wins
//   the shell writes no transform, style or class inside the mark itself

const { test, expect } = require('@playwright/test');

const PEERS = ['replay-open', 'topology-open', 'branch-open', 'trail-open', 'history-open'];

async function openShell(page) {
  await page.addInitScript((peers) => {
    const log = window.__markStateLog = { events: [], maxPeers: 0, markWrites: [] };
    const t0 = performance.now();
    const snapshot = () => peers.filter((c) => document.documentElement.classList.contains(c));
    let last = '';
    // observe from `document`: the <html> element does not exist yet when init scripts run
    new MutationObserver((records) => {
      if (!records.some((r) => r.target === document.documentElement)) return;
      const on = snapshot();
      log.maxPeers = Math.max(log.maxPeers, on.length);
      const copy = document.documentElement.classList.contains('copy-trail');
      const key = on.join(' ') + (copy ? ' +copy' : '');
      if (key !== last) { last = key; log.events.push({ t: Math.round(performance.now() - t0), peers: on, copy }); }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    // any attribute the shell writes inside the mounted SVG (the mark owns its own markup)
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target;
        if (el.closest && el.closest('#r4mProductionMark svg') && r.type === 'attributes') log.markWrites.push(`${el.id || el.tagName}.${r.attributeName}`);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style', 'transform', 'class'] });
  }, PEERS);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#r4mRoll', { state: 'visible' });
  await page.waitForSelector('#r4h-root', { state: 'attached' });
  await page.waitForFunction(() => typeof window.openTrailTopology === 'function' && typeof window.openReplayInspection === 'function' && typeof window.openTrailLedger === 'function');
}

const peersOn = (page) => page.evaluate((peers) => peers.filter((c) => document.documentElement.classList.contains(c)), PEERS);
const onlyPeer = (page, cls) => page.waitForFunction(([peers, want]) => {
  const on = peers.filter((c) => document.documentElement.classList.contains(c));
  return on.length === 1 && on[0] === want;
}, [PEERS, cls]);
const noPeers = (page) => page.waitForFunction((peers) => peers.every((c) => !document.documentElement.classList.contains(c)), PEERS);

async function fromMenu(page, action) {
  await page.locator('#r4mNavMenu').tap();
  await page.waitForSelector('#r4mMenuSheet.open');
  await page.locator(`#r4mMenuSheet [data-mobile-action="${action}"]`).first().tap();
}

async function expectInvariants(page) {
  const log = await page.evaluate(() => window.__markStateLog);
  expect(log.events.length, 'the state recorder saw the transitions').toBeGreaterThan(0);
  expect(log.maxPeers, 'never two secondary peer classes at once').toBeLessThanOrEqual(1);
  expect(log.markWrites, 'the shell writes nothing inside the mark').toEqual([]);
  // secondary classes live only on <html>, the shared ancestor with .menu-open / .rolling
  const elsewhere = await page.evaluate((peers) => peers.concat('copy-trail')
    .flatMap((c) => Array.from(document.querySelectorAll('body .' + c)).map((el) => `${c}@${el.id || el.tagName}`)), PEERS);
  expect(elsewhere).toEqual([]);
}

test.describe('secondary mark states', () => {
  test.skip(({ isMobile }) => !isMobile, 'the production mark mounts in the mobile shell');

  test('each secondary surface exposes exactly its own class, and closing it removes the class', async ({ page }) => {
    await openShell(page);
    const cases = [
      { action: 'branch', cls: 'branch-open', close: () => page.locator('#r4mBranchSheet [data-mobile-action="close-sheets"]').tap() },
      { action: 'trail-file', cls: 'trail-open', close: () => page.keyboard.press('Escape') },
      { action: 'topology', cls: 'topology-open', close: () => page.keyboard.press('Escape') },
      { action: 'history', cls: 'history-open', close: () => page.keyboard.press('Escape') },
      { action: 'replay-inspection', cls: 'replay-open', close: () => page.keyboard.press('Escape') },
    ];
    for (const c of cases) {
      await fromMenu(page, c.action);
      await onlyPeer(page, c.cls);
      expect(await peersOn(page), `${c.action} -> ${c.cls} only`).toEqual([c.cls]);
      await c.close();
      await noPeers(page);
      expect(await peersOn(page), `${c.action} closed -> no secondary state`).toEqual([]);
    }
    await expectInvariants(page);
  });

  test('closeSheets() and closes from the surface itself both clear the state', async ({ page }) => {
    await openShell(page);
    await fromMenu(page, 'branch');
    await onlyPeer(page, 'branch-open');
    await page.evaluate(() => document.getElementById('r4mBackdrop').click()); // backdrop -> closeSheets()
    await noPeers(page);
    // opening another shell sheet (MENU) over BRANCH also ends the branch state
    await fromMenu(page, 'branch');
    await onlyPeer(page, 'branch-open');
    await page.evaluate(() => document.getElementById('r4mNavMenu').click());
    await noPeers(page);
    await page.evaluate(() => document.getElementById('r4mBackdrop').click());
    // desktop-shell / programmatic opener and closer: same surface, same state
    await page.evaluate(() => window.openTrailLedger());
    await onlyPeer(page, 'trail-open');
    await page.evaluate(() => window.closeTrailLedger());
    await noPeers(page);
    await expectInvariants(page);
  });

  test('peer switch passes through the canonical closed state and never holds two peers', async ({ page }) => {
    await openShell(page);
    await fromMenu(page, 'branch');
    await onlyPeer(page, 'branch-open');
    const t0 = await page.evaluate(() => { window.__switchAt = performance.now(); window.openReplayInspection(); return true; });
    expect(t0).toBe(true);
    await onlyPeer(page, 'replay-open');
    const log = await page.evaluate(() => window.__markStateLog.events);
    const iBranchOff = log.findIndex((e, i) => i > 0 && log[i - 1].peers.includes('branch-open') && !e.peers.includes('branch-open'));
    const iReplayOn = log.findIndex((e) => e.peers.includes('replay-open'));
    expect(iBranchOff).toBeGreaterThan(-1);
    expect(iReplayOn).toBeGreaterThan(iBranchOff);
    expect(log[iBranchOff].peers, 'the old class goes first, nothing replaces it yet').toEqual([]);
    // the gap is the SVG's return schedule (380ms): the rabbit is canonical before the new pose
    expect(log[iReplayOn].t - log[iBranchOff].t).toBeGreaterThanOrEqual(340);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.closeReplayInspection && window.closeReplayInspection());
    await expectInvariants(page);
  });

  test('a surface reopened while the rabbit is still returning waits for canonical', async ({ page }) => {
    await openShell(page);
    await page.evaluate(() => window.openTrailLedger());
    await onlyPeer(page, 'trail-open');
    // close, let the close be observed, then reopen straight away: the surface is
    // open again at once, but the mark waits for the canonical pose
    await page.evaluate(async () => {
      window.closeTrailLedger();
      await new Promise((r) => requestAnimationFrame(r));
      window.openTrailLedger();
    });
    await onlyPeer(page, 'trail-open');
    const log = await page.evaluate(() => window.__markStateLog.events);
    const off = log.findIndex((e, i) => i > 0 && log[i - 1].peers.includes('trail-open') && e.peers.length === 0);
    const on = log.findIndex((e, i) => i > off && e.peers.includes('trail-open'));
    expect(off).toBeGreaterThan(-1);
    expect(log[on].t - log[off].t, 'canonical gap before the pose re-enters').toBeGreaterThanOrEqual(340);
    await expectInvariants(page);
  });

  test('COPY TRAIL is a short-lived event class, not persistent state', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await openShell(page);
    await page.waitForFunction(() => typeof window.shareTrail === 'function');
    await fromMenu(page, 'copy-trail');
    await page.waitForFunction(() => document.documentElement.classList.contains('copy-trail'));
    expect(await peersOn(page), 'copy is not a secondary peer').toEqual([]);
    await page.waitForFunction(() => !document.documentElement.classList.contains('copy-trail'), null, { timeout: 1500 });
    const log = await page.evaluate(() => window.__markStateLog.events);
    const on = log.find((e) => e.copy), off = log.find((e, i) => i > 0 && log[i - 1].copy && !e.copy);
    // long enough for the SVG's 420ms one-shot, short enough to be an event
    expect(off.t - on.t).toBeGreaterThanOrEqual(420);
    expect(off.t - on.t).toBeLessThan(800);
    await expectInvariants(page);
  });

  test('ROLL closes the secondary sheet and ROLL authority wins', async ({ page }) => {
    await openShell(page);
    await page.waitForTimeout(1300); // entrance done
    await fromMenu(page, 'branch');
    await onlyPeer(page, 'branch-open');
    await page.evaluate(() => document.getElementById('r4mRoll').click());
    await page.waitForFunction(() => document.documentElement.classList.contains('rolling'));
    await noPeers(page);
    expect(await page.evaluate(() => document.getElementById('r4mBranchSheet').getAttribute('aria-hidden'))).toBe('true');
    expect(await page.evaluate(() => document.documentElement.classList.contains('rolling'))).toBe(true);
    await expectInvariants(page);
  });

  test('BLIND DESCENT closes the secondary sheet and BLIND authority wins', async ({ page }) => {
    await openShell(page);
    await page.waitForFunction(() => typeof window.openBlindDescent === 'function' && typeof window.blindDescend === 'function');
    await fromMenu(page, 'branch');
    await onlyPeer(page, 'branch-open');
    await page.evaluate(() => document.querySelector('[data-mobile-action="blind-descent"]').click());
    await page.waitForFunction(() => document.documentElement.classList.contains('blind-descending'));
    await noPeers(page);
    expect(await page.evaluate(() => document.getElementById('r4mBranchSheet').getAttribute('aria-hidden'))).toBe('true');
    await expectInvariants(page);
  });

  test('RESULT authority is never mutated by secondary surfaces', async ({ page }) => {
    await openShell(page);
    await page.waitForTimeout(1300);
    await page.evaluate(() => document.getElementById('r4mRoll').click());
    await page.waitForFunction(() => document.documentElement.classList.contains('result-ready'), null, { timeout: 5000 });
    // watch result-ready from here on: no secondary surface may clear it
    await page.evaluate(() => {
      window.__resultDrops = 0;
      new MutationObserver(() => { if (!document.documentElement.classList.contains('result-ready')) window.__resultDrops++; })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    await fromMenu(page, 'branch');
    await onlyPeer(page, 'branch-open');
    expect(await page.evaluate(() => document.documentElement.classList.contains('result-ready'))).toBe(true);
    await page.locator('#r4mBranchSheet [data-mobile-action="close-sheets"]').tap();
    await noPeers(page);
    await fromMenu(page, 'history');
    await onlyPeer(page, 'history-open');
    await page.keyboard.press('Escape');
    await noPeers(page);
    expect(await page.evaluate(() => window.__resultDrops), 'result-ready never cleared by a sheet').toBe(0);
    expect(await page.evaluate(() => document.documentElement.classList.contains('result-ready'))).toBe(true);
    await expectInvariants(page);
  });

  test('reduced motion: peer switch has no settle delay, still never two peers', async ({ browser, isMobile }) => {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    await openShell(page);
    await page.evaluate(() => window.openTrailLedger());
    await onlyPeer(page, 'trail-open');
    const t = await page.evaluate(async () => {
      const a = performance.now();
      window.openReplayInspection();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { dt: performance.now() - a, on: ['replay-open', 'trail-open'].filter((c) => document.documentElement.classList.contains(c)) };
    });
    expect(t.on).toEqual(['replay-open']);
    expect(t.dt).toBeLessThan(200);
    await expectInvariants(page);
    await context.close();
  });
});
