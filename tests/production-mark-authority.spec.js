'use strict';

// The production mark is presentation only. Its ROLL is a fixed 1000ms SVG sequence.
// dual-shell now owns html.rolling through the rabbit's named animationend, with only
// a no-start fallback. These tests prove the mark never becomes selection authority:
// commitment begins independently, reveal follows the ROLL presentation timing, and
// the rabbit is allowed to finish its own full sequence without cancellation.

const { test, expect } = require('@playwright/test');

const MARK = 'r4b1t-h0l3-production.svg';

async function openShell(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#r4mRoll', { state: 'visible' });
}

async function instrument(page) {
  await page.evaluate(() => {
    const log = window.__markLog = { t0: null, events: [] };
    const now = () => (log.t0 === null ? null : Math.round(performance.now() - log.t0));
    const mark = (name, extra) => log.events.push({ name, t: now(), extra: extra || null });
    const html = document.documentElement;
    const wrap = (key, name) => {
      const original = window[key];
      if (typeof original !== 'function') return;
      window[key] = function () { const r = original.apply(this, arguments); mark(name); return r; };
    };
    wrap('__r4b1tCommitRoll', 'commit');
    wrap('__r4b1tRevealRoll', 'reveal');
    const history = () => {
      try { const s = window.__r4b1tSessionHistorySnapshot && window.__r4b1tSessionHistorySnapshot(); return Array.isArray(s) ? s.length : (s && s.length) || 0; } catch (e) { return 0; }
    };
    let lastHistory = history(), lastRolling = false, lastResult = false, lastPresentation = null;
    let disclosed = false;
    const sample = () => {
      if (log.t0 !== null) {
        const p = html.getAttribute('data-r4m-presentation');
        if (p !== lastPresentation) { lastPresentation = p; mark('presentation', p); }
        const r = html.classList.contains('rolling'); if (r !== lastRolling) { lastRolling = r; mark(r ? 'mark-rolling-on' : 'mark-rolling-off'); }
        const q = html.classList.contains('result-ready'); if (q !== lastResult) { lastResult = q; mark(q ? 'mark-result-on' : 'mark-result-off'); }
        const h = history(); if (h > lastHistory) { lastHistory = h; mark('trail-recorded'); }
        const mount = document.getElementById('r4mRouteMount');
        if (!disclosed && mount && mount.classList.contains('roll-disclosed') && mount.childElementCount > 0) { disclosed = true; mark('result-mounted'); }
      }
      requestAnimationFrame(sample);
    };
    // Capture every authoritative presentation attribute write, even when
    // multiple transitions happen between two animation frames.
    new MutationObserver(records => {
      if (log.t0 === null) return;
      for (const record of records) {
        mark('presentation-mutation', {
          before: record.oldValue,
          after: html.getAttribute('data-r4m-presentation'),
        });
      }
    }).observe(html, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-r4m-presentation'],
    });
    new MutationObserver(sample).observe(html, { attributes: true, attributeFilter: ['class', 'data-r4m-presentation'] });
    requestAnimationFrame(sample);
    const rabbit = document.getElementById('r4h-roll-rabbit');
    if (rabbit) {
      rabbit.addEventListener('animationstart', (e) => { if (e.animationName === 'r4h-roll-rabbit') mark('mark-roll-animation-start', { elapsedTime: e.elapsedTime }); });
      rabbit.addEventListener('animationend', (e) => { if (e.animationName === 'r4h-roll-rabbit') mark('mark-roll-animation-end', { elapsedTime: e.elapsedTime }); });
      rabbit.addEventListener('animationcancel', (e) => { if (e.animationName === 'r4h-roll-rabbit') mark('mark-roll-animation-cancel'); });
    }
    // each roll gets a fresh timeline; last-seen states carry over so only changes are logged
    window.__markStart = () => { log.events.length = 0; disclosed = false; log.t0 = performance.now(); };
  });
}

async function rollOnce(page, selector) {
  await page.evaluate(() => window.__markStart());
  await page.locator(selector).tap();
  await page.waitForTimeout(2300);
  return page.evaluate(() => window.__markLog.events);
}

const first = (events, name, extra) => {
  const e = events.find((x) => x.name === name && (extra === undefined || x.extra === extra));
  return e ? e.t : null;
};

test.describe('production mark timing authority', () => {
  test.skip(({ isMobile }) => !isMobile, 'the production mark mounts in the mobile shell');

  test('mark owns its entrance classes in its own markup; the app never writes them', async ({ page }) => {
    await page.addInitScript(() => {
      window.__rootClassWrites = 0;
      new MutationObserver((records) => {
        for (const r of records) if (r.target && r.target.id === 'r4h-root' && r.attributeName === 'class') window.__rootClassWrites++;
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await openShell(page);
    await page.waitForSelector('#r4h-root', { state: 'attached' });
    const atMount = await page.evaluate(() => ({
      cls: document.getElementById('r4h-root').getAttribute('class'),
      entrance: document.getAnimations().filter((a) => (a.animationName || '').startsWith('r4h-entrance-')).length,
    }));
    expect(atMount.cls.split(/\s+/).sort()).toEqual(['is-entering', 'is-idle']);
    expect(atMount.entrance).toBeGreaterThan(0);
    await page.waitForTimeout(1300);
    const after = await page.evaluate(() => ({
      writes: window.__rootClassWrites,
      entrance: document.getAnimations().filter((a) => (a.animationName || '').startsWith('r4h-entrance-') && a.playState === 'running').length,
      svgClass: document.querySelector('#r4mProductionMark svg').getAttribute('class'),
    }));
    expect(after.writes).toBe(0);
    expect(after.entrance).toBe(0);
    expect(after.svgClass).toBeNull();
  });

  test('rabbit finishes its own 1000ms ROLL independently of REEL reveal timing', async ({ page }) => {
    await openShell(page);
    await page.waitForSelector('#r4h-root', { state: 'attached' });
    await page.waitForTimeout(1300);
    await instrument(page);

    for (const selector of ['#r4mRoll', '#r4mRollAgain']) {
      const ev = await rollOnce(page, selector);
      const on = first(ev, 'mark-rolling-on');
      const markEnd = first(ev, 'mark-roll-animation-end');
      const authority = {
        commit: first(ev, 'commit'),
        reveal: first(ev, 'reveal'),
        revealed: first(ev, 'presentation', 'revealed'),
        mounted: first(ev, 'result-mounted'),
        recorded: first(ev, 'trail-recorded'),
      };
      for (const [k, v] of Object.entries(authority)) expect(v, `${selector}: ${k} happened; timeline=${JSON.stringify(ev)}`).not.toBeNull();
      const markStart = first(ev, 'mark-roll-animation-start');
      const markCancel = first(ev, 'mark-roll-animation-cancel');
      expect(on).not.toBeNull();
      expect(markStart).not.toBeNull();
      expect(markEnd).not.toBeNull();
      expect(markCancel).toBeNull();
      // animation events, not a presentation timer, define the rabbit's complete run.
      expect(markEnd - markStart, `${selector}: rabbit event timestamps; timeline=${JSON.stringify(ev)}`).toBeGreaterThanOrEqual(950);
      expect(await page.evaluate(() => document.documentElement.classList.contains('rolling'))).toBe(false);
      // commitment starts before the mark finishes; later reveal timing belongs to the REEL.
      expect(authority.commit).toBeLessThan(markEnd);
      // result-ready is downstream of the completed rabbit run.
      const resultOn = ev.filter((x) => x.name === 'mark-result-on').map((x) => x.t);
      expect(resultOn.length).toBeGreaterThan(0);
      expect(resultOn.every((t) => t >= markEnd)).toBe(true);
    }
  });

  test('authority timing is identical with and without the mark', async ({ browser, isMobile }) => {
    const device = { viewport: { width: 412, height: 915 }, isMobile, hasTouch: true, deviceScaleFactor: 2 };
    const timings = {};
    for (const withMark of [true, false]) {
      const context = await browser.newContext({ ...device, serviceWorkers: 'block' });
      const page = await context.newPage();
      if (!withMark) await page.route(`**/${MARK}`, (route) => route.abort());
      await openShell(page);
      if (withMark) await page.waitForSelector('#r4h-root', { state: 'attached' });
      await page.waitForTimeout(1300);
      if (!withMark) expect(await page.locator('#r4h-root').count()).toBe(0);
      await instrument(page);
      const ev = await rollOnce(page, '#r4mRoll');
      timings[withMark ? 'with' : 'without'] = {
        commit: first(ev, 'commit'), reveal: first(ev, 'reveal'), revealed: first(ev, 'presentation', 'revealed'),
        mounted: first(ev, 'result-mounted'), recorded: first(ev, 'trail-recorded'),
      };
      await context.close();
    }
    for (const k of Object.keys(timings.with)) {
      expect(timings.with[k], `${k} with mark`).not.toBeNull();
      expect(timings.without[k], `${k} without mark`).not.toBeNull();
      // same state-machine schedule either way (allow frame jitter)
      expect(Math.abs(timings.with[k] - timings.without[k]), `${k} not delayed by the mark`).toBeLessThanOrEqual(60);
    }
  });

  test('reduced motion projects the result immediately (no hold)', async ({ browser, isMobile }) => {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    await openShell(page);
    await page.waitForSelector('#r4h-root', { state: 'attached' });
    await instrument(page);
    const ev = await rollOnce(page, '#r4mRoll');
    const reveal = first(ev, 'presentation', 'reveal');
    const resultOn = first(ev, 'mark-result-on');
    expect(reveal).not.toBeNull();
    expect(resultOn).not.toBeNull();
    expect(Math.abs(resultOn - reveal)).toBeLessThanOrEqual(34);
    expect(first(ev, 'mark-rolling-off')).toBeLessThanOrEqual(reveal + 34);
    await context.close();
  });
});
