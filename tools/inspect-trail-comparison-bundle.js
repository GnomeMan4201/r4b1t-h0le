#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const bundle = require('../trail-comparison-bundle.js');

async function main() {
  const [, , dir, verifiedAt] = process.argv;
  if (!dir || !verifiedAt) {
    throw new Error('Usage: node tools/inspect-trail-comparison-bundle.js <bundle-dir> <verified-at-ISO>');
  }

  const files = {};
  for (const name of [bundle.LEFT_SOURCE_FILE, bundle.RIGHT_SOURCE_FILE, bundle.PROJECTION_FILE]) {
    files[name] = await fs.readFile(path.join(dir, name));
  }

  const result = await bundle.inspect({ files }, { verified_at: verifiedAt });

  console.log('TRAIL COMPARISON BUNDLE INSPECTED');
  console.log('left digest:   ' + result.left_source_digest);
  console.log('right digest:  ' + result.right_source_digest);
  console.log('stored left:   ' + result.stored_projection.verification.left.state);
  console.log('stored right:  ' + result.stored_projection.verification.right.state);
  console.log('fresh left:    ' + result.fresh_projection.verification.left.state);
  console.log('fresh right:   ' + result.fresh_projection.verification.right.state);
  console.log('source match:  YES');
}

main().catch((error) => {
  console.error('BUNDLE REJECTED / ' + error.message);
  process.exitCode = 1;
});
