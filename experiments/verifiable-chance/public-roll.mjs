#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cj1 = require('../../cj1.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '../..');
const DECLARATION_SCHEMA = 'r4b1t-public-roll-declaration/v1';
const RECEIPT_SCHEMA = 'r4b1t-public-roll-receipt/v1';
const TERRAIN_SCHEMA = 'r4b1t-terrain-index-v1';
const SAMPLER = 'sha256-ctr-rejection/v1';
const DOMAIN = Buffer.from('r4b1t-sha256-ctr-rejection/v1\0', 'utf8');
const ROUTE_PREFIX = Buffer.from('r4b1t-route/v0.1\n', 'utf8');
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const HEX96_RE = /^[0-9a-f]{96}$/;

function fail(code, detail = '') {
  const error = new Error(code + (detail ? ': ' + detail : ''));
  error.code = code;
  throw error;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function shaId(buffer) {
  return 'sha256:' + sha256(buffer).toString('hex');
}

function rawSha(id, label) {
  if (!SHA_RE.test(id || '')) fail('SHAPE_INVALID', label + ' must be sha256:<hex>');
  return Buffer.from(id.slice(7), 'hex');
}

function routeId(url) {
  return 'sha256:' + sha256(Buffer.concat([ROUTE_PREFIX, Buffer.from(url, 'utf8')])).toString('hex');
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SHAPE_INVALID', label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, i) => key !== wanted[i])) {
    fail('SHAPE_INVALID', label + ' keys');
  }
}

function parseUrls(bytes) {
  const text = bytes.toString('utf8');
  const urls = text.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  if (!urls.length) fail('CORPUS_INVALID', 'empty urls.txt');
  return urls;
}

function loadPinnedQuicknet(root) {
  const config = readJson(path.join(root, 'experiments/verifiable-chance/quicknet-v1.json'));
  exactKeys(config, ['schema','beacon_id','chain_hash','public_key','period','genesis_time','scheme_id','dst','api_base'], 'quicknet config');
  if (config.schema !== 'r4b1t-quicknet-config-v1' ||
      config.beacon_id !== 'quicknet' ||
      config.scheme_id !== 'bls-unchained-g1-rfc9380' ||
      config.period !== 3 ||
      !HEX64_RE.test(config.chain_hash) ||
      !/^[0-9a-f]{192}$/.test(config.public_key)) {
    fail('QUICKNET_CONFIG_INVALID');
  }
  return config;
}

function loadRelease(root, binding) {
  exactKeys(binding, ['release_id','urls_digest','resources_digest'], 'release binding');
  const releaseDir = path.join(root, 'corpus/releases', binding.release_id);
  const manifest = readJson(path.join(releaseDir, 'manifest.json'));
  if (manifest.release_id !== binding.release_id ||
      manifest.urls_digest !== binding.urls_digest ||
      manifest.resources_digest !== binding.resources_digest) {
    fail('RELEASE_BINDING_MISMATCH');
  }
  const urlBytes = fs.readFileSync(path.join(releaseDir, 'urls.txt'));
  const resourceBytes = fs.readFileSync(path.join(releaseDir, 'resources.json'));
  if (shaId(urlBytes) !== binding.urls_digest) fail('CORPUS_DIGEST_MISMATCH');
  if (shaId(resourceBytes) !== binding.resources_digest) fail('RESOURCES_DIGEST_MISMATCH');
  return { manifest, urls: parseUrls(urlBytes) };
}

function profilesForRelease(root, binding) {
  const registry = readJson(path.join(root, 'corpus/runtime/eligibility-profiles-v1.json'));
  if (registry.schema !== 'r4b1t-eligibility-profiles-v1' || !Array.isArray(registry.profiles)) {
    fail('REGISTRY_INVALID');
  }
  return registry.profiles.filter(profile => {
    const release = profile && profile.release;
    return release &&
      release.release_id === binding.release_id &&
      release.urls_digest === binding.urls_digest &&
      release.resources_digest === binding.resources_digest &&
      (profile.status === 'active' || profile.status === 'superseded');
  });
}

function authoritativeTerrainIndex(root, binding, terrainRef) {
  exactKeys(terrainRef, ['schema','digest'], 'terrain_index');
  if (terrainRef.schema !== TERRAIN_SCHEMA || !SHA_RE.test(terrainRef.digest || '')) {
    fail('TERRAIN_INDEX_INVALID');
  }
  const matches = profilesForRelease(root, binding).filter(profile =>
    profile.terrain_index &&
    profile.terrain_index.schema === TERRAIN_SCHEMA &&
    profile.terrain_index.digest === terrainRef.digest
  );
  if (matches.length !== 1) fail('TERRAIN_MAP_NOT_AUTHORITATIVE', terrainRef.digest);
  const meta = matches[0].terrain_index;
  const bytes = fs.readFileSync(path.join(root, meta.path));
  if (shaId(bytes) !== meta.digest) fail('TERRAIN_INDEX_DIGEST_MISMATCH');
  const index = JSON.parse(bytes.toString('utf8'));
  if (cj1.serialize(index) + '\n' !== bytes.toString('utf8')) fail('TERRAIN_INDEX_NOT_CANONICAL');
  if (index.schema !== TERRAIN_SCHEMA ||
      index.release.release_id !== binding.release_id ||
      index.release.urls_digest !== binding.urls_digest ||
      index.release.resources_digest !== binding.resources_digest) {
    fail('TERRAIN_INDEX_BINDING_MISMATCH');
  }
  return { index, profile: matches[0] };
}

function eligiblePool(root, declaration) {
  const release = loadRelease(root, declaration.release);
  const constraint = declaration.constraint;
  exactKeys(constraint, ['terrain','terrain_index','protocol_policy'], 'constraint');
  exactKeys(constraint.protocol_policy, ['version','exclude_onion'], 'protocol_policy');
  if (constraint.protocol_policy.version !== 1 || typeof constraint.protocol_policy.exclude_onion !== 'boolean') {
    fail('CONSTRAINT_INVALID', 'protocol_policy');
  }

  let pool;
  let terrainAuthority = null;
  if (constraint.terrain === 'ALL') {
    if (constraint.terrain_index !== null) fail('CONSTRAINT_INVALID', 'ALL terrain_index');
    pool = [...release.urls];
  } else {
    if (typeof constraint.terrain !== 'string' || !constraint.terrain) fail('CONSTRAINT_INVALID', 'terrain');
    const { index, profile } = authoritativeTerrainIndex(root, declaration.release, constraint.terrain_index);
    const terrain = index.terrains.find(entry => entry.id === constraint.terrain);
    if (!terrain || !Array.isArray(terrain.members) || terrain.count !== terrain.members.length) {
      fail('TERRAIN_UNKNOWN', constraint.terrain);
    }
    pool = terrain.members.map(member => {
      if (!Number.isSafeInteger(member) || member < 0 || member >= release.urls.length) {
        fail('TERRAIN_INDEX_INVALID', 'member range');
      }
      return release.urls[member];
    });
    terrainAuthority = profile.status === 'active' ? 'AUTHORITATIVE_ACTIVE' : 'AUTHORITATIVE_SUPERSEDED';
  }

  if (constraint.protocol_policy.exclude_onion) {
    pool = pool.filter(url => !url.includes('.onion'));
  }
  if (!pool.length) fail('EMPTY_ELIGIBLE_POOL');
  return { pool, terrainAuthority };
}

function declarationId(declaration) {
  return shaId(Buffer.from(cj1.serialize(declaration), 'utf8'));
}

function verifyDeclarationEnvelope(root, envelope) {
  exactKeys(envelope, ['declaration_id','declaration'], 'declaration envelope');
  if (!SHA_RE.test(envelope.declaration_id || '')) fail('DECLARATION_ID_INVALID');
  const declaration = envelope.declaration;
  exactKeys(declaration, ['schema','release','constraint','sampler','beacon'], 'declaration');
  if (declaration.schema !== DECLARATION_SCHEMA) fail('DECLARATION_FORMAT_UNSUPPORTED');
  exactKeys(declaration.sampler, ['algorithm'], 'sampler');
  if (declaration.sampler.algorithm !== SAMPLER) fail('SAMPLER_UNSUPPORTED');
  exactKeys(declaration.beacon, ['network','chain_hash','round'], 'beacon declaration');
  const quicknet = loadPinnedQuicknet(root);
  if (declaration.beacon.network !== 'quicknet' ||
      declaration.beacon.chain_hash !== quicknet.chain_hash ||
      !Number.isSafeInteger(declaration.beacon.round) ||
      declaration.beacon.round < 1) {
    fail('BEACON_DECLARATION_INVALID');
  }
  if (declarationId(declaration) !== envelope.declaration_id) fail('DECLARATION_ID_MISMATCH');
  // Binding checks happen even before a beacon is supplied.
  eligiblePool(root, declaration);
  return declaration;
}

function validateBeacon(declaration, beacon) {
  exactKeys(beacon, ['round','randomness','signature'], 'beacon');
  if (beacon.round !== declaration.beacon.round ||
      !HEX64_RE.test(beacon.randomness || '') ||
      !HEX96_RE.test(beacon.signature || '')) {
    fail('BEACON_INVALID');
  }
  const expected = sha256(Buffer.from(beacon.signature, 'hex')).toString('hex');
  if (expected !== beacon.randomness) fail('BEACON_RANDOMNESS_MISMATCH');
}

function deriveIndex(declarationIdValue, randomnessHex, poolSize) {
  if (!Number.isSafeInteger(poolSize) || poolSize < 1) fail('EMPTY_ELIGIBLE_POOL');
  const declarationDigest = rawSha(declarationIdValue, 'declaration_id');
  const randomness = Buffer.from(randomnessHex, 'hex');
  const modulus = BigInt(poolSize);
  const space = 1n << 256n;
  const limit = space - (space % modulus);
  for (let counter = 0; counter < Number.MAX_SAFE_INTEGER; counter += 1) {
    const c = Buffer.alloc(8);
    c.writeBigUInt64BE(BigInt(counter));
    const block = sha256(Buffer.concat([DOMAIN, declarationDigest, randomness, c]));
    const x = BigInt('0x' + block.toString('hex'));
    if (x < limit) {
      return { counter, index: Number(x % modulus), block: block.toString('hex') };
    }
  }
  fail('SAMPLER_EXHAUSTED');
}

function buildReceipt(root, declarationEnvelope, beacon) {
  const declaration = verifyDeclarationEnvelope(root, declarationEnvelope);
  validateBeacon(declaration, beacon);
  const { pool, terrainAuthority } = eligiblePool(root, declaration);
  const draw = deriveIndex(declarationEnvelope.declaration_id, beacon.randomness, pool.length);
  const url = pool[draw.index];
  return {
    schema: RECEIPT_SCHEMA,
    declaration: declarationEnvelope,
    beacon,
    selection: {
      sampler: SAMPLER,
      eligible_count: pool.length,
      counter: draw.counter,
      block: draw.block,
      index: draw.index,
      terrain_authority: terrainAuthority,
      route: { route_id: routeId(url), url }
    },
    witness: null
  };
}

function verifyReceipt(root, receipt) {
  exactKeys(receipt, ['schema','declaration','beacon','selection','witness'], 'receipt');
  if (receipt.schema !== RECEIPT_SCHEMA) fail('RECEIPT_FORMAT_UNSUPPORTED');
  if (receipt.witness !== null) fail('WITNESS_UNSUPPORTED', 'v1 prototype accepts null only');
  const expected = buildReceipt(root, receipt.declaration, receipt.beacon);
  if (cj1.serialize(expected.selection) !== cj1.serialize(receipt.selection)) {
    fail('SELECTION_REPRODUCTION_MISMATCH');
  }
  return {
    status: 'SELECTION_REPRODUCED',
    declaration_id: receipt.declaration.declaration_id,
    release_id: receipt.declaration.declaration.release.release_id,
    round: receipt.beacon.round,
    route: receipt.selection.route,
    claims: {
      declaration_integrity: 'PROVEN',
      release_binding: 'PROVEN',
      beacon_randomness_binding: 'PROVEN',
      beacon_signature: 'NOT_ESTABLISHED_BY_THIS_VERIFIER',
      route_derivation: 'PROVEN',
      non_cherry_picked: 'NOT_ESTABLISHED'
    }
  };
}

function createDeclaration(root, terrain, round, excludeOnion) {
  const promotion = readJson(path.join(root, 'corpus/runtime/active-v1.json'));
  const manifest = readJson(path.join(root, promotion.active.manifest_url));
  const binding = {
    release_id: manifest.release_id,
    urls_digest: manifest.urls_digest,
    resources_digest: manifest.resources_digest
  };
  let terrainIndex = null;
  if (terrain !== 'ALL') {
    const profiles = profilesForRelease(root, binding).filter(profile => profile.status === 'active');
    if (profiles.length !== 1) fail('ACTIVE_TERRAIN_PROFILE_INVALID');
    const bytes = fs.readFileSync(path.join(root, profiles[0].terrain_index.path));
    const index = JSON.parse(bytes.toString('utf8'));
    if (!index.terrains.some(entry => entry.id === terrain)) fail('TERRAIN_UNKNOWN', terrain);
    terrainIndex = { schema: TERRAIN_SCHEMA, digest: profiles[0].terrain_index.digest };
  }
  const quicknet = loadPinnedQuicknet(root);
  const declaration = {
    schema: DECLARATION_SCHEMA,
    release: binding,
    constraint: {
      terrain,
      terrain_index: terrainIndex,
      protocol_policy: { version: 1, exclude_onion: Boolean(excludeOnion) }
    },
    sampler: { algorithm: SAMPLER },
    beacon: { network: 'quicknet', chain_hash: quicknet.chain_hash, round }
  };
  const envelope = { declaration_id: declarationId(declaration), declaration };
  verifyDeclarationEnvelope(root, envelope);
  return envelope;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) { args._.push(value); continue; }
    const key = value.slice(2);
    if (key === 'exclude-onion') { args[key] = true; continue; }
    if (i + 1 >= argv.length) fail('ARGUMENT_INVALID', value);
    args[key] = argv[++i];
  }
  return args;
}

function writeOutput(value, out) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (out) fs.writeFileSync(out, text);
  else process.stdout.write(text);
}

function usage() {
  return [
    'Usage:',
    '  node experiments/verifiable-chance/public-roll.mjs declare --round N [--terrain ALL] [--exclude-onion] [--out file]',
    '  node experiments/verifiable-chance/public-roll.mjs receipt --declaration file --beacon file [--out file]',
    '  node experiments/verifiable-chance/public-roll.mjs verify --receipt file',
    '',
    'This JavaScript verifier independently reproduces release/eligibility/sampling,',
    'but intentionally does not claim BLS verification. Use verify_public_roll.py',
    'for the pinned Quicknet signature check.'
  ].join('\n');
}

try {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const root = path.resolve(args.root || DEFAULT_ROOT);
  if (command === 'declare') {
    const round = Number(args.round);
    if (!Number.isSafeInteger(round) || round < 1) fail('ARGUMENT_INVALID', '--round');
    writeOutput(createDeclaration(root, args.terrain || 'ALL', round, args['exclude-onion']), args.out);
  } else if (command === 'receipt') {
    if (!args.declaration || !args.beacon) fail('ARGUMENT_INVALID', '--declaration and --beacon are required');
    writeOutput(buildReceipt(root, readJson(args.declaration), readJson(args.beacon)), args.out);
  } else if (command === 'verify') {
    if (!args.receipt) fail('ARGUMENT_INVALID', '--receipt is required');
    writeOutput(verifyReceipt(root, readJson(args.receipt)));
  } else {
    process.stderr.write(usage() + '\n');
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  process.stderr.write(JSON.stringify({
    status: 'VERIFICATION_FAILED',
    code: error && error.code || 'UNEXPECTED_ERROR',
    detail: String(error && error.message || error)
  }) + '\n');
  process.exit(1);
}
