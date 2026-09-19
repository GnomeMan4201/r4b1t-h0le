'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'schema', 'proof-session-v0.1.schema.json'), 'utf8'));
const vectors = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'proof-sessions-v1', 'golden-vectors.json'), 'utf8'));

const NOTICE = 'Proof Session organizes independently verified source artifacts and derived comparison projections. It does not replace any source artifact. Re-verify sources and recompute comparisons to confirm current validity.';

const SUMMARY_LABELS = [
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
];

test('proof-session schema freezes projection identifier and non-authority notice', () => {
  assert.equal(schema.properties.format.const, 'r4b1t-proof-session/v0.1');
  assert.equal(schema.properties.notice.const, NOTICE);
  assert.match(schema.description, /not evidence authority/i);
});

test('proof-session source slots bind exact bytes and keep session identity local', () => {
  const source = schema.$defs.sourceSlot;
  assert.match(source.properties.slot_id.pattern, /^\^S/);
  assert.match(source.properties.artifact_digest.description, /exact UTF-8 source bytes/);
  assert.equal(source.properties.supplied_count.minimum, 1);
  assert.match(source.properties.slot_id.description, /session-local/i);
  assert.match(source.properties.slot_id.description, /not evidence identity/i);
});

test('proof-session schema freezes verification vocabulary', () => {
  assert.deepEqual(vectors.verification_states, ['VERIFIED', 'REJECTED', 'UNVERIFIED']);
  const refs = schema.$defs.verificationResult.oneOf.map((entry) => entry.$ref);
  assert.deepEqual(refs, [
    '#/$defs/verifiedResult',
    '#/$defs/rejectedResult',
    '#/$defs/unverifiedResult'
  ]);
});

test('proof-session pair refs point to frozen Trail Comparison projections instead of redefining stop semantics', () => {
  const pair = schema.$defs.pairRef;
  assert.equal(pair.properties.comparison_format.const, 'r4b1t-trail-comparison/v0.1');
  assert.ok(pair.properties.comparison_projection_digest);
  const serializedPair = JSON.stringify(pair);
  for (const forbidden of ['positions', 'shared_prefix_length', 'first_divergence_index', 'route_id', 'commitment']) {
    assert.equal(serializedPair.includes(forbidden), false, forbidden);
  }
});

test('proof-session relationships encode direct parent edges only', () => {
  const relationship = schema.$defs.directRelationship;
  assert.equal(relationship.properties.type.const, 'DIRECT_PARENT');
  const serialized = JSON.stringify(relationship).toLowerCase();
  for (const forbidden of ['ancestor', 'descendant', 'transitive', 'indirect_parent']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('proof-session summary vocabulary and order are closed', () => {
  const summary = schema.properties.summary;
  assert.equal(summary.minItems, SUMMARY_LABELS.length);
  assert.equal(summary.maxItems, SUMMARY_LABELS.length);
  assert.deepEqual(
    summary.prefixItems.map((entry) => entry.properties.label.const),
    SUMMARY_LABELS
  );
});

test('proof-session schema contains no persistence, network, ranking, recommendation, or selection fields', () => {
  const serialized = JSON.stringify(schema).toLowerCase();
  for (const banned of [
    'localstorage', 'sessionstorage', 'indexeddb', 'autosave', 'recent_sessions',
    '"url"', 'winner', 'similarity_score', 'similarity_percentage', 'quality_score',
    'relevance_score', 'rank', 'popularity', 'engagement', 'recommendation',
    'selection_weight', 'sampler_weight', 'wear_score', 'follower', 'trending',
    'profile', 'telemetry'
  ]) assert.equal(serialized.includes(banned), false, banned);
});

for (const vector of vectors.cases) {
  test('proof-session golden vector: ' + vector.name, () => {
    const projection = vector.projection;
    assert.equal(projection.format, 'r4b1t-proof-session/v0.1');
    assert.equal(projection.notice, NOTICE);
    assert.equal(projection.sources.length, vector.expected_unique_sources);
    assert.equal(projection.pairs.length, vector.expected_verified_pairs);
    assert.equal(projection.relationships.length, vector.expected_direct_relationships);

    const digests = projection.sources.map((source) => source.artifact_digest);
    assert.equal(new Set(digests).size, digests.length);

    const slots = projection.sources.map((source) => source.slot_id);
    assert.deepEqual(slots, slots.map((_, index) => 'S' + (index + 1)));

    const summary = Object.fromEntries(projection.summary.map((item) => [item.label, item.count]));
    assert.deepEqual(Object.keys(summary), SUMMARY_LABELS);
    assert.equal(summary.SOURCES, vector.expected_unique_sources);
    assert.equal(summary.VERIFIED, vector.expected_verified);
    assert.equal(summary.REJECTED, vector.expected_rejected);
    assert.equal(summary.UNVERIFIED, vector.expected_unverified);
    assert.equal(summary['VERIFIED PAIRS'], vector.expected_verified_pairs);
    assert.equal(summary['DIRECT RELATIONSHIPS'], vector.expected_direct_relationships);

    for (const source of projection.sources) {
      assert.match(source.artifact_digest, /^sha256:[0-9a-f]{64}$/);
      assert.ok(source.supplied_count >= 1);
      if (source.verification.state === 'VERIFIED') {
        assert.equal(source.verification.verified_digest, source.artifact_digest);
        assert.match(source.canonical_trail_id, /^sha256:[0-9a-f]{64}$/);
      } else {
        assert.equal(source.verification.verified_digest, null);
        assert.equal(source.canonical_trail_id, null);
      }
    }

    const verifiedSlots = new Set(
      projection.sources.filter((source) => source.verification.state === 'VERIFIED').map((source) => source.slot_id)
    );

    const seenPairs = new Set();
    for (const pair of projection.pairs) {
      assert.ok(verifiedSlots.has(pair.left_slot));
      assert.ok(verifiedSlots.has(pair.right_slot));
      assert.equal(pair.comparison_format, 'r4b1t-trail-comparison/v0.1');
      assert.match(pair.comparison_projection_digest, /^sha256:[0-9a-f]{64}$/);
      const key = pair.left_slot + ':' + pair.right_slot;
      assert.equal(seenPairs.has(key), false);
      seenPairs.add(key);
    }

    for (const edge of projection.relationships) {
      assert.equal(edge.type, 'DIRECT_PARENT');
      assert.ok(verifiedSlots.has(edge.parent_slot));
      assert.ok(verifiedSlots.has(edge.child_slot));
      assert.notEqual(edge.parent_slot, edge.child_slot);
      assert.match(edge.comparison_projection_digest, /^sha256:[0-9a-f]{64}$/);
    }
  });
}

test('three-source chain vector contains no manufactured transitive edge', () => {
  const vector = vectors.cases.find((entry) => entry.name === 'three-source-direct-chain-no-transitive-edge');
  assert.ok(vector);
  const edges = vector.projection.relationships.map((edge) => edge.parent_slot + '>' + edge.child_slot);
  assert.deepEqual(edges, ['S1>S2', 'S2>S3']);
  assert.equal(edges.includes('S1>S3'), false);
});

test('duplicate-source vector collapses exact bytes into one slot and records supply multiplicity only', () => {
  const vector = vectors.cases.find((entry) => entry.name === 'exact-duplicate-source-collapse');
  assert.ok(vector);
  assert.equal(vector.projection.sources.length, 1);
  assert.equal(vector.projection.sources[0].supplied_count, 2);
  assert.equal(vector.projection.summary[0].label, 'SOURCES');
  assert.equal(vector.projection.summary[0].count, 1);
});

test('diagnostic vector contributes no pair refs or relationship edges', () => {
  const vector = vectors.cases.find((entry) => entry.name === 'diagnostic-sources-excluded-from-facts');
  assert.ok(vector);
  assert.equal(vector.projection.pairs.length, 0);
  assert.equal(vector.projection.relationships.length, 0);
  const summary = Object.fromEntries(vector.projection.summary.map((item) => [item.label, item.count]));
  assert.equal(summary.REJECTED, 1);
  assert.equal(summary.UNVERIFIED, 1);
  assert.equal(summary['VERIFIED PAIRS'], 0);
  assert.equal(summary['DIRECT RELATIONSHIPS'], 0);
  assert.equal(summary['DIVERGENT PAIRS'], 0);
});
