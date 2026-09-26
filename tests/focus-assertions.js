'use strict';

const { expect } = require('@playwright/test');

async function expectFocusInside(page, selector) {
  await expect.poll(
    () => page.evaluate((target) => {
      const overlay = document.querySelector(target);
      return Boolean(overlay && overlay.contains(document.activeElement));
    }, selector),
    { message: `expected focus to move inside ${selector}` }
  ).toBe(true);
}

module.exports = { expectFocusInside };
