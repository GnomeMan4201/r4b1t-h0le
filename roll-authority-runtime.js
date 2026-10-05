(function (root) {
  'use strict';

  var core = root.R4B1TRollAuthorityCore;
  var ledger = root.R4B1TRollAuthorityLedger;
  if (!core || !ledger) return;

  var HISTORY_KEY = 'r4b1t_roll_navigation_v1';
  var store = null;
  var coordinator = null;
  var historyState = core.history.empty();
  var visibleTerminal = null;
  var initialized = false;
  var initialization = null;

  function transactionId() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    root.crypto.getRandomValues(bytes);
    return Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function loadHistory() {
    try {
      historyState = core.history.normalize(JSON.parse(root.sessionStorage.getItem(HISTORY_KEY) || 'null'));
    } catch (_) {
      historyState = core.history.empty();
    }
  }

  function persistHistory() {
    root.sessionStorage.setItem(HISTORY_KEY, JSON.stringify({
      entries: Array.from(historyState.entries),
      cursor: historyState.cursor
    }));
  }

  function browserState(transactionIdValue, cursor) {
    return {
      r4b1tRollNavigation: true,
      transactionId: transactionIdValue || null,
      cursor: Number.isSafeInteger(cursor) ? cursor : -1
    };
  }

  function syncBrowserBaseline() {
    var currentId = core.history.current(historyState);
    var state = root.history.state;
    if (state && state.r4b1tRollNavigation && state.transactionId === currentId) return;
    root.history.replaceState(browserState(currentId, historyState.cursor), '', root.location.href);
  }

  function notifyVisible(terminal) {
    visibleTerminal = terminal || null;
    try {
      root.document.dispatchEvent(new CustomEvent('r4b1t:authority-visible', {
        detail: terminal ? {
          transactionId: terminal.transactionId,
          authoritySequence: terminal.authoritySequence,
          url: terminal.result && terminal.result.url
        } : null
      }));
    } catch (_) {}
  }

  async function recordRevealed(terminal, options) {
    options = options || {};
    if (!terminal || terminal.state !== 'COMMITTED') return false;
    var currentId = core.history.current(historyState);
    if (currentId !== terminal.transactionId) {
      historyState = core.history.push(historyState, terminal.transactionId);
      persistHistory();
      if (!options.skipBrowserPush) {
        root.history.pushState(
          browserState(terminal.transactionId, historyState.cursor),
          '',
          root.location.href
        );
      }
    }
    notifyVisible(terminal);
    if (store) await store.markProjected(terminal.transactionId);
    return true;
  }

  async function projectTerminal(terminal, context) {
    if (typeof root.__r4b1tProjectAuthorityTerminal !== 'function') {
      throw new Error('TRAIL_AUTHORITY_BRIDGE_UNAVAILABLE');
    }
    var projection = await root.__r4b1tProjectAuthorityTerminal(terminal, context);
    if (context && context.recovered && terminal.state === 'COMMITTED') {
      await recordRevealed(terminal);
    }
    return projection;
  }

  async function init() {
    if (initialized) return true;
    if (initialization) return initialization;
    initialization = (async function () {
      store = ledger.createIndexedDbStore({ indexedDB: root.indexedDB });
      coordinator = ledger.createCoordinator({
        core: core,
        store: store,
        withLock: ledger.createNavigatorLock(root.navigator)
      });

      loadHistory();
      syncBrowserBaseline();

      if (root.navigator.storage && typeof root.navigator.storage.persist === 'function') {
        root.navigator.storage.persist().catch(function () {});
      }

      await coordinator.recover(projectTerminal);
      initialized = true;
      return true;
    }()).catch(function (error) {
      initialization = null;
      throw error;
    });
    return initialization;
  }

  async function commit() {
    await init();
    var terminal = await coordinator.commit(
      function () {
        if (typeof root.__r4b1tPrepareAuthorityRoll !== 'function') {
          throw new Error('TRAIL_AUTHORITY_PREPARE_UNAVAILABLE');
        }
        return root.__r4b1tPrepareAuthorityRoll(transactionId());
      },
      projectTerminal
    );

    if (!terminal || terminal.state !== 'COMMITTED') {
      try {
        root.document.dispatchEvent(new CustomEvent('r4b1t:selection-status', {
          detail: {
            status: terminal && terminal.failure ? terminal.failure.code : 'AUTHORITY_FAILED',
            message: terminal && terminal.failure ? terminal.failure.code.replace(/_/g, ' ') : 'ROLL AUTHORITY FAILED'
          }
        }));
      } catch (_) {}
      return null;
    }

    return Object.freeze({
      url: terminal.result.url,
      transactionId: terminal.transactionId,
      authoritySequence: terminal.authoritySequence
    });
  }

  async function markRevealed(result) {
    if (!result || !result.transactionId) return false;
    await init();
    var terminal = await store.get(result.transactionId);
    if (!terminal || terminal.state !== 'COMMITTED') return false;
    return recordRevealed(terminal);
  }

  function cancelPendingNavigationIntent() {
    var production = root.R4B1TRollProduction;
    if (production && typeof production.cancelPendingIntent === 'function') {
      production.cancelPendingIntent('navigation');
    }
  }

  function previous() {
    cancelPendingNavigationIntent();
    if (!core.history.canPrevious(historyState)) return false;
    root.history.back();
    return true;
  }

  function forward() {
    cancelPendingNavigationIntent();
    if (!core.history.canForward(historyState)) return false;
    root.history.forward();
    return true;
  }

  async function showHistoryTransaction(transactionIdValue, cursor) {
    await init();
    var terminal = await store.get(transactionIdValue);
    if (!terminal || terminal.state !== 'COMMITTED') return false;
    historyState = core.history.normalize({
      entries: Array.from(historyState.entries),
      cursor: cursor
    });
    persistHistory();
    if (typeof root.__r4b1tShowAuthorityTransaction === 'function') {
      await root.__r4b1tShowAuthorityTransaction(terminal);
    }
    notifyVisible(terminal);
    return true;
  }

  root.addEventListener('popstate', function (event) {
    var state = event.state;
    if (!state || !state.r4b1tRollNavigation || !state.transactionId) return;
    var entries = Array.from(historyState.entries);
    var index = entries.indexOf(state.transactionId);
    if (index < 0) return;
    showHistoryTransaction(state.transactionId, index).catch(function (error) {
      console.error('[r4b1t] history restore failed:', error);
    });
  });

  root.document.addEventListener('keydown', function (event) {
    if (event.code !== 'Escape' || event.defaultPrevented) return;
    var target = event.target;
    if (target && target.closest && target.closest('input, textarea, select, [role="dialog"], .r4m-sheet.open')) return;
    if (previous()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  async function immediateRoll() {
    var result = await commit();
    if (!result) return false;
    if (typeof root.__r4b1tRevealRoll !== 'function') return false;
    root.__r4b1tRevealRoll(result);
    await markRevealed(result);
    return true;
  }
  immediateRoll.__r4b1tSeeded = true;
  immediateRoll.__r4b1tAuthorityLedger = true;

  root.R4B1TRollAuthority = Object.freeze({
    init: init,
    commit: commit,
    markRevealed: markRevealed,
    previous: previous,
    forward: forward,
    canPrevious: function () { return core.history.canPrevious(historyState); },
    canForward: function () { return core.history.canForward(historyState); },
    historySnapshot: function () {
      return { entries: Array.from(historyState.entries), cursor: historyState.cursor };
    },
    currentTerminal: function () { return visibleTerminal; },
    store: function () { return store; }
  });

  root.roll = immediateRoll;

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', function () {
      init().catch(function (error) { console.error('[r4b1t] authority init failed:', error); });
    }, { once: true });
  } else {
    init().catch(function (error) { console.error('[r4b1t] authority init failed:', error); });
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
