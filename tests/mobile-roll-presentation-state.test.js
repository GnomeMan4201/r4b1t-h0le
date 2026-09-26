const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync('dual-shell.js', 'utf8');
const css = fs.readFileSync('dual-shell.css', 'utf8');

test('mobile ROLL exposes an idle presentation state without replacing authority', () => {
  assert.match(source, /id="r4mRoll"[^>]*data-presentation-state="idle"/);
  assert.match(source, /function setRollPresentationState\(state\)/);
  assert.doesNotMatch(source, /setRollPresentationState\([^)]*route|setRollPresentationState\([^)]*url/i);
});

test('pointer contact projects contact and compression presentation states', () => {
  assert.match(source, /setRollPresentationState\('contact'\)/);
  assert.match(source, /requestAnimationFrame[\s\S]*setRollPresentationState\('compression'\)/);
});

test('pending roll projects travel and clears back to idle', () => {
  assert.match(source, /function beginRollPending[\s\S]*setRollPresentationState\('travel'\)/);
  assert.match(source, /function endRollPending[\s\S]*setRollPresentationState\('idle'\)/);
});

test('presentation tokens centralize physical travel and reduced-motion removes it', () => {
  assert.match(css, /--r4m-contact-travel:/);
  assert.match(css, /--r4m-compress-face-travel:/);
  assert.match(css, /--r4m-time-contact:/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*--r4m-contact-travel:0px/);
});
