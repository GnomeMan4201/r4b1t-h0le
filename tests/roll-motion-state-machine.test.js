const test = require('node:test');
const assert = require('node:assert/strict');
const { STATES, createRollMotionMachine } = require('../roll-motion-machine.js');

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

function machine(opts = {}) {
  const clock = fakeClock();
  const reveals = [];
  const m = createRollMotionMachine({
    clock,
    onRevealBoundary: e => reveals.push(e),
    ...opts
  });
  return { m, clock, reveals };
}

function toCompress(m, clock) {
  assert.equal(m.pointerDown(), true);
  clock.tick(0);
  assert.equal(m.snapshot().state, STATES.COMPRESSING);
}

function toReleased(m, clock) {
  toCompress(m, clock);
  assert.equal(m.pointerUp(), true);
  assert.equal(m.snapshot().state, STATES.RELEASED);
}

function toSettled(m, clock) {
  toReleased(m, clock);
  assert.equal(m.commitAck(), true);
  clock.tick(10_000);
  assert.equal(m.snapshot().state, STATES.SETTLED);
}

test('IDLE -> PRESSED on pointerdown', () => {
  const { m } = machine();
  assert.equal(m.pointerDown(), true);
  assert.equal(m.snapshot().state, STATES.PRESSED);
});

test('PRESSED -> COMPRESSING without external input', () => {
  const { m, clock } = machine();
  m.pointerDown();
  clock.tick(0);
  assert.equal(m.snapshot().state, STATES.COMPRESSING);
});

test('COMPRESSING -> RELEASED on pointerup', () => {
  const { m, clock } = machine();
  toCompress(m, clock);
  m.pointerUp();
  assert.equal(m.snapshot().state, STATES.RELEASED);
});

test('RELEASED cannot start presentation without COMMIT_ACK', () => {
  const { m, clock } = machine();
  toReleased(m, clock);
  clock.tick(10_000);
  assert.equal(m.snapshot().state, STATES.RELEASED);
});

test('COMMIT_ACK gates RELEASED -> STRIP_ACCELERATING and is single-use', () => {
  const { m, clock } = machine();
  toReleased(m, clock);
  assert.equal(m.commitAck(), true);
  assert.equal(m.snapshot().state, STATES.STRIP_ACCELERATING);
  assert.equal(m.commitAck(), false);
});

test('COMMIT_ACK is ignored outside RELEASED', () => {
  const { m } = machine();
  assert.equal(m.commitAck(), false);
  assert.equal(m.snapshot().state, STATES.IDLE);
});

test('strip phases advance deterministically to LOCKED', () => {
  const { m, clock } = machine();
  toReleased(m, clock);
  m.commitAck();
  clock.tick(m.timing.accelerate);
  assert.equal(m.snapshot().state, STATES.STRIP_DECELERATING);
  clock.tick(m.timing.decelerate);
  assert.equal(m.snapshot().state, STATES.LOCKED);
});

test('LOCKED does not reveal until the internal reveal boundary', () => {
  const { m, clock, reveals } = machine();
  toReleased(m, clock);
  m.commitAck();
  clock.tick(m.timing.accelerate + m.timing.decelerate);
  assert.equal(m.snapshot().state, STATES.LOCKED);
  assert.equal(reveals.length, 0);
  clock.tick(m.timing.lockHold);
  assert.equal(m.snapshot().state, STATES.CARD_ENTERING);
  assert.equal(reveals.length, 1);
});

test('CARD_ENTERING -> SETTLED and transaction becomes inactive', () => {
  const { m, clock } = machine();
  toSettled(m, clock);
  assert.equal(m.snapshot().active, false);
});

test('illegal events leave state unchanged and produce no transition effects', () => {
  const { m } = machine();
  const before = m.transitionLog().length;
  assert.equal(m.pointerUp(), false);
  assert.equal(m.pointerCancel(), false);
  assert.equal(m.commitAck(), false);
  assert.equal(m.cancel(), false);
  assert.equal(m.presentationComplete(), false);
  assert.equal(m.snapshot().state, STATES.IDLE);
  assert.equal(m.transitionLog().length, before);
});

test('ACTIVE begins at PRESSED and suppresses repeated activation through CARD_ENTERING', () => {
  const { m, clock } = machine();
  m.pointerDown();
  assert.equal(m.snapshot().active, true);
  assert.equal(m.pointerDown(), false);
  clock.tick(0);
  m.pointerUp();
  assert.equal(m.pointerDown(), false);
  m.commitAck();
  assert.equal(m.pointerDown(), false);
  clock.tick(m.timing.accelerate + m.timing.decelerate + m.timing.lockHold);
  assert.equal(m.snapshot().state, STATES.CARD_ENTERING);
  assert.equal(m.pointerDown(), false);
});

test('new ROLL becomes eligible after SETTLED', () => {
  const { m, clock } = machine();
  toSettled(m, clock);
  assert.equal(m.pointerDown(), true);
  assert.equal(m.snapshot().state, STATES.PRESSED);
  assert.equal(m.snapshot().transactionId, 2);
});

test('PRESSED + pointercancel -> IDLE', () => {
  const { m } = machine();
  m.pointerDown();
  assert.equal(m.pointerCancel(), true);
  assert.equal(m.snapshot().state, STATES.IDLE);
  assert.equal(m.snapshot().active, false);
});

test('COMPRESSING + pointercancel -> IDLE', () => {
  const { m, clock } = machine();
  toCompress(m, clock);
  assert.equal(m.pointerCancel(), true);
  assert.equal(m.snapshot().state, STATES.IDLE);
});

test('post-release cancellation passes CANCELLED -> IDLE without undoing commit identity', () => {
  const { m, clock } = machine();
  toReleased(m, clock);
  m.commitAck();
  const committed = m.snapshot().committedTransactionId;
  assert.equal(m.cancel('navigation'), true);
  assert.equal(m.snapshot().state, STATES.CANCELLED);
  clock.tick(0);
  assert.equal(m.snapshot().state, STATES.IDLE);
  assert.equal(m.snapshot().committedTransactionId, committed);
});

test('failed commit never enters presentation', () => {
  const { m, clock } = machine();
  toReleased(m, clock);
  assert.equal(m.commitFailed(), true);
  clock.tick(0);
  assert.equal(m.snapshot().state, STATES.IDLE);
  assert.equal(m.transitionLog().some(e => e.to === STATES.STRIP_ACCELERATING), false);
});

test('renderer completion carries no LOCKED or reveal authority', () => {
  const { m, clock, reveals } = machine();
  toReleased(m, clock);
  m.commitAck();
  assert.equal(m.presentationComplete(), false);
  assert.equal(m.snapshot().state, STATES.STRIP_ACCELERATING);
  assert.equal(reveals.length, 0);
});

test('early renderer completion cannot advance disclosure', () => {
  const { m, clock, reveals } = machine();
  toReleased(m, clock);
  m.commitAck();
  clock.tick(m.timing.accelerate + m.timing.decelerate);
  assert.equal(m.snapshot().state, STATES.LOCKED);
  assert.equal(m.presentationComplete(), false);
  assert.equal(reveals.length, 0);
  clock.tick(m.timing.lockHold - 1);
  assert.equal(reveals.length, 0);
  clock.tick(1);
  assert.equal(reveals.length, 1);
});

test('disclosure fires on machine schedule when renderer never reports completion', () => {
  const { m, clock, reveals } = machine();
  toReleased(m, clock);
  m.commitAck();
  clock.tick(m.timing.accelerate + m.timing.decelerate + m.timing.lockHold);
  assert.equal(m.snapshot().state, STATES.CARD_ENTERING);
  assert.equal(reveals.length, 1);
});

test('duplicate renderer completion reports cannot double reveal or reschedule disclosure', () => {
  const { m, clock, reveals } = machine();
  toReleased(m, clock);
  m.commitAck();
  clock.tick(m.timing.accelerate + m.timing.decelerate);
  assert.equal(m.snapshot().state, STATES.LOCKED);
  assert.equal(m.presentationComplete(), false);
  assert.equal(m.presentationComplete(), false);
  assert.equal(reveals.length, 0);
  clock.tick(m.timing.lockHold);
  assert.equal(reveals.length, 1);
  assert.equal(m.presentationComplete(), false);
  assert.equal(m.presentationComplete(), false);
  clock.tick(10_000);
  assert.equal(reveals.length, 1);
});

test('REVEAL_BOUNDARY occurs exactly once per completed transaction', () => {
  const { m, clock, reveals } = machine();
  toSettled(m, clock);
  assert.equal(reveals.length, 1);
  clock.tick(10_000);
  m.presentationComplete();
  assert.equal(reveals.length, 1);
});

test('identical input sequences produce identical transition logs and offsets', () => {
  function run() {
    const { m, clock } = machine();
    toSettled(m, clock);
    return m.transitionLog().map(({ from, to, cause, at }) => ({ from, to, cause, at }));
  }
  assert.deepEqual(run(), run());
});

test('route identity cannot influence pre-reveal scheduling because machine accepts no route input', () => {
  const { m } = machine();
  const publicInputs = Object.keys(m).sort();
  assert.equal(publicInputs.includes('route'), false);
  assert.equal(publicInputs.includes('selectedRoute'), false);
  assert.equal(publicInputs.includes('result'), false);
});
