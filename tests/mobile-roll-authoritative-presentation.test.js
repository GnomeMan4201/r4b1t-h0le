'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const production = fs.readFileSync('roll-production-integration.js', 'utf8');
const shell = fs.readFileSync('dual-shell.js', 'utf8');

test('authoritative motion transitions are projected to presentation without presentation driving authority', () => {
  assert.match(production, /onTransition:\s*function \(entry\)[\s\S]*__r4b1tProjectRollPresentation[\s\S]*entry\.to/);
  assert.match(shell, /window\.__r4b1tProjectRollPresentation\s*=\s*projectAuthoritativeRollPresentation/);
  assert.doesNotMatch(shell, /projectAuthoritativeRollPresentation[\s\S]{0,900}(?:commitAck|commitFailed|activeCommitCapability|__r4b1tCommitRoll)/);
});

test('authoritative states map through committed, travel, brake, seat and reveal presentation phases', () => {
  for (const pair of [
    ['STRIP_ACCELERATING', 'travel'],
    ['STRIP_DECELERATING', 'brake'],
    ['LOCKED', 'seat'],
    ['CARD_ENTERING', 'reveal'],
    ['SETTLED', 'revealed']
  ]) {
    const pattern = new RegExp(pair[0] + "[\\s\\S]{0,160}" + pair[1]);
    assert.match(shell, pattern);
  }
});

test('reveal presentation cannot precede authoritative CARD_ENTERING', () => {
  const revealIndex = shell.indexOf("'CARD_ENTERING': 'reveal'");
  assert.ok(revealIndex >= 0);
  assert.equal(shell.indexOf("'STRIP_ACCELERATING': 'reveal'"), -1);
  assert.equal(shell.indexOf("'STRIP_DECELERATING': 'reveal'"), -1);
  assert.equal(shell.indexOf("'LOCKED': 'reveal'"), -1);
});
