'use strict';

const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8080/';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['e2e.spec.js', 'dual-shell.spec.js', 'hero-copy.spec.js', 'trail-runtime.spec.js', 'blind-runtime.spec.js', 'topology-runtime.spec.js', 'cf1-mobile-roll-provenance.spec.js', 'resource-metadata.spec.js', 'production-mark-authority.spec.js', 'typed-candidate-production-shadow.spec.js', 'corpus-authority-loader.spec.js', 'corpus-authority.spec.js', 'terrain-eligibility.spec.js', 'sampler-continuity.spec.js', 'trail-v03-runtime.spec.js', 'branch-determinism.spec.js', 'mark-secondary-states.spec.js'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: {
    command: 'node tests/test-server.js',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
