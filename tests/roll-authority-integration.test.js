'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const production = fs.readFileSync('roll-production-integration.js', 'utf8');
const shell = fs.readFileSync('dual-shell.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const trail = fs.readFileSync('trail-runtime.js', 'utf8');
const runtime = fs.readFileSync('roll-authority-runtime.js', 'utf8');

test('production ROLL awaits durable authority and preserves machine-owned reveal', () => {
  assert.match(production, /R4B1TRollAuthority/);
  assert.match(production, /Promise\.resolve\(commitment\)/);
  assert.match(production, /disclosure\.commit\(transactionId, result\)/);
  assert.match(production, /machine\.commitAck\(capability\)/);
  assert.match(production, /markRevealed\(payload\.result\)/);
});

test('historical projection remounts a result without calling reveal authority', () => {
  assert.match(production, /function showHistory\(result\)/);
  const showHistory = production.slice(production.indexOf('function showHistory'), production.indexOf('function roll()'));
  assert.match(showHistory, /routeMarkup\(result\)/);
  assert.doesNotMatch(showHistory, /__r4b1tRevealRoll/);
  assert.doesNotMatch(showHistory, /markRevealed/);
});

test('result card exposes PREVIOUS/FORWARD and the shell routes them to authority cursor navigation', () => {
  assert.match(production, /data-mobile-action="previous"/);
  assert.match(production, /data-mobile-action="forward"/);
  assert.match(shell, /action === 'previous'[\s\S]*R4B1TRollAuthority[\s\S]*previous/);
  assert.match(shell, /action === 'forward'[\s\S]*R4B1TRollAuthority[\s\S]*forward/);
  assert.match(shell, /r4b1t:authority-navigation/);
});

test('authority scripts load before the deferred runtime and are precached', () => {
  const coreAt = index.indexOf('roll-authority-core.js');
  const ledgerAt = index.indexOf('roll-authority-ledger.js');
  const trailAt = index.indexOf('trail-runtime.js');
  const runtimeAt = index.indexOf('roll-authority-runtime.js');
  assert.ok(coreAt >= 0 && ledgerAt > coreAt);
  assert.ok(trailAt > ledgerAt && runtimeAt > trailAt);
  for (const file of ['roll-authority-core.js', 'roll-authority-ledger.js', 'roll-authority-runtime.js']) {
    assert.ok(sw.includes(file), file + ' must be precached');
  }
});

test('Trail bridge publishes readiness only after corpus load and authority wrapping', () => {
  assert.match(trail, /__r4b1tTrailAuthorityReady/);
  assert.match(trail, /authorityReadyResolve/);
  assert.match(trail, /wrapRoll\(\)/);
  assert.match(trail, /corpusReady\.then/);
});

test('all legacy/global ROLL entry points delegate to the production durable path', () => {
  assert.match(runtime, /function authoritativeRollEntry\(\)/);
  assert.match(runtime, /R4B1TRollProduction[\s\S]*\.roll\(\)/);
  assert.match(runtime, /root\.roll\s*=\s*authoritativeRollEntry/);
  assert.match(runtime, /__r4b1tSeeded\s*=\s*true/);
});

test('authority navigation never delegates to browser history', () => {
  assert.doesNotMatch(runtime, /history\.pushState|history\.back\(|history\.forward\(|history\.replaceState/);
});

test('Trail authority refreshes the durable draft under the global lock before prepare/project', () => {
  assert.match(trail, /function refreshAuthorityDraftFromStorage\(\)/);
  const prepareAt = trail.indexOf('async function prepareAuthorityRoll');
  const projectAt = trail.indexOf('async function projectAuthorityTerminal');
  assert.ok(prepareAt >= 0 && projectAt >= 0);
  assert.match(trail.slice(prepareAt, prepareAt + 700), /refreshAuthorityDraftFromStorage\(\)/);
  assert.match(trail.slice(projectAt, projectAt + 500), /refreshAuthorityDraftFromStorage\(\)/);
});
