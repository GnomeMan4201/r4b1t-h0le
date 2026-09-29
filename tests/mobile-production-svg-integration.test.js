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
  assert.match(source, /var rolling = \['contact','compression','committed','travel','brake','seat'\]/);
  assert.doesNotMatch(source, /var rolling = \[[^\n]*'reveal'/);
  assert.match(source, /var resultReady = presentation === 'reveal' \|\| presentation === 'revealed'/);
  // the mark holds .rolling for its full 1000ms ROLL rather than mirroring the ~660ms strip phases
  assert.match(source, /var MARK_ROLL_MS = 1050;/);
  assert.match(source, /if \(rolling && markRollTimer === null\)[\s\S]*classList\.add\('rolling'\)[\s\S]*setTimeout\([\s\S]*classList\.remove\('rolling'\)[\s\S]*MARK_ROLL_MS\)/);
  assert.match(source, /if \(markRollTimer !== null\) return;\s*root\.classList\.toggle\('result-ready', resultReady\)/);
  // only the reduced-motion branch may mirror the phases directly
  assert.match(source, /if \(reduced\) \{[\s\S]*classList\.toggle\('rolling', rolling\)[\s\S]*return;\s*\}/);
  assert.match(source, /classList\.toggle\('result-ready', resultReady\)/);
  assert.match(source, /function projectAuthoritativeRollPresentation\(machineState\)/);
});

test('menu and blind descent project visual state without selecting routes', () => {
  assert.match(source, /classList\.toggle\('menu-open', id === 'r4mMenuSheet'\)/);
  assert.match(source, /action === 'blind-descent'[\s\S]*classList\.add\('blind-descending'\)[\s\S]*openBlindDescent/);
  assert.match(source, /resetRollStage[\s\S]*'blind-descending'/);
});

test('production SVG locks state priority for MENU, secondary, RESULT, ROLL, and BLIND on #r4h-root, the svg, or any ancestor', () => {
  assert.match(svg, /Public states \(class on #r4h-root, on this svg element, or on any ancestor;[\s\S]*\.blind-descending\s*>\s*\.rolling\s*>\s*\.result-ready\s*>\s*secondary interaction\s*>\s*\.menu-open\s*>\s*idle/);
  assert.match(svg, /#r4h-root:is\(\.menu-open, \.menu-open \*\):not\(\.blind-descending, \.blind-descending \*\) #r4h-menu-glint/);
  assert.match(svg, /#r4h-root:is\(\.menu-open, \.menu-open \*\):is\(\.rolling, \.rolling \*\):not\(\.blind-descending, \.blind-descending \*\) #r4h-menu-ear/);
  assert.match(svg, /#r4h-root:is\(\.result-ready, \.result-ready \*\):not\(\.rolling, \.rolling \*\):not\(\.blind-descending, \.blind-descending \*\) #r4h-result-card-slot/);
  assert.match(svg, /#r4h-root:is\(\.blind-descending, \.blind-descending \*\) #r4h-blind-rabbit/);
  // no gate may match only descendants (that ignored a class placed on #r4h-root itself)
  assert.doesNotMatch(svg, /:(?:is|not)\(\.(?:menu-open|rolling|result-ready|blind-descending) \*\)/);
});

test('production mark has a single accessible identity owned by the inline SVG', () => {
  assert.match(source, /<div class="r4m-production-mark" id="r4mProductionMark"><\/div>/);
  assert.doesNotMatch(source, /id="r4mProductionMark"[^>]*aria-label=/);
  assert.match(svg, /<svg[^>]*role="img"[^>]*aria-labelledby="r4h-title"/);
  assert.match(svg, /<title id="r4h-title">R4B1T H0L3<\/title>/);
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


test('mobile ROLL retires legacy aperture artwork but preserves motion-machine hooks', () => {
  assert.doesNotMatch(source, /rabbit-aperture-void\.svg/);
  assert.doesNotMatch(source, /class="r4m-ap-(?:lip|void|ring|rim|rabbit|kicker)"/);
  assert.match(source, /id="r4mRoll"[^>]*aria-label="ROLL — commit a route before reveal"/);
  assert.match(source, /class="r4m-ap-label">ROLL<\/strong>/);
  assert.match(source, /id="r4mRollScope">FULL CORPUS<\/em>/);
  assert.match(source, /class="r4m-roll-strip" aria-hidden="true"/);
});


test('retired ROLL aperture visual selectors stay out of the mobile stylesheet', () => {
  for (const selector of ['r4m-ap-lip', 'r4m-ap-void', 'r4m-ap-rim', 'r4m-ap-rabbit', 'r4m-ap-ring', 'r4m-ap-kicker']) {
    assert.doesNotMatch(css, new RegExp('\\.' + selector + '(?![\\w-])'));
  }
});


test('secondary motion wrappers preserve canonical geometry ownership', () => {
  for (const id of [
    'r4h-act-rabbit','r4h-act-head','r4h-act-ear-left','r4h-act-ear-right','r4h-act-eyes',
    'r4h-act-glint-left','r4h-act-glint-right','r4h-act-paw-left','r4h-act-paw-right',
    'r4h-act-card','r4h-act-hole','r4h-act-hole-front',
    'r4h-copy-paw-left','r4h-copy-paw-right','r4h-copy-card'
  ]) {
    assert.equal((svg.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id + ' must exist exactly once');
  }
  assert.match(svg, /r4h-blind-\*\s*>\s*r4h-roll-\*\s*>\s*r4h-result-\*\s*>\s*r4h-act-\*\s*>\s*r4h-copy-\*\s*>\s*r4h-menu-\*/);
});

test('secondary states support root, svg, or ancestor placement and yield to RESULT, ROLL, and BLIND', () => {
  for (const state of ['branch-open','trail-open','topology-open','history-open','replay-open']) {
    assert.match(svg, new RegExp('#r4h-root:is\\(\\.' + state + ', \\.' + state + ' \\*\\)'));
  }
  assert.match(svg, /#r4h-root:is\(\.branch-open, \.branch-open \*\):not\(\.result-ready, \.result-ready \*\):not\(\.rolling, \.rolling \*\):not\(\.blind-descending, \.blind-descending \*\)/);
  assert.match(svg, /#r4h-root:is\(\.copy-trail, \.copy-trail \*\):not\(\.rolling, \.rolling \*\):not\(\.blind-descending, \.blind-descending \*\)/);
  assert.doesNotMatch(svg, /:(?:is|not)\(\.(?:branch-open|trail-open|topology-open|history-open|replay-open|copy-trail) \*\)/);
});

test('secondary motion has explicit reduced-motion state semantics and canonical return', () => {
  assert.match(svg, /@media\s*\(prefers-reduced-motion:reduce\)[\s\S]*\.branch-open[\s\S]*\.trail-open[\s\S]*\.topology-open[\s\S]*\.history-open[\s\S]*\.replay-open[\s\S]*\.copy-trail/);
  assert.match(svg, /@keyframes r4h-history-one-shot[\s\S]*100%\s*\{[^}]*transform:none/);
  assert.match(svg, /@keyframes r4h-copy-card[\s\S]*100%\s*\{[^}]*transform:none/);
});

test('application projects secondary presentation classes without adding selection authority', () => {
  const trailRuntime = fs.readFileSync('trail-runtime.js', 'utf8');
  const replayRuntime = fs.readFileSync('replay-inspection-overlay.js', 'utf8');
  const topologyRuntime = fs.readFileSync('topology-runtime.js', 'utf8');

  assert.match(source, /branch-open/);
  assert.match(source, /history-open/);
  assert.match(source, /copy-trail/);
  assert.match(trailRuntime, /classList\.add\('trail-open'\)/);
  assert.match(trailRuntime, /classList\.remove\('trail-open'\)/);
  assert.match(replayRuntime, /classList\.add\('replay-open'\)/);
  assert.match(replayRuntime, /classList\.remove\('replay-open'\)/);
  assert.match(topologyRuntime, /classList\.add\('topology-open'\)/);
  assert.match(topologyRuntime, /classList\.remove\('topology-open'\)/);

  for (const state of ['branch-open','trail-open','topology-open','history-open','replay-open','copy-trail']) {
    assert.doesNotMatch(source, new RegExp(state + '[^\\n]{0,120}(?:roll\\(|__r4b1tCommitRoll|selectUrl|blindDescend)'));
  }
});


test('secondary wrappers are physically nested by transform priority', () => {
  assert.match(svg, /<g id="r4h-blind-rabbit"><g id="r4h-roll-rabbit"><g id="r4h-act-rabbit"><g id="r4h-entrance-rise">/);
  assert.match(svg, /<g id="r4h-roll-head"><g id="r4h-result-head"><g id="r4h-act-head">/);
  assert.match(svg, /<g id="r4h-blind-ear-right"><g id="r4h-roll-ear-right"><g id="r4h-result-ear-right"><g id="r4h-act-ear-right"><g id="r4h-menu-ear"><g id="r4h-idle-ear"><g id="r4h-entrance-ear-right">/);
  assert.match(svg, /<g id="r4h-blind-glint-left"[^>]*><g id="r4h-result-glint-left"[^>]*><g id="r4h-act-glint-left"/);
  assert.match(svg, /<g id="r4h-result-paw"><g id="r4h-act-paw-right"><g id="r4h-copy-paw-right">/);
  assert.match(svg, /<g id="r4h-roll-hole"[^>]*><g id="r4h-act-hole"[^>]*><g id="r4h-entrance-hole"/);
  assert.match(svg, /<g id="r4h-roll-hole-front"[^>]*><g id="r4h-act-hole-front"[^>]*><g id="r4h-entrance-hole-front"/);
});
