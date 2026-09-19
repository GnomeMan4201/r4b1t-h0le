'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');
const comparison = require('../trail-comparison.js');
const bundle = require('../trail-comparison-bundle.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const CORPUS = 'sha256:' + 'c'.repeat(64);
const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NONCE_A = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
const NONCE_B = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI';

async function v01(urls, options) {
  options = options || {};
  const manifest = await trail.createManifest({
    created_at: options.created_at || '2026-09-19T23:50:00.000Z',
    corpus_revision: CORPUS,
    seed: options.seed || 'comparison-final-audit',
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: options.parent || null,
  });
  return trail.envelope(manifest);
}

async function v02(steps, options) {
  options = options || {};
  let manifest = await blind.create({
    created_at: options.created_at || '2026-09-19T23:51:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
    parent: options.parent || null,
  });
  for (let index = 0; index < steps.length; index += 1) {
    const item = steps[index];
    const committed = await blind.commit(manifest, item.url, item.nonce || (index === 0 ? NONCE_A : NONCE_B));
    manifest = committed.manifest;
    if (item.revealed) manifest = await blind.reveal(manifest, committed.secret);
  }
  return blind.envelope(manifest);
}

function bytes(value, pretty) {
  return new TextEncoder().encode(pretty ? JSON.stringify(value, null, 2) + '\n' : JSON.stringify(value));
}

test('contract clause 3: both canonical inputs are freshly verifiable and exact-byte bound', async () => {
  const left = await v01(['https://example.org/a']);
  const right = await v01(['https://example.org/a', 'https://example.org/b'], { seed: 'audit-right' });
  const leftBytes = bytes(left, true);
  const rightBytes = bytes(right, false);

  const result = await comparison.compare(leftBytes, rightBytes, {
    verified_at: '2026-09-19T23:52:00.000Z',
  });

  assert.equal(result.verification.left.state, 'VERIFIED');
  assert.equal(result.verification.right.state, 'VERIFIED');
  assert.equal(result.verification.left.verified_digest, result.sources.left.artifact_digest);
  assert.equal(result.verification.right.verified_digest, result.sources.right.artifact_digest);
  assert.equal(result.sources.left.artifact_digest, await comparison.digestOf(leftBytes));
  assert.equal(result.sources.right.artifact_digest, await comparison.digestOf(rightBytes));
});

test('comparison is one-way derived presentation with no reconstruction or merge API', () => {
  assert.deepEqual(Object.keys(comparison).sort(), [
    'DIAGNOSTIC_NOTICE',
    'FORMAT',
    'NOTICE',
    'compare',
    'digestOf',
    'validateProjection',
  ]);

  const source = read('trail-comparison.js');
  for (const forbidden of [
    /reconstruct(?:Canonical|Trail|Artifact)/i,
    /comparisonTo(?:Trail|Source)/i,
    /mergeTrails/i,
    /synthesizeTrail/i,
    /repairTrail/i,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test('verification-state vocabulary remains exactly VERIFIED, REJECTED, UNVERIFIED', () => {
  const vectors = JSON.parse(read('tests/fixtures/trail-comparison-v1/golden-vectors.json'));
  assert.deepEqual(vectors.verification_states, ['VERIFIED', 'REJECTED', 'UNVERIFIED']);
});

test('diagnostic input suppresses all comparison facts instead of inferring from unverified material', async () => {
  const left = await v01(['https://example.org/a']);
  const right = await v01(['https://example.org/a'], { seed: 'audit-tamper' });
  right.manifest.routes[0].url = 'https://attacker.invalid/';

  const result = await comparison.compare(bytes(left), bytes(right), {
    verified_at: '2026-09-19T23:53:00.000Z',
  });

  assert.equal(result.verification.left.state, 'VERIFIED');
  assert.equal(result.verification.right.state, 'REJECTED');
  assert.equal(result.comparison, null);
  assert.equal(result.diagnostic_notice, 'THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.');
});

test('shared prefix uses exact revealed identity or equal concealed commitment only', async () => {
  const left = await v02([
    { url: 'https://example.org/a', revealed: true, nonce: NONCE_A },
    { url: 'https://secret.example/left', revealed: false, nonce: NONCE_B },
  ]);
  const samePrefix = JSON.parse(JSON.stringify(left));

  const result = await comparison.compare(bytes(left), bytes(samePrefix), {
    verified_at: '2026-09-19T23:54:00.000Z',
  });

  assert.equal(result.comparison.shared_prefix_length, 2);
  assert.deepEqual(result.comparison.positions.map((p) => p.state), [
    'MATCH_REVEALED',
    'BOTH_CONCEALED_SAME_COMMITMENT',
  ]);

  const projectionText = JSON.stringify(result);
  assert.equal(projectionText.includes('secret.example'), false);
});

test('concealed identity never leaks through core, renderer, or schema', async () => {
  const left = await v02([{ url: 'https://secret.example/left', revealed: false, nonce: NONCE_A }]);
  const right = await v02([{ url: 'https://secret.example/right', revealed: false, nonce: NONCE_B }], {
    created_at: '2026-09-19T23:55:00.000Z',
  });

  const result = await comparison.compare(bytes(left), bytes(right), {
    verified_at: '2026-09-19T23:56:00.000Z',
  });

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('secret.example'), false);
  assert.equal(result.comparison.positions[0].left.route_id, null);
  assert.equal(result.comparison.positions[0].right.route_id, null);

  const schema = read('docs/schema/trail-comparison-v0.1.schema.json').toLowerCase();
  assert.equal(schema.includes('"url"'), false);

  const renderer = read('trail-comparison-renderer.js');
  assert.match(renderer, /side\.state === 'CONCEALED'/);
});

test('direct parent lineage is canonical-verifier-backed and shared prefix alone does not prove ancestry', async () => {
  const parent = await v01(['https://example.org/a']);
  const child = await v01(['https://example.org/a', 'https://example.org/b'], {
    seed: 'audit-child',
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });

  const direct = await comparison.compare(bytes(parent), bytes(child), {
    verified_at: '2026-09-19T23:57:00.000Z',
  });
  assert.equal(direct.comparison.lineage_state, 'LEFT_PARENT_OF_RIGHT');
  assert.equal(direct.comparison.direct_fork_at, 1);

  const unrelated = await v01(['https://example.org/a', 'https://example.org/c'], { seed: 'audit-unrelated' });
  const sharedOnly = await comparison.compare(bytes(parent), bytes(unrelated), {
    verified_at: '2026-09-19T23:58:00.000Z',
  });
  assert.equal(sharedOnly.comparison.shared_prefix_length, 1);
  assert.equal(sharedOnly.comparison.lineage_state, 'SHARED_ANCESTRY_NOT_PROVEN');
  assert.equal(sharedOnly.comparison.direct_fork_at, null);
});

test('left/right roles are symmetric and never encode a preferred trail', async () => {
  const parent = await v01(['https://example.org/a']);
  const child = await v01(['https://example.org/a', 'https://example.org/b'], {
    seed: 'audit-symmetry',
    parent: { trail_id: parent.trail_id, fork_at: 1 },
  });

  const forward = await comparison.compare(bytes(parent), bytes(child), {
    verified_at: '2026-09-20T00:00:00.000Z',
  });
  const reverse = await comparison.compare(bytes(child), bytes(parent), {
    verified_at: '2026-09-20T00:00:00.000Z',
  });

  assert.equal(forward.comparison.lineage_state, 'LEFT_PARENT_OF_RIGHT');
  assert.equal(reverse.comparison.lineage_state, 'RIGHT_PARENT_OF_LEFT');
  assert.equal(forward.comparison.shared_prefix_length, reverse.comparison.shared_prefix_length);
  assert.equal(forward.comparison.first_divergence_index, reverse.comparison.first_divergence_index);

  const schema = read('docs/schema/trail-comparison-v0.1.schema.json').toLowerCase();
  for (const banned of ['winner', 'preferred', 'better', 'quality_score', 'similarity_percentage', 'rank']) {
    assert.equal(schema.includes(banned), false, banned);
  }
});

test('contract clause 4: no recommendation, relevance, winner, rank, or fuzzy-similarity machinery', () => {
  const sources = [
    read('trail-comparison.js'),
    read('trail-comparison-renderer.js'),
    read('trail-comparison-import.js'),
    read('trail-comparison-bundle.js'),
  ];

  for (const source of sources) {
    for (const forbidden of [
      /you might like/i,
      /recommended next/i,
      /recommendation/i,
      /relevance[_ -]?score/i,
      /quality[_ -]?score/i,
      /similarity[_ -]?(?:score|percentage)/i,
      /winner/i,
      /rankRoutes\s*\(/,
      /rerank\s*\(/,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('contract clause 5: comparison and proof remain local-first with no account or network dependency', () => {
  const sources = [
    read('trail-comparison.js'),
    read('trail-comparison-import.js'),
    read('trail-comparison-bundle.js'),
  ];

  for (const source of sources) {
    for (const forbidden of [
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /WebSocket/,
      /EventSource/,
      /sendBeacon/,
      /Authorization\s*:/i,
      /Bearer\s+/i,
      /\blogin\b/i,
      /\baccount\b/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('contract clauses 6 and 7: comparison cannot mutate sampler, corpus, wear, or future selection', () => {
  const sources = [
    read('trail-comparison.js'),
    read('trail-comparison-renderer.js'),
    read('trail-comparison-import.js'),
    read('trail-comparison-bundle.js'),
  ];

  for (const source of sources) {
    for (const forbidden of [
      /createSampler\s*\(/,
      /nextFloat\s*\(/,
      /setCorpus/i,
      /updateCorpus/i,
      /corpusEligibility/i,
      /setSampler/i,
      /updateSampler/i,
      /samplerState/i,
      /selection_weight/i,
      /sampler_weight/i,
      /triggerSprout\s*\(/,
      /R4b1tWear/,
      /deriveWear\s*\(/,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('contract clause 9: cross-user comparison never creates social, aggregate steering, or discovery state', () => {
  const sources = [
    read('trail-comparison.js'),
    read('trail-comparison-import.js'),
    read('trail-comparison-bundle.js'),
  ];

  for (const source of sources) {
    for (const forbidden of [
      /localStorage/,
      /sessionStorage/,
      /follower/i,
      /following/i,
      /leaderboard/i,
      /people like you/i,
      /public gallery/i,
      /aggregateWeight/i,
      /collectiveWeight/i,
      /crossUserWeight/i,
      /sharedRanking/i,
      /globalPopularity/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('portable bundle preserves two authoritative sources and freshly recomputes derived comparison', async () => {
  const left = JSON.stringify(await v01(['https://example.org/a'], { seed: 'bundle-left' }), null, 2) + '\n';
  const right = JSON.stringify(await v01(['https://example.org/a', 'https://example.org/b'], { seed: 'bundle-right' }));

  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-20T00:01:00.000Z',
  });

  assert.deepEqual(bundle.fileNames(portable), [
    'README.txt',
    'left-source.json',
    'right-source.json',
    'trail-comparison.json',
  ]);
  assert.equal(Buffer.from(portable.files['left-source.json']).toString('utf8'), left);
  assert.equal(Buffer.from(portable.files['right-source.json']).toString('utf8'), right);

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:02:00.000Z',
  });
  assert.equal(inspected.left_source_matches, true);
  assert.equal(inspected.right_source_matches, true);
  assert.equal(inspected.fresh_projection.verification.left.state, 'VERIFIED');
  assert.equal(inspected.fresh_projection.verification.right.state, 'VERIFIED');
});

test('renderer structurally separates verified comparison from diagnostic-only output', () => {
  const source = read('trail-comparison-renderer.js');
  assert.match(source, /trail-comparison-body-verified/);
  assert.match(source, /trail-comparison-diagnostic/);
  assert.match(source, /THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS/);
  assert.match(source, /comparison facts are suppressed/i);
});

test('local import UX is explicit two-file input with no persistent comparison history', () => {
  const source = read('trail-comparison-import.js');
  assert.match(source, /Left trail JSON/);
  assert.match(source, /Right trail JSON/);
  assert.match(source, /arrayBuffer/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(source, /history|recent comparison|recent_compare/i);
});


test('Trail Cards are not accepted as comparison evidence inputs', async () => {
  const left = await v01(['https://example.org/a'], { seed: 'audit-card-input' });
  const cardLike = {
    format: 'r4b1t-trail-card/v0.1',
    source: {
      artifact_format: 'r4b1t-trail/v0.1',
      artifact_digest: 'sha256:' + '1'.repeat(64),
    },
  };

  const result = await comparison.compare(bytes(left), bytes(cardLike), {
    verified_at: '2026-09-20T00:03:00.000Z',
  });

  assert.equal(result.verification.left.state, 'VERIFIED');
  assert.equal(result.verification.right.state, 'UNVERIFIED');
  assert.equal(result.comparison, null);
  assert.equal(result.diagnostic_notice, 'THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.');
});

test('renderer consumes validated projection only and performs no verification', () => {
  const source = read('trail-comparison-renderer.js');
  for (const forbidden of [
    /trail\.verify\s*\(/,
    /blind\.verify\s*\(/,
    /verifyLineage\s*\(/,
    /R4b1tTrailComparison\.compare\s*\(/,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test('closing local import discards selected files and rendered comparison state', () => {
  const source = read('trail-comparison-import.js');
  assert.match(source, /function resetOverlayState\(\)/);
  assert.match(source, /input\.value = ''/);
  assert.match(source, /result\.replaceChildren\(\)/);
  assert.match(source, /resetOverlayState\(\);[\s\S]*overlay\.hidden = true/);
});

test('final comparison audit leaves Trail Cards and Topology frozen implementation untouched', () => {
  const comparisonSources = [
    'trail-comparison.js',
    'trail-comparison-renderer.js',
    'trail-comparison-import.js',
    'trail-comparison-bundle.js',
  ].map(read).join('\n');

  assert.equal(comparisonSources.includes("require('./trail-topology.js')"), false);
  assert.equal(comparisonSources.includes('R4b1tTrailCard'), false);
  assert.equal(comparisonSources.includes('trail-card.js'), false);
});
