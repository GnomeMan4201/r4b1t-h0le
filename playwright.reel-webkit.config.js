'use strict';

const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8080/';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['roll-reel-webkit.spec.js'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list']] : 'list',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{
    name: 'mobile-webkit',
    use: {
      ...devices['iPhone 13'],
      browserName: 'webkit',
    },
  }],
  webServer: {
    command: 'node tests/test-server.js',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
