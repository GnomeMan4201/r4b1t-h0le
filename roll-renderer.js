(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.R4B1TRollRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FULL = Object.freeze({
    press: 88,
    release: 122,
    accelerate: 150,
    decelerate: 260,
    seat: 40,
    card: 110
  });
  const REDUCED = Object.freeze({
    press: 70,
    release: 80,
    accelerate: 0,
    decelerate: 0,
    seat: 45,
    card: 90
  });

  function profile(reduced) {
    const t = reduced ? REDUCED : FULL;
    return Object.freeze({
      reduced: !!reduced,
      timing: t,
      totalAfterRelease: t.release + t.accelerate + t.decelerate + t.seat + t.card
    });
  }

  function createRollRenderer(options = {}) {
    const button = options.button;
    const strip = options.strip;
    const routeHost = options.routeHost;
    const matchMedia = options.matchMedia || (typeof window !== 'undefined' ? window.matchMedia.bind(window) : null);
    if (!button || !button.classList) throw new TypeError('ROLL renderer requires button');
    if (!strip || !strip.classList) throw new TypeError('ROLL renderer requires strip');
    if (!routeHost || !routeHost.classList) throw new TypeError('ROLL renderer requires routeHost');

    let active = false;
    let timers = [];
    const reduce = () => !!(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const later = (fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    };
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const clearClasses = () => {
      ['roll-press','roll-release','roll-accelerate','roll-decelerate','roll-seat','roll-reduced'].forEach(c=>button.classList.remove(c));
      ['roll-strip-accelerate','roll-strip-decelerate','roll-strip-seat','roll-strip-reduced'].forEach(c=>strip.classList.remove(c));
      routeHost.classList.remove('roll-card-enter','roll-card-reduced');
      button.removeAttribute('aria-busy');
    };

    function press() {
      if (active) return false;
      active = true;
      const p = profile(reduce());
      button.classList.add(p.reduced ? 'roll-reduced' : 'roll-press');
      button.setAttribute('aria-busy','true');
      return true;
    }

    function release() {
      if (!active) return false;
      const p = profile(reduce());
      button.classList.remove('roll-press');
      button.classList.add(p.reduced ? 'roll-reduced' : 'roll-release');
      if (p.reduced) {
        strip.classList.add('roll-strip-reduced');
        later(()=>routeHost.classList.add('roll-card-reduced'), p.timing.seat);
        later(settle, p.timing.seat + p.timing.card);
        return true;
      }
      let at = p.timing.release;
      later(()=>{ button.classList.add('roll-accelerate'); strip.classList.add('roll-strip-accelerate'); }, at);
      at += p.timing.accelerate;
      later(()=>{ button.classList.remove('roll-accelerate'); button.classList.add('roll-decelerate'); strip.classList.remove('roll-strip-accelerate'); strip.classList.add('roll-strip-decelerate'); }, at);
      at += p.timing.decelerate;
      later(()=>{ button.classList.remove('roll-decelerate'); button.classList.add('roll-seat'); strip.classList.remove('roll-strip-decelerate'); strip.classList.add('roll-strip-seat'); }, at);
      at += p.timing.seat;
      later(()=>routeHost.classList.add('roll-card-enter'), at);
      later(settle, at + p.timing.card);
      return true;
    }

    function cancel() {
      clearTimers(); clearClasses(); active = false; return true;
    }
    function settle() {
      clearTimers(); clearClasses(); active = false; return true;
    }
    return Object.freeze({ press, release, cancel, settle, isActive:()=>active, profile:()=>profile(reduce()) });
  }

  return Object.freeze({ FULL, REDUCED, profile, createRollRenderer });
});
