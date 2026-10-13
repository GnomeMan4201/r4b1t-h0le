(function (root) {
  'use strict';

  // Release gate: activate per preview with ?flow=sprout, or set the flag before
  // this deferred script. No selection, proof, or persistence authority here.
  var enabled = root.R4B1T_SPROUT_FLOW_ENABLED === true || new URLSearchParams(root.location.search).get('flow') === 'sprout';
  if (!enabled) return;
  var host, status, active = null, epoch = null, busy = false, rollTimer = null;
  var nodes = new Map();
  var order = 0;
  var pendingParent = null;
  var rollRevealed = false;
  var svgNS = 'http://www.w3.org/2000/svg';
  var paths = [
    {type: 'sideways', label: '/02_ALTERNATIVE', direction: 'left'},
    {type: 'deeper', label: '/01_DEEPER', direction: 'center'},
    {type: 'opposite', label: '/03_OPPOSITE', direction: 'right'}
  ];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action) {
    var node = el('button', 'sprout-control', text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function announce(message) { status.textContent = message; }
  function motionBusy() {
    var api = root.R4B1TRollProduction;
    var snapshot = api && api.snapshot();
    return Boolean(snapshot && snapshot.active);
  }
  function syncSproutNavigation() {
    var nav = document.getElementById('r4mNavRoll');
    if (!nav) return;
    function attribute(name, value) {
      if (value === null) { if (nav.hasAttribute(name)) nav.removeAttribute(name); }
      else if (nav.getAttribute(name) !== value) nav.setAttribute(name, value);
    }
    var sproutMode = !document.documentElement.classList.contains('r4m-stage-blind');
    attribute('data-mobile-action', sproutMode ? 'sprout' : 'nav-roll');
    var label = nav.querySelector('b');
    var text = sproutMode ? 'SPROUT' : 'ROLL';
    if (label && label.textContent !== text) label.textContent = text;
    var disabled = sproutMode && (!active || busy || motionBusy());
    if (nav.disabled !== disabled) nav.disabled = disabled;
    attribute('aria-label', sproutMode ? 'SPROUT roots from the active card' : null);
    attribute('aria-expanded', sproutMode ? String(Boolean(active && active.roots)) : null);
    attribute('aria-controls', sproutMode && active && active.roots ? active.section.id + '-targets' : null);
  }
  function updateControls() {
    var locked = busy || motionBusy();
    nodes.forEach(function (node) {
      node.roll.disabled = locked || node !== active;
      node.sprout.disabled = locked || Boolean(node.roots);
      node.branchButtons.forEach(function (b) { b.disabled = locked || b.dataset.unavailable === 'true'; });
    });
    if (host.start) host.start.disabled = locked;
    host.setAttribute('aria-busy', String(busy));
    syncSproutNavigation();
  }
  function finishRoll() {
    clearTimeout(rollTimer); rollTimer = null;
    busy = motionBusy(); pendingParent = null; updateControls();
    if (busy) rollTimer = setTimeout(checkRoll, 100);
  }
  function roll() {
    if (busy || motionBusy()) return;
    pendingParent = active;
    rollRevealed = false;
    busy = true; announce('ROLLING…'); updateControls();
    try {
      if (document.documentElement.classList.contains('r4-mobile-active')) {
        if (!root.R4B1TRollProduction || !root.R4B1TRollProduction.roll({reel: true})) throw new Error('Roll unavailable. Try again.');
      } else {
        if (typeof root.roll !== 'function') throw new Error('Roll authority is not ready.');
        root.roll();
      }
      // Actual cards only land from route-revealed. Failed commits create none.
      if (busy) rollTimer = setTimeout(checkRoll, 100);
    } catch (error) { finishRoll(); announce(error.message); }
  }
  function checkRoll() {
    if (!busy) return;
    if (!motionBusy()) { finishRoll(); if (!rollRevealed) announce('No route revealed. You can retry ROLL.'); return; }
    rollTimer = setTimeout(checkRoll, 100);
  }
  function rootsSvg() {
    var svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('sprout-roots');
    svg.setAttribute('viewBox', '0 0 600 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    [
      'M300 0 C300 14 296 23 300 34 L300 100',
      'M300 28 C266 48 199 36 168 53 S100 74 100 100',
      'M300 28 C334 48 401 36 432 53 S500 74 500 100'
    ].forEach(function (d, index) { var path = document.createElementNS(svgNS, 'path'); path.setAttribute('d', d); path.dataset.type = ['deeper', 'sideways', 'opposite'][index]; svg.appendChild(path); });
    return svg;
  }
  function sprout(node) {
    if (busy || motionBusy() || node.roots) return;
    try {
      var targets = root.getSproutTargets(node.receipt.url);
      node.targets = new Map(targets.map(function (target) { return [target.type, target]; }));
      var branches = el('div', 'sprout-targets');
      branches.id = node.section.id + '-targets';
      branches.setAttribute('role', 'group');
      branches.setAttribute('aria-label', 'Roots from ' + node.receipt.url);
      node.roots = rootsSvg();
      paths.forEach(function (path) {
        var target = node.targets.get(path.type);
        var b = button(path.label, function () { choose(node, path.type); });
        b.replaceChildren(el('span', 'sprout-target-index', path.label.slice(0, 4)), el('span', 'sprout-target-name', path.label.slice(4)));
        b.dataset.direction = path.direction;
        b.setAttribute('aria-expanded', 'false');
        if (!target) { b.disabled = true; b.dataset.unavailable = 'true'; b.title = 'No route available for this direction'; }
        else b.title = target.reason;
        node.branchButtons.set(path.type, b); branches.appendChild(b);
      });
      node.sprout.setAttribute('aria-expanded', 'true');
      node.sprout.setAttribute('aria-controls', branches.id);
      node.card.after(node.roots, branches);
      updateControls(); announce('Three roots. Choose a direction.');
    } catch (error) { announce(error.message || 'Roots unavailable. Try again.'); }
  }
  function choose(node, type) {
    if (busy || motionBusy()) return;
    if (node.children.has(type)) { node.children.get(type).heading.focus(); return; }
    var target = node.targets.get(type);
    if (!target) return;
    busy = true; updateControls();
    try {
      var receipt = root.selectSproutBranch({
        originUrl: node.receipt.url, fromStep: node.receipt.step, epoch: node.receipt.epoch,
        url: target.url, type: type
      });
      if (!receipt) throw new Error('Branch unavailable or recording failed. SPROUT a fresh card after a corpus change.');
      // The synchronous reveal event already appended exactly one card.
      var child = nodes.get(receipt.step);
      if (child) {
        var b = node.branchButtons.get(type);
        b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-controls', child.section.id);
        var followed = node.roots.querySelector('[data-type=' + type + ']');
        if (followed) followed.classList.add('sprout-root-followed');
        child.heading.focus({preventScroll: true});
        child.section.scrollIntoView({behavior: root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
      }
    } catch (error) { announce(error.message || 'Branch failed. Try again.'); }
    finally { busy = false; updateControls(); }
  }
  function safeUrl(value) {
    try { var u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; }
    catch (_) { return false; }
  }
  function land(receipt) {
    if (!host || !receipt || !Number.isInteger(receipt.step) || !safeUrl(receipt.url)) return;
    if (epoch !== receipt.epoch) clear(receipt.epoch);
    if (nodes.has(receipt.step)) return;
    var parent = receipt.kind === 'BRANCH' ? nodes.get(receipt.fromStep) : pendingParent || active;
    var section = el('section', 'sprout-stage');
    section.id = 'sprout-step-' + receipt.step;
    section.dataset.step = receipt.step;
    section.dataset.kind = receipt.kind;
    section.dataset.direction = receipt.kind === 'BRANCH' ? receipt.branchLabel : 'roll';
    var card = el('article', 'sprout-card');
    var meta = el('small', 'sprout-step-label', '#' + String(receipt.step).padStart(3, '0') + ' / ' + receipt.kind + (receipt.branchLabel ? ' / ' + (receipt.branchLabel === 'sideways' ? 'ALTERNATIVE' : receipt.branchLabel.toUpperCase()) : ''));
    var heading = el('h2', 'sprout-title', new URL(receipt.url).hostname + new URL(receipt.url).pathname);
    heading.tabIndex = -1;
    var domain = el('strong', 'sprout-domain', new URL(receipt.url).hostname.replace(/^www\./, ''));
    var snippet = el('p', 'sprout-snippet'); snippet.hidden = true;
    var url = el('code', 'sprout-url', receipt.url);
    var open = el('a', 'sprout-open', 'OPEN DESTINATION ↗');
    open.href = receipt.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
    var actions = el('div', 'sprout-actions');
    var node = {receipt: Object.freeze(Object.assign({}, receipt)), section: section, card: card, heading: heading, snippet: snippet, roots: null, children: new Map(), branchButtons: new Map(), targets: new Map()};
    node.roll = button('[ ROLL AGAIN ]', roll);
    node.sprout = button('[ SPROUT ]', function () { sprout(node); });
    node.sprout.setAttribute('aria-expanded', 'false');
    actions.append(node.roll, node.sprout); card.append(meta, domain, heading, snippet, url, open, actions);
    var children = el('div', 'sprout-children'); node.childHost = children;
    section.append(card, children);
    nodes.set(receipt.step, node);
    if (parent) {
      parent.childHost.appendChild(section);
      if (receipt.kind === 'BRANCH') parent.children.set(receipt.branchLabel, node);
    } else host.insertBefore(section, status);
    active = node;
    if (host.start) host.start.hidden = true;
    order += 1;
    syncMetadata();
    if (receipt.kind === 'ROLL') { rollRevealed = true; finishRoll(); }
    updateControls(); announce('Landed step ' + receipt.step + '.');
  }
  function syncMetadata() {
    // Presentation only. The route identity comes exclusively from the receipt.
    if (!active) return;
    var url = document.getElementById('previewUrl');
    if (!url || url.textContent.trim() !== active.receipt.url) return;
    var title = document.getElementById('ogTitle'), description = document.getElementById('ogDesc');
    if (title && title.textContent.trim()) active.heading.textContent = title.textContent.trim();
    active.snippet.textContent = description ? description.textContent.trim() : '';
    active.snippet.hidden = !active.snippet.textContent;
  }
  function clear(nextEpoch) {
    clearTimeout(rollTimer); rollTimer = null;
    nodes.forEach(function (node) { node.section.remove(); }); nodes.clear();
    active = pendingParent = null; busy = false; epoch = nextEpoch; order = 0;
    if (host && host.start) host.start.hidden = false;
    if (host) { updateControls(); announce('Roll to begin a new descent.'); }
  }
  function placeHost() {
    var mobile = document.documentElement.classList.contains('r4-mobile-active');
    var parent = mobile ? document.getElementById('r4mPrimaryStage') : document.querySelector('.rig');
    if (parent && host.parentNode !== parent) parent.appendChild(host);
    syncSproutNavigation();
  }
  function start() {
    host = el('div', 'sprout-flow'); host.id = 'sproutFlow'; host.setAttribute('aria-label', 'Continuous descent');
    host.start = button('[ ROLL AGAIN ]', roll); host.start.classList.add('sprout-start');
    status = el('p', 'sprout-status', 'Roll. Land. Sprout.'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    host.append(host.start, status);
    document.documentElement.classList.add('r4-sprout-flow'); placeHost();
    new MutationObserver(placeHost).observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
    var source = document.getElementById('preview');
    if (source) new MutationObserver(syncMetadata).observe(source, {subtree: true, childList: true, characterData: true});
    document.addEventListener('r4b1t:route-revealed', function (event) { land(event.detail); });
    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented || document.documentElement.classList.contains('r4m-stage-blind') ||
          event.target.closest('button,a,input,textarea,select,[contenteditable=true],[role=dialog]') ||
          document.querySelector('[aria-modal=true][aria-hidden=false]')) return;
      if (!['KeyP', 'Space', 'KeyS'].includes(event.code)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.code === 'KeyP') { if (active) sprout(active); }
      else roll();
    }, true);
    root.addEventListener('pageshow', function (event) {
      if (event.persisted && busy) { clearTimeout(rollTimer); checkRoll(); }
    });
    document.addEventListener('r4b1t:trail-reset', function (event) { clear(event.detail.epoch); });
    // Persisted ledger remains authoritative. This presentation tree intentionally
    // starts empty on reload; it never fabricates previous reveal boundaries.
    root.R4B1TSproutFlow = Object.freeze({
      enabled: true,
      roll: roll,
      sproutCurrent: function () {
        if (active) {
          sprout(active);
          var target = active.branchButtons.get('deeper');
          if (!target || target.disabled) target = active.heading;
          target.focus({preventScroll: true});
          target.scrollIntoView({behavior: root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center'});
        }
        else announce('Roll a card first.');
      },
      snapshot: function () { return Object.freeze({cards: order, busy: busy, activeStep: active ? active.receipt.step : null}); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})(window);
