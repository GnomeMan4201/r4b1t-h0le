const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync('dual-shell.js', 'utf8');
const css = fs.readFileSync('dual-shell.css', 'utf8');
const svg = fs.readFileSync('r4b1t-h0l3-production.svg', 'utf8');

test('mobile landing mounts the canonical production SVG instead of the legacy hero rabbit', () => {
  assert.match(source, /id="r4mProductionMark"/);
  assert.match(source, /fetch\('r4b1t-h0l3-production\.svg'/);
  assert.doesNotMatch(source, /<img src="rabbit-aperture\.svg"/);
  assert.match(svg, /viewBox="0 0 1700 925"/);
  assert.match(svg, /r4h-root/);
});

test('production mark remains presentation-only and follows authoritative ROLL projection', () => {
  assert.match(source, /function syncProductionMarkState\(\)/);
  assert.match(source, /classList\.toggle\('rolling', rolling\)/);
  assert.match(source, /classList\.toggle\('result-ready', presentation === 'revealed'\)/);
  assert.match(source, /function projectAuthoritativeRollPresentation\(machineState\)/);
});

test('menu and blind descent project visual state without selecting routes', () => {
  assert.match(source, /classList\.toggle\('menu-open', id === 'r4mMenuSheet'\)/);
  assert.match(source, /action === 'blind-descent'[\s\S]*classList\.add\('blind-descending'\)[\s\S]*openBlindDescent/);
  assert.match(source, /resetRollStage[\s\S]*'blind-descending'/);
});

test('mobile CSS gives the production mark a responsive landing surface', () => {
  assert.match(css, /\.r4m-production-mark\{/);
  assert.match(css, /\.r4m-production-mark svg\{/);
  assert.match(css, /max-height:230px/);
});

test('production mark stays outside the hero hidden by RESULT and BLIND stage CSS', () => {
  assert.match(source, /id="r4mPrimaryStage">',[\s\S]*id="r4mProductionMark"[\s\S]*<section class="r4m-hero" id="r4mHero">/);
  assert.match(css, /html\.r4m-stage-result \.r4m-hero,[\s\S]*display:none!important/);
  assert.match(css, /html\.r4m-stage-blind \.r4m-hero,[\s\S]*display:none!important/);
  assert.doesNotMatch(css, /html\.r4m-stage-(?:result|blind) \.r4m-production-mark/);
});


test('blind return releases the production descent state only at the surface', () => {
  const blind = fs.readFileSync('blind-runtime.js', 'utf8');
  assert.match(blind, /function returnTowardSurface\(\)[\s\S]*state\.currentDepth = Math\.max\(0, state\.currentDepth - 1\)[\s\S]*if \(state\.currentDepth === 0\) \{[\s\S]*classList\.remove\('blind-descending'\)/);
});
