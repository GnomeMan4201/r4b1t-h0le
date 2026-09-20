(function (root) {
  'use strict';

  var machine = null;
  var renderer = null;
  var disclosure = null;
  var releaseTimer = null;

  function byId(id) { return document.getElementById(id); }

  function routeMarkup() {
    var section = document.createElement('section');
    section.className = 'r4m-route';
    section.id = 'r4mRoute';
    section.innerHTML =
      '<div class="r4m-route-top"><span>ROUTE / <b id="r4mRouteNo">001</b></span><strong id="r4mTag">ROUTE</strong></div>' +
      '<small id="r4mProtocol">https://</small>' +
      '<h2 id="r4mDomain">—</h2>' +
      '<p id="r4mDescription">A route selected from the corpus.</p>' +
      '<code id="r4mUrl">—</code>' +
      '<div class="r4m-route-actions">' +
        '<button type="button" data-mobile-action="sprout">SPROUT ×4</button>' +
        '<button type="button" data-mobile-action="share">SHARE</button>' +
        '<button type="button" data-mobile-action="cut">CUT CARD</button>' +
      '</div>' +
      '<div class="r4m-route-wear" id="r4mRouteWear" aria-label="Persistent route wear"></div>' +
      '<button class="r4m-enter" type="button" data-mobile-action="visit">FOLLOW THE RABBIT ↗</button>' +
      '<button class="r4m-next" type="button" data-mobile-action="next">REJECT / NEXT</button>';
    return section;
  }

  function setup() {
    if (machine && renderer && disclosure) return true;
    var motionApi = root.R4B1TRollMotion;
    var rendererApi = root.R4B1TRollRenderer;
    var disclosureApi = root.R4B1TRollDisclosure;
    var button = byId('r4mRoll');
    var mount = byId('r4mRouteMount');
    if (!motionApi || !rendererApi || !disclosureApi || !button || !mount) return false;

    var strip = button.querySelector('.r4m-roll-strip');
    if (!strip) {
      strip = document.createElement('i');
      strip.className = 'r4m-roll-strip';
      strip.setAttribute('aria-hidden', 'true');
      button.appendChild(strip);
    }

    disclosure = disclosureApi.createRollDisclosureBoundary({
      createNode: function (result) {
        return Object.freeze({ element: routeMarkup(), result: result });
      },
      mountNode: function (payload) {
        mount.replaceChildren(payload.element);
        if (typeof root.__r4b1tRevealRoll === 'function') root.__r4b1tRevealRoll(payload.result);
        payload.element.hidden = false;
        mount.classList.add('roll-disclosed');
        root.requestAnimationFrame(function () {
          if (typeof root.__r4b1tSyncMobileRoute === 'function') root.__r4b1tSyncMobileRoute();
        });
      }
    });

    machine = motionApi.createRollMotionMachine({
      onRevealBoundary: function (event) {
        disclosure.reveal(event);
      }
    });

    renderer = rendererApi.createRollRenderer({
      button: button,
      strip: strip,
      routeHost: mount
    });
    return true;
  }

  function clearVisibleResult() {
    var mount = byId('r4mRouteMount');
    if (!mount) return;
    mount.classList.remove('roll-disclosed', 'roll-card-enter', 'roll-card-reduced');
    mount.replaceChildren();
  }

  function roll() {
    if (!setup()) return false;
    if (machine.snapshot().active || renderer.isActive()) return false;

    clearVisibleResult();
    if (!machine.pointerDown()) return false;
    renderer.press();

    window.setTimeout(function () {
      if (!machine.pointerUp()) {
        renderer.cancel();
        return;
      }

      var result = typeof root.__r4b1tCommitRoll === 'function' ? root.__r4b1tCommitRoll() : null;
      if (!result) {
        machine.commitFailed();
        renderer.cancel();
        return;
      }

      var transactionId = machine.snapshot().transactionId;
      var capability = machine.activeCommitCapability();
      if (!disclosure.commit(transactionId, result)) {
        machine.commitFailed();
        renderer.cancel();
        return;
      }

      renderer.release();
      var releaseMs = renderer.profile().timing.release;
      releaseTimer = window.setTimeout(function () {
        releaseTimer = null;
        if (!machine.commitAck(capability)) {
          disclosure.cancel(transactionId);
          renderer.cancel();
        }
      }, releaseMs);
    }, 0);
    return true;
  }

  function cancel(reason) {
    if (!machine) return false;
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    var snap = machine.snapshot();
    if (snap.transactionId != null && disclosure) disclosure.cancel(snap.transactionId);
    machine.cancel(reason || 'navigation/reset');
    if (renderer) renderer.cancel();
    return true;
  }

  document.addEventListener('r4b1t:reset', function () { cancel('reset'); });
  window.addEventListener('pagehide', function () { cancel('navigation'); });

  root.R4B1TRollProduction = Object.freeze({
    roll: roll,
    cancel: cancel,
    snapshot: function () { return machine ? machine.snapshot() : null; }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
