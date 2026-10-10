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
  // the mark holds .rolling until the canonical rabbit animation itself ends.
  assert.match(source, /var MARK_ROLL_MS = 1050;/);
  assert.match(source, /rabbit\.addEventListener\('animationstart', markRollOnStart\)/);
  assert.match(source, /rabbit\.addEventListener\('animationend', markRollOnEnd\)/);
  assert.match(source, /event\.animationName !== 'r4h-roll-rabbit'/);
  assert.match(source, /finishProductionMarkRoll\('no-start-after-frame'\)/);
  assert.match(source, /MARK_ROLL_ABSOLUTE_CEILING_MS = 3000/);
  assert.match(source, /MARK_ROLL_COMPLETION_WATCHDOG_MS = 1250/);
  assert.match(source, /MARK_ROLL_MS \+ 300/);
  assert.match(source, /if \(markRollActive\) return;\s*root\.classList\.toggle\('result-ready', resultReady\)/);
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

test('production SVG locks state priority for MENU, RESULT, ROLL, and BLIND on #r4h-root, the svg, or any ancestor', () => {
  assert.match(svg, /Public states \(class on #r4h-root, on this svg element, or on any ancestor;[\s\S]*\.blind-descending\s*>\s*\.rolling\s*>\s*\.result-ready\s*>\s*\.menu-open\s*>\s*idle/);
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


test('blind descent pose follows the visible stage without changing committed depth on close', () => {
  const blind = fs.readFileSync('blind-runtime.js', 'utf8');
  assert.match(blind, /function returnTowardSurface\(\)[\s\S]*state\.currentDepth = Math\.max\(0, state\.currentDepth - 1\)[\s\S]*render\('RETURNING \/ COMMITMENTS UNCHANGED'/);
  const projection = blind.slice(blind.indexOf('function syncBlindMark()'), blind.indexOf('function terrain()'));
  assert.match(projection, /classList\.toggle\('blind-descending',[\s\S]*overlay\.classList\.contains\('open'\) && state\.currentDepth > 0/);
  const close = blind.slice(blind.indexOf('function close()'), blind.indexOf('window.openBlindDescent = open'));
  assert.match(close, /syncBlindMark\(\)/);
  assert.doesNotMatch(close, /state\.currentDepth\s*=|save\(|api\.commit\(|selectUrl\(/);
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


test('secondary motion layer: act and copy wrappers nest in the approved ownership order', () => {
  const chains = [
    ['r4h-roll-hole', 'r4h-act-hole', 'r4h-entrance-hole'],
    ['r4h-roll-hole-front', 'r4h-act-hole-front', 'r4h-entrance-hole-front'],
    ['r4h-roll-rabbit', 'r4h-act-rabbit', 'r4h-entrance-rise'],
    ['r4h-result-ear-left', 'r4h-act-ear-left', 'r4h-entrance-ear-left'],
    ['r4h-result-ear-right', 'r4h-act-ear-right', 'r4h-menu-ear'],
    ['r4h-result-head', 'r4h-act-head'],
    ['r4h-entrance-backing', 'r4h-act-backing', 'r4h-roll-backing'],
    ['r4h-roll-eyes', 'r4h-act-eyes', 'r4h-entrance-eyes'],
    ['r4h-result-glint-left', 'r4h-act-glint-left', 'r4h-act-glance-left'],
    ['r4h-result-glint-right', 'r4h-act-glint-right', 'r4h-act-glance-right', 'r4h-menu-glint'],
    ['r4h-roll-paw-left', 'r4h-act-paw-left', 'r4h-copy-paw-left', 'r4h-entrance-paw-left'],
    ['r4h-result-paw', 'r4h-act-paw-right', 'r4h-copy-paw-right'],
    ['r4h-result-card-slot', 'r4h-act-card', 'r4h-copy-card', 'r4h-result-card'],
  ];
  for (const chain of chains) {
    const re = new RegExp(chain.map((id) => `<g id="${id}"[^>]*>`).join('\\s*'));
    assert.match(svg, re, chain.join(' > '));
  }
  // 15 act wrappers + 3 copy wrappers + one act socket that reuses the highlight geometry
  assert.equal((svg.match(/<g id="r4h-act-/g) || []).length, 15);
  assert.equal((svg.match(/<g id="r4h-copy-/g) || []).length, 3);
  assert.match(svg, /<use id="r4h-act-eye-left-socket" href="#r4h-eye-left-highlight"/);
});

test('secondary motion layer: TRAIL returns its eyes last, after head and paw, inside the 380ms contract', () => {
  const ms = (rule) => {
    const m = svg.match(new RegExp(`^#r4h-root ${rule}\\{transition:transform (\\d+)ms [^ ]+ (\\d+)ms\\}`, 'm'));
    assert.ok(m, rule);
    return { start: Number(m[2]), end: Number(m[1]) + Number(m[2]) };
  };
  const card = ms('#r4h-act-card'), head = ms('#r4h-act-head'), paw = ms('#r4h-act-paw-left'), eyes = ms('\\.r4h-act-glance');
  assert.ok(card.start <= paw.start && paw.end <= eyes.end && head.end <= eyes.end, 'artifact, paw, head, then eyes');
  assert.ok(eyes.start >= head.start && eyes.end <= 380);
  // only TRAIL poses the glance wrappers; every other peer keeps its eyes on r4h-act-glint-*
  for (const r of svg.match(/^[^\n]*#r4h-act-glance-(?:left|right)\{(?:transform|transition)[^\n]*$/gm) || []) {
    if (/-open/.test(r)) assert.match(r, /^#r4h-root:is\(\.trail-open, \.trail-open \*\)/, r);
  }
  assert.doesNotMatch(svg, /^#r4h-root:is\(\.trail-open, \.trail-open \*\)[^{]*#r4h-act-glint-(?:left|right)\{/m);
});

test('secondary motion layer: every state gate matches the state element itself and yields to ROLL and BLIND', () => {
  const states = ['branch-open', 'trail-open', 'topology-open', 'history-open', 'replay-open', 'copy-trail'];
  for (const s of states) {
    assert.match(svg, new RegExp(`:is\\((?:[^)]*, )?\\.${s}, \\.${s} \\*`), s);
    assert.doesNotMatch(svg, new RegExp(`:(?:is|not)\\(\\.${s} \\*\\)`), `${s} descendant-only gate`);
  }
  // every act/copy rule that sets a pose or motion is switched off by ROLL and BLIND
  const actRules = svg.match(/^#r4h-root:is\([^{]*(?:-open|copy-trail)[^{]*#r4h-(?:act|copy)-[^{]*\{/gm) || [];
  assert.ok(actRules.length > 20);
  for (const r of actRules) assert.match(r, /:not\(\.rolling, \.rolling \*\):not\(\.blind-descending, \.blind-descending \*\)/, r);
  // the card slot stays RESULT's: act only moves the card while RESULT is not holding it
  for (const r of svg.match(/^[^\n]*#r4h-act-card\{(?:transform|transition|animation)[^\n]*$/gm) || []) {
    if (/-open/.test(r)) assert.match(r, /:not\(\.result-ready, \.result-ready \*\)/, r);
  }
});

test('secondary motion layer: reduced motion shows held poses only, never motion', () => {
  const media = svg.indexOf('@media (prefers-reduced-motion:no-preference){');
  const close = svg.indexOf('/* keyframes (bodies copied verbatim');
  const outside = svg.slice(0, media) + svg.slice(close);
  const inside = svg.slice(media, close);
  // no act/copy transition or animation outside the no-preference block
  assert.doesNotMatch(outside.replace(/@keyframes[\s\S]*$/, ''), /#r4h-(?:act|copy)-[^{]*\{[^}]*(?:transition|animation)/);
  // held poses for the states that hold (BRANCH, TRAIL, TOPOLOGY, REPLAY) live outside it
  for (const s of ['branch-open', 'trail-open', 'topology-open', 'replay-open']) {
    assert.match(outside, new RegExp(`\\.${s}[^{]*#r4h-act-[a-z-]+\\{transform:`), s);
  }
  // HISTORY and COPY TRAIL are motion only
  assert.doesNotMatch(outside.replace(/@keyframes[\s\S]*$/, ''), /\.(?:history-open|copy-trail)[^{]*\{transform:/);
  assert.match(inside, /\.history-open[^{]*#r4h-act-head\{transition:none;animation:r4h-act-history-head/);
  assert.match(inside, /\.copy-trail[^{]*#r4h-copy-card\{transition:none;animation:r4h-copy-/);
});

test('secondary motion layer: MENU yields and idle stops without editing the approved rules', () => {
  assert.match(svg, /-open \*\):is\(\.menu-open, \.menu-open \*\):not\(\.rolling, \.rolling \*\):not\(\.blind-descending, \.blind-descending \*\) #r4h-menu-glint\{transform:none;animation:none;/);
  assert.match(svg, /#r4h-root\.is-idle:is\([^{]*-open \*\) #r4h-menu-ear > #r4h-idle-ear\{animation:none\}/);
});

test('secondary motion layer: every new id, keyframe and custom property is r4h- namespaced', () => {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) assert.match(id, /^r4h-/, id);
  for (const [, name] of svg.matchAll(/@keyframes ([\w-]+)/g)) assert.match(name, /^r4h-/, name);
  for (const [, name] of svg.matchAll(/(--[\w-]+)\s*:/g)) assert.ok(['--glance-x', '--glance-y', '--ear-rot'].includes(name) || name.startsWith('--r4h-'), name);
  assert.doesNotMatch(svg, /<script/i);
});


test('shell exposes secondary surfaces to the mark in Motion Board priority, on <html> only', () => {
  const order = [...source.matchAll(/\{ cls: '([a-z-]+)', id: '([A-Za-z0-9]+)' \}/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(order, [
    'replay-open:replayInspectionOverlay',
    'topology-open:trailTopologyOverlay',
    'branch-open:r4mBranchSheet',
    'trail-open:trailLedgerOverlay',
    'history-open:historyOverlay',
  ]);
  const block = source.slice(source.indexOf('// ── Secondary mark states'), source.indexOf('function buildShell()'));
  // state is read from the surfaces themselves, never inferred from taps
  assert.match(block, /getAttribute\('aria-hidden'\) === 'false'/);
  assert.match(block, /markSurfaceObserver\.observe\(el, \{ attributes: true, attributeFilter: \['aria-hidden', 'hidden', 'style'\] \}\)/);
  // one element carries the classes: the same ancestor as .menu-open / .rolling
  assert.doesNotMatch(block.replace(/var root = document\.documentElement;/g, ''), /classList\.(?:add|remove|toggle)\((?!next|markSecondary|'copy-trail')/);
  assert.match(block, /var root = document\.documentElement;/);
  // JS exposes state only: no transforms, styles, animations or SVG access
  const code = block.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /\.style\.[a-zA-Z]+\s*=(?!=)|setAttribute|transform|animate\(|getAnimations|r4h-/);
});

test('shell peer switch passes through canonical and COPY TRAIL is a short event class', () => {
  const block = source.slice(source.indexOf('// ── Secondary mark states'), source.indexOf('function buildShell()'));
  const settle = Number((block.match(/var MARK_SECONDARY_RETURN_MS = (\d+);/) || [])[1]);
  const copy = Number((block.match(/var MARK_COPY_MS = (\d+);/) || [])[1]);
  const svgSrc = fs.readFileSync('r4b1t-h0l3-production.svg', 'utf8');
  // canonical-return contract: the settle equals the SVG's longest act/copy return
  // (duration + delay of every base return transition), derived from the SVG itself
  const returns = [...svgSrc.matchAll(/^#r4h-root #(r4h-(?:act|copy)-[a-z-]+)\{transition:([^}]+)\}$/gm)];
  assert.ok(returns.length >= 15, `found ${returns.length} return rules`);
  const ends = returns.map(([, id, decl]) => {
    const times = [...decl.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)].map(([, n, u]) => Number(n) * (u === 's' ? 1000 : 1));
    return { id, end: times[0] + (times[1] || 0) };
  });
  const longest = Math.max(...ends.map((e) => e.end));
  assert.equal(settle, longest, `MARK_SECONDARY_RETURN_MS must equal the SVG's longest return (${JSON.stringify(ends.filter((e) => e.end === longest))})`);
  assert.match(svgSrc, /Canonical-return contract: 380ms after a secondary class is removed/);
  assert.match(source, /Canonical-return contract with r4b1t-h0l3-production\.svg/);
  // copy lives at least as long as the SVG one-shot, and is removed on a timer
  assert.match(svgSrc, /r4h-copy-reach-left 420ms/);
  assert.ok(copy >= 420 && copy < 800, `copy ${copy}`);
  assert.match(block, /root\.classList\.remove\(markSecondary\);[\s\S]*markSecondarySettleUntil = prefersReducedMotion\(\) \? 0 : Date\.now\(\) \+ MARK_SECONDARY_RETURN_MS/);
  assert.match(block, /markCopyTimer = window\.setTimeout\(function \(\) \{[\s\S]*root\.classList\.remove\('copy-trail'\);[\s\S]*MARK_COPY_MS\)/);
  assert.match(source, /if \(action === 'copy-trail'\) \{\s*if \(call\('shareTrail'\)\) pulseMarkCopy\(\);/);
});

test('ROLL and BLIND entries close shell sheets before the mark takes the stage', () => {
  assert.match(source, /function runRollTransition\(kind\) \{\s*\/\/[^\n]*\n\s*closeSheets\(\);/);
  assert.match(source, /action === 'blind-descent'[\s\S]*?closeSheets\(\);\s*document\.documentElement\.classList\.add\('blind-descending'\)/);
});
