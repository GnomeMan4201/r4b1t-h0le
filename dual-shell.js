(function () {
  'use strict';

  var MOBILE_QUERY = '(max-width: 900px)';
  var mq = window.matchMedia(MOBILE_QUERY);
  var syncObserver = null;
  var filterObserver = null;
  var branchObserver = null;
  var trailObserver = null;
  var resizeTimer = null;
  var sheetCloseTimer = null;
  var routeMotionTimer = null;
  var routeTransitionBusy = false;
  var pendingRouteMotion = null;
  var rollPendingTimer = null;
  var ledgerRowObserver = null;
  var motionDebugEnabled = /[?&]debug-motion=1(?:&|$)/.test(window.location.search);

  function byId(id) { return document.getElementById(id); }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function call(name) {
    var fn = window[name];
    if (typeof fn !== 'function') return false;
    fn.apply(window, Array.prototype.slice.call(arguments, 1));
    return true;
  }

  function currentUrl() {
    var source = byId('previewUrl');
    var value = source ? source.textContent.trim() : '';
    return value && value !== '—' ? value : '';
  }

  function currentDomain() {
    var source = byId('previewDomain');
    var value = source ? source.textContent.trim() : '';
    return value && value !== '—' ? value : '';
  }

  function hostnameFor(url, fallback) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (_) { return fallback || ''; }
  }

  // The armed terrain is exposed by the desktop controls' aria-pressed state (TERRAIN_AUTHORITY_CONTRACT.md §6).
  function sourceFilterIsActive(button) {
    if (!button) return false;
    return button.getAttribute('aria-pressed') === 'true';
  }

  function terrainScopeText(button) {
    var label = button.dataset.terrainLabel || button.textContent.trim().toUpperCase();
    var count = button.dataset.eligibleCount;
    if (count === '1') return label + ' · 1 ROUTE · SINGLE ROUTE';
    if (count === '2') return label + ' · 2 ROUTES · ALTERNATES';
    return count ? label + ' · ' + count + ' ROUTES' : label + ' ROUTES';
  }

  function branchModeActive() {
    var branch = byId('btnModeBranch');
    return Boolean(branch && branch.classList.contains('active'));
  }

  function shellMarkup() {
    return [
      '<main class="r4m-shell" aria-label="r4b1t mobile interface">',
        '<header class="r4m-header">',
          '<div class="r4m-wordmark"><span>R4B1T</span> H0L3</div>',
        '</header>',
        '<div class="r4m-compat-state" hidden aria-hidden="true"><span id="r4mFilterLabel">ALL SIGNALS</span><b id="r4mModeLabel">UNBOUNDED</b></div>',
        '<div class="r4m-mode-switch" role="group" aria-label="Primary exploration mode"><button type="button" class="active" data-mobile-action="stage-roll" id="r4mModeRoll" aria-pressed="true">ROLL</button><button type="button" data-mobile-action="stage-blind" id="r4mModeBlind" aria-pressed="false">BLIND DESCENT</button></div>',
        '<div class="r4m-primary-stage" id="r4mPrimaryStage">',
        '<div class="r4m-production-mark" id="r4mProductionMark"></div>',
        '<section class="r4m-hero" id="r4mHero">',
          '<div class="r4m-hero-copy"><small id="r4mApertureState">RANDOM DISCOVERY / CYBERSECURITY WEB</small><h1>A HOLE, NOT A FEED.</h1><p>NO PROFILE. NO RANKING. COMMITTED BEFORE REVEAL.</p></div>',
        '</section>',
        '<button class="r4m-roll r4m-roll-aperture" id="r4mRoll" type="button" data-mobile-instrument="aperture" data-presentation-state="idle" aria-label="ROLL — commit a route before reveal">',
          '<strong class="r4m-ap-label">ROLL</strong>',
          '<em class="r4m-ap-scope" id="r4mRollScope">FULL CORPUS</em>',
          '<i class="r4m-roll-strip" aria-hidden="true"></i>',
        '</button>',
        '<section class="r4m-descent-entry" id="r4mDescentEntry" aria-label="Blind Descent entry" hidden>',
          '<div><small>COMMIT FIRST / SEE LATER</small><strong>BLIND DESCENT</strong><p>Lock one route before it is shown.</p></div>',
          '<div class="r4m-descent-actions">',
            '<button type="button" data-mobile-action="blind-descent"><span>DESCEND BLIND</span> <b aria-hidden="true">↓</b></button>',
          '</div>',
        '</section>',
        '<div id="r4mRouteMount" aria-live="polite"></div>',
        '<button type="button" class="r4m-roll-again" data-mobile-action="roll-again" id="r4mRollAgain" hidden><span class="r4m-next-aperture" data-aperture-role="selection" aria-hidden="true"><i class="r4m-ap-depth-ring"></i></span><span>ROLL AGAIN</span></button>',
        '</div>',
        '<nav class="r4m-nav r4m-nav-minimal" aria-label="Mobile controls">',
          '<button type="button" data-mobile-action="nav-roll" id="r4mNavRoll"><span class="r4m-nav-aperture" data-aperture-role="navigation" aria-hidden="true"></span><b>ROLL</b></button>',
          '<button type="button" data-mobile-action="menu" id="r4mNavMenu" aria-expanded="false" aria-controls="r4mMenuSheet"><b id="r4mNavMenuLabel">MENU</b><span class="r4m-nav-menu-icon" aria-hidden="true"><i></i><i></i></span></button>',
        '</nav>',
      '</main>',
      '<div class="r4m-sheet-backdrop" id="r4mBackdrop" hidden></div>',
      '<aside class="r4m-sheet r4m-menu-sheet" id="r4mMenuSheet" aria-hidden="true">',
        '<div class="r4m-sheet-head"><strong>INSTRUMENTS</strong><button type="button" data-mobile-action="close-sheets">CLOSE</button></div>',
        '<div class="r4m-menu-body">',
          '<section class="r4m-menu-group r4m-menu-explore" data-menu-group="explore">',
            '<h3>EXPLORE</h3>',
            '<div class="r4m-menu-primary-actions"><button type="button" data-mobile-action="nav-roll">ROLL</button><button type="button" data-mobile-action="history">HISTORY</button></div>',
          '</section>',
          '<section class="r4m-menu-group r4m-menu-from-here" data-menu-group="from-here">',
            '<h3>FROM HERE</h3>',
            '<span class="r4m-menu-group-context">THIS ROUTE, THE NEXT ROLL</span>',
            '<button type="button" data-mobile-action="inspect">ROUTE INFO</button>',
            '<button type="button" data-mobile-action="filter">TERRAIN FILTER</button>',
            '<button type="button" data-mobile-action="branch">BRANCH</button>',
          '</section>',
          '<section class="r4m-menu-group r4m-menu-trail" data-menu-group="trail">',
            '<h3>YOUR TRAIL</h3>',
            '<b class="r4m-menu-group-count" id="r4mTrailCount">00</b>',
            '<div class="r4m-trail-scroll" id="r4mTrailItems"><span class="r4m-empty">NO ROUTES YET</span></div>',
            '<button type="button" class="r4m-ledger" data-mobile-action="copy-trail">COPY TRAIL</button>',
            '<button type="button" class="r4m-ledger" data-mobile-action="topology">MAP TRAILS</button>',
          '</section>',
          '<section class="r4m-menu-group r4m-menu-proof" data-menu-group="proof">',
            '<h3>TRAIL FILES &amp; PROOF</h3>',
            '<div class="r4m-menu-proof-grid">',
              '<button type="button" data-mobile-action="trail-file">TRAIL FILE / REPLAY</button>',
              '<button type="button" data-mobile-action="comparison">COMPARE TRAILS</button>',
              '<button type="button" data-mobile-action="replay-inspection">VERIFY + REPLAY</button>',
              '<button type="button" data-mobile-action="proof-session">PROOF SESSION</button>',
            '</div>',
          '</section>',
          '<section class="r4m-menu-group r4m-menu-app" data-menu-group="app">',
            '<h3>THIS APP</h3>',
            '<div class="r4m-menu-app-actions"><button type="button" data-mobile-action="help">TOUCH GUIDE</button><button type="button" data-mobile-action="theme" id="r4mMenuTheme" aria-label="Toggle light or dark theme">THEME</button><a id="r4mMenuZip" href="https://github.com/GnomeMan4201/r4b1t-h0le/archive/refs/heads/main.zip" rel="noopener">.ZIP</a></div>',
          '</section>',
        '</div>',
      '</aside>',
      '<aside class="r4m-sheet" id="r4mFilterSheet" aria-hidden="true">',
        '<div class="r4m-sheet-head"><strong>TERRAIN FILTER</strong><button type="button" data-mobile-action="close-sheets">CLOSE</button></div>',
        '<div id="r4mFilterOptions" class="r4m-filter-options"></div>',
      '</aside>',
      '<aside class="r4m-sheet" id="r4mBranchSheet" aria-hidden="true">',
        '<div class="r4m-sheet-head"><strong>BRANCH / DIRECTIONS</strong><button type="button" data-mobile-action="random-mode">RANDOM MODE</button><button type="button" data-mobile-action="close-sheets">CLOSE</button></div>',
        '<div id="r4mBranchOptions" class="r4m-branch-options"></div>',
      '</aside>',
      '<aside class="r4m-sheet" id="r4mHelpSheet" aria-hidden="true">',
        '<div class="r4m-sheet-head"><strong>TOUCH GUIDE</strong><button type="button" data-mobile-action="close-sheets">CLOSE</button></div>',
        '<div class="r4m-inspect-body r4m-help-body">',
          '<div><small>ROLL</small><p>Draw a random route from the active terrain.</p></div>',
          '<div><small>FILTER</small><p>Limit the terrain before a roll.</p></div>',
          '<div><small>BRANCH</small><p>Explore directions from the current route. RANDOM MODE returns to unbounded rolls.</p></div>',
          '<div><small>ROUTE INFO</small><p>Inspect the current domain, URL, metadata, and URL suggestion handoff.</p></div>',
          '<div><small>TRAIL</small><p>Open history, copy the readable trail, or use Trail File / Replay, Compare Trails, Proof Session, and Verify + Replay.</p></div>',
          '<div><small>BLIND DESCENT / MAP TRAILS</small><p>Commit before reveal, or inspect the recorded trail topology and wear.</p></div>',
        '</div>',
      '</aside>',
      '<aside class="r4m-sheet" id="r4mInspectSheet" aria-hidden="true">',
        '<div class="r4m-sheet-head"><strong>INSPECT ROUTE</strong><button type="button" data-mobile-action="close-sheets">CLOSE</button></div>',
        '<div class="r4m-inspect-body">',
          '<div><small>DOMAIN</small><strong id="r4mInspectDomain">NO ROUTE</strong></div>',
          '<div><small>URL</small><code id="r4mInspectUrl">—</code></div>',
          '<div><small>METADATA</small><p id="r4mInspectDesc">Roll a route to inspect it.</p></div>',
          '<div><small>RESOURCE TYPE</small><strong id="r4mInspectResourceType">UNAVAILABLE</strong></div>',
          '<div><small>ELIGIBILITY</small><p id="r4mInspectEligibility">UNAVAILABLE</p></div>',
          '<div><small>PROVENANCE</small><code id="r4mInspectProvenance">UNAVAILABLE</code></div>',
          '<button type="button" class="r4m-inspect-suggest" data-mobile-action="suggest-url">SUGGEST THIS URL ↗</button>',
        '</div>',
      '</aside>'
    ].join('');
  }

  function mountProductionMark() {
    var host = byId('r4mProductionMark');
    if (!host || host.dataset.mounted === 'true') return Promise.resolve();
    return fetch('r4b1t-h0l3-production.svg', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('production SVG ' + response.status);
        return response.text();
      })
      .then(function (markup) {
        if (!host.isConnected) return;
        host.innerHTML = markup;
        host.dataset.mounted = 'true';
        if (!byId('r4h-root')) throw new Error('production SVG root missing');
        // The mark's own markup carries is-entering/is-idle on #r4h-root; the entrance
        // plays once from insertion and needs no classes from the app.
        syncProductionMarkState();
      })
      .catch(function (error) {
        console.error('R4B1T production mark failed to mount', error);
      });
  }

  // The production mark is presentation only. Its ROLL is a fixed 1000ms sequence
  // (r4h-roll-*, right paw +14ms), longer than the strip phases (~660ms), so the
  // mark holds .rolling for its full run instead of mirroring the phases, and only
  // then shows .result-ready. Otherwise the roll is cut mid-launch and snaps home.
  var MARK_ROLL_MS = 1050;
  var markRollTimer = null;
  function syncProductionMarkState() {
    var root = document.documentElement;
    if (!byId('r4h-root')) return;
    var presentation = root.getAttribute('data-r4m-presentation') || 'idle';
    var rolling = ['contact','compression','committed','travel','brake','seat'].indexOf(presentation) !== -1;
    var resultReady = presentation === 'reveal' || presentation === 'revealed';
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // no mark motion to wait for: represent the state directly
      root.classList.toggle('rolling', rolling);
      root.classList.toggle('result-ready', resultReady);
      return;
    }
    if (rolling && markRollTimer === null) {
      root.classList.remove('result-ready');
      root.classList.add('rolling');
      markRollTimer = window.setTimeout(function () {
        markRollTimer = null;
        root.classList.remove('rolling');
        syncProductionMarkState();
      }, MARK_ROLL_MS);
    }
    if (markRollTimer !== null) return;
    root.classList.toggle('result-ready', resultReady);
  }

  // ── Secondary mark states ───────────────────────────────────────────────
  // Presentation only. The production mark reacts to which secondary surface is
  // open (.branch-open, .trail-open, .topology-open, .history-open, .replay-open)
  // and to one-shot .copy-trail. This code never opens, closes or orders a surface
  // and carries no motion: it reads each surface's own open state from the DOM
  // (so a close from any button, Esc or the desktop shell is seen) and exposes at
  // most one secondary class on <html>, the same ancestor as .menu-open/.rolling.
  // ROLL and BLIND need nothing here; the SVG gates the secondary layer off.
  var MARK_SECONDARY_SURFACES = [ // Motion Board priority: replay > topology > branch > trail > history
    { cls: 'replay-open', id: 'replayInspectionOverlay' },
    { cls: 'topology-open', id: 'trailTopologyOverlay' },
    { cls: 'branch-open', id: 'r4mBranchSheet' },
    { cls: 'trail-open', id: 'trailLedgerOverlay' },
    { cls: 'history-open', id: 'historyOverlay' }
  ];
  // Canonical-return contract with r4b1t-h0l3-production.svg: the act layer is back
  // on the exact canonical pose MARK_SECONDARY_RETURN_MS after its class is removed
  // (the longest return, the ears, lands at 80+300ms). A peer switch removes the old
  // class and applies the next only once that has elapsed, so no keyframed pose
  // restarts mid-pose. tests/mobile-production-svg-integration.test.js derives the
  // value from the SVG's own rules; change it here if the Motion Board timing changes.
  var MARK_SECONDARY_RETURN_MS = 380;
  var MARK_COPY_MS = 460; // the SVG's COPY TRAIL one-shot runs 420ms
  var markSecondary = null;
  var markSecondarySettleUntil = 0;
  var markSecondaryTimer = null;
  var markCopyTimer = null;
  var markSurfaceObserver = null;
  var markWatched = {};

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function markSurfaceOpen(surface) {
    var el = byId(surface.id);
    if (!el || el.hidden) return false;
    if (el.getAttribute('aria-hidden') === 'false') return true;
    // the mobile history motion may show the legacy ledger before it flips aria-hidden
    return surface.id === 'historyOverlay' && el.style.display === 'flex';
  }

  function desiredMarkSecondary() {
    for (var i = 0; i < MARK_SECONDARY_SURFACES.length; i++) {
      if (markSurfaceOpen(MARK_SECONDARY_SURFACES[i])) return MARK_SECONDARY_SURFACES[i].cls;
    }
    return null;
  }

  function syncMarkSecondary() {
    var root = document.documentElement;
    var next = desiredMarkSecondary();
    if (markSecondary && markSecondary !== next) {
      root.classList.remove(markSecondary);
      markSecondary = null;
      markSecondarySettleUntil = prefersReducedMotion() ? 0 : Date.now() + MARK_SECONDARY_RETURN_MS;
    }
    if (!next || markSecondary === next) {
      window.clearTimeout(markSecondaryTimer);
      markSecondaryTimer = null;
      return;
    }
    var wait = markSecondarySettleUntil - Date.now();
    if (wait > 0) {
      if (markSecondaryTimer === null) {
        markSecondaryTimer = window.setTimeout(function () {
          markSecondaryTimer = null;
          syncMarkSecondary();
        }, wait);
      }
      return;
    }
    root.classList.add(next);
    markSecondary = next;
  }

  function watchMarkSurfaces() {
    if (!markSurfaceObserver) markSurfaceObserver = new MutationObserver(syncMarkSecondary);
    MARK_SECONDARY_SURFACES.forEach(function (surface) {
      var el = byId(surface.id);
      if (!el || markWatched[surface.id] === el) return;
      markWatched[surface.id] = el;
      markSurfaceObserver.observe(el, { attributes: true, attributeFilter: ['aria-hidden', 'hidden', 'style'] });
    });
    syncMarkSecondary();
  }

  function initMarkSecondary() {
    watchMarkSurfaces();
    // trail ledger and topology mount their overlays on first open
    new MutationObserver(watchMarkSurfaces).observe(document.body, { childList: true });
  }

  // COPY TRAIL is an event, not a state: a short-lived class per completed copy action.
  function pulseMarkCopy() {
    var root = document.documentElement;
    window.clearTimeout(markCopyTimer);
    if (root.classList.contains('copy-trail')) {
      root.classList.remove('copy-trail');
      void root.offsetWidth; // let the one-shot restart for a repeated copy
    }
    root.classList.add('copy-trail');
    markCopyTimer = window.setTimeout(function () {
      markCopyTimer = null;
      root.classList.remove('copy-trail');
    }, MARK_COPY_MS);
  }

  function buildShell() {
    if (byId('r4mShellHost')) return;
    if (motionDebugEnabled) ensureMotionDebug();
    var host = document.createElement('div');
    host.id = 'r4mShellHost';
    host.innerHTML = shellMarkup();
    document.body.appendChild(host);
    mountProductionMark();

    host.addEventListener('click', function (event) {
      var target = event.target.closest('[data-mobile-action]');
      if (!target) return;
      var action = target.getAttribute('data-mobile-action');
      reportTap(action.toUpperCase());
      handleAction(action, target);
    });

    var backdrop = byId('r4mBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeSheets);
    bindPressLifecycle(host);
    runInitialStagger();
    var mobileTheme = byId('r4mMenuTheme');
    if (mobileTheme) { mobileTheme.textContent = 'THEME'; mobileTheme.dataset.theme = document.documentElement.classList.contains('light') ? 'light' : 'dark'; }
    syncEverything();
    observeSource();
  }

  function runInitialStagger() {
    var selectors = ['.r4m-header', '.r4m-mode-switch', '.r4m-hero', '.r4m-roll'];
    selectors.forEach(function (selector, index) {
      var element = document.querySelector(selector);
      if (!element) return;
      element.style.setProperty('--motion-delay', String(index * 60) + 'ms');
      element.classList.add('motion-stagger-in');
      window.setTimeout(function () { element.classList.remove('motion-stagger-in'); }, 620 + (index * 60));
    });
  }

  function setRollPresentationState(state) {
    var roll = byId('r4mRoll');
    if (!roll) return;
    var next = state || 'idle';
    roll.setAttribute('data-presentation-state', next);
    document.documentElement.setAttribute('data-r4m-presentation', next);
    reportMotion('PRESENTATION-' + next.toUpperCase(), roll, next);
    syncProductionMarkState();
  }

  function projectAuthoritativeRollPresentation(machineState) {
    var projection = {
      'PRESSED': 'contact',
      'COMPRESSING': 'compression',
      'RELEASED': 'committed',
      'STRIP_ACCELERATING': 'travel',
      'STRIP_DECELERATING': 'brake',
      'LOCKED': 'seat',
      'CARD_ENTERING': 'reveal',
      'SETTLED': 'revealed',
      'CANCELLED': 'idle',
      'IDLE': 'idle'
    };
    var next = projection[machineState];
    if (!next) return false;
    setRollPresentationState(next);
    return true;
  }

  window.__r4b1tProjectRollPresentation = projectAuthoritativeRollPresentation;

  function bindPressLifecycle(host) {
    function buttonFrom(event) {
      var target = event.target && event.target.closest ? event.target.closest('button') : null;
      return target && host.contains(target) ? target : null;
    }
    host.addEventListener('pointerdown', function (event) {
      var button = buttonFrom(event);
      if (!button || button.disabled) return;
      button.classList.remove('motion-released');
      button.classList.add('motion-pressed');
      if (button.id === 'r4mRoll') {
        setRollPresentationState('contact');
        window.requestAnimationFrame(function () {
          if (button.classList.contains('motion-pressed')) setRollPresentationState('compression');
        });
      }
      reportMotion('PRESS', button, 'motion-pressed');
    });
    function release(event) {
      var button = buttonFrom(event);
      if (!button || !button.classList.contains('motion-pressed')) return;
      button.classList.remove('motion-pressed', 'motion-released');
      if (button.id === 'r4mRoll' && button.getAttribute('data-presentation-state') !== 'travel') {
        setRollPresentationState('idle');
      }
      void button.offsetWidth;
      button.classList.add('motion-released');
      reportMotion('RELEASE', button, 'motion-released');
      window.setTimeout(function () { button.classList.remove('motion-released'); }, 190);
    }
    host.addEventListener('pointerup', release);
    host.addEventListener('pointercancel', release);
    host.addEventListener('pointerleave', release, true);
  }

  function beginRollPending(button) {
    if (!button) return;
    window.clearTimeout(rollPendingTimer);
    button.classList.add('roll-pending');
    button.setAttribute('aria-busy', 'true');
    if (button.id === 'r4mRoll') setRollPresentationState('travel');
    reportMotion('ROLL-PENDING', button, 'roll-pending');
  }

  function endRollPending(button) {
    if (!button) return;
    button.classList.remove('roll-pending');
    button.removeAttribute('aria-busy');
    if (button.id === 'r4mRoll') setRollPresentationState('idle');
  }

  function animateRouteCounter(value) {
    var target = byId('r4mRouteNo');
    if (!target) return;
    var next = String(value).padStart(3, '0');
    if (target.dataset.value === next && target.querySelector('.r4m-route-digit')) return;
    var previous = target.dataset.value || ''.padStart(next.length, ' ');
    target.dataset.value = next;
    target.setAttribute('aria-label', next);
    target.innerHTML = next.split('').map(function (digit, index) {
      var changed = previous[index] !== digit;
      return '<span class="r4m-route-digit' + (changed ? ' changed' : '') + '" aria-hidden="true">' + digit + '</span>';
    }).join('');
  }

  function prepareLedgerRows() {
    var list = byId('historyList');
    if (!list) return;
    if (ledgerRowObserver) ledgerRowObserver.disconnect();

    var allRows = Array.from(list.children);
    allRows.forEach(function (row) {
      if (row) row.classList.add('r4m-ledger-row', 'row-in');
    });
    var storedRows = allRows.filter(function (row) {
      return row && row.tagName === 'BUTTON';
    });
    var total = storedRows.length;
    var presentation = storedRows.map(function (row, storedIndex) {
      return {
        row: row,
        storedIndex: storedIndex,
        chronologicalNumber: total - storedIndex,
        latest: storedIndex === 0
      };
    }).reverse();

    presentation.forEach(function (record) {
      var row = record.row;
      row.classList.add('r4m-ledger-row', 'row-in');
      row.dataset.historyStoredIndex = String(record.storedIndex);
      row.dataset.historyChronological = String(record.chronologicalNumber);
      row.dataset.historyLatest = String(record.latest);
      var number = row.querySelector('span');
      if (number) number.textContent = String(record.chronologicalNumber).padStart(3, '0');
      list.appendChild(row);
    });

    var rows = presentation.map(function (record) { return record.row; });
    if (!('IntersectionObserver' in window)) {
      rows.forEach(function (row) { row.classList.add('row-in'); });
      return;
    }
    ledgerRowObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('row-in');
        ledgerRowObserver.unobserve(entry.target);
      });
    }, { root: list, threshold: 0.3 });
    rows.forEach(function (row) { ledgerRowObserver.observe(row); });
  }

  function flashCopyTarget(button) {
    if (!button) return;
    button.classList.remove('copied-flash');
    void button.offsetWidth;
    button.classList.add('copied-flash');
    reportMotion('COPY-ACKNOWLEDGED', button, 'copied-flash');
    window.setTimeout(function () { button.classList.remove('copied-flash'); }, 250);
  }

  function ensureMotionDebug() {
    if (!motionDebugEnabled || byId('r4mMotionDebug')) return;
    var panel = document.createElement('aside');
    panel.id = 'r4mMotionDebug';
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'position:fixed;z-index:12000;right:8px;bottom:calc(76px + env(safe-area-inset-bottom));width:min(310px,calc(100vw - 16px));padding:10px;background:#050505ee;color:#f3ead8;border:1px solid #ff3333;box-shadow:4px 4px 0 #3a0808;font:500 10px/1.55 "DM Mono",monospace;letter-spacing:.04em;pointer-events:none;white-space:pre-wrap';
    panel.textContent = 'MOTION DEBUG / waiting for input';
    document.body.appendChild(panel);
  }

  function reportMotion(action, element, className) {
    if (!motionDebugEnabled || !element) return;
    ensureMotionDebug();
    var panel = byId('r4mMotionDebug');
    if (!panel) return;
    var style = getComputedStyle(element);
    var animation = element.getAnimations && element.getAnimations()[0];
    var timing = animation && animation.effect ? animation.effect.getTiming() : {};
    var animationName = style.animationName && style.animationName !== 'none' ? style.animationName : 'none';
    var duration = timing.duration || style.animationDuration || 'none';
    var transition = style.transitionDuration && style.transitionDuration !== '0s' ? style.transitionDuration : 'none';
    panel.textContent =
      'MOTION DEBUG\
' +
      'LAST TAP: ' + (panel.dataset.lastTap || action) + '\
' +
      'MOTION: ' + action + '\
' +
      'TARGET: #' + (element.id || element.className || element.tagName).toString().replace(/\\s+/g, '.') + '\
' +
      'CLASS: ' + (className || '(none)') + '\
' +
      'ANIMATION: ' + animationName + '\
' +
      'DURATION: ' + String(duration) + '\
' +
      'TRANSITION: ' + transition;
  }

  function reportTap(action) {
    if (!motionDebugEnabled) return;
    ensureMotionDebug();
    var panel = byId('r4mMotionDebug');
    if (panel) {
      panel.dataset.lastTap = action;
      panel.textContent = 'MOTION DEBUG\
LAST TAP: ' + action + '\
MOTION: waiting for target…';
    }
  }

  function playMotion(element, className, duration) {
    if (!element) return;
    [
      'motion-route-unfold',
      'motion-route-reject',
      'motion-route-next',
      'roll-enter',
      'reject-exit',
      'forward-enter',
      'motion-control-press',
      'sheet-open',
      'sheet-close',
      'ledger-open',
      'ledger-close',
      'motion-history-enter',
      'motion-history-exit'
    ].forEach(function (name) { element.classList.remove(name); });
    void element.offsetWidth;
    element.classList.add(className);
    reportMotion(className.replace(/^motion-/, '').toUpperCase(), element, className);
    window.clearTimeout(routeMotionTimer);
    routeMotionTimer = window.setTimeout(function () {
      element.classList.remove(className);
    }, duration || 500);
  }

  function runRollTransition(kind) {
    // a ROLL takes the stage: no shell sheet stays open over it
    closeSheets();
    if (kind === 'roll' && window.R4B1TRollProduction && typeof window.R4B1TRollProduction.roll === 'function') {
      return window.R4B1TRollProduction.roll();
    }
    if (routeTransitionBusy) return;
    reportTap(kind === 'next' ? 'REJECT / NEXT' : 'ROLL');
    var route = byId('r4mRoute');
    var rollButton = byId('r4mRoll');
    playMotion(rollButton, 'motion-control-press', 240);
    beginRollPending(rollButton);
    routeTransitionBusy = true;

    if (kind === 'next' && route && !route.hidden) {
      playMotion(route, 'reject-exit', 280);
      rollPendingTimer = window.setTimeout(function () {
        pendingRouteMotion = 'forward-enter';
        endRollPending(rollButton);
        call('roll');
        routeTransitionBusy = false;
      }, 270);
      return;
    }

    rollPendingTimer = window.setTimeout(function () {
      pendingRouteMotion = 'roll-enter';
      endRollPending(rollButton);
      call('roll');
      routeTransitionBusy = false;
    }, 240);
  }

  function toggleHistoryWithMotion() {
    reportTap('HISTORY');
    var overlay = byId('historyOverlay');
    if (!overlay) return call('toggleHistory');
    var open = overlay.style.display === 'flex';
    if (!open) {
      call('toggleHistory');
      // The legacy ledger returns early when empty; mobile history must still
      // open and animate so an empty trail is an explicit state, not a dead tap.
      if (overlay.style.display !== 'flex') overlay.style.display = 'flex';
      window.requestAnimationFrame(function () {
        prepareLedgerRows();
        playMotion(overlay, 'ledger-open', 340);
      });
      return;
    }
    playMotion(overlay, 'ledger-close', 260);
    window.setTimeout(function () { call('toggleHistory'); }, 250);
  }

  function handleAction(action, sourceElement) {
    if (action === 'theme') {
      document.documentElement.classList.toggle('light');
      var light = document.documentElement.classList.contains('light');
      localStorage.setItem('r4b1t_theme', light ? 'light' : 'dark');
      var mobileTheme = byId('r4mMenuTheme');
      var desktopTheme = byId('themeBtn');
      if (mobileTheme) { mobileTheme.textContent = 'THEME'; mobileTheme.dataset.theme = light ? 'light' : 'dark'; }
      if (desktopTheme) desktopTheme.textContent = light ? '◑ DARK' : '◑ LIGHT';
      return;
    }
    if (action === 'stage-roll') {
      call('closeBlindDescent');
      return resetRollStage();
    }
    if (action === 'nav-roll') {
      closeSheets();
      call('closeBlindDescent');
      return resetRollStage();
    }
    if (action === 'menu') {
      var menuSheet = byId('r4mMenuSheet');
      if (menuSheet && menuSheet.classList.contains('open')) return closeSheets();
      return openSheet('r4mMenuSheet');
    }
    if (action === 'stage-blind') return setPrimaryMode('blind');
    if (action === 'roll-again') {
      resetRollStage();
      return runRollTransition('roll');
    }
    if (action === 'filter') return openSheet('r4mFilterSheet');
    if (action === 'help') return openSheet('r4mHelpSheet');
    if (action === 'close-sheets') return closeSheets();
    if (action === 'next') return runRollTransition('next');
    if (action === 'previous') {
      var previousAuthority = window.R4B1TRollAuthority;
      return previousAuthority && typeof previousAuthority.previous === 'function' ? previousAuthority.previous() : false;
    }
    if (action === 'forward') {
      var forwardAuthority = window.R4B1TRollAuthority;
      return forwardAuthority && typeof forwardAuthority.forward === 'function' ? forwardAuthority.forward() : false;
    }
    if (action === 'random-mode') {
      call('setMode', 'random');
      closeSheets();
      return;
    }
    if (action === 'branch-roll') {
      closeSheets();
      return runRollTransition('roll');
    }
    if (action === 'branch-generate') {
      call('sprout');
      window.setTimeout(syncBranch, 180);
      return;
    }
    if (action === 'visit') return call('visit');
    if (action === 'sprout') {
      if (branchModeActive()) call('sprout');
      else call('setMode', 'branch');
      openSheet('r4mBranchSheet');
      window.setTimeout(syncBranch, 180);
      return;
    }
    if (action === 'branch') {
      if (!branchModeActive()) call('setMode', 'branch');
      openSheet('r4mBranchSheet');
      window.setTimeout(syncBranch, 60);
      return;
    }
    if (action === 'keep' || action === 'share' || action === 'cut') {
      flashCopyTarget(sourceElement);
      window.setTimeout(function () { call('shareCard'); }, 120);
      return;
    }
    if (action === 'history') {
      closeSheets();
      return toggleHistoryWithMotion();
    }
    if (action === 'trail-file') {
      closeSheets();
      return call('openTrailLedger');
    }
    if (action === 'copy-trail') {
      if (call('shareTrail')) pulseMarkCopy();
      return;
    }
    if (action === 'comparison') {
      closeSheets();
      return call('toggleTrailComparison');
    }
    if (action === 'proof-session') {
      closeSheets();
      return call('toggleProofSession');
    }
    if (action === 'replay-inspection') {
      closeSheets();
      return call('openReplayInspection');
    }
    if (action === 'suggest-url') return call('submitUrl');
    if (action === 'blind-descent') {
      if (typeof window.openBlindDescent !== 'function' || typeof window.blindDescend !== 'function') return;
      closeSheets();
      document.documentElement.classList.add('blind-descending');
      Promise.resolve(window.openBlindDescent())
        .then(function () { return window.blindDescend(); })
        .catch(function (error) { console.error('Blind descent failed', error); });
      return;
    }
    if (action === 'topology') {
      closeSheets();
      if (typeof window.getLegacyTrailManifest !== 'function' || typeof window.openTrailTopology !== 'function') return;
      // Topology v2 verifies trail v0.1/v0.2 only. Use the explicit legacy
      // projection instead of feeding the default v0.3 artifact into it.
      Promise.resolve(window.getLegacyTrailManifest())
        .then(function (snapshot) { return window.openTrailTopology(snapshot); })
        .catch(function (error) { console.error('Trail topology failed', error); });
      return;
    }
    if (action === 'inspect') {
      syncInspect();
      return openSheet('r4mInspectSheet');
    }
  }

  function openSheet(id) {
    window.clearTimeout(sheetCloseTimer);
    ['r4mMenuSheet', 'r4mFilterSheet', 'r4mBranchSheet', 'r4mHelpSheet', 'r4mInspectSheet'].forEach(function (sheetId) {
      var candidate = byId(sheetId);
      if (candidate && sheetId !== id) {
        candidate.classList.remove('open', 'sheet-open');
        candidate.classList.add('sheet-close');
        candidate.setAttribute('aria-hidden', 'true');
      }
    });
    var sheet = byId(id);
    var backdrop = byId('r4mBackdrop');
    if (!sheet || !backdrop) return;
    backdrop.hidden = false;
    void backdrop.offsetWidth;
    window.requestAnimationFrame(function () {
      backdrop.classList.add('open');
      sheet.classList.remove('sheet-close');
      sheet.classList.add('open', 'sheet-open');
      sheet.setAttribute('aria-hidden', 'false');
      reportMotion(id.replace('r4m', '').replace('Sheet', '').toUpperCase(), sheet, 'open');
    });
    document.documentElement.classList.add('r4m-sheet-open');
    document.documentElement.classList.toggle('menu-open', id === 'r4mMenuSheet');
    var menuButton = byId('r4mNavMenu');
    if (menuButton) {
      var menuOpen = id === 'r4mMenuSheet';
      menuButton.setAttribute('aria-expanded', String(menuOpen));
      menuButton.classList.toggle('active', menuOpen);
      var menuLabel = byId('r4mNavMenuLabel');
      if (menuLabel) menuLabel.textContent = menuOpen ? 'CLOSE' : 'MENU';
    }
  }

  function closeSheets() {
    ['r4mMenuSheet', 'r4mFilterSheet', 'r4mBranchSheet', 'r4mHelpSheet', 'r4mInspectSheet'].forEach(function (id) {
      var sheet = byId(id);
      if (!sheet) return;
      sheet.classList.remove('open', 'sheet-open');
      sheet.classList.add('sheet-close');
      sheet.setAttribute('aria-hidden', 'true');
    });
    var backdrop = byId('r4mBackdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      window.clearTimeout(sheetCloseTimer);
      sheetCloseTimer = window.setTimeout(function () { backdrop.hidden = true; }, 330);
    }
    document.documentElement.classList.remove('r4m-sheet-open');
    document.documentElement.classList.remove('menu-open');
    var menuButton = byId('r4mNavMenu');
    if (menuButton) {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.classList.remove('active');
      var menuLabel = byId('r4mNavMenuLabel');
      if (menuLabel) menuLabel.textContent = 'MENU';
    }
  }

  function syncRoute() {
    var domain = currentDomain();
    var url = currentUrl();
    var route = byId('r4mRoute');
    var sourceTitle = byId('ogTitle');
    var sourceDesc = byId('ogDesc');
    var tagBadge = byId('tagBadge');
    var typedMeta = byId('typedResourceMeta');
    var typedType = byId('typedResourceType');
    var typedReason = byId('typedEligibilityReason');
    var typedProvenance = byId('typedProvenance');
    var counter = byId('counter');

    if (!route) return;
    var active = Boolean(domain && url);
    route.hidden = !active;
    document.documentElement.classList.toggle('r4m-has-route', active);
    if (active && !document.documentElement.classList.contains('r4m-stage-blind')) document.documentElement.classList.add('r4m-stage-result');
    if (!active) return;

    var displayDomain = hostnameFor(url, domain);
    var schemeMatch = String(url).match(/^([a-z][a-z0-9+.-]*:)(?:\/\/)?/i);
    var proto = schemeMatch ? schemeMatch[0] : '';
    var title = sourceTitle ? sourceTitle.textContent.trim() : '';
    var desc = sourceDesc ? sourceDesc.textContent.trim() : '';
    var tag = tagBadge && tagBadge.style.display !== 'none' ? tagBadge.textContent.trim() : '';
    var protoNode = byId('r4mProtocol');
    var titleNode = byId('r4mTitle');
    var descNode = byId('r4mDescription');
    var tagNode = byId('r4mTag');
    var verifiedTypedMeta = Boolean(typedMeta && typedMeta.dataset.state === 'verified');
    var typedTypeText = verifiedTypedMeta && typedType ? typedType.textContent.trim() : '';
    var typedReasonText = verifiedTypedMeta && typedReason ? typedReason.textContent.trim() : '';
    var typedProvenanceText = verifiedTypedMeta && typedProvenance ? typedProvenance.textContent.trim() : '';
    var mobileTypedMeta = byId('r4mTypedMeta');
    var mobileTypedType = byId('r4mResourceType');

    if (protoNode) {
      protoNode.textContent = proto;
      protoNode.hidden = !proto;
    }
    if (titleNode) titleNode.textContent = title || displayDomain;
    byId('r4mDomain').textContent = displayDomain.toUpperCase();
    byId('r4mUrl').textContent = url;
    if (descNode) {
      descNode.textContent = desc;
      descNode.hidden = !desc;
    }
    if (tagNode) {
      tagNode.textContent = tag;
      tagNode.hidden = !tag;
    }
    if (mobileTypedMeta) mobileTypedMeta.hidden = !verifiedTypedMeta;
    if (mobileTypedType) mobileTypedType.textContent = typedTypeText;
    byId('r4mInspectDomain').textContent = displayDomain;
    byId('r4mInspectUrl').textContent = url;
    byId('r4mInspectDesc').textContent = [title, desc].filter(Boolean).join(' — ') || 'NO SOURCE METADATA';
    byId('r4mInspectResourceType').textContent = typedTypeText || 'UNAVAILABLE';
    byId('r4mInspectEligibility').textContent = typedReasonText || 'UNAVAILABLE';
    byId('r4mInspectProvenance').textContent = typedProvenanceText || 'UNAVAILABLE';
    var routeIndex = 0;
    if (counter) {
      var m = counter.textContent.match(/\d+/);
      if (m) routeIndex = Number(m[0]);
    }
    if (!routeIndex) {
      var trailSource = byId('trailItems');
      routeIndex = trailSource ? trailSource.querySelectorAll('.trail-item').length : 0;
    }
    animateRouteCounter(routeIndex || 1);
    renderRouteWear();
    if (pendingRouteMotion) {
      var nextMotion = pendingRouteMotion;
      pendingRouteMotion = null;
      window.requestAnimationFrame(function () {
        playMotion(route, nextMotion, nextMotion === 'forward-enter' ? 400 : 460);
      });
    }
  }

  window.__r4b1tSyncMobileRoute = syncRoute;

  function renderRouteWear() {
    var host = byId('r4mRouteWear');
    if (!host || !window.R4b1tWear) return;
    var source = byId('trailItems');
    var items = source ? Array.from(source.querySelectorAll('.trail-item')) : [];
    var stops = items.map(function (item, index) {
      return {
        index: index,
        state: 'revealed',
        label: item.textContent.trim() || 'REVEALED ROUTE',
        action: 'ROLL'
      };
    });
    var current = currentDomain();
    if (current && (!stops.length || stops[stops.length - 1].label !== current)) {
      stops.push({ index: stops.length, state: 'revealed', label: current, action: 'CURRENT' });
    }
    window.R4b1tWear.render(host, {
      stops: stops,
      depth: stops.length,
      crease_count: Math.min(12, stops.length),
      fold_size: Math.min(20, 4 + stops.length)
    });
  }

  function syncInspect() { syncRoute(); renderRouteWear(); }

  function syncFilter() {
    var source = byId('catFilter');
    var dest = byId('r4mFilterOptions');
    if (!dest) return;
    var allSource = source ? source.querySelector('button[data-terrain-id="ALL"]') : null;
    var buttons = source ? Array.from(source.querySelectorAll('button[data-terrain-id]')).filter(function (button) {
      return button.dataset.terrainId !== 'ALL';
    }) : [];
    var activeSource = buttons.find(sourceFilterIsActive) || null;
    var allCount = allSource ? allSource.dataset.eligibleCount : '';
    dest.innerHTML = '';

    var label = byId('r4mFilterLabel');
    var scope = byId('r4mRollScope');
    if (label) label.textContent = activeSource ? (activeSource.dataset.terrainLabel || activeSource.textContent.trim().toUpperCase()) : 'ALL SIGNALS';
    if (scope && !scope.dataset.selectionStatus) {
      scope.textContent = activeSource ? terrainScopeText(activeSource) : (allCount ? 'FULL CORPUS · ' + allCount + ' ROUTES' : 'FULL CORPUS');
    }

    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'r4m-filter-proxy' + (!activeSource ? ' active' : '');
    all.setAttribute('aria-pressed', activeSource ? 'false' : 'true');
    all.textContent = allCount ? 'ALL SIGNALS · ' + allCount : 'ALL SIGNALS';
    all.addEventListener('click', function () {
      var currentAll = source ? source.querySelector('button[data-terrain-id="ALL"]') : null;
      if (currentAll) currentAll.click();
      closeSheets();
      window.setTimeout(syncFilter, 20);
    });
    dest.appendChild(all);

    buttons.forEach(function (button) {
      var id = button.dataset.terrainId;
      var proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.className = 'r4m-filter-proxy' + (sourceFilterIsActive(button) ? ' active' : '');
      proxy.textContent = button.textContent.trim();
      proxy.dataset.terrainId = id;
      proxy.setAttribute('aria-pressed', sourceFilterIsActive(button) ? 'true' : 'false');
      if (button.disabled) {
        proxy.disabled = true;
        proxy.setAttribute('aria-disabled', 'true');
      }
      if (button.title) proxy.title = button.title;
      proxy.addEventListener('click', function () {
        var current = source ? source.querySelector('button[data-terrain-id="' + id + '"]') : null;
        if (current && !current.disabled) current.click();
        closeSheets();
        window.setTimeout(syncFilter, 20);
      });
      dest.appendChild(proxy);
    });

    var status = byId('terrainStatus');
    if (status && status.dataset.state !== 'READY') {
      var note = document.createElement('p');
      note.className = 'r4m-sheet-note';
      note.textContent = status.textContent;
      dest.appendChild(note);
    } else if (!buttons.length) {
      var empty = document.createElement('p');
      empty.className = 'r4m-sheet-note';
      empty.textContent = 'Terrains appear after the corpus initializes.';
      dest.appendChild(empty);
    }
  }

  // Selection status (EMPTY / AUTHORITY UNAVAILABLE …) is shown on the ROLL apparatus until the next change.
  document.addEventListener('r4b1t:selection-status', function (event) {
    var scope = byId('r4mRollScope');
    if (!scope) return;
    var detail = event.detail || {};
    if (detail.message) {
      scope.textContent = detail.message;
      scope.dataset.selectionStatus = detail.status;
    } else if (scope.dataset.selectionStatus) {
      delete scope.dataset.selectionStatus;
      syncFilter();
    }
  });

  function syncBranch() {
    var source = byId('branchGrid');
    var dest = byId('r4mBranchOptions');
    if (!dest) return;
    var items = source ? Array.from(source.querySelectorAll('.branch-item')) : [];
    dest.innerHTML = '';

    if (!currentUrl()) {
      dest.innerHTML = '<div class="r4m-branch-empty" role="status">' +
        '<strong>NO CURRENT ROUTE</strong>' +
        '<p>Roll a route before generating directions.</p>' +
        '<button type="button" data-mobile-action="branch-roll">ROLL A ROUTE</button>' +
      '</div>';
      return;
    }
    if (!items.length) {
      dest.innerHTML = '<div class="r4m-branch-empty" role="status">' +
        '<strong>NO DIRECTIONS YET</strong>' +
        '<p>Generate four directions from the current route.</p>' +
        '<button type="button" data-mobile-action="branch-generate">GENERATE DIRECTIONS</button>' +
      '</div>';
      return;
    }

    items.forEach(function (item, index) {
      var proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.className = 'r4m-branch-proxy';
      proxy.innerHTML = '<span>' + String(index + 1).padStart(2, '0') + '</span><p>' + escapeHtml(item.textContent.trim()) + '</p>';
      proxy.addEventListener('click', function () {
        var currentItems = source ? source.querySelectorAll('.branch-item') : [];
        var current = currentItems[index];
        if (current) current.click();
        closeSheets();
      });
      dest.appendChild(proxy);
    });
  }

  function syncTrail() {
    var source = byId('trailItems');
    var dest = byId('r4mTrailItems');
    if (!dest) return;
    var items = source ? Array.from(source.querySelectorAll('.trail-item')) : [];
    dest.innerHTML = '';
    byId('r4mTrailCount').textContent = String(items.length).padStart(2, '0');

    if (!items.length) {
      dest.innerHTML = '<span class="r4m-empty">NO ROUTES YET</span>';
      return;
    }

    items.forEach(function (item, index) {
      var proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.className = 'r4m-trail-chip';
      proxy.innerHTML = '<b>' + String(index + 1).padStart(3, '0') + '</b><span>' + escapeHtml(item.textContent.trim()) + '</span>';
      proxy.addEventListener('click', function () {
        var current = source ? source.querySelectorAll('.trail-item')[index] : null;
        if (current) current.click();
      });
      dest.appendChild(proxy);
    });
  }

  function syncMode() {
    var random = byId('btnModeRandom');
    var mode = random && random.classList.contains('active') ? 'UNBOUNDED' : 'BRANCH';
    var target = byId('r4mModeLabel');
    if (target) target.textContent = mode;
  }

  function setPrimaryMode(mode) {
    var blind = mode === 'blind';
    document.documentElement.dataset.r4mPrimaryMode = blind ? 'blind' : 'roll';
    var rollMode = byId('r4mModeRoll');
    var blindMode = byId('r4mModeBlind');
    var descent = byId('r4mDescentEntry');
    var route = byId('r4mRouteMount');
    if (rollMode) { rollMode.classList.toggle('active', !blind); rollMode.setAttribute('aria-pressed', String(!blind)); }
    if (blindMode) { blindMode.classList.toggle('active', blind); blindMode.setAttribute('aria-pressed', String(blind)); }
    if (descent) descent.hidden = !blind;
    if (route) route.hidden = blind;
    document.documentElement.classList.toggle('r4m-stage-blind', blind);
    document.documentElement.classList.toggle('r4m-stage-result', !blind && Boolean(route && route.classList.contains('roll-disclosed')));
  }

  function resetRollStage() {
    if (markRollTimer !== null) { window.clearTimeout(markRollTimer); markRollTimer = null; }
    document.documentElement.classList.remove('r4m-stage-result', 'blind-descending', 'rolling', 'result-ready');
    var mount = byId('r4mRouteMount');
    if (mount) mount.hidden = false;
    setRollPresentationState('idle');
    setPrimaryMode('roll');
  }

  function syncEverything() {
    syncRoute();
    renderRouteWear();
    syncFilter();
    syncBranch();
    syncTrail();
    syncMode();
  }

  function watchNode(id, callback, options) {
    var node = byId(id);
    if (!node) return null;
    var observer = new MutationObserver(callback);
    observer.observe(node, options || { childList: true, subtree: true, characterData: true, attributes: true });
    return observer;
  }

  function observeSource() {
    if (syncObserver) return;
    var sources = ['previewDomain', 'previewUrl', 'ogTitle', 'ogDesc', 'tagBadge', 'darkBadge', 'typedResourceMeta', 'typedResourceType', 'typedEligibilityReason', 'typedProvenance', 'counter'];
    var observer = new MutationObserver(function () { window.requestAnimationFrame(syncRoute); });
    sources.forEach(function (id) {
      var node = byId(id);
      if (node) observer.observe(node, { childList: true, subtree: true, characterData: true, attributes: true });
    });
    syncObserver = observer;
    filterObserver = watchNode('catFilter', function () { window.requestAnimationFrame(syncFilter); });
    branchObserver = watchNode('branchGrid', function () { window.requestAnimationFrame(syncBranch); });
    trailObserver = watchNode('trailItems', function () { window.requestAnimationFrame(syncTrail); });
    watchNode('btnModeRandom', function () { window.requestAnimationFrame(syncMode); }, { attributes: true, attributeFilter: ['class'] });
  }

  function applyViewportMode() {
    var mobile = mq.matches;
    document.documentElement.dataset.r4b1tInterface = mobile ? 'mobile' : 'desktop';
    document.documentElement.classList.toggle('r4-mobile-active', mobile);
    if (!mobile) closeSheets();
    if (mobile) syncEverything();
  }

  function init() {
    buildShell();
    initMarkSecondary();
    // the desktop shell's copy control drives the same mark event
    document.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('#shareTrailBtn')) pulseMarkCopy();
    });
    applyViewportMode();
    setPrimaryMode('roll');
    var listener = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyViewportMode, 20);
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', listener);
    else if (typeof mq.addListener === 'function') mq.addListener(listener);

    var rollButton = byId('r4mRoll');
    if (rollButton) rollButton.addEventListener('click', function () {
      runRollTransition('roll');
    });
    window.addEventListener('pageshow', function (event) {
      // A bfcache restore resumes an already-settled instrument. Rebuilding the
      // shell here can replace presentation DOM and make Back feel like a new
      // route transition even though selection/reveal state has not changed.
      if (event && event.persisted) {
        renderRouteWear();
        return;
      }
      syncEverything();
    });
    document.addEventListener('r4b1t:reset', function () { window.setTimeout(syncEverything, 20); });
  }

  ready(init);
})();
