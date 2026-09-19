'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const trail = require('../trail-manifest.js');
const cards = require('../trail-card.js');
const bundle = require('../trail-card-bundle.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const CORPUS = 'sha256:' + 'c'.repeat(64);

async function verifiedSource() {
  const manifest = await trail.createManifest({
    created_at: '2026-09-19T18:20:00.000Z',
    corpus_revision: CORPUS,
    seed: 'trail-cards-final-audit',
    terrain: 'RESEARCH',
    routes: [{ url: 'https://example.org/final-audit', action: 'ROLL' }],
    parent: null,
  });
  return JSON.stringify(await trail.envelope(manifest), null, 2) + '\n';
}

test('contract clause 3: portable handoff preserves canonical source and supports fresh independent verification', async () => {
  const source = await verifiedSource();
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T18:21:00.000Z',
  });

  assert.equal(Buffer.from(portable.files['source.json']).toString('utf8'), source);
  assert.equal(portable.card.verification.state, 'VERIFIED');
  assert.equal(portable.card.source.artifact_digest, await cards.digestOf(new TextEncoder().encode(source)));

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-19T18:22:00.000Z',
  });

  assert.equal(inspected.source_matches_stored_card, true);
  assert.equal(inspected.fresh_state, 'VERIFIED');
  assert.equal(inspected.fresh_card.source.artifact_digest, inspected.source_digest);

  portable.files['source.json'] = new TextEncoder().encode(source + ' ');
  await assert.rejects(
    () => bundle.inspect(portable, { verified_at: '2026-09-19T18:23:00.000Z' }),
    /source digest mismatch/,
  );
});

test('projection remains one-way and exposes no canonical reconstruction API', () => {
  assert.deepEqual(Object.keys(cards).sort(), [
    'DIAGNOSTIC_NOTICE',
    'FORMAT',
    'NOTICE',
    'TOPOLOGY_FORMAT',
    'digestOf',
    'project',
    'validateProjection',
  ]);

  const core = read('trail-card.js');
  for (const forbidden of [
    /reconstruct(?:Canonical|Artifact|Trail)/i,
    /fromCard(?:ToSource|ToTrail|ToTopology)?/i,
    /cardTo(?:Source|Trail|Topology)/i,
    /restore(?:Canonical|Artifact)FromCard/i,
  ]) {
    assert.doesNotMatch(core, forbidden);
  }
});

test('verification-state vocabulary is exactly VERIFIED, REJECTED, UNVERIFIED', () => {
  const vectors = JSON.parse(read('tests/fixtures/trail-cards-v1/golden-vectors.json'));
  const schema = JSON.parse(read('docs/schema/trail-card-v0.1.schema.json'));

  assert.deepEqual(vectors.states, ['VERIFIED', 'REJECTED', 'UNVERIFIED']);
  assert.equal(schema.$defs.verifiedResult.properties.state.const, 'VERIFIED');
  assert.equal(schema.$defs.rejectedResult.properties.state.const, 'REJECTED');
  assert.equal(schema.$defs.unverifiedResult.properties.state.const, 'UNVERIFIED');
});

test('PARENT ABSENT is a relationship state inside VERIFIED topology presentation', () => {
  const vectors = JSON.parse(read('tests/fixtures/trail-cards-v1/golden-vectors.json'));
  const parentAbsent = vectors.cases.find((entry) => entry.name === 'verified-parent-absent-topology');

  assert.ok(parentAbsent);
  assert.equal(parentAbsent.card.verification.state, 'VERIFIED');
  assert.equal(parentAbsent.card.display.kind, 'topology');
  assert.equal(parentAbsent.card.display.parent_absent_count, 1);
  assert.equal(parentAbsent.card.display.branch_diagram.nodes[0].relationship_state, 'PARENT ABSENT');
  assert.equal(parentAbsent.card.display.branch_diagram.edges[0].relationship_state, 'PARENT ABSENT');
  assert.equal(parentAbsent.card.diagnostic_notice, undefined);
});

test('REJECTED and UNVERIFIED remain diagnostic and cannot carry verified display claims', () => {
  const vectors = JSON.parse(read('tests/fixtures/trail-cards-v1/golden-vectors.json'));

  for (const name of ['rejected-artifact', 'unverified-unsupported-source', 'rejected-tampered-source-artifact']) {
    const item = vectors.cases.find((entry) => entry.name === name).card;
    assert.ok(item.verification.state === 'REJECTED' || item.verification.state === 'UNVERIFIED');
    assert.equal(item.verification.verified_digest, null);
    assert.equal(item.display, null);
    assert.equal(item.diagnostic_notice, 'THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.');
    cards.validateProjection(item);
  }

  const renderer = read('trail-card-renderer.js');
  assert.match(renderer, /trail-card-body-diagnostic/);
  assert.match(renderer, /trail-card-diagnostic-banner/);
  assert.match(renderer, /CONFIRMED DIGEST/);
  assert.match(renderer, /THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY/);
});

test('detached-card authority is explicitly denied in renderer, bundle, and handoff copy', () => {
  const spec = read('docs/TRAIL_CARDS_V1_SPEC.md');
  const bundleSource = read('trail-card-bundle.js');
  const shareSource = read('trail-card-share.js');

  assert.match(spec, /Detached cards carry no authority/);
  assert.match(bundleSource, /Trail Card is not evidence authority/);
  assert.match(bundleSource, /A detached card documents a render-time claim only/);
  assert.match(shareSource, /Trail Card is presentation only and does not establish current integrity/);
  assert.match(shareSource, /Re-verify source\.json locally/);
});

test('contract clause 4: Trail Cards contain no recommendation or relevance machinery', () => {
  const sources = [
    read('trail-card.js'),
    read('trail-card-renderer.js'),
    read('trail-card-bundle.js'),
    read('trail-card-share.js'),
  ];

  for (const source of sources) {
    for (const forbidden of [
      /you might like/i,
      /recommended next/i,
      /relevance[_ -]?score/i,
      /quality[_ -]?score/i,
      /interestingness[_ -]?score/i,
      /rankRoutes\s*\(/,
      /rerank\s*\(/,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('contract clause 5: proof and handoff remain local-first with no account or service dependency', () => {
  const coreSources = [
    read('trail-card.js'),
    read('trail-card-bundle.js'),
  ];

  for (const source of coreSources) {
    for (const forbidden of [
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /WebSocket/,
      /EventSource/,
      /Authorization\s*:/i,
      /Bearer\s+/i,
      /\blogin\b/i,
      /\baccount\b/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }

  const share = read('trail-card-share.js');
  for (const forbidden of [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /EventSource/,
    /Authorization\s*:/i,
    /Bearer\s+/i,
    /\blogin\b/i,
    /\baccount\b/i,
  ]) {
    assert.doesNotMatch(share, forbidden);
  }
  assert.match(share, /navigator\.share/);
});

test('contract clauses 6 and 7: Trail Cards extend proof/presentation only and cannot mutate sampler, corpus, wear, or selection', () => {
  const sources = [
    read('trail-card.js'),
    read('trail-card-renderer.js'),
    read('trail-card-bundle.js'),
    read('trail-card-share.js'),
  ];

  for (const source of sources) {
    for (const forbidden of [
      /setCorpus/i,
      /updateCorpus/i,
      /corpusEligibility/i,
      /setSampler/i,
      /updateSampler/i,
      /samplerState/i,
      /selection_weight/i,
      /sampler_weight/i,
      /require\(['"]\.\/trail-wear\.js['"]\)/,
      /R4b1tWear/,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  }
});

test('contract clause 9 and share boundary: sharing is point-to-point only with no persistent or discoverable share state', () => {
  const share = read('trail-card-share.js');

  assert.match(share, /navigator\.share/);
  assert.match(share, /URL\.createObjectURL/);

  for (const forbidden of [
    /localStorage/,
    /sessionStorage/,
    /share[_ -]?history/i,
    /recent[_ -]?shares/i,
    /gallery/i,
    /\bfeed\b/i,
    /view[_ -]?count/i,
    /like[_ -]?count/i,
    /follow(?:er|ing)/i,
    /trending/i,
    /popularity/i,
    /recommendation/i,
    /aggregateWeight/i,
    /collectiveWeight/i,
    /crossUserWeight/i,
    /sharedRanking/i,
  ]) {
    assert.doesNotMatch(share, forbidden);
  }
});

test('portable bundle is a file set whose evidentiary authority remains source.json', async () => {
  const source = await verifiedSource();
  const portable = await bundle.create(source, {
    verified_at: '2026-09-19T18:24:00.000Z',
  });

  assert.deepEqual(bundle.fileNames(portable), ['README.txt', 'source.json', 'trail-card.json']);
  const readme = Buffer.from(portable.files['README.txt']).toString('utf8');
  assert.match(readme, /Evidence authority: source\.json/);
  assert.match(readme, /Presentation only:\s+trail-card\.json/);
  assert.doesNotMatch(JSON.stringify(portable.card), /bundle[_ -]?format/i);
});

test('final Trail Cards v1 audit has no mutable-selection dependency path', () => {
  const packageJson = JSON.parse(read('package.json'));
  const audited = [
    'trail-card.js',
    'trail-card-renderer.js',
    'trail-card-bundle.js',
    'trail-card-share.js',
  ];

  assert.equal(packageJson.name, 'r4b1t');
  for (const file of audited) {
    const source = read(file);
    for (const forbidden of [
      /trail-manifest\.js[^\n]*createSampler/,
      /triggerSprout\s*\(/,
      /selection[_A-Za-z]*\s*=/i,
      /behavior(?:al)?[_A-Za-z]*\s*=/i,
      /popularity[_A-Za-z]*\s*=/i,
      /engagement[_A-Za-z]*\s*=/i,
    ]) {
      assert.doesNotMatch(source, forbidden, file + ' matched ' + forbidden);
    }
  }
});
