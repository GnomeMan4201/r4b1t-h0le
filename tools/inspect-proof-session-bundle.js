#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const bundle = require('../proof-session-bundle.js');

async function collectFiles(root, relative) {
  const dir = path.join(root, relative || '');
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = {};

  for (const entry of entries) {
    const rel = relative ? path.posix.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) {
      Object.assign(files, await collectFiles(root, rel));
    } else if (entry.isFile()) {
      files[rel] = await fs.readFile(path.join(root, ...rel.split('/')));
    }
  }
  return files;
}

async function main() {
  const [, , dir, verifiedAt] = process.argv;
  if (!dir || !verifiedAt) {
    throw new Error('Usage: node tools/inspect-proof-session-bundle.js <file-set-dir> <verified-at-ISO>');
  }

  const files = await collectFiles(dir, '');
  const result = await bundle.inspect({ files }, { verified_at: verifiedAt });

  console.log('PROOF SESSION FILE SET INSPECTED');
  console.log('classification: ' + result.classification);

  if (result.fresh_projection) {
    console.log('fresh sources:  ' + result.fresh_projection.sources.length);
    console.log('fresh pairs:    ' + result.fresh_projection.pairs.length);
  }

  if (result.warnings.length) {
    console.log('warnings:       ' + result.warnings.join('; '));
  }
  if (result.mismatches.length) {
    console.log('mismatches:     ' + result.mismatches.join('; '));
  }
  if (result.reason) {
    console.log('reason:         ' + result.reason);
  }

  if (result.classification !== 'MATCH') process.exitCode = 2;
}

main().catch((error) => {
  console.error('INSPECTION ERROR / ' + error.message);
  process.exitCode = 1;
});
