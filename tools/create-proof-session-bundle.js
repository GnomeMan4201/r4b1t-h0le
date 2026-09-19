#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const bundle = require('../proof-session-bundle.js');

async function main() {
  const [, , outputDir, verifiedAt, ...sourcePaths] = process.argv;
  if (!outputDir || !verifiedAt || !sourcePaths.length) {
    throw new Error('Usage: node tools/create-proof-session-bundle.js <output-dir> <verified-at-ISO> <source1.json> [source2.json ...]');
  }

  const inputs = [];
  for (const sourcePath of sourcePaths) inputs.push(await fs.readFile(sourcePath));
  const portable = await bundle.create(inputs, { verified_at: verifiedAt });

  await fs.mkdir(outputDir, { recursive: false });

  for (const name of bundle.fileNames(portable)) {
    const target = path.join(outputDir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, portable.files[name]);
  }

  console.log('PROOF SESSION FILE SET CREATED');
  console.log('directory: ' + outputDir);
  console.log('sources:   ' + portable.projection.sources.length);
  console.log('pairs:     ' + portable.projection.pairs.length);
  console.log('format:    ' + portable.projection.format);
}

main().catch((error) => {
  console.error('EXPORT ERROR / ' + error.message);
  process.exitCode = 1;
});
