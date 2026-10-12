#!/usr/bin/env node
'use strict';

/**
 * R4B1T domain-concentration audit (offline, non-authoritative).
 *
 * Uses the actual digest-pinned active URLs and production eligiblePool() to
 * compute domain shares, then simulates the production URL-uniform choice
 * (including the last-URL retry guard) with a deterministic seeded PRNG.
 * This is NOT a live production roll or a provenance proof.
 *
 * Usage:
 *   node tools/reel_domain_audit.js
 *   node tools/reel_domain_audit.js --terrain ALL --rolls 500 --seed 4201
 *   node tools/reel_domain_audit.js --terrain article,reference --rolls 300 --json
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { eligiblePool } = require('../selection-core.js');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = { terrain: 'ALL,article,reference', rolls: 300, seed: 4201, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node tools/reel_domain_audit.js [--terrain ALL,article,reference] [--rolls 300] [--seed 4201] [--json]');
      process.exit(0);
    }
    if (arg === '--json') { options.json = true; continue; }
    if (!['--terrain', '--rolls', '--seed'].includes(arg) || i + 1 >= argv.length) {
      throw new Error('Unknown or incomplete argument: ' + arg);
    }
    const value = argv[++i];
    options[arg.slice(2)] = value;
  }
  options.terrain = String(options.terrain).split(',').filter(Boolean);
  options.rolls = Number(options.rolls);
  options.seed = Number(options.seed);
  if (!Number.isSafeInteger(options.rolls) || options.rolls < 1 || options.rolls > 1000000)
    throw new Error('rolls must be an integer between 1 and 1000000');
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 4294967295)
    throw new Error('seed must be a uint32');
  return options;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hostOf(url) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
}

function histogram(urls) {
  const counts = Object.create(null);
  for (const url of urls) {
    const host = hostOf(url);
    counts[host] = (counts[host] || 0) + 1;
  }
  return counts;
}

function summary(counts, total, max = 10) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([host, count]) => ({ host, count, pct: +(100 * count / total).toFixed(3) }));
}

// Mirror index.html's ee(pool, rng, reference). This is a sampling model,
// NOT the production commit/reveal RNG implementation.
function pickUrl(pool, rng, previous) {
  let choice, attempts = 0;
  do {
    choice = pool[Math.floor(rng() * pool.length)];
    attempts++;
    if (previous == null || choice !== previous) break;
  } while (attempts < 30);
  return choice;
}

function run(options) {
  const active = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/runtime/active-v1.json'), 'utf8'));
  if (!active.active || active.active.selection_authority !== true) throw new Error('active promotion lacks authority');
  const urlBytes = fs.readFileSync(path.join(ROOT, active.active.url));
  const digest = 'sha256:' + crypto.createHash('sha256').update(urlBytes).digest('hex');
  if (digest !== active.active.expected_digest) throw new Error('active URL digest mismatch');
  const urls = urlBytes.toString('utf8').trimEnd().split(/\r?\n/);
  const registry = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'corpus/runtime/eligibility-profiles-v1.json'), 'utf8'
  ));
  const profile = registry.profiles.find(row => row.promotion_id === active.promotion_id && row.status === 'active');
  if (!profile || profile.release.urls_digest !== digest ||
      profile.release.release_id !== active.active.release_id) {
    throw new Error('active terrain profile does not match corpus promotion');
  }
  const indexBytes = fs.readFileSync(path.join(ROOT, profile.terrain_index.path));
  const terrainDigest = 'sha256:' + crypto.createHash('sha256').update(indexBytes).digest('hex');
  if (terrainDigest !== profile.terrain_index.digest) throw new Error('terrain index digest mismatch');
  const terrainIndex = JSON.parse(indexBytes.toString('utf8'));
  if (terrainIndex.schema !== profile.terrain_index.schema ||
      terrainIndex.release.urls_digest !== digest) {
    throw new Error('terrain index is not bound to active URLs');
  }
  const known = new Set(['ALL', ...terrainIndex.terrains.map(t => t.id)]);
  const results = options.terrain.map((terrain, index) => {
    if (!known.has(terrain)) throw new Error('unknown terrain: ' + terrain);
    const eligible = eligiblePool(urls, terrainIndex, {
      terrain,
      protocolPolicy: { version: 1, excludeOnion: false }
    });
    if (!eligible.length) throw new Error('empty eligible pool: ' + terrain);
    const corpusHosts = histogram(eligible);
    const rng = seededRandom((options.seed + index) >>> 0);
    let prev = null, adjacentSameHost = 0, adjacentSameUrl = 0;
    const rolled = [];
    for (let i = 0; i < options.rolls; i++) {
      const url = pickUrl(eligible, rng, prev);
      if (prev != null && hostOf(prev) === hostOf(url)) adjacentSameHost++;
      if (prev === url) adjacentSameUrl++;
      rolled.push(url);
      prev = url;
    }
    const observed = histogram(rolled);
    return {
      terrain, pool: eligible.length, unique_hosts: Object.keys(corpusHosts).length,
      draws: options.rolls, distinct_urls_rolled: new Set(rolled).size,
      adjacent_same_host: adjacentSameHost, adjacent_same_url: adjacentSameUrl,
      expected_top_hosts: summary(corpusHosts, eligible.length),
      observed_top_hosts: summary(observed, options.rolls),
      requested: Object.fromEntries(['gtfobins.org', 'tmpout.sh'].map(h => [h, {
        eligible: corpusHosts[h] || 0, expected_pct: +(100 * (corpusHosts[h] || 0) / eligible.length).toFixed(3),
        drawn: observed[h] || 0, observed_pct: +(100 * (observed[h] || 0) / options.rolls).toFixed(3)
      }]))
    };
  });
  return { schema: 'r4b1t-reel-domain-audit-v1', authority_digest: digest, terrain_digest: terrainDigest, release: active.active.release_id,
    simulation: 'seeded offline URL-uniform sample (not live roll or proof)',
    seed: options.seed, results };
}

try {
  const options = parseArgs(process.argv.slice(2));
  const report = run(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('R4B1T domain audit — ' + report.release);
    console.log('Verified active digest: ' + report.authority_digest);
    console.log('Verified terrain digest: ' + report.terrain_digest);
    console.log(report.simulation + '; seed=' + report.seed);
    for (const r of report.results) {
      console.log('\n' + r.terrain + ' — ' + r.pool + ' eligible URLs, ' + r.unique_hosts + ' hosts, ' + r.draws + ' simulated selections');
      console.log('URL repeats in consecutive rolls: ' + r.adjacent_same_url + '; same-host transitions: ' + r.adjacent_same_host);
      for (const [host, v] of Object.entries(r.requested)) {
        console.log('  ' + host + ': eligible ' + v.eligible + ' (' + v.expected_pct + '%), drawn ' + v.drawn + ' (' + v.observed_pct + '%)');
      }
      for (const h of r.expected_top_hosts.slice(0, 5)) console.log('  corpus: ' + h.host + ' ' + h.count + ' (' + h.pct + '%)');
    }
  }
} catch (error) {
  console.error('Audit failed: ' + error.message);
  process.exitCode = 1;
}
