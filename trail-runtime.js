(function () {
  'use strict';

  var api = window.R4b1tTrail;
  if (!api) return;

  var STORAGE_KEY = 'r4b1t_trail_draft_v1';
  var state = {
    seed: randomSeed(),
    createdAt: new Date().toISOString(),
    corpusRevision: null,
    routes: [],
    parent: null,
    sampler: null,
    imported: null,
    replayIndex: 0,
    suppressRecord: false,
    samplerCursor: 0,
    transactionSequence: 0,
    selectionTerrain: null
  };

  function randomSeed() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }

  function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved.seed === 'string' && Array.isArray(saved.routes)) {
        state.seed = saved.seed;
        state.createdAt = typeof saved.createdAt === 'string' ? saved.createdAt : state.createdAt;
        state.routes = saved.routes.filter(function (route) {
          try { return Boolean(new URL(route.url)); } catch (_) { return false; }
        });
        state.parent = saved.parent || null;
      }
    } catch (_) {}
    state.sampler = api.createSampler(state.seed);
    state.samplerCursor = 0;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      seed: state.seed,
      createdAt: state.createdAt,
      routes: state.routes,
      parent: state.parent
    }));
  }

  async function loadCorpusRevision() {
    var response = await fetch('urls.txt?v=trail-v1', { cache: 'no-store' });
    if (!response.ok) throw new Error('Corpus revision unavailable');
    var bytes = new Uint8Array(await response.arrayBuffer());
    state.corpusRevision = 'sha256:' + await api.sha256Hex(bytes);
    renderPanel();
  }

  function terrain() {
    var active = document.querySelector('#catFilter button[style*="204, 17, 17"], #catFilter button[style*="#cc1111"]');
    return active ? active.textContent.trim().toUpperCase() : 'ALL';
  }

  function record(url, action, transaction) {
    if (state.suppressRecord || !/^https?:\/\//i.test(url || '')) return;
    var previous = state.routes[state.routes.length - 1];
    if (previous && previous.url === url) return;
    var route = { url: url, action: action || 'SELECT' };
    if (transaction) route.selection_transaction = transaction;
    state.routes.push(route);
    state.imported = null;
    persist();
    renderPanel();
  }

  // DOM mutation is presentation only. Authoritative ROLL provenance is
  // recorded synchronously from the immutable selection transaction below.
  function watchSelections() {}

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function wrapRoll() {
    if (typeof window.__r4b1tCommitRoll !== 'function' || window.__r4b1tCommitRoll.__r4b1tAuthority) return false;
    var originalCommit = window.__r4b1tCommitRoll;
    var wrappedCommit = function () {
      var selectionConstraint = typeof window.__r4b1tCaptureSelectionConstraint === 'function'
        ? window.__r4b1tCaptureSelectionConstraint()
        : deepFreeze({ terrain: terrain(), protocolPolicy: { version: 1, excludeOnion: false } });
      var selectionTerrain = selectionConstraint.terrain;
      var drawStart = state.samplerCursor;
      var drawCount = 0;
      var nextFloat = function () {
        drawCount += 1;
        state.samplerCursor += 1;
        return state.sampler();
      };
      var result = originalCommit(nextFloat, selectionConstraint);
      if (!result || !result.url) return result;

      var transaction = deepFreeze({
        transaction_version: 'r4b1t-selection-transaction/v1',
        sequence: ++state.transactionSequence,
        action: 'ROLL',
        constraint: selectionConstraint,
        corpus_revision: state.corpusRevision,
        sampler: {
          algorithm: 'uniform-with-repeat-guard-v1',
          prng: 'mulberry32-v1',
          seed: state.seed,
          draw_start: drawStart,
          draw_count: drawCount
        },
        route: { url: result.url }
      });

      state.selectionTerrain = selectionTerrain;
      record(result.url, 'ROLL', transaction);
      return Object.freeze({ url: result.url, transaction: transaction });
    };
    wrappedCommit.__r4b1tAuthority = true;
    window.__r4b1tCommitRoll = wrappedCommit;
    return true;
  }

  async function currentEnvelope() {
    if (!state.corpusRevision) await loadCorpusRevision();
    var manifest = await api.createManifest({
      created_at: state.createdAt,
      corpus_revision: state.corpusRevision,
      seed: state.seed,
      terrain: state.selectionTerrain || terrain(),
      routes: state.routes,
      parent: state.parent
    });
    return api.envelope(manifest);
  }

  async function exportTrail() {
    var result = await currentEnvelope();
    var blob = new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json' });
    var link = document.createElement('a');
    link.download = 'r4b1t-trail-' + result.trail_id.slice(7, 19) + '.json';
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
    state.imported = result;
    if (window.rememberTopologySnapshot) await window.rememberTopologySnapshot(result);
    renderPanel();
    return result;
  }

  async function importTrail(input) {
    var verified = await api.verify(input);
    state.imported = verified;
    if (window.rememberTopologySnapshot) await window.rememberTopologySnapshot(verified);
    state.replayIndex = 0;
    renderPanel('VERIFIED / READY TO REPLAY');
    return verified;
  }

  async function replayStep(index) {
    if (!state.imported) throw new Error('Import or export a trail first');
    var urls = await api.replay(state.imported);
    var selected = typeof index === 'number' ? index : state.replayIndex;
    if (selected >= urls.length) selected = 0;
    state.suppressRecord = true;
    try {
      if (typeof window.selectUrl !== 'function') throw new Error('Route engine is unavailable');
      window.selectUrl(urls[selected]);
    } finally {
      setTimeout(function () { state.suppressRecord = false; }, 0);
    }
    state.replayIndex = selected + 1;
    renderPanel('REPLAY ' + String(selected + 1).padStart(3, '0') + ' / ' + String(urls.length).padStart(3, '0'));
    return urls[selected];
  }

  async function forkTrail(index) {
    if (!state.imported) throw new Error('Import or export a trail first');
    var parent = await api.verify(state.imported);
    var forkAt = typeof index === 'number' ? index : state.replayIndex;
    if (!Number.isSafeInteger(forkAt) || forkAt < 0 || forkAt > parent.manifest.routes.length) {
      throw new Error('Fork position is invalid');
    }
    state.seed = randomSeed();
    state.createdAt = new Date().toISOString();
    state.sampler = api.createSampler(state.seed);
    state.routes = parent.manifest.routes.slice(0, forkAt).map(function (route) {
      return { url: route.url, action: route.action };
    });
    state.parent = { trail_id: parent.trail_id, fork_at: forkAt };
    state.imported = null;
    state.replayIndex = 0;
    persist();
    renderPanel('FORKED / STEP ' + String(forkAt).padStart(3, '0'));
    var child = await currentEnvelope();
    if (window.rememberTopologySnapshot) await window.rememberTopologySnapshot(child);
    return child;
  }

  function resetTrail() {
    state.seed = randomSeed();
    state.createdAt = new Date().toISOString();
    state.sampler = api.createSampler(state.seed);
    state.samplerCursor = 0;
    state.transactionSequence = 0;
    state.selectionTerrain = null;
    state.routes = [];
    state.parent = null;
    state.imported = null;
    state.replayIndex = 0;
    persist();
    renderPanel('NEW SEED / TRAIL EMPTY');
  }

  function ensurePanel() {
    if (document.getElementById('trailLedgerOverlay')) return;
    if (!document.getElementById('trailLedgerStyles')) {
      var style = document.createElement('style');
      style.id = 'trailLedgerStyles';
      style.textContent =
        '#trailLedgerOverlay .trail-ledger-panel{background:#141210;border:1px solid #2a2825;border-top:2px solid #cc1111;padding:24px;width:min(560px,96vw);max-height:86vh;display:flex;flex-direction:column;gap:14px;overflow:auto}' +
        '#trailLedgerOverlay .trail-ledger-meta{margin:0;font-size:.52rem;line-height:1.9;color:#9a8f7a;overflow-wrap:anywhere}' +
        '#trailLedgerOverlay .trail-ledger-value{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;color:#e8e0d0;margin:0 0 6px}' +
        '#trailLedgerOverlay .trail-ledger-value>span{min-width:0;overflow-wrap:anywhere}' +
        '#trailLedgerOverlay .trail-ledger-copy{flex:0 0 auto;border:1px solid #5a332e;background:transparent;color:#c8bba6;padding:5px 7px;font:500 .43rem "DM Mono",monospace;letter-spacing:.1em;cursor:pointer}' +
        '#trailLedgerOverlay .trail-ledger-hint{margin:0;color:#9a8f7a;font:400 .5rem/1.55 "DM Mono",monospace;letter-spacing:.04em}' +
        '#trailLedgerOverlay .trail-ledger-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}' +
        '#trailLedgerOverlay .btn-share-trail{min-height:44px;border:1px solid #5a463d;background:#17130f;color:#d8cdb9;font:500 .48rem "DM Mono",monospace;letter-spacing:.1em;cursor:pointer}' +
        '#trailLedgerOverlay .btn-share-trail:disabled{border-color:#302922;background:#100e0c;color:#706658;cursor:not-allowed}' +
        '#trailLedgerOverlay .btn-share-trail:focus-visible,#trailLedgerOverlay .trail-ledger-copy:focus-visible{outline:2px solid #cc1111;outline-offset:2px}' +
        '@media(max-width:600px){#trailLedgerOverlay{align-items:flex-start!important;padding:12px!important}#trailLedgerOverlay .trail-ledger-panel{width:100%;max-height:calc(100dvh - 24px);padding:20px 16px}}';
      document.head.appendChild(style);
    }
    var overlay = document.createElement('div');
    overlay.id = 'trailLedgerOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'trailLedgerTitle');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('tabindex', '-1');
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:#000000e8;z-index:10020;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML = '<div class="trail-ledger-panel">' +
      '<div id="trailLedgerTitle" style="font-family:Bebas Neue,sans-serif;font-size:1.35rem;letter-spacing:.12em">REPRODUCIBLE RABBIT TRAIL</div>' +
      '<div id="trailLedgerStatus" role="status" style="font-size:.48rem;letter-spacing:.12em;color:#cc1111">LOCAL / UNSIGNED</div>' +
      '<dl id="trailLedgerMeta" class="trail-ledger-meta"></dl>' +
      '<input id="trailLedgerFile" type="file" accept="application/json,.json" hidden>' +
      '<p id="trailLedgerHint" class="trail-ledger-hint" role="status">Import or export a trail to enable replay and fork.</p>' +
      '<div class="trail-ledger-actions">' +
        '<button class="btn-share-trail" type="button" data-trail-action="export">EXPORT JSON</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="import">IMPORT JSON</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="replay">REPLAY NEXT</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="fork">FORK HERE</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="blind">BLIND DESCENT</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="topology">MAP TRAILS</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="reset">NEW TRAIL</button>' +
      '</div>' +
      '<button class="btn-share-trail" type="button" data-trail-action="close">CLOSE [ESC]</button>' +
    '</div>';
    overlay.addEventListener('click', function (event) {
      var copyButton = event.target.closest('[data-copy-value]');
      if (copyButton) return copyLedgerValue(copyButton);
      var button = event.target.closest('[data-trail-action]');
      if (!button) return;
      var action = button.dataset.trailAction;
      if (action === 'close') return closePanel();
      if (action === 'export') return exportTrail().catch(showError);
      if (action === 'import') return document.getElementById('trailLedgerFile').click();
      if (action === 'replay') return replayStep().catch(showError);
      if (action === 'fork') return forkTrail().catch(showError);
      if (action === 'blind') { closePanel(); return window.openBlindDescent(); }
      if (action === 'topology') {
        return currentEnvelope().then(function (snapshot) { closePanel(); return window.openTrailTopology(snapshot); }).catch(showError);
      }
      if (action === 'reset') return resetTrail();
    });
    overlay.addEventListener('click', function (event) { if (event.target === overlay) closePanel(); });
    document.body.appendChild(overlay);
    document.getElementById('trailLedgerFile').addEventListener('change', async function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      try { await importTrail(await file.text()); } catch (error) { showError(error); }
      event.target.value = '';
    });
  }

  function renderPanel(status) {
    var meta = document.getElementById('trailLedgerMeta');
    if (!meta) return;
    var trailId = state.imported ? state.imported.trail_id : 'GENERATED ON EXPORT';
    meta.replaceChildren();
    appendLedgerField(meta, 'TRAIL ID', trailId, state.imported ? 'trail ID' : null);
    appendLedgerField(meta, 'CORPUS REVISION', state.corpusRevision || 'CALCULATING', state.corpusRevision ? 'corpus revision' : null);
    appendLedgerField(meta, 'SEED', state.seed, 'seed');
    appendLedgerField(meta, 'RECORDED ROUTES', state.routes.length);
    appendLedgerField(meta, 'PARENT / FORK', state.parent ? state.parent.trail_id + ' / ' + String(state.parent.fork_at).padStart(3, '0') : 'ORIGIN', state.parent ? 'parent trail' : null);
    var available = Boolean(state.imported);
    var replay = document.querySelector('[data-trail-action="replay"]');
    var fork = document.querySelector('[data-trail-action="fork"]');
    if (replay) replay.disabled = !available;
    if (fork) fork.disabled = !available;
    var hint = document.getElementById('trailLedgerHint');
    if (hint) hint.textContent = available
      ? 'Verified trail loaded. Replay and fork are available.'
      : 'Import or export a trail to enable replay and fork.';
    if (status) document.getElementById('trailLedgerStatus').textContent = status;
  }

  function appendLedgerField(meta, label, value, copyField) {
    var term = document.createElement('dt');
    term.textContent = label;
    var detail = document.createElement('dd');
    detail.className = 'trail-ledger-value';
    var text = document.createElement('span');
    text.textContent = String(value);
    detail.appendChild(text);
    if (copyField) {
      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'trail-ledger-copy';
      copy.textContent = 'COPY';
      copy.dataset.copyField = copyField;
      copy.dataset.copyValue = String(value);
      copy.setAttribute('aria-label', 'Copy ' + copyField);
      detail.appendChild(copy);
    }
    meta.appendChild(term);
    meta.appendChild(detail);
  }

  function copyLedgerValue(button) {
    var value = button.dataset.copyValue || '';
    var field = button.dataset.copyField || 'value';
    var write = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(value)
      : new Promise(function (resolve, reject) {
          var area = document.createElement('textarea');
          area.value = value;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          try { document.execCommand('copy') ? resolve() : reject(new Error('Copy unavailable')); }
          catch (error) { reject(error); }
          area.remove();
        });
    return Promise.resolve(write).then(function () {
      var original = button.textContent;
      button.textContent = 'COPIED';
      var hint = document.getElementById('trailLedgerHint');
      if (hint) hint.textContent = field.toUpperCase() + ' COPIED.';
      setTimeout(function () { button.textContent = original; renderPanel(); }, 1200);
    }).catch(showError);
  }

  function showError(error) {
    renderPanel('REJECTED / ' + String(error && error.message || error).toUpperCase());
  }

  var panelFocus = null;

  function panelFocusables(panel) {
    return Array.from(panel.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null; });
  }

  function focusPanel(panel) {
    var items = panelFocusables(panel);
    (items[0] || panel).focus();
  }

  function trapPanelTab(event, panel) {
    if (event.code !== 'Tab') return false;
    var items = panelFocusables(panel);
    if (!items.length) {
      event.preventDefault();
      panel.focus();
      return true;
    }
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function openPanel() {
    ensurePanel();
    renderPanel();
    var panel = document.getElementById('trailLedgerOverlay');
    panelFocus = document.activeElement;
    panel.style.display = 'flex';
    panel.setAttribute('aria-hidden', 'false');
    setTimeout(function () { focusPanel(panel); }, 0);
  }

  function closePanel() {
    var panel = document.getElementById('trailLedgerOverlay');
    if (panel) {
      panel.style.display = 'none';
      panel.setAttribute('aria-hidden', 'true');
    }
    var restore = panelFocus;
    panelFocus = null;
    if (restore && typeof restore.focus === 'function') setTimeout(function () { restore.focus(); }, 0);
  }

  restore();
  window.openTrailLedger = openPanel;
  window.closeTrailLedger = closePanel;
  window.exportTrailManifest = exportTrail;
  window.importTrailManifest = importTrail;
  window.replayTrailManifest = replayStep;
  window.forkTrailManifest = forkTrail;
  window.getTrailManifest = currentEnvelope;
  window.resetReproducibleTrail = resetTrail;

  document.addEventListener('DOMContentLoaded', function () {
    ensurePanel();
    watchSelections();
    loadCorpusRevision().catch(showError);
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (wrapRoll() || attempts > 100) clearInterval(timer);
    }, 25);
  });

  document.addEventListener('keydown', function (event) {
    var panel = document.getElementById('trailLedgerOverlay');
    if (panel?.style.display === 'flex') {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePanel();
        return;
      }
      if (trapPanelTab(event, panel)) {
        event.stopImmediatePropagation();
        return;
      }
    }
    if ((event.code === 'Space' || event.code === 'KeyS') &&
        !event.target.closest('input, textarea, select, button, a') &&
        typeof window.roll === 'function' && window.roll.__r4b1tSeeded) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.roll();
    }
  }, true);

  document.addEventListener('r4b1t:reset', resetTrail);
})();
