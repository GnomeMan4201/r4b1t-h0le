const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'dual-shell.css'), 'utf8');

test('locked mobile surface declares the authoritative black/red visual tokens', () => {
  assert.match(css, /LOCKED R4B1T H0L3 MOBILE SURFACE/);
  assert.match(css, /--r4m-locked-red:\s*#FB0118/i);
  assert.match(css, /--r4m-locked-white:\s*#FEFEFE/i);
  assert.match(css, /--r4m-locked-black:\s*#000(?:000)?\b/i);
});

test('locked mobile landing removes the old chassis/card treatment', () => {
  assert.match(css, /\.r4m-roll\s*\{[^}]*background:\s*var\(--r4m-locked-red\)/s);
  assert.match(css, /\.r4m-roll\s*\{[^}]*border-radius:\s*0/s);
  assert.match(css, /\.r4m-roll-chassis\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.r4m-route\s*\{[^}]*background:\s*var\(--r4m-locked-black\)/s);
  assert.match(css, /\.r4m-route\s*\{[^}]*box-shadow:\s*none/s);
});

test('locked mobile navigation keeps ROLL primary and MENU outlined', () => {
  assert.match(css, /#r4mNavRoll\s*\{[^}]*background:\s*var\(--r4m-locked-red\)/s);
  assert.match(css, /#r4mNavMenu\s*\{[^}]*background:\s*var\(--r4m-locked-black\)/s);
  assert.match(css, /#r4mNavMenu\s*\{[^}]*border:\s*2px solid var\(--r4m-locked-white\)/s);
});

test('locked mobile surface preserves reduced-motion handling', () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});


test('mobile landing uses the exact locked animated master asset', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'dual-shell.js'), 'utf8');
  const svg = fs.readFileSync(path.join(__dirname, '..', 'r4b1t-h0l3-master.svg'), 'utf8');
  assert.match(js, /r4b1t-h0l3-master\.svg/);
  assert.match(svg, /viewBox="0 0 1700 925"/);
  assert.match(svg, /id="r4h"/);
  assert.match(svg, /\.is-entering/);
  assert.match(svg, /#FB0118/i);
});
