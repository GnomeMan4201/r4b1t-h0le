'use strict';

const base = require('./playwright.config');

module.exports = {
  ...base,
  testMatch: ['mobile-result-viewport.spec.js'],
  outputDir: 'test-results-short-result',
  projects: base.projects.filter(project => project.name === 'mobile-chromium'),
  retries: 0,
};
