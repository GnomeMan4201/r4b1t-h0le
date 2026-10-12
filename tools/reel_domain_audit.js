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
  const options = { terrain: 'ALL,article,reference', rolls: 300, seed: 4201, seeds: 1, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node tools/reel_domain_audit.js [--terrain ALL,article,reference] [--rolls 300] [--seed 4201] [--seeds 200] [--json]');
      process.exit(0);
    }
    if (arg === '--json') { options.json = true; continue; }
    if (!['--terrain', '--rolls', '--seed', '--seeds'].includes(arg) || i + 1 >= argv.length) {
      throw new Error('Unknown or incomplete argument: ' + arg);
    }
    const value = argv[++i];
    options[arg.slice(2)] = value;
  }
  options.terrain = String(options.terrain).split(',').filter(Boolean);
  options.rolls = Number(options.rolls);
  options.seed = Number(options.seed);
  options.seeds = Number(options.seeds);
  if (!Number.isSafeInteger(options.rolls) || options.rolls < 1 || options.rolls > 1000000)
    throw new Error('rolls must be an integer between 1 and 1000000');
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 4294967295)
    throw new Error('seed must be a uint32');
  if (!Number.isSafeInteger(options.seeds) || options.seeds < 1 || options.seeds > 1000)
    throw new Error('seeds must be an integer between 1 and 1000');
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

/**
 * Independent statistical oracle, separate from the sampler/simulation.
 * For R draws within one fixed eligible pool of N distinct URLs, there are
 * R-1 adjacent transitions. The first ROLL has no previous-URL reference.
 *
 * A previous URL reappears only if ALL 30 independent attempts choose it:
 *   q = (1/N)^30  (for N=1, q=1)
 * If a previous URL is in the pool, the other N-1 URLs are symmetric.
 * Host repeats still occur when a different URL belongs to the same host.
 */
function expectedTransitions(counts, poolSize, rolls) {
  const transitions = Math.max(0, rolls - 1);
  const n = poolSize;
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('expected transitions: pool must be nonempty');
  const hostCounts = Object.values(counts);
  const squared = hostCounts.reduce((sum, count) => sum + count * count, 0);
  const others = hostCounts.reduce((sum, count) => sum + count * (count - 1), 0);
  const exhausted = Math.pow(1 / n, 30);
  const iidUrl = transitions / n;
  const iidHost = transitions * squared / (n * n);
  const guardedUrl = transitions * exhausted;
  const guardedHost = transitions * (n === 1
    ? 1 : exhausted + (1 - exhausted) * others / (n * (n - 1)));
  return Object.freeze({
    independent_iid: Object.freeze({ same_url: iidUrl, same_host: iidHost }),
    uniform_with_repeat_guard_v1: Object.freeze({ same_url: guardedUrl, same_host: guardedHost })
  });
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

/**
 * Independent seed sweep: each chain starts with a null previous URL.
 * Report observed replicate means and empirical standard errors, retaining
 * the exact fixed-seed golden vector separately in run().
 * This is a deterministic regression diagnostic, not proof of RNG fairness.
 */
function multiSeedTrial(pool, rolls, baseSeed, seeds, expectation) {
  const hosts = pool.map(hostOf);
  const index = new Map(pool.map((url, i) => [url, i]));
  const counts = new Array(pool.length).fill(0);
  const sameHostPerSeed = [];
  const sameUrlPerSeed = [];
  for (let k = 0; k < seeds; k++) {
    const rng = seededRandom((baseSeed + k) >>> 0);
    let previous = null, prevHost = '', sameHost = 0, sameUrl = 0;
    for (let j = 0; j < rolls; j++) {
      const url = pickUrl(pool, rng, previous);
      const position = index.get(url);
      if (position === undefined) throw new Error('multi-seed output escaped eligible pool');
      counts[position]++;
      const host = hosts[position];
      if (previous != null && previous === url) sameUrl++;
      if (previous != null && prevHost === host) sameHost++;
      previous = url;
      prevHost = host;
    }
    sameHostPerSeed.push(sameHost);
    sameUrlPerSeed.push(sameUrl);
  }
  function stats(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      Math.max(1, values.length - 1);
    return { mean, standard_error: Math.sqrt(variance / values.length) };
  }
  // A marginal frequency guard catches missing/oversampled URLs even if the
  // aggregate same-host transitions happen to look correct.
  const total = rolls * seeds;
  const expectedEach = total / pool.length;
  const singleUrlStdDev = Math.sqrt(total * (1 / pool.length) * (1 - 1 / pool.length));
  const maxUrlFrequencyZ = counts.reduce((max, count) =>
    Math.max(max, Math.abs(count - expectedEach) / Math.max(singleUrlStdDev, Number.EPSILON)), 0);
  return {
    seeds, rolls_per_seed: rolls, total_draws: total,
    expected: expectation,
    observed: { same_url: stats(sameUrlPerSeed), same_host: stats(sameHostPerSeed) },
    max_url_frequency_z: maxUrlFrequencyZ,
    max_url_frequency_count: Math.max(...counts),
    min_url_frequency_count: Math.min(...counts)
  };
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
      expected_transitions: expectedTransitions(corpusHosts, eligible.length, options.rolls),
      observed_transitions: { same_url: adjacentSameUrl, same_host: adjacentSameHost },
      ...(options.seeds > 1 ? { multi_seed: multiSeedTrial(
        eligible, options.rolls, (options.seed + index * options.seeds) >>> 0,
        options.seeds, expectedTransitions(corpusHosts, eligible.length, options.rolls).uniform_with_repeat_guard_v1
      ) } : {}),
      expected_top_hosts: summary(corpusHosts, eligible.length),
      observed_top_hosts: summary(observed, options.rolls),
      requested: Object.fromEntries(['gtfobins.org', 'tmpout.sh'].map(h => [h, {
        eligible: corpusHosts[h] || 0, expected_pct: +(100 * (corpusHosts[h] || 0) / eligible.length).toFixed(3),
        drawn: observed[h] || 0, observed_pct: +(100 * (observed[h] || 0) / options.rolls).toFixed(3)
      }]))
    };
  });
  return { schema: 'r4b1t-reel-domain-audit-v1', authority_digest: digest, terrain_digest: terrainDigest, release: active.active.release_id,
    simulation: 'seeded offline URL-uniform-with-30-draw-repeat-guard model (not live roll or proof)',
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
      function formatExpectation(value) { return value === 0 ? '0' : value < 0.0001 ? value.toExponential(3) : value.toFixed(3); }
      for (const field of ['same_url', 'same_host']) {
        console.log(field + ' transitions: independent expected ' +
          formatExpectation(r.expected_transitions.independent_iid[field]) +
          '; guarded expected ' +
          formatExpectation(r.expected_transitions.uniform_with_repeat_guard_v1[field]) +
          '; observed ' + r.observed_transitions[field]);
      }
      if (r.multi_seed) {
        console.log('multi-seed (' + r.multi_seed.seeds + ' seeds x ' + r.multi_seed.rolls_per_seed + ' rolls):');
        console.log('  identical URL mean ' + r.multi_seed.observed.same_url.mean.toFixed(4) +
          ', expected ' + formatExpectation(r.multi_seed.expected.same_url));
        console.log('  same-host mean ' + r.multi_seed.observed.same_host.mean.toFixed(4) +
          ' +/- SE ' + r.multi_seed.observed.same_host.standard_error.toFixed(4) +
          ', expected ' + formatExpectation(r.multi_seed.expected.same_host));
        console.log('  max URL marginal z-score ' + r.multi_seed.max_url_frequency_z.toFixed(3));
      }
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
