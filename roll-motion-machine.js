(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.R4B1TRollMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    PRESSED: 'PRESSED',
    COMPRESSING: 'COMPRESSING',
    RELEASED: 'RELEASED',
    STRIP_ACCELERATING: 'STRIP_ACCELERATING',
    STRIP_DECELERATING: 'STRIP_DECELERATING',
    LOCKED: 'LOCKED',
    CARD_ENTERING: 'CARD_ENTERING',
    SETTLED: 'SETTLED',
    CANCELLED: 'CANCELLED'
  });

  const DEFAULT_TIMING = Object.freeze({
    pressToCompress: 0,
    accelerate: 150,
    decelerate: 260,
    lockHold: 40,
    cardEnter: 110,
    cancelSettle: 0
  });

  function defaultClock() {
    return {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: id => clearTimeout(id)
    };
  }

  function createRollMotionMachine(options = {}) {
    const clock = options.clock || defaultClock();
    const timing = Object.freeze({ ...DEFAULT_TIMING, ...(options.timing || {}) });
    const onTransition = typeof options.onTransition === 'function' ? options.onTransition : () => {};
    const onRevealBoundary = typeof options.onRevealBoundary === 'function' ? options.onRevealBoundary : () => {};

    let state = STATES.IDLE;
    let active = false;
    let transactionId = 0;
    let committedTransactionId = null;
    let revealFired = false;
    let timer = null;
    const log = [];

    function clearScheduled() {
      if (timer !== null) {
        clock.clearTimeout(timer);
        timer = null;
      }
    }

    function transition(next, cause) {
      const previous = state;
      state = next;
      const entry = Object.freeze({
        from: previous,
        to: next,
        cause,
        at: clock.now(),
        transactionId: active ? transactionId : null
      });
      log.push(entry);
      onTransition(entry, snapshot());
      return entry;
    }

    function schedule(ms, fn) {
      clearScheduled();
      timer = clock.setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    }

    function snapshot() {
      return Object.freeze({
        state,
        active,
        transactionId: active ? transactionId : null,
        committedTransactionId,
        revealFired
      });
    }

    function pointerDown() {
      if (active || (state !== STATES.IDLE && state !== STATES.SETTLED)) return false;
      clearScheduled();
      active = true;
      transactionId += 1;
      committedTransactionId = null;
      revealFired = false;
      transition(STATES.PRESSED, 'pointerdown');
      schedule(timing.pressToCompress, () => {
        if (state === STATES.PRESSED) transition(STATES.COMPRESSING, 'internal:compress');
      });
      return true;
    }

    function pointerUp() {
      if (state !== STATES.COMPRESSING) return false;
      transition(STATES.RELEASED, 'pointerup');
      return true;
    }

    function commitAck() {
      if (state !== STATES.RELEASED || committedTransactionId !== null) return false;
      committedTransactionId = transactionId;
      transition(STATES.STRIP_ACCELERATING, 'commit:ack');
      schedule(timing.accelerate, () => {
        if (state !== STATES.STRIP_ACCELERATING) return;
        transition(STATES.STRIP_DECELERATING, 'internal:accelerated');
        schedule(timing.decelerate, () => {
          if (state !== STATES.STRIP_DECELERATING) return;
          transition(STATES.LOCKED, 'internal:locked');
          schedule(timing.lockHold, crossRevealBoundary);
        });
      });
      return true;
    }

    function commitFailed() {
      if (state !== STATES.RELEASED) return false;
      cancel('commit:failed');
      return true;
    }

    function crossRevealBoundary() {
      if (state !== STATES.LOCKED || revealFired) return false;
      revealFired = true;
      onRevealBoundary(Object.freeze({ transactionId, at: clock.now() }), snapshot());
      transition(STATES.CARD_ENTERING, 'internal:reveal-boundary');
      schedule(timing.cardEnter, () => {
        if (state !== STATES.CARD_ENTERING) return;
        transition(STATES.SETTLED, 'internal:card-settled');
        active = false;
      });
      return true;
    }

    function pointerCancel() {
      if (state !== STATES.PRESSED && state !== STATES.COMPRESSING) return false;
      clearScheduled();
      transition(STATES.IDLE, 'pointercancel');
      active = false;
      return true;
    }

    function cancel(reason = 'navigation/reset') {
      const postRelease = [
        STATES.RELEASED,
        STATES.STRIP_ACCELERATING,
        STATES.STRIP_DECELERATING,
        STATES.LOCKED,
        STATES.CARD_ENTERING
      ];
      if (!postRelease.includes(state)) return false;
      clearScheduled();
      transition(STATES.CANCELLED, reason);
      schedule(timing.cancelSettle, () => {
        if (state !== STATES.CANCELLED) return;
        transition(STATES.IDLE, 'internal:cancel-settled');
        active = false;
      });
      return true;
    }

    function presentationComplete() {
      // A renderer may report its own completion, but that report carries no
      // state or disclosure authority. Machine timing remains authoritative.
      return false;
    }

    return Object.freeze({
      states: STATES,
      timing,
      snapshot,
      transitionLog: () => log.slice(),
      pointerDown,
      pointerUp,
      pointerCancel,
      commitAck,
      commitFailed,
      cancel,
      presentationComplete
    });
  }

  return Object.freeze({ STATES, DEFAULT_TIMING, createRollMotionMachine });
});
