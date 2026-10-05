(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.installBrowser(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var HISTORY_KEY = 'r4b1t_roll_navigation_v1';

  function defaultIdFactory(root) {
    return function transactionId() {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
      var bytes = new Uint8Array(16);
      root.crypto.getRandomValues(bytes);
      return Array.from(bytes, function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    };
  }

  function createRuntime(options) {
    options = options || {};
    var core = options.core;
    var ledger = options.ledger;
    var store = options.store;
    var withLock = options.withLock;
    var sessionStorage = options.sessionStorage;
    var idFactory = options.idFactory;
    var prepare = options.prepare;
    var project = options.project;
    var show = options.show;

    if (!core || !core.history) throw new TypeError('roll authority core is required');
    if (!ledger || typeof ledger.createCoordinator !== 'function') throw new TypeError('roll authority ledger is required');
    if (!store) throw new TypeError('authority store is required');
    if (typeof withLock !== 'function') throw new TypeError('withLock is required');
    if (!sessionStorage || typeof sessionStorage.getItem !== 'function' || typeof sessionStorage.setItem !== 'function') {
      throw new TypeError('sessionStorage is required');
    }
    if (typeof idFactory !== 'function') throw new TypeError('idFactory is required');
    if (typeof prepare !== 'function') throw new TypeError('prepare is required');
    if (typeof project !== 'function') throw new TypeError('project is required');
    if (typeof show !== 'function') throw new TypeError('show is required');

    var coordinator = ledger.createCoordinator({
      core: core,
      store: store,
      withLock: withLock
    });

    var historyState = core.history.empty();
    var visibleTerminal = null;

    function loadHistory() {
      try {
        historyState = core.history.normalize(JSON.parse(sessionStorage.getItem(HISTORY_KEY) || 'null'));
      } catch (_) {
        historyState = core.history.empty();
      }
    }

    function persistHistory() {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify({
        entries: Array.from(historyState.entries),
        cursor: historyState.cursor
      }));
    }

    function setCurrentTransaction(transactionId) {
      var entries = Array.from(historyState.entries);
      var existing = entries.indexOf(transactionId);
      if (existing >= 0) {
        historyState = core.history.normalize({ entries: entries, cursor: existing });
      } else {
        historyState = core.history.push(historyState, transactionId);
      }
      persistHistory();
      return historyState;
    }

    function presentation(terminal) {
      if (!terminal || terminal.state !== 'COMMITTED' || !terminal.result) return null;
      return Object.freeze({
        url: terminal.result.url,
        transactionId: terminal.transactionId,
        authoritySequence: terminal.authoritySequence
      });
    }

    async function projectTerminal(terminal, context) {
      var projected = await project(terminal, context);
      if (context && context.recovered && terminal && terminal.state === 'COMMITTED') {
        setCurrentTransaction(terminal.transactionId);
        visibleTerminal = terminal;
      }
      return projected;
    }

    async function recover() {
      await coordinator.recover(projectTerminal);
      return true;
    }

    async function commit() {
      var terminal = await coordinator.commit(
        function () { return prepare(idFactory()); },
        projectTerminal
      );
      if (!terminal || terminal.state !== 'COMMITTED') return null;
      return presentation(terminal);
    }

    async function markRevealed(result) {
      if (!result || typeof result.transactionId !== 'string' || !result.transactionId) return false;
      var terminal = await store.get(result.transactionId);
      if (!terminal || terminal.state !== 'COMMITTED') return false;
      await store.markProjected(terminal.transactionId);
      setCurrentTransaction(terminal.transactionId);
      visibleTerminal = terminal;
      return true;
    }

    async function move(nextHistory) {
      var transactionId = core.history.current(nextHistory);
      if (!transactionId) return false;
      var terminal = await store.get(transactionId);
      if (!terminal || terminal.state !== 'COMMITTED') return false;
      historyState = nextHistory;
      persistHistory();
      await show(terminal);
      visibleTerminal = terminal;
      return presentation(terminal);
    }

    async function previous() {
      if (!core.history.canPrevious(historyState)) return false;
      return move(core.history.previous(historyState));
    }

    async function forward() {
      if (!core.history.canForward(historyState)) return false;
      return move(core.history.forward(historyState));
    }

    loadHistory();

    return Object.freeze({
      recover: recover,
      commit: commit,
      markRevealed: markRevealed,
      previous: previous,
      forward: forward,
      canPrevious: function () { return core.history.canPrevious(historyState); },
      canForward: function () { return core.history.canForward(historyState); },
      snapshot: function () {
        return { entries: Array.from(historyState.entries), cursor: historyState.cursor };
      },
      currentTerminal: function () { return visibleTerminal; },
      store: function () { return store; }
    });
  }

  function installBrowser(root) {
    var core = root.R4B1TRollAuthorityCore;
    var ledger = root.R4B1TRollAuthorityLedger;
    if (!core || !ledger) return null;

    var bridgeReady = async function () {
      if (root.__r4b1tTrailAuthorityReady && typeof root.__r4b1tTrailAuthorityReady.then === 'function') {
        await root.__r4b1tTrailAuthorityReady;
      }
      if (typeof root.__r4b1tPrepareAuthorityRoll !== 'function' ||
          typeof root.__r4b1tProjectAuthorityTerminal !== 'function' ||
          typeof root.__r4b1tShowAuthorityTransaction !== 'function') {
        throw new Error('TRAIL_AUTHORITY_BRIDGE_UNAVAILABLE');
      }
    };

    var store = ledger.createIndexedDbStore({ indexedDB: root.indexedDB });
    var runtime = createRuntime({
      core: core,
      ledger: ledger,
      store: store,
      withLock: ledger.createNavigatorLock(root.navigator),
      sessionStorage: root.sessionStorage,
      idFactory: defaultIdFactory(root),
      prepare: async function (transactionId) {
        await bridgeReady();
        return root.__r4b1tPrepareAuthorityRoll(transactionId);
      },
      project: async function (terminal, context) {
        await bridgeReady();
        return root.__r4b1tProjectAuthorityTerminal(terminal, context);
      },
      show: async function (terminal) {
        await bridgeReady();
        await root.__r4b1tShowAuthorityTransaction(terminal);
        if (root.R4B1TRollProduction && typeof root.R4B1TRollProduction.showHistory === 'function') {
          root.R4B1TRollProduction.showHistory(presentationForBrowser(terminal));
        }
      }
    });

    function presentationForBrowser(terminal) {
      return Object.freeze({
        url: terminal.result.url,
        transactionId: terminal.transactionId,
        authoritySequence: terminal.authoritySequence
      });
    }

    function emitNavigationState() {
      try {
        root.document.dispatchEvent(new CustomEvent('r4b1t:authority-navigation', {
          detail: Object.freeze({
            canPrevious: runtime.canPrevious(),
            canForward: runtime.canForward(),
            history: runtime.snapshot()
          })
        }));
      } catch (_) {}
    }

    async function init() {
      await bridgeReady();
      if (root.navigator.storage && typeof root.navigator.storage.persist === 'function') {
        root.navigator.storage.persist().catch(function () {});
      }
      await runtime.recover();
      emitNavigationState();
      return true;
    }

    async function commit() {
      await bridgeReady();
      var result = await runtime.commit();
      if (!result) return null;
      return result;
    }

    async function markRevealed(result) {
      var completed = await runtime.markRevealed(result);
      emitNavigationState();
      return completed;
    }

    async function previous() {
      if (root.R4B1TRollProduction && typeof root.R4B1TRollProduction.cancelPendingIntent === 'function') {
        root.R4B1TRollProduction.cancelPendingIntent();
      }
      var result = await runtime.previous();
      emitNavigationState();
      return result;
    }

    async function forward() {
      if (root.R4B1TRollProduction && typeof root.R4B1TRollProduction.cancelPendingIntent === 'function') {
        root.R4B1TRollProduction.cancelPendingIntent();
      }
      var result = await runtime.forward();
      emitNavigationState();
      return result;
    }

    root.R4B1TRollAuthority = Object.freeze({
      init: init,
      commit: commit,
      markRevealed: markRevealed,
      previous: previous,
      forward: forward,
      canPrevious: runtime.canPrevious,
      canForward: runtime.canForward,
      historySnapshot: runtime.snapshot,
      currentTerminal: runtime.currentTerminal,
      store: runtime.store
    });

    root.document.addEventListener('keydown', function (event) {
      if (event.code !== 'Escape' || event.defaultPrevented) return;
      var target = event.target;
      if (target && target.closest && target.closest('input, textarea, select, [role="dialog"], .r4m-sheet.open')) return;
      if (!runtime.canPrevious()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      previous().catch(function (error) {
        console.error('[r4b1t] previous failed:', error);
      });
    }, true);

    var start = function () {
      init().catch(function (error) {
        console.error('[r4b1t] authority init failed:', error);
      });
    };
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }

    return runtime;
  }

  return Object.freeze({
    HISTORY_KEY: HISTORY_KEY,
    createRuntime: createRuntime,
    installBrowser: installBrowser
  });
});
