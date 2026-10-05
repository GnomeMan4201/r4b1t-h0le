(function (root) {
  'use strict';

  var machine = null;
  var renderer = null;
  var disclosure = null;
  var pendingIntent = false;
  var commitPending = false;

  function byId(id) { return document.getElementById(id); }

  function routeMarkup(result) {
    var section = document.createElement('section');
    section.className = 'r4m-route';
    section.id = 'r4mRoute';
    var authoritySequence = result && Number.isSafeInteger(result.authoritySequence) ? result.authoritySequence : null;
    var drawLabel = authoritySequence === null ? 'DRAW —' : 'DRAW ' + String(authoritySequence).padStart(4, '0');
    section.innerHTML =
      '<div class="r4m-route-kicker">SELECTED / COMMITTED</div>' +
      '<div class="r4m-route-top"><span>ROUTE / <b id="r4mRouteNo">001</b></span><em id="r4mDrawSequence">' + drawLabel + '</em><strong id="r4mTag" hidden></strong></div>' +
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
        '<button type="button" data-mobile-action="previous">← PREVIOUS</button>' +
        '<button type="button" data-mobile-action="keep">KEEP CARD</button>' +
        '<button type="button" data-mobile-action="inspect">INSPECT</button>' +
        '<button type="button" data-mobile-action="forward">FORWARD →</button>' +
      '</div>' +
      '<button class="r4m-next" type="button" data-mobile-action="next"><span class="r4m-next-aperture" data-aperture-role="selection" aria-hidden="true"><i class="r4m-ap-depth-ring"></i></span><span>ROLL AGAIN</span></button>';
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
        return Object.freeze({ element: routeMarkup(result), result: result });
      },
      mountNode: function (payload) {
        mount.replaceChildren(payload.element);
        if (typeof root.__r4b1tRevealRoll === 'function') root.__r4b1tRevealRoll(payload.result);
        if (root.R4B1TRollAuthority && typeof root.R4B1TRollAuthority.markRevealed === 'function') {
          root.R4B1TRollAuthority.markRevealed(payload.result).catch(function (error) {
            console.error('[r4b1t] reveal completion failed:', error);
          });
        }
        payload.element.hidden = false;
        mount.classList.add('roll-disclosed');
        root.requestAnimationFrame(function () {
          if (typeof root.__r4b1tSyncMobileRoute === 'function') root.__r4b1tSyncMobileRoute();
          syncAuthorityControls({ authoritySequence: payload.result.authoritySequence });
        });
      }
    });

    machine = motionApi.createRollMotionMachine({
      onTransition: function (entry) {
        if (renderer) renderer.renderState(entry.to);
        if (typeof root.__r4b1tProjectRollPresentation === 'function') {
          root.__r4b1tProjectRollPresentation(entry.to);
        }
        if (entry.to === 'SETTLED' && pendingIntent) {
          pendingIntent = false;
          root.setTimeout(function () { roll(); }, 0);
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

  function syncAuthorityControls(detail) {
    var authority = root.R4B1TRollAuthority;
    var marker = byId('r4mDrawSequence');
    if (marker && detail && Number.isSafeInteger(detail.authoritySequence)) {
      marker.textContent = 'DRAW ' + String(detail.authoritySequence).padStart(4, '0');
    }
    var previous = document.querySelector('[data-mobile-action="previous"]');
    var forward = document.querySelector('[data-mobile-action="forward"]');
    if (previous && authority && typeof authority.canPrevious === 'function') previous.disabled = !authority.canPrevious();
    if (forward && authority && typeof authority.canForward === 'function') forward.disabled = !authority.canForward();
  }

  function clearVisibleResult() {
    var mount = byId('r4mRouteMount');
    if (!mount) return;
    mount.classList.remove('roll-disclosed', 'roll-card-enter', 'roll-card-reduced');
    mount.replaceChildren();
  }

  function showHistory(result) {
    if (!result || !result.url || !setup()) return false;
    pendingIntent = false;
    clearVisibleResult();
    var mount = byId('r4mRouteMount');
    if (!mount) return false;
    var node = routeMarkup(result);
    mount.replaceChildren(node);
    node.hidden = false;
    mount.classList.add('roll-disclosed');
    root.requestAnimationFrame(function () {
      if (typeof root.__r4b1tSyncMobileRoute === 'function') root.__r4b1tSyncMobileRoute();
    });
    return true;
  }

  function roll() {
    if (!setup()) return false;
    if (machine.snapshot().active || renderer.isActive() || commitPending) {
      pendingIntent = true;
      return true;
    }

    clearVisibleResult();
    if (!machine.pointerDown()) return false;
    window.setTimeout(function () {
      if (!machine.pointerUp()) {
        renderer.cancel();
        return;
      }

      commitPending = true;
      var authority = root.R4B1TRollAuthority;
      var commitment = authority && typeof authority.commit === 'function'
        ? authority.commit()
        : Promise.resolve(typeof root.__r4b1tCommitRoll === 'function' ? root.__r4b1tCommitRoll() : null);

      Promise.resolve(commitment).then(function (result) {
        commitPending = false;
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

        if (!machine.commitAck(capability)) {
          disclosure.cancel(transactionId);
          renderer.cancel();
        }
      }).catch(function (error) {
        commitPending = false;
        console.error('[r4b1t] durable ROLL failed:', error);
        machine.commitFailed();
        renderer.cancel();
      });
    }, 0);
    return true;
  }

  function cancelPendingIntent() {
    pendingIntent = false;
    return true;
  }

  function cancel(reason) {
    pendingIntent = false;
    if (!machine) return false;
    var snap = machine.snapshot();
    if (snap.transactionId != null && disclosure) disclosure.cancel(snap.transactionId);
    machine.cancel(reason || 'navigation/reset');
    if (renderer) renderer.cancel();
    return true;
  }

  document.addEventListener('r4b1t:authority-visible', function (event) {
    syncAuthorityControls(event && event.detail);
  });
  document.addEventListener('r4b1t:reset', function () { cancel('reset'); });
  window.addEventListener('pagehide', function () { cancel('navigation'); });

  root.R4B1TRollProduction = Object.freeze({
    roll: roll,
    cancel: cancel,
    cancelPendingIntent: cancelPendingIntent,
    showHistory: showHistory,
    snapshot: function () {
      var snapshot = machine ? machine.snapshot() : null;
      if (!snapshot) return null;
      return Object.assign({}, snapshot, {
        commitPending: commitPending,
        pendingIntent: pendingIntent
      });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
