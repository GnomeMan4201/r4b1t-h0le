'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { STATES, createRollMotionMachine } = require('../roll-motion-machine.js');

const reel = fs.readFileSync('roll-reel.js', 'utf8');
const reelCss = fs.readFileSync('roll-reel.css', 'utf8');
const production = fs.readFileSync('roll-production-integration.js', 'utf8');
const shell = fs.readFileSync('dual-shell.js', 'utf8');
const trail = fs.readFileSync('trail-runtime.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const svg = fs.readFileSync('r4b1t-h0l3-production.svg', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const jobs = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++;
      jobs.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id) { jobs.delete(id); },
    tick(ms = 0) {
      const end = now + ms;
      for (;;) {
        const due = [...jobs.entries()]
          .filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        jobs.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    }
  };
}

function releasedMachine() {
  const clock = fakeClock();
  const reveals = [];
  const machine = createRollMotionMachine({
    clock,
    onRevealBoundary: event => reveals.push(event)
  });
  assert.equal(machine.pointerDown(), true);
  clock.tick(0);
  assert.equal(machine.pointerUp(), true);
  return { machine, clock, reveals };
}

test('REEL is behind one default-on feature flag and flag-off retains the legacy click path', () => {
  assert.match(reel, /R4B1T_ROLL_REEL_ENABLED !== false/);
  assert.match(shell, /window\.R4B1T_ROLL_REEL_ENABLED !== false/);
  assert.match(shell, /if \(rollButton\) rollButton\.addEventListener\('click'/);
  assert.match(reel, /function suppressClick\(event\) \{\s*if \(!enabled\(\)\) return;[\s\S]*if \(suppressGestureClick\)[\s\S]*quickRoll\(\)/);
});

test('selection and disclosure remain authoritative: commit precedes reel prepare and commitAck', () => {
  const commit = production.indexOf("root.__r4b1tCommitRoll");
  const prepare = production.indexOf("requestedReel.reel.prepare");
  const ack = production.indexOf("machine.commitAck");
  assert.ok(commit >= 0 && prepare > commit && ack > prepare);
  assert.match(production, /onRevealBoundary:\s*function \(event\) \{\s*disclosure\.reveal\(event\)/);
});

test('the exact eligible pool used by selection is only carried downstream for presentation', () => {
  assert.match(index, /eligiblePool:Object\.freeze\(e\.slice\(\)\)/);
  assert.match(trail, /eligiblePool:\s*Array\.isArray\(result\.eligiblePool\)/);
  assert.match(reel, /targetIndex = pool\.indexOf\(options\.result\.url\)/);
  assert.doesNotMatch(reel, /__r4b1tCommitRoll|eligiblePool\([^)]*rng|crypto\.getRandomValues/);
});

test('landing row is bound to the already selected result, never re-picked', () => {
  assert.match(reel, /ui\.dataset\.landedUrl = spin\.result\.url/);
  assert.match(reel, /spin\.position = spin\.to;[\s\S]*drawRows\(spin\.position, 0\)/);
  assert.match(reel, /var to = reduced\(\) \? targetIndex : loops \* pool\.length \+ targetIndex/);
});

test('reel mechanics include wind meter, minimum tap charge, slam, detents and overshoot', () => {
  assert.match(reel, /var MIN_CHARGE = 0\.22/);
  assert.match(reel, /for \(var i = 0; i < 10; i \+= 1\)/);
  assert.match(reel, /OVERSHOOT_ROWS = 0\.26/);
  assert.match(reel, /HIT_STOP_MS = 76/);
  assert.match(reel, /function detent\(speed\)/);
  assert.match(reel, /function requestSlam/);
  assert.match(reel, /function onReelPointerDown\(event\)/);
  assert.match(reel, /ui\.addEventListener\('pointerdown', onReelPointerDown\)/);
  assert.match(reel, /event\.key !== 'Escape'/);
});

test('reduced motion resolves without strip travel and keeps the reveal short', () => {
  assert.match(reel, /accelerate: 0,[\s\S]*decelerate: 0,[\s\S]*lockHold: 70,[\s\S]*cardEnter: 130/);
  assert.match(reelCss, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(reelCss, /filter:none!important/);
});

test('sound is synthesized, default off, persisted defensively, and cleaned up', () => {
  assert.match(reel, /localStorage\.getItem\(SOUND_KEY\) === '1'/);
  assert.match(reel, /new AudioContext\(\)/);
  assert.match(reel, /localStorage\.setItem\(SOUND_KEY/);
  assert.match(reel, /function trackChain\(source, nodes\)/);
  assert.match(reel, /audioNodes\.forEach/);
  assert.match(reel, /audio\.close\(\)/);
  assert.match(reel, /removeEventListener\('keydown', onGlobalKeyDown, true\)/);
  assert.match(reel, /cancelAnimationFrame\(reelFrame\)/);
});

test('keyboard hold-to-wind and pointer gestures are attached to the focused ROLL control', () => {
  assert.match(reel, /button\.addEventListener\('keydown', onKeyDown\)/);
  assert.match(reel, /button\.addEventListener\('keyup', onKeyUp\)/);
  assert.match(reel, /button\.addEventListener\('pointerdown', onPointerDown\)/);
  assert.match(reel, /button\.addEventListener\('pointerup', onPointerUp\)/);
  assert.match(reel, /button\.classList\.add\('r4m-reel-winding'\)/);
  assert.match(reelCss, /#r4mRoll \.r4m-ap-label/);
  assert.match(reelCss, /var\(--r4m-reel-charge\)/);
  assert.match(reelCss, /#r4mRoll\.r4m-reel-release \.r4m-ap-label/);
  assert.match(reelCss, /-webkit-user-select:none/);
  assert.match(reelCss, /-webkit-touch-callout:none/);
});

test('closing an already-closed mobile sheet does not animate it onscreen', () => {
  assert.match(shell, /var wasOpen = sheet\.classList\.contains\('open'\) \|\| sheet\.classList\.contains\('sheet-open'\)/);
  assert.match(shell, /sheet\.classList\.toggle\('sheet-close', wasOpen\)/);
});

test('rabbit ROLL animation definition and trigger remain the canonical 1000ms sequence', () => {
  assert.match(svg, /@keyframes r4h-roll-rabbit\{[\s\S]*31% \{transform:translate\(0,480px\)[\s\S]*34% \{transform:translate\(0,640px\)[\s\S]*90%,100% \{transform:none\}/);
  assert.match(svg, /#r4h-roll-rabbit\{animation:r4h-roll-rabbit 1000ms linear 0ms 1 none\}/);
  assert.match(shell, /var MARK_ROLL_MS = 1050/);
  assert.match(shell, /function rearmProductionMarkRollIfActive\(\)[\s\S]*markRollActive[\s\S]*clearProductionMarkRollWatch\(\)[\s\S]*classList\.remove\('rolling', 'result-ready'\)[\s\S]*return startProductionMarkRoll\(\)/);
  assert.match(production, /__r4b1tRearmProductionMarkRollIfActive/);
  assert.doesNotMatch(reel, /r4h-roll-rabbit|MARK_ROLL_MS/);
});

test('reel assets load before production integration and are offline-cached', () => {
  const moduleIndex = index.indexOf('<script src="roll-reel.js"></script>');
  const productionIndex = index.indexOf('<script src="roll-production-integration.js"></script>');
  assert.ok(moduleIndex >= 0 && productionIndex > moduleIndex);
  assert.match(index, /<link rel="stylesheet" href="roll-reel\.css">/);
  assert.match(sw, /'\.\/roll-reel\.js'/);
  assert.match(sw, /'\.\/roll-reel\.css'/);
});

test('per-roll presentation timing does not change commit authority', () => {
  const { machine, clock, reveals } = releasedMachine();
  const capability = machine.activeCommitCapability();
  assert.equal(machine.commitAck(capability, {
    accelerate: 80,
    decelerate: 100,
    lockHold: 70,
    cardEnter: 90
  }), true);
  assert.equal(machine.snapshot().state, STATES.STRIP_ACCELERATING);
  clock.tick(79);
  assert.equal(machine.snapshot().state, STATES.STRIP_ACCELERATING);
  clock.tick(1);
  assert.equal(machine.snapshot().state, STATES.STRIP_DECELERATING);
  clock.tick(100);
  assert.equal(machine.snapshot().state, STATES.LOCKED);
  assert.equal(reveals.length, 0);
  clock.tick(69);
  assert.equal(reveals.length, 0);
  clock.tick(1);
  assert.equal(machine.snapshot().state, STATES.CARD_ENTERING);
  assert.equal(reveals.length, 1);
});

test('slam interrupts presentation only and reveals the same committed transaction once', () => {
  const { machine, clock, reveals } = releasedMachine();
  const capability = machine.activeCommitCapability();
  assert.equal(machine.commitAck(capability, {
    accelerate: 200,
    decelerate: 500,
    lockHold: 70,
    cardEnter: 90
  }), true);
  const committed = machine.snapshot().committedTransactionId;
  clock.tick(40);
  assert.equal(machine.slamToLock(), true);
  assert.equal(machine.snapshot().state, STATES.LOCKED);
  assert.equal(machine.snapshot().committedTransactionId, committed);
  assert.equal(machine.slamToLock(), false);
  clock.tick(69);
  assert.equal(reveals.length, 0);
  clock.tick(1);
  assert.equal(reveals.length, 1);
  assert.equal(machine.snapshot().committedTransactionId, committed);
});


test('rabbit mark lifecycle is owned by named animationend with a no-start fallback', () => {
  assert.match(shell, /rabbit\.addEventListener\('animationstart', markRollOnStart\)/);
  assert.match(shell, /rabbit\.addEventListener\('animationend', markRollOnEnd\)/);
  assert.match(shell, /event\.animationName !== 'r4h-roll-rabbit'/);
  assert.match(shell, /if \(!animationStarted\) finishProductionMarkRoll\(\)/);
  assert.match(shell, /MARK_ROLL_MS \+ 300/);
  assert.match(shell, /return startProductionMarkRoll\(\)/);
});


test('REEL presentation retains the Heavy Roll geometry and presentation-only category chips', () => {
  assert.match(reel, /var ROW_HEIGHT = 64/);
  assert.match(reel, /PROTOTYPE_WEIGHT = 0\.6/);
  assert.match(reel, /1\.1 \+ value \* 1\.3/);
  assert.match(reel, /SPRING_K = 380/);
  assert.match(reel, /SPRING_C = 16/);
  assert.match(reel, /className = 'r4m-reel-name'/);
  assert.match(reel, /className = 'r4m-reel-type'/);
  assert.match(reel, /vibrate\(3\)/);
  assert.match(reelCss, /height:192px/);
  assert.match(reelCss, /top:64px/);
  assert.match(reelCss, /border-left:9px solid var\(--r4m-reel-red-hi\)/);
  assert.match(reelCss, /width:min\(208px,calc\(100vw - 48px\)\)/);
  assert.match(production, /r4mResultCategory/);
  assert.doesNotMatch(reel, /loadResourceMetadata|resourceFor\(/);
});


test('completed rabbit run is not retriggered by a longer REEL presentation phase', () => {
  assert.match(shell, /var markRollCompleted = false/);
  assert.match(shell, /markRollCompleted = true;[\s\S]*classList\.remove\('rolling'\)/);
  assert.match(shell, /if \(!rolling\) markRollCompleted = false/);
  assert.match(shell, /rolling && !markRollActive && !markRollCompleted/);
});
