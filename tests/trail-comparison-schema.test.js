'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'schema', 'trail-comparison-v0.1.schema.json'), 'utf8'));
const vectors = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'trail-comparison-v1', 'golden-vectors.json'), 'utf8'));

const NOTICE = 'Comparison describes two independently verified source artifacts identified by their digests. It does not replace either source artifact. Re-verify both sources to confirm current validity.';
const DIAGNOSTIC = 'THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.';

test('comparison schema freezes projection identifier and exact-byte source binding', () => {
  assert.equal(schema.properties.format.const, 'r4b1t-trail-comparison/v0.1');
  assert.match(schema.$defs.source.properties.artifact_digest.description, /exact UTF-8 source bytes/);
});

test('comparison schema freezes verification, position, and lineage vocabularies', () => {
  assert.deepEqual(vectors.verification_states, ['VERIFIED', 'REJECTED', 'UNVERIFIED']);
  assert.deepEqual(schema.$defs.position.properties.state.enum, vectors.position_states);
  assert.deepEqual(schema.$defs.comparison.properties.lineage_state.enum, vectors.lineage_states.filter((x) => x !== 'INDETERMINATE'));
});

test('comparison projection contains no URL, score, ranking, recommendation, or selection fields', () => {
  const serialized = JSON.stringify(schema).toLowerCase();
  for (const banned of [
    '"url"', 'winner', 'similarity_score', 'similarity_percentage', 'quality_score',
    'relevance_score', 'rank', 'popularity', 'engagement', 'recommendation',
    'selection_weight', 'sampler_weight', 'wear_score', 'follower', 'trending'
  ]) assert.equal(serialized.includes(banned), false, banned);
});

test('comparison side-stop shape preserves concealment boundary', () => {
  assert.deepEqual(schema.$defs.sideStop.properties.state.enum, ['REVEALED', 'CONCEALED', 'ABSENT']);
  assert.ok(schema.$defs.sideStop.properties.route_id);
  assert.ok(schema.$defs.sideStop.properties.commitment);
});

for (const vector of vectors.cases) {
  test('comparison golden vector: ' + vector.name, () => {
    const projection = vector.projection;
    assert.equal(projection.format, 'r4b1t-trail-comparison/v0.1');
    assert.equal(projection.notice, NOTICE);
    assert.match(projection.sources.left.artifact_digest, /^sha256:[0-9a-f]{64}$/);
    assert.match(projection.sources.right.artifact_digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(projection.verification.left.state, vector.expected_left_state);
    assert.equal(projection.verification.right.state, vector.expected_right_state);

    const bothVerified = vector.expected_left_state === 'VERIFIED' && vector.expected_right_state === 'VERIFIED';
    if (bothVerified) {
      assert.ok(projection.comparison);
      assert.equal(Object.prototype.hasOwnProperty.call(projection, 'diagnostic_notice'), false);
      assert.equal(projection.verification.left.verified_digest, projection.sources.left.artifact_digest);
      assert.equal(projection.verification.right.verified_digest, projection.sources.right.artifact_digest);
      assert.equal(projection.comparison.positions.length, Math.max(projection.comparison.left_stop_count, projection.comparison.right_stop_count));
      for (const position of projection.comparison.positions) {
        for (const side of [position.left, position.right]) {
          if (side.state === 'CONCEALED') assert.equal(side.route_id, null);
          if (side.state === 'ABSENT') {
            assert.equal(side.route_id, null);
            assert.equal(side.commitment, null);
          }
        }
      }
    } else {
      assert.equal(projection.comparison, null);
      assert.equal(projection.diagnostic_notice, DIAGNOSTIC);
    }
  });
}
