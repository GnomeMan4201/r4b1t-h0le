const { test, expect } = require('@playwright/test');

test('RA-3 diagnostic: Session History focus timing across repeated desktop opens', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();

  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    const historyButton = page.locator('button', { hasText: 'history' }).first();
    await expect(historyButton).toBeVisible();
    await historyButton.focus();
    await expect(historyButton).toBeFocused();

    await historyButton.press('Enter');

    const snapshot = async (phase) => page.evaluate((label) => {
      const overlay = document.querySelector('#historyOverlay');
      const active = document.activeElement;
      return {
        phase: label,
        inside: !!(overlay && overlay.contains(active)),
        activeTag: active ? active.tagName : null,
        activeId: active ? active.id : null,
        activeText: active ? (active.textContent || '').trim().slice(0, 80) : null,
        display: overlay ? getComputedStyle(overlay).display : null,
        ariaHidden: overlay ? overlay.getAttribute('aria-hidden') : null
      };
    }, phase);

    const immediate = await snapshot('immediate');
    await page.waitForTimeout(25);
    const after25 = await snapshot('after25ms');
    await page.waitForTimeout(75);
    const after100 = await snapshot('after100ms');

    samples.push({ iteration: i + 1, immediate, after25, after100 });
  }

  console.log('RA3_HISTORY_FOCUS_SAMPLES=' + JSON.stringify(samples));

  const immediateMisses = samples.filter((s) => !s.immediate.inside).length;
  const after25Misses = samples.filter((s) => !s.after25.inside).length;
  const after100Misses = samples.filter((s) => !s.after100.inside).length;
  console.log('RA3_HISTORY_FOCUS_COUNTS=' + JSON.stringify({
    runs: samples.length,
    immediateMisses,
    after25Misses,
    after100Misses
  }));

  // Investigation gate: focus must at least converge inside the open dialog.
  expect(after100Misses).toBe(0);
});


test('RA-3 diagnostic: Help focus timing across repeated desktop opens', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') test.skip();

  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    const theme = page.locator('#themeBtn');
    await expect(theme).toBeVisible();
    await theme.focus();
    await expect(theme).toBeFocused();

    await page.evaluate(() => window.toggleHelp());

    const snapshot = async (phase) => page.evaluate((label) => {
      const overlay = document.querySelector('#helpOverlay');
      const active = document.activeElement;
      return {
        phase: label,
        inside: !!(overlay && overlay.contains(active)),
        activeTag: active ? active.tagName : null,
        activeId: active ? active.id : null,
        activeText: active ? (active.textContent || '').trim().slice(0, 80) : null,
        open: overlay ? overlay.classList.contains('open') : false,
        ariaHidden: overlay ? overlay.getAttribute('aria-hidden') : null
      };
    }, phase);

    const immediate = await snapshot('immediate');
    await page.waitForTimeout(25);
    const after25 = await snapshot('after25ms');
    await page.waitForTimeout(75);
    const after100 = await snapshot('after100ms');

    samples.push({ iteration: i + 1, immediate, after25, after100 });
  }

  console.log('RA3_HELP_FOCUS_SAMPLES=' + JSON.stringify(samples));

  const immediateMisses = samples.filter((s) => !s.immediate.inside).length;
  const after25Misses = samples.filter((s) => !s.after25.inside).length;
  const after100Misses = samples.filter((s) => !s.after100.inside).length;
  console.log('RA3_HELP_FOCUS_COUNTS=' + JSON.stringify({
    runs: samples.length,
    immediateMisses,
    after25Misses,
    after100Misses
  }));

  expect(after100Misses).toBe(0);
});
