(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.installBrowser(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_HISTORY_KEY = 'r4b1t_roll_navigation_v1';

  function createRuntime(options) {
    options = options || {};
    var core = options.core;
    var ledger = options.ledger;
    var store = options.store;
    var withLock = options.withLock;
    var sessionStorage = options.sessionStorage;
    var historyKey = options.historyKey || DEFAULT_HISTORY_KEY;
    var idFactory = options.idFactory;
    var prepare = options.prepare;
    var project = typeof options.project === 'function' ? options.project : async function () {};
    var show = typeof options.show === 'function' ? options.show : async function () {};

    if (!core || !ledger || !store) throw new TypeError('core, ledger and store are required');
    if (typeof withLock !== 'function') throw new TypeError('withLock is required');
    if (!sessionStorage) throw new TypeError('sessionStorage is required');
    if (typeof idFactory !== 'function') throw new TypeError('idFactory is required');
    if (typeof prepare !== 'function') throw new TypeError('prepare is required');

    var historyState = loadHistory();

    function loadHistory() {
      try {
        return core.history.normalize(JSON.parse(sessionStorage.getItem(historyKey) || 'null'));
      } catch (_) {
        return core.history.empty();
      }
    }

    function persistHistory() {
      sessionStorage.setItem(historyKey, JSON.stringify({
        entries: Array.from(historyState.entries),
        cursor: historyState.cursor
      }));
    }

    function snapshot() {
      return {
        entries: Array.from(historyState.entries),
        cursor: historyState.cursor
      };
    }

    function pushTransaction(transactionId) {
      if (core.history.current(historyState) === transactionId) return false;
      historyState = core.history.push(historyState, transactionId);
      persistHistory();
      return true;
    }

    async function showCurrent() {
      var transactionId = core.history.current(historyState);
      if (!transactionId) return null;
      var terminal = await store.get(transactionId);
      if (!terminal || terminal.state !== 'COMMITTED') return null;
      await show(terminal);
      return terminal;
    }

    async function projectTerminal(terminal, context) {
      var projection = await project(terminal, context);
      if (context && context.recovered && terminal.state === 'COMMITTED') {
        pushTransaction(terminal.transactionId);
        await show(terminal);
      }
      return projection;
    }

    var coordinator = ledger.createCoordinator({
      core: core,
      store: store,
      withLock: withLock,
      boundary: options.boundary
    });

    async function recover() {
      await coordinator.recover(projectTerminal);
      return snapshot();
    }

    async function commit() {
      var id = idFactory();
      var terminal = await coordinator.commit(
        function () { return prepare(id); },
        projectTerminal
      );
      if (!terminal || terminal.state !== 'COMMITTED') return null;
      return Object.freeze({
        url: terminal.result.url,
        transactionId: terminal.transactionId,
        authoritySequence: terminal.authoritySequence
      });
    }

    async function markRevealed(result) {
      if (!result || !result.transactionId) return false;
      var terminal = await store.get(result.transactionId);
      if (!terminal || terminal.state !== 'COMMITTED') return false;
      pushTransaction(terminal.transactionId);
      await store.markProjected(terminal.transactionId);
      return true;
    }

    async function previous() {
      if (!core.history.canPrevious(historyState)) return null;
      historyState = core.history.previous(historyState);
      persistHistory();
      return showCurrent();
    }

    async function forward() {
      if (!core.history.canForward(historyState)) return null;
      historyState = core.history.forward(historyState);
      persistHistory();
      return showCurrent();
    }

    async function navigateTo(transactionId) {
      var entries = Array.from(historyState.entries);
      var cursor = entries.indexOf(transactionId);
      if (cursor < 0) return null;
      historyState = core.history.normalize({ entries: entries, cursor: cursor });
      persistHistory();
      return showCurrent();
    }

    return Object.freeze({
      recover: recover,
      commit: commit,
      markRevealed: markRevealed,
      previous: previous,
      forward: forward,
      navigateTo: navigateTo,
      canPrevious: function () { return core.history.canPrevious(historyState); },
      canForward: function () { return core.history.canForward(historyState); },
      snapshot: snapshot,
      currentTransactionId: function () { return core.history.current(historyState); }
    });
  }

  function installBrowser(root) {
    var core = root.R4B1TRollAuthorityCore;
    var ledger = root.R4B1TRollAuthorityLedger;
    if (!core || !ledger) return null;

    var runtime = null;
    var store = null;
    var initialization = null;
    var visibleTerminal = null;

    function transactionId() {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
      var bytes = new Uint8Array(16);
      root.crypto.getRandomValues(bytes);
      return Array.from(bytes, function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    }

    function browserState(transactionIdValue, cursor) {
      return {
        r4b1tRollNavigation: true,
        transactionId: transactionIdValue || null,
        cursor: Number.isSafeInteger(cursor) ? cursor : -1
      };
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

    async function show(terminal) {
      if (typeof root.__r4b1tShowAuthorityTransaction === 'function') {
        await root.__r4b1tShowAuthorityTransaction(terminal);
      }
      notifyVisible(terminal);
    }

    async function project(terminal, context) {
      if (typeof root.__r4b1tProjectAuthorityTerminal !== 'function') {
        throw new Error('TRAIL_AUTHORITY_BRIDGE_UNAVAILABLE');
      }
      return root.__r4b1tProjectAuthorityTerminal(terminal, context);
    }

    function syncBrowserBaseline() {
      var snap = runtime.snapshot();
      var transactionIdValue = runtime.currentTransactionId();
      var state = root.history.state;
      if (state && state.r4b1tRollNavigation && state.transactionId === transactionIdValue) return;
      root.history.replaceState(browserState(transactionIdValue, snap.cursor), '', root.location.href);
    }

    async function init() {
      if (runtime) return true;
      if (initialization) return initialization;

      initialization = (async function () {
        store = ledger.createIndexedDbStore({ indexedDB: root.indexedDB });
        runtime = createRuntime({
          core: core,
          ledger: ledger,
          store: store,
          withLock: ledger.createNavigatorLock(root.navigator),
          sessionStorage: root.sessionStorage,
          idFactory: transactionId,
          prepare: function (id) {
            if (typeof root.__r4b1tPrepareAuthorityRoll !== 'function') {
              throw new Error('TRAIL_AUTHORITY_PREPARE_UNAVAILABLE');
            }
            return root.__r4b1tPrepareAuthorityRoll(id);
          },
          project: project,
          show: show
        });

        syncBrowserBaseline();

        if (root.navigator.storage && typeof root.navigator.storage.persist === 'function') {
          root.navigator.storage.persist().catch(function () {});
        }

        var before = runtime.currentTransactionId();
        await runtime.recover();
        var after = runtime.currentTransactionId();
        if (after && after !== before) {
          var terminal = await store.get(after);
          if (terminal) notifyVisible(terminal);
          var snap = runtime.snapshot();
          root.history.pushState(browserState(after, snap.cursor), '', root.location.href);
        }
        return true;
      }()).catch(function (error) {
        initialization = null;
        throw error;
      });

      return initialization;
    }

    async function commit() {
      await init();
      var result = await runtime.commit();
      if (!result) {
        try {
          root.document.dispatchEvent(new CustomEvent('r4b1t:selection-status', {
            detail: { status: 'AUTHORITY_FAILED', message: 'ROLL AUTHORITY FAILED' }
          }));
        } catch (_) {}
      }
      return result;
    }

    async function markRevealed(result) {
      await init();
      var before = runtime.currentTransactionId();
      var marked = await runtime.markRevealed(result);
      if (!marked) return false;
      var terminal = await store.get(result.transactionId);
      notifyVisible(terminal);
      if (before !== result.transactionId) {
        var snap = runtime.snapshot();
        root.history.pushState(
          browserState(result.transactionId, snap.cursor),
          '',
          root.location.href
        );
      }
      return true;
    }

    function cancelPendingNavigationIntent() {
      var production = root.R4B1TRollProduction;
      if (production && typeof production.cancelPendingIntent === 'function') {
        production.cancelPendingIntent('navigation');
      }
    }

    function previous() {
      cancelPendingNavigationIntent();
      if (!runtime || !runtime.canPrevious()) return false;
      root.history.back();
      return true;
    }

    function forward() {
      cancelPendingNavigationIntent();
      if (!runtime || !runtime.canForward()) return false;
      root.history.forward();
      return true;
    }

    root.addEventListener('popstate', function (event) {
      var state = event.state;
      if (!runtime || !state || !state.r4b1tRollNavigation || !state.transactionId) return;
      runtime.navigateTo(state.transactionId).catch(function (error) {
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
      if (!result || typeof root.__r4b1tRevealRoll !== 'function') return false;
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
      canPrevious: function () { return runtime ? runtime.canPrevious() : false; },
      canForward: function () { return runtime ? runtime.canForward() : false; },
      historySnapshot: function () { return runtime ? runtime.snapshot() : { entries: [], cursor: -1 }; },
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

    return root.R4B1TRollAuthority;
  }

  return Object.freeze({
    HISTORY_KEY: DEFAULT_HISTORY_KEY,
    createRuntime: createRuntime,
    installBrowser: installBrowser
  });
});
