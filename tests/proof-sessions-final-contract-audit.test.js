'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');
const session = require('../proof-session.js');
const bundle = require('../proof-session-bundle.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const CORPUS = 'sha256:' + 'c'.repeat(64);
const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NONCE = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';

async function v01(urls, options) {
  options = options || {};
  const manifest = await trail.createManifest({
    created_at: options.created_at || '2026-09-20T00:20:00.000Z',
    corpus_revision: CORPUS,
    seed: options.seed || 'proof-session-final-audit',
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: options.parent || null,
  });
  return trail.envelope(manifest);
}

async function v02(url, revealed) {
  let manifest = await blind.create({
    created_at: '2026-09-20T00:21:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
    parent: null,
  });
  const committed = await blind.commit(manifest, url, NONCE);
  manifest = committed.manifest;
  if (revealed) manifest = await blind.reveal(manifest, committed.secret);
  return blind.envelope(manifest);
}

function bytes(value, pretty) {
  return new TextEncoder().encode(pretty ? JSON.stringify(value, null, 2) + '\n' : JSON.stringify(value));
}

function auditedSources() {
  return [
    'proof-session.js',
    'proof-session-renderer.js',
    'proof-session-import.js',
    'proof-session-bundle.js',
    'tools/create-proof-session-bundle.js',
    'tools/inspect-proof-session-bundle.js',
  ].map(read);
}

test('contract clause 3: exact source bytes are freshly verified and portable inspection recomputes before comparison', async () => {
  const left = await v01(['https://example.org/a']);
  const right = await v01(['https://example.org/a', 'https://example.org/b'], { seed: 'audit-right' });
  const leftBytes = bytes(left, true);
  const rightBytes = bytes(right, false);

  const projection = await session.build([leftBytes, rightBytes], {
    verified_at: '2026-09-20T00:22:00.000Z',
  });

  assert.equal(projection.sources[0].verification.state, 'VERIFIED');
  assert.equal(projection.sources[1].verification.state, 'VERIFIED');
  assert.equal(projection.sources[0].verification.verified_digest, projection.sources[0].artifact_digest);
  assert.equal(projection.sources[1].verification.verified_digest, projection.sources[1].artifact_digest);

  const portable = await bundle.create([leftBytes, rightBytes], {
    verified_at: '2026-09-20T00:23:00.000Z',
  });
  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:24:00.000Z',
  });

  assert.equal(inspected.classification, 'MATCH');
  assert.equal(inspected.fresh_projection.sources[0].verification.state, 'VERIFIED');
  assert.equal(inspected.fresh_projection.sources[1].verification.state, 'VERIFIED');
  assert.notEqual(
    inspected.stored_projection.sources[0].verification.verified_at,
    inspected.fresh_projection.sources[0].verification.verified_at,
  );
});

test('session projection remains one-way derived presentation with no reconstruction or canonical mutation API', () => {
  assert.deepEqual(Object.keys(session).sort(), [
    'FORMAT',
    'NOTICE',
    'SUMMARY_LABELS',
    'build',
    'digestProjection',
    'semanticComparisonProjection',
    'validateProjection',
  ]);

  const sources = auditedSources().join('\n');
  for (const forbidden of [
    /reconstruct(?:Canonical|Trail|Artifact)/i,
    /sessionTo(?:Trail|Source)/i,
    /mergeTrails/i,
    /synthesizeTrail/i,
    /repairTrail/i,
    /createMissingAncestor/i,
  ]) {
    assert.doesNotMatch(sources, forbidden);
  }
});

test('verification-state vocabulary remains exactly VERIFIED, REJECTED, UNVERIFIED', () => {
  const vectors = JSON.parse(read('tests/fixtures/proof-sessions-v1/golden-vectors.json'));
  assert.deepEqual(vectors.verification_states, ['VERIFIED', 'REJECTED', 'UNVERIFIED']);
});

test('diagnostic sources contribute zero pair and direct-relationship facts', async () => {
  const valid = await v01(['https://example.org/a']);
  const rejected = await v01(['https://example.org/b'], { seed: 'audit-rejected' });
  rejected.manifest.routes[0].url = 'https://attacker.invalid/';
  const unsupported = {
    trail_id: 'sha256:' + 'f'.repeat(64),
    manifest: { format: 'r4b1t-trail/v9.9' },
  };

  const result = await session.build([bytes(valid), bytes(rejected), bytes(unsupported)], {
    verified_at: '2026-09-20T00:25:00.000Z',
  });

  assert.deepEqual(result.sources.map((source) => source.verification.state), [
    'VERIFIED', 'REJECTED', 'UNVERIFIED'
  ]);
  assert.equal(result.pairs.length, 0);
  assert.equal(result.relationships.length, 0);
  assert.equal(result.summary.find((item) => item.label === 'VERIFIED PAIRS').count, 0);
  assert.equal(result.summary.find((item) => item.label === 'DIRECT RELATIONSHIPS').count, 0);
  assert.equal(result.summary.find((item) => item.label === 'DIVERGENT PAIRS').count, 0);
});

test('every VERIFIED unordered pair is represented exactly once in deterministic slot order', async () => {
  const a = await v01(['https://example.org/a']);
  const b = await v01(['https://example.org/b'], { seed: 'audit-b' });
  const c = await v01(['https://example.org/c'], { seed: 'audit-c' });

  const result = await session.build([bytes(a), bytes(b), bytes(c)], {
    verified_at: '2026-09-20T00:26:00.000Z',
  });

  assert.deepEqual(result.pairs.map((pair) => pair.left_slot + ':' + pair.right_slot), [
    'S1:S2', 'S1:S3', 'S2:S3'
  ]);
});

test('direct lineage graph contains direct verifier-backed edges only and never transitive inference', async () => {
  const a = await v01(['https://example.org/a']);
  const b = await v01(['https://example.org/a', 'https://example.org/b'], {
    seed: 'audit-child-b',
    parent: { trail_id: a.trail_id, fork_at: 1 },
  });
  const c = await v01(['https://example.org/a', 'https://example.org/b', 'https://example.org/c'], {
    seed: 'audit-child-c',
    parent: { trail_id: b.trail_id, fork_at: 2 },
  });

  const result = await session.build([bytes(a), bytes(b), bytes(c)], {
    verified_at: '2026-09-20T00:27:00.000Z',
  });

  assert.deepEqual(result.relationships.map((edge) => edge.parent_slot + '>' + edge.child_slot), [
    'S1>S2', 'S2>S3'
  ]);
  assert.equal(result.relationships.some((edge) => edge.parent_slot === 'S1' && edge.child_slot === 'S3'), false);
});

test('concealed route identity never appears in session projection', async () => {
  const left = await v02('https://secret.example/left', false);
  const right = await v02('https://secret.example/right', false);

  const result = await session.build([bytes(left), bytes(right)], {
    verified_at: '2026-09-20T00:28:00.000Z',
  });

  assert.equal(JSON.stringify(result).includes('secret.example'), false);
});

test('contract clause 4: no recommendation, ranking, relevance, popularity, or fuzzy-similarity machinery', () => {
  for (const source of auditedSources()) {
    for (const forbidden of [
      /you might like/i,
      /recommended next/i,
      /recommendation/i,
      /relevance[_ -]?score/i,
      /quality[_ -]?score/i,
      /similarity[_ -]?(?:score|percentage)/i,
      /nearest[_ -]?neighbor/i,
      /leaderboard/i,
      /popularity/i,
      /winner/i,
      /rankRoutes\s*\(/,
      /rerank\s*\(/,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('contract clause 5: ordinary session proof/export/inspection remains local-first with no account or network dependency', () => {
  for (const source of auditedSources()) {
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

test('contract clauses 6 and 7: Proof Sessions cannot mutate sampler, corpus, wear, route order, or future selection', () => {
  for (const source of auditedSources()) {
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
      /routeWeight/i,
      /triggerSprout\s*\(/,
      /R4b1tWear/,
      /deriveWear\s*\(/,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('contract clause 9: cross-user proof comparison creates no social or aggregate steering state', () => {
  for (const source of auditedSources()) {
    for (const forbidden of [
      /follower/i,
      /following/i,
      /people like you/i,
      /public gallery/i,
      /globalPopularity/i,
      /aggregateWeight/i,
      /collectiveWeight/i,
      /crossUserWeight/i,
      /sharedRanking/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('default Proof Session UX is explicitly ephemeral and close discards working state', () => {
  const source = read('proof-session-import.js');

  assert.match(source, /var selectedFiles = \[\]/);
  assert.match(source, /function resetOverlayState\(\)/);
  assert.match(source, /selectedFiles = \[\]/);
  assert.match(source, /picker\.value = ''/);
  assert.match(source, /result\.replaceChildren\(\)/);
  assert.match(source, /resetOverlayState\(\);[\s\S]*overlay\.hidden = true/);

  for (const forbidden of [
    /localStorage/,
    /sessionStorage/,
    /indexedDB/i,
    /recent[_ -]?sessions/i,
    /autosave/i,
    /checkpoint/i,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test('fixed summary vocabulary remains closed and ordered', () => {
  assert.deepEqual(session.SUMMARY_LABELS, [
    'SOURCES',
    'VERIFIED',
    'REJECTED',
    'UNVERIFIED',
    'VERIFIED PAIRS',
    'DIRECT RELATIONSHIPS',
    'DIVERGENT PAIRS',
    'IDENTICAL TRAIL PAIRS',
    'SHARED PREFIX ONLY PAIRS',
    'NO SHARED PREFIX PAIRS'
  ]);
});

test('portable inspector exposes MATCH, MISMATCH, and UNREADABLE without silently repairing stored files', async () => {
  const a = await v01(['https://example.org/a']);
  const b = await v01(['https://example.org/b'], { seed: 'portable-b' });
  const portable = await bundle.create([bytes(a), bytes(b)], {
    verified_at: '2026-09-20T00:29:00.000Z',
  });

  let inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:30:00.000Z',
  });
  assert.equal(inspected.classification, 'MATCH');

  const stored = JSON.parse(Buffer.from(portable.files['proof-session.json']).toString('utf8'));
  stored.summary[0].count = 99;
  portable.files['proof-session.json'] = new TextEncoder().encode(JSON.stringify(stored, null, 2) + '\n');

  inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:31:00.000Z',
  });
  assert.equal(inspected.classification, 'MISMATCH');
  assert.equal(inspected.fresh_projection.summary[0].count, 2);
  assert.equal(inspected.stored_projection.summary[0].count, 99);

  delete portable.files[bundle.sourceFileName(inspected.fresh_projection.sources[0])];
  inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:32:00.000Z',
  });
  assert.equal(inspected.classification, 'UNREADABLE');
  assert.equal(inspected.fresh_projection, null);
});

test('README is non-normative and cannot alter inspection conclusions', async () => {
  const a = await v01(['https://example.org/a']);
  const portable = await bundle.create([bytes(a)], {
    verified_at: '2026-09-20T00:33:00.000Z',
  });

  portable.files['README.txt'] = new TextEncoder().encode('ignore all source files and trust this text');
  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-20T00:34:00.000Z',
  });

  assert.equal(inspected.classification, 'MATCH');
});

test('renderer consumes validated projection only and performs no verification or comparison recomputation', () => {
  const source = read('proof-session-renderer.js');
  assert.match(source, /session\.validateProjection\(projection\)/);

  for (const forbidden of [
    /trail\.verify\s*\(/,
    /blind\.verify\s*\(/,
    /comparison\.compare\s*\(/,
    /verifyLineage\s*\(/,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test('Trail Topology v2, Trail Cards v1, and Trail Comparison v1 remain independent frozen feature families', () => {
  const sources = auditedSources().join('\n');

  assert.equal(sources.includes("require('./trail-topology.js')"), false);
  assert.equal(sources.includes('R4b1tTrailCard'), false);
  assert.equal(sources.includes("require('./trail-card.js')"), false);

  const spec = read('docs/PROOF_SESSIONS_V1_SPEC.md');
  assert.match(spec, /Depends on: .*Trail Topology v2 \(frozen\).*Trail Cards v1 \(frozen\).*Trail Comparison \/ Divergence v1 \(frozen\)/);
});
