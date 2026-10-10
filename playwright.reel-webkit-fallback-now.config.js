'use strict';
const { defineConfig } = require('@playwright/test');
const base = require('./playwright.reel-webkit.config.js');
module.exports = defineConfig({ ...base, testMatch: ['roll-reel-fallback-now.spec.js'], fullyParallel: true, workers: 4, retries: 0, timeout: 40000 });
