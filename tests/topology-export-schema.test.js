'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const topology = require('../trail-topology.js');

const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'schema', 'trail-topology-export-v0.1.schema.json'),
  'utf8',
));
const vectors = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'topology-v2', 'golden-vectors.json'),
  'utf8',
));

const STATES = ['VERIFIED', 'REJECTED', 'PARENT ABSENT', 'CONCEALED', 'REVEALED'];

test('topology export schema exposes only categorical proof states', () => {
  assert.equal(schema.properties.format.const, 'r4b1t-topology-export/v0.1');
  assert.deepEqual(vectors.states, STATES);
  assert.deepEqual(schema.$defs.artifactState.enum, ['VERIFIED']);
  assert.deepEqual(schema.$defs.relationshipState.enum, ['VERIFIED', 'PARENT ABSENT']);
  assert.deepEqual(schema.$defs.stopState.enum, ['CONCEALED', 'REVEALED']);
  assert.deepEqual(schema.$defs.diagnosticState.enum, ['REJECTED']);

  const serialized = JSON.stringify(schema).toLowerCase();
  for (const banned of ['confidence', 'score', 'interesting', 'recommended', 'popularity']) {
    assert.equal(serialized.includes(banned), false, 'schema must not introduce ' + banned + ' semantics');
  }
});

for (const vector of vectors.cases) {
  test('topology golden vector: ' + vector.name, async () => {
    if (vector.expected_state === 'REJECTED') {
      await assert.rejects(
        () => topology.build(vector.input),
        new RegExp(vector.expected_error),
      );
      return;
    }

    const graph = await topology.build(vector.input);
    assert.equal(graph.snapshots.length, 1);
    const node = graph.snapshots[0];

    if (vector.expected_state === 'VERIFIED') {
      assert.equal(node.trail_id, vector.input[0].trail_id);
      return;
    }

    if (vector.expected_state === 'PARENT ABSENT') {
      assert.ok(node.parent);
      assert.equal(node.parent_known, false);
      return;
    }

    assert.equal(node.stops.length, 1);
    if (vector.expected_state === 'CONCEALED') {
      assert.equal(node.stops[0].state, 'concealed');
      assert.equal(node.stops[0].url, null);
      assert.equal(JSON.stringify(node).includes('example.net/concealed'), false);
      return;
    }

    if (vector.expected_state === 'REVEALED') {
      assert.equal(node.stops[0].state, 'revealed');
      assert.equal(node.stops[0].url, 'https://example.net/concealed');
      return;
    }

    assert.fail('Unhandled proof state: ' + vector.expected_state);
  });
}
