#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const bundle = require('../trail-comparison-bundle.js');

async function main() {
  const [, , leftPath, rightPath, outputDir, verifiedAt] = process.argv;
  if (!leftPath || !rightPath || !outputDir || !verifiedAt) {
    throw new Error('Usage: node tools/create-trail-comparison-bundle.js <left.json> <right.json> <output-dir> <verified-at-ISO>');
  }

  const leftBytes = await fs.readFile(leftPath);
  const rightBytes = await fs.readFile(rightPath);
  const portable = await bundle.create(leftBytes, rightBytes, { verified_at: verifiedAt });

  await fs.mkdir(outputDir, { recursive: false });
  for (const name of bundle.fileNames(portable)) {
    await fs.writeFile(path.join(outputDir, name), portable.files[name]);
  }

  console.log('TRAIL COMPARISON BUNDLE CREATED');
  console.log('directory:    ' + outputDir);
  console.log('left state:   ' + portable.projection.verification.left.state);
  console.log('right state:  ' + portable.projection.verification.right.state);
  console.log('left digest:  ' + portable.projection.sources.left.artifact_digest);
  console.log('right digest: ' + portable.projection.sources.right.artifact_digest);
}

main().catch((error) => {
  console.error('BUNDLE ERROR / ' + error.message);
  process.exitCode = 1;
});
