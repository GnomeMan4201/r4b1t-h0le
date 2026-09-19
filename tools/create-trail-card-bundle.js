#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const bundle = require('../trail-card-bundle.js');

async function main() {
  const [, , sourcePath, outputDir, verifiedAt] = process.argv;
  if (!sourcePath || !outputDir || !verifiedAt) {
    throw new Error('Usage: node tools/create-trail-card-bundle.js <source.json> <output-dir> <verified-at-ISO>');
  }

  const sourceBytes = await fs.readFile(sourcePath);
  const portable = await bundle.create(sourceBytes, { verified_at: verifiedAt });

  await fs.mkdir(outputDir, { recursive: false });

  for (const name of bundle.fileNames(portable)) {
    await fs.writeFile(path.join(outputDir, name), portable.files[name]);
  }

  console.log('TRAIL CARD BUNDLE CREATED');
  console.log('directory: ' + outputDir);
  console.log('state:     ' + portable.card.verification.state);
  console.log('digest:    ' + portable.card.source.artifact_digest);
  console.log('authority: ' + bundle.SOURCE_FILE);
  console.log('card:      ' + bundle.CARD_FILE);
}

main().catch((error) => {
  console.error('BUNDLE ERROR / ' + error.message);
  process.exitCode = 1;
});
