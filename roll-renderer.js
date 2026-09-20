(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.R4B1TRollRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Press/release are local visual gestures. Lifecycle phase durations come
  // exclusively from the motion machine and are projected to CSS once at init.
  const GESTURE = Object.freeze({ press: 88, release: 122 });
  const REDUCED = Object.freeze({ press: 70, release: 80 });

  function createRollRenderer(options = {}) {
    const button = options.button;
    const strip = options.strip;
    const routeHost = options.routeHost;
    const timing = options.timing;
    const matchMedia = options.matchMedia || (typeof window !== 'undefined' ? window.matchMedia.bind(window) : null);
    if (!button || !button.classList) throw new TypeError('ROLL renderer requires button');
    if (!strip || !strip.classList) throw new TypeError('ROLL renderer requires strip');
    if (!routeHost || !routeHost.classList) throw new TypeError('ROLL renderer requires routeHost');
    if (!timing || !Number.isFinite(timing.accelerate) || !Number.isFinite(timing.decelerate) ||
        !Number.isFinite(timing.lockHold) || !Number.isFinite(timing.cardEnter)) {
      throw new TypeError('ROLL renderer requires authoritative machine timing');
    }

    const authoritativeTiming = Object.freeze({
      accelerate: timing.accelerate,
      decelerate: timing.decelerate,
      lockHold: timing.lockHold,
      cardEnter: timing.cardEnter
    });
    const reduce = () => !!(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Init-only projection. CSS consumes these values; neither CSS nor the
    // renderer rewrites them during a transaction.
    const timingProps = Object.freeze({
      '--roll-accelerate-ms': authoritativeTiming.accelerate + 'ms',
      '--roll-decelerate-ms': authoritativeTiming.decelerate + 'ms',
      '--roll-lock-hold-ms': authoritativeTiming.lockHold + 'ms',
      '--roll-card-enter-ms': authoritativeTiming.cardEnter + 'ms'
    });
    [button, strip, routeHost].forEach(element => {
      if (!element.style || typeof element.style.setProperty !== 'function') return;
      Object.entries(timingProps).forEach(([name, value]) => element.style.setProperty(name, value));
    });

    let active = false;
    const clearClasses = () => {
      ['roll-press','roll-release','roll-accelerate','roll-decelerate','roll-seat','roll-reduced'].forEach(c=>button.classList.remove(c));
      ['roll-strip-accelerate','roll-strip-decelerate','roll-strip-seat','roll-strip-reduced'].forEach(c=>strip.classList.remove(c));
      routeHost.classList.remove('roll-card-enter','roll-card-reduced');
      button.removeAttribute('aria-busy');
    };

    function renderState(state) {
      const reduced = reduce();
      switch (state) {
        case 'PRESSED':
        case 'COMPRESSING':
          if (!active) {
            active = true;
            button.setAttribute('aria-busy','true');
          }
          button.classList.add(reduced ? 'roll-reduced' : 'roll-press');
          return true;
        case 'RELEASED':
          button.classList.remove('roll-press');
          button.classList.add(reduced ? 'roll-reduced' : 'roll-release');
          if (reduced) strip.classList.add('roll-strip-reduced');
          return true;
        case 'STRIP_ACCELERATING':
          if (!reduced) {
            button.classList.add('roll-accelerate');
            strip.classList.add('roll-strip-accelerate');
          }
          return true;
        case 'STRIP_DECELERATING':
          button.classList.remove('roll-accelerate');
          strip.classList.remove('roll-strip-accelerate');
          if (!reduced) {
            button.classList.add('roll-decelerate');
            strip.classList.add('roll-strip-decelerate');
          }
          return true;
        case 'LOCKED':
          button.classList.remove('roll-decelerate');
          strip.classList.remove('roll-strip-decelerate');
          if (!reduced) {
            button.classList.add('roll-seat');
            strip.classList.add('roll-strip-seat');
          }
          return true;
        case 'CARD_ENTERING':
          routeHost.classList.add(reduced ? 'roll-card-reduced' : 'roll-card-enter');
          return true;
        case 'SETTLED':
        case 'CANCELLED':
        case 'IDLE':
          clearClasses();
          active = false;
          return true;
        default:
          return false;
      }
    }

    function cancel() { clearClasses(); active = false; return true; }
    function settle() { clearClasses(); active = false; return true; }

    return Object.freeze({
      renderState,
      cancel,
      settle,
      isActive:()=>active,
      timing:()=>authoritativeTiming,
      timingProps:()=>timingProps
    });
  }

  return Object.freeze({ GESTURE, REDUCED, createRollRenderer });
});
