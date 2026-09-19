'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');
const topology = require('../trail-topology.js');
const independent = require('../tools/verify-topology-export.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const CORPUS = 'sha256:' + 'a'.repeat(64);
const SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NONCE = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';

async function blindConcealed(url) {
  let manifest = await blind.create({
    created_at: '2026-09-19T05:10:00.000Z',
    corpus_revision: CORPUS,
    terrain: 'RESEARCH',
    trail_salt: SALT,
  });
  const committed = await blind.commit(manifest, url, NONCE);
  return blind.envelope(committed.manifest);
}

test('clause 1: topology cannot steer selection from observed history', () => {
  const core = read('trail-topology.js');
  const runtime = read('topology-runtime.js');

  for (const source of [core, runtime]) {
    for (const forbidden of [
      /createSampler\s*\(/,
      /nextFloat\s*\(/,
      /triggerSprout\s*\(/,
      /selection_weight/i,
      /sampler_weight/i,
      /popularity[_A-Za-z]*\s*=/i,
      /engagement[_A-Za-z]*\s*=/i,
      /behavior(?:al)?[_A-Za-z]*\s*=/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('clause 2: concealed selection remains concealed through export and verification', async () => {
  const secretUrl = 'https://secret.example/contract-audit';
  const snapshot = await blindConcealed(secretUrl);
  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-19T05:11:00.000Z',
  });

  assert.equal(exported.nodes[0].stops[0].proof_state, 'CONCEALED');
  assert.equal(exported.nodes[0].stops[0].route_id, null);
  assert.equal(exported.nodes[0].stops[0].url, null);
  assert.equal(JSON.stringify(exported).includes(secretUrl), false);

  const result = await independent.verifyExport(exported);
  assert.equal(result.proof_state, 'VERIFIED');
});

test('clause 3: exported topology is independently verifiable and tampering is rejected', async () => {
  const manifest = await trail.createManifest({
    created_at: '2026-09-19T05:20:00.000Z',
    corpus_revision: CORPUS,
    seed: 'final-audit-independent',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.org/audit', action: 'ROLL' }],
    parent: null,
  });
  const snapshot = await trail.envelope(manifest);
  const exported = await topology.exportTopology([snapshot], {
    created_at: '2026-09-19T05:21:00.000Z',
  });

  const result = await independent.verifyExport(exported);
  assert.equal(result.proof_state, 'VERIFIED');

  const tampered = JSON.parse(JSON.stringify(exported));
  tampered.nodes[0].stops[0].url = 'https://attacker.invalid/';
  await assert.rejects(
    () => independent.verifyExport(tampered),
    /Topology node stop derivation mismatch/,
  );
});

test('clause 4: topology presentation exposes no recommendation or relevance machinery', () => {
  const core = read('trail-topology.js').toLowerCase();
  const runtime = read('topology-runtime.js').toLowerCase();

  for (const source of [core, runtime]) {
    for (const banned of [
      'recommended next',
      'you might like',
      'relevance score',
      'quality score',
      'interestingness score',
      'popularity score',
      'engagement score',
      'force-directed',
    ]) {
      assert.equal(source.includes(banned), false, banned);
    }
  }
});

test('clause 5: proof, export, import, and independent verification are local-first', () => {
  const core = read('trail-topology.js');
  const verifier = read('tools/verify-topology-export.js');

  for (const source of [core, verifier]) {
    for (const forbidden of [
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /WebSocket/,
      /EventSource/,
      /Authorization\s*:/i,
      /Bearer\s+/i,
      /require\(['"]https?:/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }

  assert.equal(verifier.includes("require('../trail-topology.js')"), false);
  assert.equal(verifier.includes('window.'), false);
  assert.equal(verifier.includes('document.'), false);
});

test('clause 6: topology extends proof surface without sampler or corpus mutation hooks', () => {
  const core = read('trail-topology.js');
  const runtime = read('topology-runtime.js');

  for (const source of [core, runtime]) {
    for (const forbidden of [
      /setCorpus/i,
      /updateCorpus/i,
      /corpusEligibility/i,
      /setSampler/i,
      /updateSampler/i,
      /samplerState/i,
      /rankRoutes/i,
      /rerank/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('clause 7: wear stays diagnostic and cannot enter canonical proof/export derivation', async () => {
  const core = read('trail-topology.js');
  assert.equal(core.includes("require('./trail-wear.js')"), false);
  assert.equal(core.includes('R4b1tWear'), false);

  const manifest = await trail.createManifest({
    created_at: '2026-09-19T05:30:00.000Z',
    corpus_revision: CORPUS,
    seed: 'final-audit-wear',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.net/wear-audit', action: 'ROLL' }],
    parent: null,
  });
  const exported = await topology.exportTopology([await trail.envelope(manifest)], {
    created_at: '2026-09-19T05:31:00.000Z',
  });
  const serialized = JSON.stringify(exported).toLowerCase();

  for (const forbidden of ['crease_count', 'fold_size', 'wear_score', 'wear_weight']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('clause 8: topology contains no inferred exploration-constraint activation path', () => {
  const core = read('trail-topology.js');
  const runtime = read('topology-runtime.js');

  for (const source of [core, runtime]) {
    for (const forbidden of [
      /infer(?:red)?Constraint/i,
      /activateConstraint/i,
      /tightenConstraint/i,
      /relaxConstraint/i,
      /behavioralConstraint/i,
      /profileConstraint/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('clause 9: topology comparison/proof data cannot write cross-user steering state', () => {
  const core = read('trail-topology.js');
  const runtime = read('topology-runtime.js');

  for (const source of [core, runtime]) {
    for (const forbidden of [
      /aggregateWeight/i,
      /collectiveWeight/i,
      /crossUserWeight/i,
      /globalPopularity/i,
      /sharedRanking/i,
      /participantRank/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }

  assert.match(runtime, /r4b1t_topology_atlas_v1/);
  assert.doesNotMatch(runtime, /localStorage\.setItem\([^,]*(profile|ranking|sampler|weight|corpus)/i);
});

test('final audit: canonical round-trip preserves exact export semantics', async () => {
  const manifest = await trail.createManifest({
    created_at: '2026-09-19T05:40:00.000Z',
    corpus_revision: CORPUS,
    seed: 'final-audit-roundtrip',
    terrain: 'RESEARCH',
    routes: [
      { url: 'https://example.com/one', action: 'ROLL' },
      { url: 'https://example.com/two', action: 'BRANCH' },
    ],
    parent: null,
  });
  const snapshot = await trail.envelope(manifest);
  const options = { created_at: '2026-09-19T05:41:00.000Z' };
  const exported = await topology.exportTopology([snapshot], options);
  const imported = await topology.importTopology(exported);
  const rebuilt = await topology.exportTopology(imported.snapshots, options);

  assert.equal(trail.canonicalJson(rebuilt), trail.canonicalJson(exported));
  const independentlyVerified = await independent.verifyExport(rebuilt);
  assert.equal(independentlyVerified.proof_state, 'VERIFIED');
});
