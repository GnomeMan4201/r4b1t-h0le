'use strict';

const { defineConfig } = require('@playwright/test');
const production = require('./playwright.production.config');

module.exports = defineConfig({
  ...production,
  testMatch: [
    'typed-candidate-production-shadow.spec.js',
    'corpus-authority.spec.js',
    'corpus-authority-loader.spec.js',
  ],
});
