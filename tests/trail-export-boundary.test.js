'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const boundary = require('../trail-export-boundary.js');

function tx(url = 'https://example.test/a') {
  return Object.freeze({
    transaction_version: 'r4b1t-selection-transaction/v1',
    sequence: 1,
    action: 'ROLL',
    constraint: Object.freeze({ terrain: 'CODE' }),
    corpus_revision: 'sha256:' + 'a'.repeat(64),
    sampler: Object.freeze({
      algorithm: 'uniform-with-repeat-guard-v1',
      prng: 'mulberry32-v1',
      seed: 'seed',
      draw_start: 0,
      draw_count: 1,
    }),
    route: Object.freeze({ url }),
  });
}

test('fresh authority-backed ROLL trail chooses v0.3 export', () => {
  const transaction = tx();
  assert.equal(boundary.choose({
    routes: [{ url: transaction.route.url, action: 'ROLL' }],
    transactions: [transaction],
    parent: null,
    legacy_boundary: false,
  }).format, 'r4b1t-trail/v0.3');
});

test('legacy v0.1 draft without transaction provenance is never silently upgraded', () => {
  assert.equal(boundary.choose({
    routes: [{ url: 'https://example.test/legacy', action: 'ROLL' }],
    transactions: [],
    parent: null,
    legacy_boundary: true,
  }).format, 'r4b1t-trail/v0.1');
});

test('non-random SELECT remains on the legacy boundary and receives no fake ROLL provenance', () => {
  const transaction = tx();
  const result = boundary.choose({
    routes: [
      { url: transaction.route.url, action: 'ROLL' },
      { url: 'https://example.test/manual', action: 'SELECT' },
    ],
    transactions: [transaction],
    parent: null,
    legacy_boundary: true,
  });
  assert.equal(result.format, 'r4b1t-trail/v0.1');
  assert.match(result.reason, /legacy|non-random/);
});

test('legacy parent/fork lineage remains v0.1 in Phase 3', () => {
  const transaction = tx();
  assert.equal(boundary.choose({
    routes: [{ url: transaction.route.url, action: 'ROLL' }],
    transactions: [transaction],
    parent: { trail_id: 'sha256:' + 'b'.repeat(64), fork_at: 1 },
    legacy_boundary: false,
  }).format, 'r4b1t-trail/v0.1');
});
