'use strict';

const base = require('./playwright.config.js');

module.exports = {
  ...base,
  testMatch: ['proof-session-renderer.spec.js', 'proof-session-import.spec.js'],
  webServer: {
    ...base.webServer,
    command: 'TEST_ROOT=. node tests/test-server.js',
  },
};
