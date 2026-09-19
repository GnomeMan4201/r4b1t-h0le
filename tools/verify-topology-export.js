#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const verifier = require('../topology-independent-verifier.js');

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))).toString('utf8');
}

async function readJson(path) {
  if (path === '-') return JSON.parse(await readStdin());
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

async function main() {
  const [, , file] = process.argv;
  if (!file) throw new Error('Usage: npm run topology:verify -- <topology-export.json|->');
  const result = await verifier.verifyExport(await readJson(file));
  console.log('TOPOLOGY VERIFIED');
  console.log('format:      ' + result.format);
  console.log('nodes:       ' + result.nodes);
  console.log('edges:       ' + result.edges);
  console.log('diagnostics: ' + result.diagnostics);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('REJECTED / ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = verifier;
