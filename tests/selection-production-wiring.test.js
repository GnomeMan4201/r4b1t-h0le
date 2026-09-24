'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const handoff = require('../roll-authority-handoff.js');

const ROOT = path.resolve(__dirname, '..');
function source(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, 'missing source marker: ' + startMarker);
  assert.notEqual(end, -1, 'missing source marker: ' + endMarker);
  return text.slice(start, end);
}

test('desktop production ROLL executes the shared commit boundary and reveals its returned transaction', () => {
  const index = source('index.html');
  const body = extractBetween(index, 'function B(){', 'function F(){');
  const tx = Object.freeze({ route: Object.freeze({ url: 'https://example.test/desktop' }) });
  let commits = 0;
  let revealed = null;
  const sandbox = {
    _commitRollSelection() { commits += 1; return tx; },
    _revealRollSelection(value) { revealed = value; return true; },
    document: { getElementById() { return null; } },
    setTimeout(fn) { fn(); return 1; },
  };
  vm.runInNewContext(body + '\nthis.desktopRoll = B;', sandbox);
  sandbox.desktopRoll();
  assert.equal(commits, 1);
  assert.equal(revealed, tx);
});

test('shared production commit function hands exact authority transaction to trail-runtime before presentation mutation', () => {
  const index = source('index.html');
  const body = extractBetween(index, 'function _commitRollSelection(){', 'function _revealRollSelection(');
  const tx = Object.freeze({
    transaction_version: 'r4b1t-selection-transaction/v1',
    sequence: 1,
    action: 'ROLL',
    constraint: Object.freeze({ terrain: 'CODE' }),
    corpus_revision: 'sha256:' + 'c'.repeat(64),
    sampler: Object.freeze({ seed: 'wire-seed', algorithm: 'uniform-with-repeat-guard-v1', prng: 'mulberry32-v1', draw_start: 0, draw_count: 1 }),
    route: Object.freeze({ url: 'https://example.test/authority' }),
  });
  const order = [];
  let recorded = null;
  const authority = { selectRoll() { order.push('select'); return tx; } };
  const sandbox = {
    _getSelectionAuthority() { return authority; },
    _captureRollConstraint() { return { terrain: 'CODE' }; },
    _poolForRollConstraint() { return ['https://example.test/authority']; },
    window: {
      R4B1TRollAuthorityHandoff: handoff,
      __r4b1tCorpusRevision: tx.corpus_revision,
      __r4b1tRecordSelectionTransaction(value) { order.push('record'); recorded = value; return true; },
    },
    Ie: tx.corpus_revision,
    s: { last: null, activeNodeId: null, mode: 'random' },
    te(url) { order.push('presentation-state'); sandbox.s.current = url; },
    h: { reset() {} },
    document: { getElementById() { return { style: {}, innerHTML: '' }; } },
  };
  vm.runInNewContext(body + '\nthis.commitRollSelection = _commitRollSelection;', sandbox);
  const returned = sandbox.commitRollSelection();
  assert.equal(returned, tx);
  assert.equal(recorded, tx);
  assert.deepEqual(order, ['select', 'record', 'presentation-state']);
});

test('mobile production ROLL calls the same shared commit boundary exactly once and gives disclosure the same transaction', () => {
  const integration = source('roll-production-integration.js');
  const tx = Object.freeze({ route: Object.freeze({ url: 'https://example.test/mobile' }) });
  let commitCalls = 0;
  let disclosed = null;
  const button = { querySelector() { return {}; }, appendChild() {} };
  const mount = { classList: { remove() {}, add() {} }, replaceChildren() {} };
  const sandbox = {
    document: {
      getElementById(id) { return id === 'r4mRoll' ? button : id === 'r4mRouteMount' ? mount : null; },
      createElement() { return { className: '', id: '', innerHTML: '', setAttribute() {} }; },
      addEventListener() {},
    },
    requestAnimationFrame() {},
    setTimeout(fn) { fn(); return 1; },
    addEventListener() {},
    __r4b1tCommitRoll() { commitCalls += 1; return tx; },
    R4B1TRollMotion: {
      createRollMotionMachine() {
        return {
          timing: {},
          snapshot() { return { active: false, transactionId: 7 }; },
          pointerDown() { return true; },
          pointerUp() { return true; },
          activeCommitCapability() { return Object.freeze({ id: 7 }); },
          commitAck() { return true; },
          commitFailed() {},
          cancel() {},
        };
      },
    },
    R4B1TRollRenderer: {
      createRollRenderer() { return { renderState() {}, isActive() { return false; }, cancel() {} }; },
    },
    R4B1TRollDisclosure: {
      createRollDisclosureBoundary() {
        return {
          commit(_id, value) { disclosed = value; return true; },
          reveal() { return true; },
          cancel() { return true; },
        };
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(integration, sandbox);
  assert.equal(sandbox.R4B1TRollProduction.roll(), true);
  assert.equal(commitCalls, 1);
  assert.equal(disclosed, tx);
});

test('trail-runtime exposes direct transaction recorder and DOM observation cannot manufacture ROLL provenance', () => {
  const runtime = source('trail-runtime.js');
  const index = source('index.html');
  assert.match(runtime, /window\.__r4b1tRecordSelectionTransaction\s*=\s*recordSelectionTransaction/);
  assert.match(runtime, /record\(target\.textContent\.trim\(\), 'SELECT'\)/);
  assert.doesNotMatch(runtime, /addEventListener\(['"]r4b1t:selection-committed/);
  assert.doesNotMatch(index, /dispatchEvent\(new CustomEvent\(['"]r4b1t:selection-committed/);
});

test('ROLL authority path contains no global Math.random replacement', () => {
  for (const name of ['selection-authority.js', 'roll-authority-handoff.js', 'trail-runtime.js', 'index.html']) {
    assert.doesNotMatch(source(name), /Math\.random\s*=/, name + ' must not replace global Math.random');
  }
});
