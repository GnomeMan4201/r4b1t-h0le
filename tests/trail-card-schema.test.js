'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'docs', 'schema', 'trail-card-v0.1.schema.json'),
  'utf8',
));
const vectors = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tests', 'fixtures', 'trail-cards-v1', 'golden-vectors.json'),
  'utf8',
));

const NOTICE = 'Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.';
const DIAGNOSTIC_NOTICE = 'THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.';

function checkCounts(display) {
  if (!display) return;
  assert.equal(
    display.stop_count,
    display.concealed_count + display.revealed_count,
    'stop count must equal concealed + revealed',
  );
  if (display.kind === 'topology') {
    assert.equal(display.node_count, display.branch_diagram.nodes.length);
    assert.equal(display.edge_count, display.branch_diagram.edges.length);
    for (const node of display.branch_diagram.nodes) {
      assert.equal(node.stop_count, node.concealed_count + node.revealed_count);
    }
  } else {
    assert.equal(display.stop_count, display.stops.length);
  }
}

test('Trail Card schema freezes projection and source-format identifiers', () => {
  assert.equal(schema.properties.format.const, 'r4b1t-trail-card/v0.1');
  const verifiedFormats = schema.allOf[0].then.properties.source.properties.artifact_format.enum;
  assert.deepEqual(verifiedFormats, [
    'r4b1t-topology-export/v0.1',
    'r4b1t-trail/v0.1',
    'r4b1t-trail/v0.2',
  ]);
  assert.match(schema.$defs.source.properties.artifact_digest.description, /exact UTF-8 source bytes/);
});

test('Trail Card schema exposes only the frozen card and relationship states', () => {
  assert.deepEqual(vectors.states, ['VERIFIED', 'REJECTED', 'UNVERIFIED']);
  assert.deepEqual(vectors.relationship_states, ['VERIFIED', 'PARENT ABSENT']);
  assert.equal(schema.$defs.verifiedResult.properties.state.const, 'VERIFIED');
  assert.equal(schema.$defs.rejectedResult.properties.state.const, 'REJECTED');
  assert.equal(schema.$defs.unverifiedResult.properties.state.const, 'UNVERIFIED');
  assert.deepEqual(schema.$defs.relationshipState.enum, ['VERIFIED', 'PARENT ABSENT']);
});

test('Trail Card schema keeps source-specific display shapes distinct', () => {
  assert.equal(schema.$defs.trailDisplay.properties.kind.const, 'trail');
  assert.equal(schema.$defs.topologyDisplay.properties.kind.const, 'topology');
  assert.ok(schema.$defs.trailDisplay.properties.stops);
  assert.ok(schema.$defs.topologyDisplay.properties.branch_diagram);
  assert.equal(Object.prototype.hasOwnProperty.call(schema.$defs.topologyDisplay.properties, 'genesis_id'), false);
});

test('Trail Card notices are fixed and diagnostic notice is state-gated', () => {
  assert.equal(schema.properties.notice.const, NOTICE);
  assert.equal(schema.properties.diagnostic_notice.const, DIAGNOSTIC_NOTICE);
  assert.deepEqual(schema.allOf[1].then.required, ['diagnostic_notice']);
});

test('Trail Card schema introduces no ranking, popularity, or recommendation fields', () => {
  const serialized = JSON.stringify(schema).toLowerCase();
  for (const banned of [
    'popularity',
    'engagement',
    'interestingness',
    'recommendation',
    'selection_weight',
    'sampler_weight',
    'quality_score',
    'relevance_score',
  ]) {
    assert.equal(serialized.includes(banned), false, banned);
  }
});

for (const vector of vectors.cases) {
  test('Trail Card golden vector: ' + vector.name, () => {
    const card = vector.card;
    assert.equal(card.format, 'r4b1t-trail-card/v0.1');
    assert.equal(card.notice, NOTICE);
    assert.match(card.source.artifact_digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(card.verification.state, vector.expected_state);

    if (card.verification.state === 'VERIFIED') {
      assert.equal(card.verification.verified_digest, card.source.artifact_digest);
      assert.equal(card.verification.reason, null);
      assert.ok(card.verification.verified_at);
      assert.ok(card.display);
      assert.equal(Object.prototype.hasOwnProperty.call(card, 'diagnostic_notice'), false);
    } else {
      assert.equal(card.verification.verified_digest, null);
      assert.equal(typeof card.verification.reason, 'string');
      assert.ok(card.verification.reason.length > 0);
      assert.equal(card.diagnostic_notice, DIAGNOSTIC_NOTICE);
    }

    checkCounts(card.display);

    if (vector.name === 'verified-concealed-source-material') {
      assert.equal(card.display.concealed_count, 1);
      assert.deepEqual(card.display.stops, [{ index: 0, state: 'concealed' }]);
      assert.equal(JSON.stringify(card).includes('url'), false);
    }

    if (vector.name === 'verified-parent-absent-topology') {
      assert.equal(card.verification.state, 'VERIFIED');
      assert.equal(vector.expected_relationship_state, 'PARENT ABSENT');
      assert.equal(card.display.parent_absent_count, 1);
      assert.equal(card.display.branch_diagram.nodes[0].relationship_state, 'PARENT ABSENT');
      assert.equal(card.display.branch_diagram.edges[0].relationship_state, 'PARENT ABSENT');
    }
  });
}
