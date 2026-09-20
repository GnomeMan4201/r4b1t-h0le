'use strict';

const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'https://r4b1t.badbananaresearch.com/';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['production-acceptance.spec.js'],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-production-report' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-production',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'iphone13-production',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],
});
