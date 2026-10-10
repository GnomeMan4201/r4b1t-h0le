'use strict';
const { test, expect } = require('@playwright/test');

// DIAGNOSTIC ONLY. This verifies the actual SVG CSS keyframes under a controlled
// CSSAnimation timeline. It cannot prove that a stalled WebKit compositor paints
// each intermediate frame in real time; the live-roll lifecycle test remains separate.
test('WebKit: controlled 1s canonical rabbit CSS motion has the deep-descent poses', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);

  const evidence = await page.evaluate(() => {
    const rabbit = document.getElementById('r4h-roll-rabbit');
    const originalInline = rabbit.style.getPropertyValue('animation');
    const originalPriority = rabbit.style.getPropertyPriority('animation');
    const originalComputed = getComputedStyle(rabbit).transform;
    if (originalComputed !== 'none') throw new Error('Rabbit not idle at fixture start: ' + originalComputed);
    const phases = [0, 100, 310, 340, 450, 560, 790, 900, 999];
    const observations = [];
    let animation;
    try {
      // Invoke the literal, existing canonical SVG @keyframes on the actual
      // production rabbit node. This is not a replacement animation definition.
      rabbit.style.setProperty('animation', 'r4h-roll-rabbit 1000ms linear 0ms 1 none', 'important');
      void rabbit.getBoundingClientRect();
      animation = rabbit.getAnimations().find(a => a.animationName === 'r4h-roll-rabbit');
      if (!animation) throw new Error('Canonical CSSAnimation not instantiated');
      animation.pause();
      for (const phase of phases) {
        animation.currentTime = phase;
        const computed = getComputedStyle(rabbit);
        const matrix = computed.transform === 'none' ? null : new DOMMatrix(computed.transform);
        observations.push({
          expectedPhaseMs: phase,
          actualPhaseMs: Number(animation.currentTime),
          playState: animation.playState,
          duration: computed.animationDuration,
          y: matrix ? matrix.m42 : 0,
          transform: computed.transform
        });
      }
    } finally {
      if (animation) animation.cancel();
      if (originalInline) rabbit.style.setProperty('animation', originalInline, originalPriority);
      else rabbit.style.removeProperty('animation');
    }
    return { initial: originalComputed, final: getComputedStyle(rabbit).transform, observations };
  });

  const obs = evidence.observations;
  const values = obs.map(x => x.y).filter(Number.isFinite);
  const peak = values.length ? Math.max(...values) : null;
  expect(obs, JSON.stringify(evidence)).toHaveLength(9);
  expect(obs.every(x => Number.isFinite(x.actualPhaseMs) &&
    Math.abs(x.actualPhaseMs - x.expectedPhaseMs) <= 1), JSON.stringify(evidence)).toBe(true);
  expect(obs.every(x => /^(1s|1000ms)$/.test(x.duration)), JSON.stringify(evidence)).toBe(true);
  expect(values.length, JSON.stringify(evidence)).toBeGreaterThanOrEqual(3);
  // Same motion thresholds as the live WebKit visual gate. No relaxation.
  expect(peak, JSON.stringify(evidence)).toBeGreaterThan(200);
  expect(Math.min(...values), JSON.stringify(evidence)).toBeGreaterThan(-30);
  expect(Math.abs(obs[0].y), JSON.stringify(evidence)).toBeLessThan(1);
  expect(Math.abs(obs[obs.length-1].y), JSON.stringify(evidence)).toBeLessThan(1);
  expect(evidence.final).toBe('none');
});
