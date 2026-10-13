'use strict';
const base = require('./playwright.config');
module.exports = {
  ...base,
  testMatch: ['sprout-flow.spec.js'],
  use: {
    ...base.use,
    video: process.env.SPROUT_CHROMIUM_PATH ? 'off' : base.use.video,
    launchOptions: process.env.SPROUT_CHROMIUM_PATH ? {
      executablePath: process.env.SPROUT_CHROMIUM_PATH,
      args: ['--no-sandbox','--disable-dev-shm-usage']
    } : {}
  }
};
