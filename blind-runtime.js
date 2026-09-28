(function () {
  'use strict';

  var api = window.R4b1tBlind;
  var trail = window.R4b1tTrail;
  var corpusAuthority = window.R4b1tCorpusAuthority;
  if (!api || !trail) return;
  if (!corpusAuthority) throw new Error('Corpus authority unavailable');

  var PUBLIC_KEY = 'r4b1t_blind_public_v02';
  var PRIVATE_KEY = 'r4b1t_blind_private_v02';
  var state = {
    manifest: null,
    secrets: {},
    corpus: null,
    corpusRevision: null,
    currentDepth: 0,
    revealedUrl: null,
    ready: null
  };

  function mobileBlindStage() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function terrain() {
    return 'ALL SIGNALS';
  }

  async function loadCorpus() {
    if (state.corpus) return state.corpus;
    var loaded = await corpusAuthority.loadActive();
    state.corpusRevision = loaded.revision;
    state.corpus = loaded.urls.slice();
    return state.corpus;
  }

  function uniformIndex(length) {
    if (!Number.isSafeInteger(length) || length < 1 || length > 0xffffffff) {
      throw new RangeError('Blind sampler pool size is invalid');
    }
    var range = 0x100000000;
    var limit = range - (range % length);
    var sample = new Uint32Array(1);
    do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
    return sample[0] % length;
  }

  function save() {
    localStorage.setItem(PUBLIC_KEY, JSON.stringify({
      manifest: state.manifest,
      currentDepth: state.currentDepth
    }));
    localStorage.setItem(PRIVATE_KEY, JSON.stringify(state.secrets));
  }

  async function restoreOrCreate() {
    await loadCorpus();
    try {
      var saved = JSON.parse(localStorage.getItem(PUBLIC_KEY) || 'null');
      var secrets = JSON.parse(localStorage.getItem(PRIVATE_KEY) || '{}');
      if (saved && saved.manifest) {
        await api.verify(await api.envelope(saved.manifest));
        if (!saved.manifest.genesis || saved.manifest.genesis.corpus_revision !== state.corpusRevision) {
          throw new Error('Corpus revision mismatch');
        }
        state.manifest = saved.manifest;
        state.currentDepth = Number.isSafeInteger(saved.currentDepth) ?
          Math.min(state.manifest.steps.length, Math.max(0, saved.currentDepth)) : 0;
        state.secrets = secrets && typeof secrets === 'object' ? secrets : {};
        return;
      }
    } catch (_) {
      localStorage.removeItem(PUBLIC_KEY);
      localStorage.removeItem(PRIVATE_KEY);
      state.manifest = null;
      state.secrets = {};
      state.currentDepth = 0;
      state.revealedUrl = null;
    }
    state.manifest = await api.create({
      corpus_revision: state.corpusRevision,
      terrain: terrain(),
      parent: null
    });
    save();
  }

  async function ready() {
    if (!state.ready) state.ready = restoreOrCreate();
    await state.ready;
  }

  async function descend() {
    await ready();
    var url = state.corpus[uniformIndex(state.corpus.length)];
    var committed = await api.commit(state.manifest, url);
    state.manifest = committed.manifest;
    state.secrets[String(committed.secret.index)] = committed.secret;
    state.currentDepth += 1;
    state.revealedUrl = null;
    save();
    render('CONCEALED / COMMITMENT PRESENT', { motion: 'descend' });
    return api.envelope(state.manifest);
  }

  function lastConcealedIndex() {
    for (var index = state.manifest.steps.length - 1; index >= 0; index -= 1) {
      if (state.manifest.steps[index].state === 'concealed') return index;
    }
    return -1;
  }

  async function reveal(index) {
    await ready();
    var selected = typeof index === 'number' ? index : lastConcealedIndex();
    if (selected < 0) throw new Error('No concealed route to reveal');
    var secret = state.secrets[String(selected)];
    if (!secret) throw new Error('Reveal secret is unavailable on this device');
    state.manifest = await api.reveal(state.manifest, secret);
    var verified = await api.verify(await api.envelope(state.manifest));
    if (verified.statuses[selected].status !== 'COMMITMENT VERIFIED') {
      throw new Error('Reveal verification did not complete');
    }
    state.revealedUrl = secret.url;
    delete state.secrets[String(selected)];
    save();
    if (typeof window.selectUrl === 'function') window.selectUrl(secret.url);
    if (typeof window.__r4b1tRecordHistorySelection === 'function') {
      window.__r4b1tRecordHistorySelection(secret.url, 'BLIND_REVEAL');
    }
    render('REVEALED / COMMITMENT VERIFIED', { revealIndex: selected, motion: 'reveal' });
    return secret.url;
  }

  async function returnTowardSurface() {
    await ready();
    var returnFromIndex = Math.max(0, state.currentDepth - 1);
    state.currentDepth = Math.max(0, state.currentDepth - 1);
    save();
    render('RETURNING / COMMITMENTS UNCHANGED', {
      motion: 'return',
      returnFromIndex: returnFromIndex
    });
    return state.currentDepth;
  }

  async function currentEnvelope() {
    await ready();
    return api.envelope(state.manifest);
  }

  async function exportSnapshot() {
    var result = await currentEnvelope();
    var blob = new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json' });
    var link = document.createElement('a');
    link.download = 'r4b1t-blind-' + result.trail_id.slice(7, 19) + '.json';
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
    if (window.rememberTopologySnapshot) await window.rememberTopologySnapshot(result);
    render('SNAPSHOT EXPORTED / PRIVATE SECRETS WITHHELD');
    return result;
  }

  async function reset() {
    state.manifest = null;
    state.secrets = {};
    state.currentDepth = 0;
    state.revealedUrl = null;
    state.ready = null;
    localStorage.removeItem(PUBLIC_KEY);
    localStorage.removeItem(PRIVATE_KEY);
    await ready();
    render('NEW GENESIS / DEPTH 000');
  }

  function ensureOverlay() {
    if (document.getElementById('blindDescentOverlay')) return;
    var style = document.createElement('style');
    style.textContent =
      '#blindDescentOverlay{display:none;position:fixed;inset:0;z-index:10040;background:radial-gradient(circle at 50% 22%,#311010 0,#120d0d 34%,#070707 78%);color:#e8e0d0;font-family:"DM Mono",monospace;overflow:auto}' +
      '#blindDescentOverlay.open{display:block}' +
      '.blind-grid{min-height:100%;display:grid;grid-template-rows:auto 1fr auto;width:min(780px,100%);margin:auto;padding:24px;gap:20px;background-image:linear-gradient(#cc11110a 1px,transparent 1px),linear-gradient(90deg,#cc11110a 1px,transparent 1px);background-size:44px 44px}' +
      '.blind-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #49312c;padding-bottom:14px}' +
      '.blind-kicker{font-size:10px;letter-spacing:.24em;color:#ff3333}' +
      '.blind-title{font-family:"Bebas Neue",sans-serif;font-size:clamp(38px,9vw,74px);line-height:.9;letter-spacing:.05em}' +
      '.blind-depth{text-align:right;font-family:"Bebas Neue",sans-serif;font-size:48px;color:#ff3333;line-height:.85}' +
      '.blind-depth small{display:block;font-family:"DM Mono",monospace;font-size:8px;letter-spacing:.2em;color:#9a8f7a;margin-top:8px}' +
      '.blind-card{align-self:center;position:relative;border:1px solid #60342e;border-left:8px dotted #cc1111;background:#15100fee;padding:30px;min-height:300px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;box-shadow:0 18px 0 #220808;transition:transform .3s,border-radius .3s}' +
      '.blind-card:before{content:"";position:absolute;inset:0;background:url("rabbit-aperture.svg") center/78% no-repeat;opacity:.055;pointer-events:none}' +
      '.blind-state{position:relative;font-size:10px;letter-spacing:.2em;color:#ff3333;margin-bottom:24px}' +
      '.blind-message{position:relative;font-family:"Bebas Neue",sans-serif;font-size:clamp(42px,10vw,86px);line-height:.9;max-width:620px}' +
      '.blind-message span{color:#ff3333}' +
      '.blind-proof{position:relative;font-size:9px;line-height:1.7;color:#9a8f7a;margin-top:24px;overflow-wrap:anywhere}' +
      '.blind-wear{margin-top:16px}' +
      '.blind-chain{display:flex;gap:7px;flex-wrap:wrap;min-height:18px}' +
      '.blind-link{width:16px;height:16px;border:1px solid #60342e;transform:rotate(45deg)}' +
      '.blind-link.revealed{background:#cc1111}.blind-link.concealed{background:#24100e}' +
      '.blind-actions{display:grid;grid-template-columns:2fr 2fr 1fr;gap:8px}' +
      '.blind-actions button{font:500 11px "DM Mono",monospace;letter-spacing:.14em;padding:15px 10px;border:1px solid #60342e;background:#120d0d;color:#e8e0d0;cursor:pointer}' +
      '.blind-actions button[data-blind-action="descend"],.blind-actions button[data-blind-action="reveal"]{background:#15100e;color:#e8e0d0;border-color:#ff3333}' +
      '.blind-actions button[data-blind-action="return"]{background:transparent;color:#9a8f7a;border-color:#49312c}' +
      '.blind-subactions{display:flex;justify-content:space-between;gap:8px;margin-top:8px}' +
      '.blind-subactions button{font:9px "DM Mono",monospace;letter-spacing:.14em;padding:9px;background:none;color:#9a8f7a;border:1px solid #49312c}' +
      '@media(max-width:600px){.blind-grid{padding:18px 14px}.blind-card{min-height:360px;padding:24px 20px}.blind-actions{grid-template-columns:1fr 1fr}.blind-actions button:last-child{grid-column:1/-1}}';
    document.head.appendChild(style);

    var mobileStyle = document.createElement('style');
    mobileStyle.textContent =
      '@media(max-width:900px){' +
      '#blindDescentOverlay{inset:0 0 calc(64px + env(safe-area-inset-bottom)) 0;z-index:9000;background:#0c0c0b;color:#ece9e1;overflow:auto}' +
      '#blindDescentOverlay .blind-grid{width:min(100%,560px);min-height:100%;margin:0 auto;padding:18px 20px 24px;gap:0;grid-template-rows:auto 1fr auto;background:none}' +
      '#blindDescentOverlay .blind-head{padding:0 0 14px;border-bottom:1px solid #2b2a27;align-items:flex-end}' +
      '#blindDescentOverlay .blind-kicker{color:#8e8b84;font-size:8px;letter-spacing:.16em}' +
      '#blindDescentOverlay .blind-title{margin:4px 0 0;color:#ece9e1;font-size:clamp(42px,14vw,66px);letter-spacing:.01em}' +
      '#blindDescentOverlay .blind-depth{color:#ece9e1;font-size:44px}' +
      '#blindDescentOverlay .blind-depth small{color:#8e8b84;letter-spacing:.12em}' +
      '#blindDescentOverlay .blind-card{min-height:150px;margin:22px 0 12px;padding:18px 0;border:0;border-radius:0!important;background:transparent;box-shadow:none!important;transform:none!important}' +
      '#blindDescentOverlay .blind-card:before{display:none}' +
      '#blindDescentOverlay .blind-state{margin-bottom:14px;color:#8e8b84;font-size:8px;letter-spacing:.14em}' +
      '#blindDescentOverlay .blind-message{font-size:clamp(38px,12vw,58px);color:#ece9e1}' +
      '#blindDescentOverlay .blind-proof{margin-top:14px;color:#77746e;font-size:8px;line-height:1.5}' +
      '#blindDescentOverlay .blind-strata{position:relative;margin:8px 0 18px;padding:4px 0 4px 22px;border-left:1px solid #3a3935}' +
      '#blindDescentOverlay .blind-stratum{position:relative;display:grid;grid-template-columns:42px 1fr auto;align-items:center;min-height:36px;border-bottom:1px solid #20201e;color:#6f6c66;font-size:8px;letter-spacing:.09em}' +
      '#blindDescentOverlay .blind-stratum:before{content:"";position:absolute;left:-27px;top:50%;width:10px;height:1px;background:#4a4944}' +
      '#blindDescentOverlay .blind-stratum[data-current-depth="true"]{color:#ece9e1}' +
      '#blindDescentOverlay .blind-stratum[data-current-depth="true"]:before{left:-29px;width:14px;height:2px;background:#ece9e1}' +
      '#blindDescentOverlay .blind-stratum[data-reveal-target="true"]{color:#ff3333}' +
      '#blindDescentOverlay .blind-stratum[data-reveal-target="true"]:after{content:"";position:absolute;inset:5px -2px 5px -9px;border:1px solid #ff3333;pointer-events:none}' +
      '#blindDescentOverlay .blind-stratum-depth{font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:.04em}' +
      '#blindDescentOverlay .blind-stratum-state{text-align:right}' +
      '#blindDescentOverlay .blind-reveal-target{min-height:28px;display:flex;align-items:center;border-top:1px solid #2b2a27;color:#ff3333;font-size:8px;letter-spacing:.13em}' +
      '#blindDescentOverlay .blind-wear{margin:0 0 18px;opacity:.7}' +
      '#blindDescentOverlay .blind-actions{grid-template-columns:1fr 1fr 90px;gap:0;border-top:1px solid #2b2a27;border-bottom:1px solid #2b2a27}' +
      '#blindDescentOverlay .blind-actions button{min-height:56px;border:0;border-right:1px solid #2b2a27;background:transparent;color:#ece9e1;padding:10px;font-size:9px}' +
      '#blindDescentOverlay .blind-actions button[data-blind-action="descend"],#blindDescentOverlay .blind-actions button[data-blind-action="reveal"]{background:transparent;color:#ece9e1;border-color:#2b2a27}' +
      '#blindDescentOverlay .blind-actions button[data-blind-action="return"]{border-right:0;color:#8e8b84}' +
      '#blindDescentOverlay .blind-subactions{gap:0;margin:8px 0 0;flex-wrap:wrap}' +
      '#blindDescentOverlay .blind-subactions button{min-height:36px;border:0;border-bottom:1px solid #2b2a27;color:#77746e;padding:8px 6px;font-size:7px}' +
      '}' ;
    document.head.appendChild(mobileStyle);

    var overlay = document.createElement('section');
    overlay.id = 'blindDescentOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'blindDescentTitle');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('tabindex', '-1');
    overlay.innerHTML = '<div class="blind-grid">' +
      '<header class="blind-head"><div><div class="blind-kicker">APERTURE / BLIND</div><h2 class="blind-title" id="blindDescentTitle">BLIND DESCENT</h2></div><div class="blind-depth" id="blindDepth">000<small>DEPTH / COMMITTED</small></div></header>' +
      '<div><article class="blind-card" id="blindCard"><div class="blind-state" id="blindStatus">READY / NOTHING SELECTED</div><div class="blind-message" id="blindMessage">DESCEND WITHOUT <span>LOOKING.</span></div><div class="blind-proof" id="blindProof">Selection happens before reveal. Reveal cannot reroll, replace, filter, or reject.</div></article><div class="blind-strata" id="blindStrata" aria-label="Blind descent strata"></div><div class="blind-wear" id="blindWear" aria-label="Persistent trail wear"></div></div>' +
      '<footer><div class="blind-reveal-target" id="blindRevealTarget">NO CONCEALED COMMITMENT</div><div class="blind-actions"><button type="button" data-blind-action="descend">DESCEND BLIND</button><button type="button" data-blind-action="reveal" aria-describedby="blindRevealTarget">REVEAL ROUTE</button><button type="button" data-blind-action="return">RETURN</button></div><div class="blind-subactions"><button type="button" data-blind-action="export">EXPORT PUBLIC SNAPSHOT</button><button type="button" data-blind-action="topology">MAP TRAILS</button><button type="button" data-blind-action="reset">NEW GENESIS</button><button type="button" data-blind-action="close">CLOSE</button></div></footer>' +
    '</div>';
    overlay.addEventListener('click', function (event) {
      var button = event.target.closest('[data-blind-action]');
      if (!button) return;
      var action = button.dataset.blindAction;
      if (action === 'descend') descend().catch(showError);
      if (action === 'reveal') reveal().catch(showError);
      if (action === 'return') returnTowardSurface().catch(showError);
      if (action === 'export') exportSnapshot().catch(showError);
      if (action === 'topology') currentEnvelope().then(function (snapshot) { close(); return window.openTrailTopology(snapshot); }).catch(showError);
      if (action === 'reset') reset().catch(showError);
      if (action === 'close') close();
    });
    document.body.appendChild(overlay);
  }

  function renderStrata() {
    var host = document.getElementById('blindStrata');
    var target = document.getElementById('blindRevealTarget');
    if (!host || !target || !state.manifest) return;

    var revealIndex = lastConcealedIndex();
    var revealDepth = revealIndex >= 0 ? revealIndex + 1 : 0;
    host.replaceChildren();

    state.manifest.steps.forEach(function (step, index) {
      var depth = index + 1;
      var row = document.createElement('div');
      row.className = 'blind-stratum';
      row.dataset.blindDepth = String(depth);
      if (depth === state.currentDepth) row.dataset.currentDepth = 'true';
      if (index === revealIndex) row.dataset.revealTarget = 'true';

      var depthNode = document.createElement('span');
      depthNode.className = 'blind-stratum-depth';
      depthNode.textContent = String(depth).padStart(2, '0');

      var commitment = document.createElement('span');
      commitment.className = 'blind-stratum-commitment';
      commitment.textContent = String(step.commitment || '').slice(0, 12);

      var stateNode = document.createElement('span');
      stateNode.className = 'blind-stratum-state';
      stateNode.textContent = String(step.state || '').toUpperCase();

      row.append(depthNode, commitment, stateNode);
      host.appendChild(row);
    });

    target.textContent = revealDepth ?
      'LAST CONCEALED · ' + String(revealDepth).padStart(2, '0') :
      'NO CONCEALED COMMITMENT';
  }

  function render(status, transition) {
    ensureOverlay();
    if (!state.manifest) return;
    var wear = api.deriveWear(state.manifest);
    var card = document.getElementById('blindCard');
    var message = document.getElementById('blindMessage');
    var proof = document.getElementById('blindProof');
    document.getElementById('blindDepth').firstChild.nodeValue = String(state.currentDepth).padStart(3, '0');
    document.getElementById('blindStatus').textContent = status || 'READY / COMMIT LOCALLY';
    renderStrata();
    card.style.transform = 'rotate(' + Math.min(wear.committed_count * 0.13, 1.3) + 'deg)';
    card.style.borderRadius = '0 0 ' + wear.fold_size + 'px 0';
    transition = transition || {};
    card.classList.remove('ink-reveal-card', 'motion-descend-card', 'motion-return-card');
    void card.offsetWidth;
    card.classList.toggle('revealed', Boolean(state.revealedUrl));
    if (transition.motion === 'reveal') card.classList.add('ink-reveal-card');
    if (transition.motion === 'descend') card.classList.add('motion-descend-card');
    if (transition.motion === 'return') card.classList.add('motion-return-card');
    if (state.revealedUrl) {
      var domain = new URL(state.revealedUrl).hostname.replace(/^www\./, '');
      message.textContent = domain;
      proof.textContent = state.revealedUrl;
    } else if (state.manifest.steps.length) {
      message.innerHTML = 'ROUTE <span>COMMITTED.</span>';
      proof.textContent = state.manifest.steps[state.manifest.steps.length - 1].commitment;
    } else {
      message.innerHTML = 'DESCEND WITHOUT <span>LOOKING.</span>';
      proof.textContent = 'Selection happens before reveal. Reveal cannot reroll, replace, filter, or reject.';
    }
    if (window.R4b1tWear) {
      window.R4b1tWear.render(document.getElementById('blindWear'), state.manifest, {
        depth: state.currentDepth,
        crease_count: wear.creases,
        fold_size: wear.fold_size,
        motion: transition.motion === 'reveal' ? null : transition.motion,
        revealIndex: transition.revealIndex,
        returnFromIndex: transition.returnFromIndex
      });
    }
  }

  function showError(error) {
    render('REJECTED / ' + String(error && error.message || error).toUpperCase());
  }

  var overlayFocus = null;

  function overlayFocusables(overlay) {
    return Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null; });
  }

  function focusOverlay(overlay) {
    var items = overlayFocusables(overlay);
    (items[0] || overlay).focus();
  }

  function trapOverlayTab(event, overlay) {
    if (event.code !== 'Tab') return false;
    var items = overlayFocusables(overlay);
    if (!items.length) {
      event.preventDefault();
      overlay.focus();
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

  async function open() {
    ensureOverlay();
    await ready();
    render('READY / COMMIT LOCALLY');
    var overlay = document.getElementById('blindDescentOverlay');
    overlayFocus = document.activeElement;
    var mobile = mobileBlindStage();
    overlay.classList.toggle('mobile-stage', mobile);
    overlay.setAttribute('aria-modal', mobile ? 'false' : 'true');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(function () { focusOverlay(overlay); }, 0);
  }

  function close() {
    var overlay = document.getElementById('blindDescentOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    var restore = overlayFocus;
    overlayFocus = null;
    if (restore && typeof restore.focus === 'function') setTimeout(function () { restore.focus(); }, 0);
  }

  window.openBlindDescent = open;
  window.closeBlindDescent = close;
  window.blindDescend = descend;
  window.blindReveal = reveal;
  window.blindReturn = returnTowardSurface;
  window.getBlindManifest = currentEnvelope;
  window.resetBlindTrail = reset;

  document.addEventListener('DOMContentLoaded', function () {
    ensureOverlay();
    ready().then(function () { render(); }).catch(showError);
  });

  document.addEventListener('keydown', function (event) {
    var overlay = document.getElementById('blindDescentOverlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (!mobileBlindStage() && trapOverlayTab(event, overlay)) {
      event.stopImmediatePropagation();
      return;
    }
    if (event.target.closest && event.target.closest('button,a,input,textarea,select,[contenteditable=true]')) return;
    if (!['Space', 'Enter', 'Backspace'].includes(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.code === 'Space') descend().catch(showError);
    if (event.code === 'Enter') reveal().catch(showError);
    if (event.code === 'Backspace') returnTowardSurface().catch(showError);
  }, true);
})();
