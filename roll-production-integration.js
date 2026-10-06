(function (root) {
  'use strict';

  var machine = null;
  var renderer = null;
  var disclosure = null;
  var reelActive = false;

  function byId(id) { return document.getElementById(id); }

  function routeMarkup() {
    var section = document.createElement('section');
    section.className = 'r4m-route';
    section.id = 'r4mRoute';
    section.innerHTML =
      '<div class="r4m-route-kicker">SELECTED / COMMITTED</div>' +
      '<div class="r4m-route-top"><span>ROUTE / <b id="r4mRouteNo">001</b></span><strong id="r4mTag" hidden></strong></div>' +
      '<div class="r4m-route-label">RANDOM CYBERSECURITY RESOURCE</div>' +
      '<div class="r4m-route-proof" id="r4mTypedMeta" hidden><strong id="r4mResourceType"></strong></div>' +
      '<small id="r4mProtocol" hidden></small>' +
      '<h2 id="r4mTitle"></h2>' +
      '<div class="r4m-route-domain" id="r4mDomain"></div>' +
      '<span class="r4m-route-mouth" aria-hidden="true"></span>' +
      '<p id="r4mDescription" hidden></p>' +
      '<code id="r4mUrl"></code>' +
      '<button class="r4m-enter" type="button" data-mobile-action="visit">OPEN DESTINATION ↗</button>' +
      '<div class="r4m-route-actions">' +
        '<button type="button" data-mobile-action="keep">KEEP CARD</button>' +
        '<button type="button" data-mobile-action="inspect">INSPECT</button>' +
      '</div>' +
      '<button class="r4m-next" type="button" data-mobile-action="next"><span class="r4m-next-aperture" data-aperture-role="selection" aria-hidden="true"><i class="r4m-ap-depth-ring"></i></span><span>ROLL AGAIN</span></button>';
    return section;
  }

  function reelApi() {
    return root.R4B1TRollReel || null;
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
      onTransition: function (entry) {
        if (renderer) renderer.renderState(entry.to);
        if (typeof root.__r4b1tProjectRollPresentation === 'function') {
          root.__r4b1tProjectRollPresentation(entry.to);
        }
        var reel = reelApi();
        if (reelActive && reel && typeof reel.onTransition === 'function') {
          reel.onTransition(entry.to, entry);
        }
        if (entry.to === 'SETTLED' || entry.to === 'CANCELLED' || entry.to === 'IDLE') {
          reelActive = false;
        }
      },
      onRevealBoundary: function (event) {
        disclosure.reveal(event);
      }
    });

    renderer = rendererApi.createRollRenderer({
      button: button,
      strip: strip,
      routeHost: mount,
      timing: machine.timing
    });
    return true;
  }

  function clearVisibleResult() {
    var mount = byId('r4mRouteMount');
    if (!mount) return;
    mount.classList.remove('roll-disclosed', 'roll-card-enter', 'roll-card-reduced');
    mount.replaceChildren();
  }

  function reelRequest(options) {
    if (!options || options.reel !== true) return null;
    if (root.R4B1T_ROLL_REEL_ENABLED === false) return null;
    var reel = reelApi();
    if (!reel || typeof reel.prepare !== 'function') return null;
    return Object.freeze({
      reel: reel,
      charge: Number.isFinite(options.charge) ? options.charge : 0.22
    });
  }

  function roll(options) {
    if (!setup()) return false;
    if (machine.snapshot().active || renderer.isActive()) return false;

    var requestedReel = reelRequest(options);
    clearVisibleResult();
    if (typeof root.__r4b1tRearmProductionMarkRollIfActive === 'function') {
      root.__r4b1tRearmProductionMarkRollIfActive();
    }
    if (!machine.pointerDown()) return false;
    window.setTimeout(function () {
      if (!machine.pointerUp()) {
        renderer.cancel();
        return;
      }

      var result = typeof root.__r4b1tCommitRoll === 'function' ? root.__r4b1tCommitRoll() : null;
      if (!result) {
        machine.commitFailed();
        renderer.cancel();
        if (requestedReel) requestedReel.reel.cancel('commit-failed');
        return;
      }

      var transactionId = machine.snapshot().transactionId;
      var capability = machine.activeCommitCapability();
      if (!disclosure.commit(transactionId, result)) {
        machine.commitFailed();
        renderer.cancel();
        if (requestedReel) requestedReel.reel.cancel('disclosure-commit-failed');
        return;
      }

      var reelPlan = null;
      if (requestedReel) {
        try {
          reelPlan = requestedReel.reel.prepare({
            result: result,
            charge: requestedReel.charge
          });
        } catch (_) {
          reelPlan = null;
        }
        if (!reelPlan && typeof requestedReel.reel.cancel === 'function') {
          requestedReel.reel.cancel('prepare-failed');
        }
      }
      reelActive = Boolean(reelPlan);

      if (!machine.commitAck(capability, reelPlan && reelPlan.timing ? reelPlan.timing : null)) {
        disclosure.cancel(transactionId);
        renderer.cancel();
        if (requestedReel) requestedReel.reel.cancel('commit-ack-failed');
        reelActive = false;
      }
    }, 0);
    return true;
  }

  function slam() {
    if (!machine || !reelActive || typeof machine.slamToLock !== 'function') return false;
    return machine.slamToLock();
  }

  function cancel(reason) {
    var reel = reelApi();
    var reelBusy = reelActive || Boolean(reel && typeof reel.isActive === 'function' && reel.isActive());
    if (reelBusy && reel && typeof reel.cancel === 'function') reel.cancel(reason || 'navigation/reset');
    reelActive = false;
    if (!machine) return false;
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
    slam: slam,
    cancel: cancel,
    snapshot: function () {
      var snap = machine ? machine.snapshot() : null;
      if (!snap) return null;
      return Object.freeze({
        state: snap.state,
        active: snap.active,
        transactionId: snap.transactionId,
        committedTransactionId: snap.committedTransactionId,
        revealFired: snap.revealFired,
        reelActive: reelActive
      });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
