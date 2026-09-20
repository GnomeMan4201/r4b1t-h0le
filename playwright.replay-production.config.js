'use strict';

const base = require('./playwright.production.config.js');

module.exports = {
  ...base,
  testMatch: ['replay-production-acceptance.spec.js'],
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-replay-production-report' }]],
};
