'use strict';

const base = require('./playwright.config.js');

module.exports = {
  ...base,
  testMatch: ['replay-inspection-ui.spec.js'],
};
