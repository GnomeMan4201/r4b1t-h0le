'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRollMotionMachine, createRendererFacade, STATES } = require('../roll-motion-machine.js');

function fakeClock() {
  let now = 0, id = 0;
  const q = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) { const n=++id; q.set(n,{at:now+ms,fn}); return n; },
    clearTimeout(n) { q.delete(n); },
    tick(ms=0) {
      const end=now+ms;
      for (;;) {
        const due=[...q.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);
        if (!due.length) break;
        const [n,v]=due[0]; q.delete(n); now=v.at; v.fn();
      }
      now=end;
    }
  };
}
function released() {
  const clock=fakeClock();
  const machine=createRollMotionMachine({clock});
  assert.equal(machine.pointerDown(),true); clock.tick(0);
  assert.equal(machine.pointerUp(),true);
  return {clock,machine};
}

test('active transaction exposes an opaque commit capability', () => {
  const {machine}=released();
  const cap=machine.activeCommitCapability();
  assert.ok(cap);
  assert.equal(Object.isFrozen(cap),true);
  assert.equal(machine.snapshot().state,STATES.RELEASED);
});

test('correct capability authorizes commit exactly once', () => {
  const {machine}=released(); const cap=machine.activeCommitCapability();
  assert.equal(machine.commitAck(cap),true);
  assert.equal(machine.commitAck(cap),false);
  assert.equal(machine.snapshot().state,STATES.STRIP_ACCELERATING);
});

test('foreign capability cannot commit a released transaction', () => {
  const {machine}=released();
  assert.equal(machine.commitAck(Object.freeze({transactionId:machine.snapshot().transactionId})),false);
  assert.equal(machine.snapshot().state,STATES.RELEASED);
  assert.equal(machine.snapshot().committedTransactionId,null);
});

test('stale capability from ROLL A cannot commit ROLL B', () => {
  const clock=fakeClock(); const machine=createRollMotionMachine({clock});
  machine.pointerDown(); clock.tick(0); machine.pointerUp();
  const stale=machine.activeCommitCapability();
  machine.cancel(); clock.tick(0);
  machine.pointerDown(); clock.tick(0); machine.pointerUp();
  const current=machine.activeCommitCapability();
  assert.notEqual(stale,current);
  assert.equal(machine.commitAck(stale),false);
  assert.equal(machine.snapshot().state,STATES.RELEASED);
  assert.equal(machine.snapshot().committedTransactionId,null);
  assert.equal(machine.commitAck(current),true);
});

test('legacy no-argument commit is bound to only the active capability', () => {
  const {machine}=released();
  assert.equal(machine.commitAck(),true);
  assert.equal(machine.commitAck(),false);
});

test('renderer facade is frozen and contains observation only', () => {
  const {machine}=released(); const renderer=createRendererFacade(machine);
  assert.equal(Object.isFrozen(renderer),true);
  assert.deepEqual(Object.keys(renderer).sort(),['presentationComplete','snapshot','transitionLog']);
  for (const forbidden of ['commitAck','commitFailed','cancel','pointerDown','pointerUp','pointerCancel','activeCommitCapability']) {
    assert.equal(forbidden in renderer,false);
  }
});

test('renderer completion cannot commit, reveal, or change state', () => {
  const {machine}=released(); const renderer=createRendererFacade(machine);
  const before=machine.snapshot();
  assert.equal(renderer.presentationComplete(),false);
  assert.deepEqual(machine.snapshot(),before);
});

test('renderer facade does not expose a mutable machine reference', () => {
  const {machine}=released(); const renderer=createRendererFacade(machine);
  for (const value of Object.values(renderer)) assert.notEqual(value,machine);
});

test('repeated activation while ACTIVE cannot create another transaction', () => {
  const {machine}=released(); const id=machine.snapshot().transactionId;
  assert.equal(machine.pointerDown(),false);
  assert.equal(machine.snapshot().transactionId,id);
});

test('post-commit cancellation preserves committed transaction identity', () => {
  const {clock,machine}=released(); const cap=machine.activeCommitCapability();
  machine.commitAck(cap); const committed=machine.snapshot().committedTransactionId;
  machine.cancel(); clock.tick(0);
  assert.equal(machine.snapshot().committedTransactionId,committed);
});

test('pre-commit cancellation leaves no committed transaction', () => {
  const {clock,machine}=released(); machine.cancel(); clock.tick(0);
  assert.equal(machine.snapshot().committedTransactionId,null);
});

test('capability is cleared after cancellation settles', () => {
  const {clock,machine}=released(); machine.cancel(); clock.tick(0);
  assert.equal(machine.activeCommitCapability(),null);
});

test('capability is cleared after successful transaction settles', () => {
  const {clock,machine}=released(); machine.commitAck(machine.activeCommitCapability());
  clock.tick(150+260+40+110);
  assert.equal(machine.snapshot().state,STATES.SETTLED);
  assert.equal(machine.activeCommitCapability(),null);
});

test('route identity is not accepted by commit authority', () => {
  const {machine}=released(); const cap=machine.activeCommitCapability();
  assert.equal(machine.commitAck({capability:cap,route:'https://example.invalid'}),false);
  assert.equal(machine.snapshot().state,STATES.RELEASED);
});

test('removing renderer leaves commit truth unchanged', () => {
  const a=released(), b=released();
  createRendererFacade(a.machine);
  assert.equal(a.machine.commitAck(a.machine.activeCommitCapability()),true);
  assert.equal(b.machine.commitAck(b.machine.activeCommitCapability()),true);
  assert.equal(a.machine.snapshot().committedTransactionId,b.machine.snapshot().committedTransactionId);
  assert.equal(a.machine.snapshot().state,b.machine.snapshot().state);
});
