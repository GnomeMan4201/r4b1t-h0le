#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const bundle = require('../trail-card-bundle.js');

async function main() {
  const [, , dir, verifiedAt] = process.argv;
  if (!dir || !verifiedAt) {
    throw new Error('Usage: node tools/inspect-trail-card-bundle.js <bundle-dir> <verified-at-ISO>');
  }

  const files = {};
  for (const name of [bundle.SOURCE_FILE, bundle.CARD_FILE]) {
    files[name] = await fs.readFile(path.join(dir, name));
  }

  const result = await bundle.inspect({ files }, { verified_at: verifiedAt });

  console.log('TRAIL CARD BUNDLE INSPECTED');
  console.log('source digest: ' + result.source_digest);
  console.log('stored state:  ' + result.stored_card.verification.state);
  console.log('fresh state:   ' + result.fresh_state);
  console.log('source match:  YES');
}

main().catch((error) => {
  console.error('BUNDLE REJECTED / ' + error.message);
  process.exitCode = 1;
});
