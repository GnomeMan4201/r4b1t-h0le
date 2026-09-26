'use strict';

const base = require('./playwright.config.js');

module.exports = {
  ...base,
  testMatch: ['trail-comparison-renderer.spec.js', 'trail-comparison-import.spec.js'],
  webServer: {
    ...base.webServer,
    command: 'TEST_ROOT=. node tests/test-server.js',
  },
};
