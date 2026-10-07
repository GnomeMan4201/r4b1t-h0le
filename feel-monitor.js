(function (root) {
  'use strict';

  var enabled = false;
  try {
    enabled = new URLSearchParams(root.location.search).get('feel') === '1';
  } catch (_) {}
  if (!enabled) return;

  var overlay = null;
  var reel = null;
  var phaseObserver = null;
  var findObserver = null;
  var frameId = 0;
  var sampling = false;
  var lastFrameAt = null;
  var lockAt = null;
  var lockSignature = null;
  var lastPhase = null;

  function blankRun() {
    return {
      startedAt: null,
      spinStartedAt: null,
      spinMs: null,
      framesOver20: 0,
      worstFrameMs: 0,
      hitStopMs: null,
      rabbitStartMs: null,
      rabbitEndMs: null,
      rabbitCancel: 0
    };
  }

  var run = blankRun();

  function now() {
    return root.performance && typeof root.performance.now === 'function'
      ? root.performance.now()
      : Date.now();
  }

  function relative(at) {
    if (run.startedAt === null || at === null) return null;
    return Math.max(0, Math.round(at - run.startedAt));
  }

  function fmtMs(value, digits) {
    if (value === null || !Number.isFinite(value)) return '—';
    return Number(value).toFixed(digits || 0) + ' ms';
  }

  function render() {
    if (!overlay) return;
    var spin = overlay.querySelector('#r4mFeelSpin');
    var longFrames = overlay.querySelector('#r4mFeelLongFrames');
    var worst = overlay.querySelector('#r4mFeelWorst');
    var hit = overlay.querySelector('#r4mFeelHitStop');
    var rabbit = overlay.querySelector('#r4mFeelRabbit');
    if (spin) spin.textContent = fmtMs(run.spinMs, 0);
    if (longFrames) longFrames.textContent = String(run.framesOver20);
    if (worst) worst.textContent = fmtMs(run.worstFrameMs || null, 1);
    if (hit) hit.textContent = fmtMs(run.hitStopMs, 0);
    if (rabbit) {
      var start = run.rabbitStartMs === null ? '—' : '+' + run.rabbitStartMs + 'ms';
      var end = run.rabbitEndMs === null ? '—' : '+' + run.rabbitEndMs + 'ms';
      rabbit.textContent = 'S ' + start + ' · E ' + end + ' · C ' + run.rabbitCancel;
    }
  }

  function buildOverlay() {
    if (document.getElementById('r4mFeelMonitor')) return document.getElementById('r4mFeelMonitor');
    var panel = document.createElement('aside');
    panel.id = 'r4mFeelMonitor';
    panel.setAttribute('aria-label', 'ROLL feel monitor');
    panel.innerHTML =
      '<strong>FEEL / LIVE</strong>' +
      '<div><span>spin</span><b id="r4mFeelSpin">—</b></div>' +
      '<div><span>frames &gt;20</span><b id="r4mFeelLongFrames">0</b></div>' +
      '<div><span>worst frame</span><b id="r4mFeelWorst">—</b></div>' +
      '<div><span>hit-stop</span><b id="r4mFeelHitStop">—</b></div>' +
      '<div><span>rabbit</span><b id="r4mFeelRabbit">S — · E — · C 0</b></div>';
    panel.style.cssText =
      'position:fixed;z-index:13000;right:8px;top:calc(8px + env(safe-area-inset-top));' +
      'width:min(300px,calc(100vw - 16px));padding:9px 10px;background:rgba(8,8,7,.94);' +
      'border:1px solid #4b1417;border-top:2px solid #d52229;color:#eee4d2;' +
      'font:500 10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
      'letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;';
    var style = document.createElement('style');
    style.textContent =
      '#r4mFeelMonitor>strong{display:block;color:#d52229;letter-spacing:.18em;margin-bottom:6px}' +
      '#r4mFeelMonitor>div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px;padding:2px 0}' +
      '#r4mFeelMonitor span{color:#8f8270;text-transform:uppercase}' +
      '#r4mFeelMonitor b{font-weight:600;color:#eee4d2;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
    document.head.appendChild(style);
    document.body.appendChild(panel);
    return panel;
  }

  function rowSignature() {
    if (!reel) return '';
    var rows = reel.querySelectorAll('.r4m-reel-row');
    var parts = [];
    for (var i = 0; i < rows.length; i += 1) parts.push(rows[i].style.transform || '');
    return parts.join('|');
  }

  function stopSampling() {
    sampling = false;
    if (frameId) root.cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrameAt = null;
  }

  function sampleFrame(at) {
    frameId = 0;
    if (!sampling) return;

    if (lastFrameAt !== null) {
      var delta = at - lastFrameAt;
      if (delta > 20) run.framesOver20 += 1;
      if (delta > run.worstFrameMs) run.worstFrameMs = delta;
    }
    lastFrameAt = at;

    if (lockAt !== null && run.hitStopMs === null && lockSignature !== null) {
      var signature = rowSignature();
      if (signature && signature !== lockSignature) {
        run.hitStopMs = Math.max(0, Math.round(at - lockAt));
        lockSignature = signature;
      }
    }

    render();
    frameId = root.requestAnimationFrame(sampleFrame);
  }

  function startSampling() {
    stopSampling();
    sampling = true;
    run.framesOver20 = 0;
    run.worstFrameMs = 0;
    lastFrameAt = null;
    frameId = root.requestAnimationFrame(sampleFrame);
  }

  function resetRun(at) {
    stopSampling();
    run = blankRun();
    run.startedAt = at;
    lockAt = null;
    lockSignature = null;
    render();
  }

  function handlePhase() {
    if (!reel) return;
    var next = reel.dataset.phase || 'idle';
    if (next === lastPhase) return;
    lastPhase = next;
    var at = now();

    if (next === 'awaiting-commit') {
      resetRun(at);
    } else if (next === 'spin') {
      if (run.startedAt === null) run.startedAt = at;
      run.spinStartedAt = at;
      lockAt = null;
      lockSignature = null;
      startSampling();
    } else if (next === 'lock') {
      if (run.spinStartedAt !== null) run.spinMs = Math.max(0, Math.round(at - run.spinStartedAt));
      lockAt = at;
      lockSignature = rowSignature();
    } else if (next === 'revealed' || next === 'idle') {
      stopSampling();
    }

    render();
  }

  function bindReel(candidate) {
    if (!candidate || candidate === reel) return;
    if (phaseObserver) phaseObserver.disconnect();
    reel = candidate;
    lastPhase = null;
    phaseObserver = new MutationObserver(handlePhase);
    phaseObserver.observe(reel, { attributes: true, attributeFilter: ['data-phase'] });
    handlePhase();
  }

  function findReel() {
    var candidate = document.getElementById('r4mRollReel');
    if (candidate) {
      bindReel(candidate);
      if (findObserver) {
        findObserver.disconnect();
        findObserver = null;
      }
      return true;
    }
    return false;
  }

  function onRabbitEvent(event) {
    if (!event || !event.target || event.target.id !== 'r4h-roll-rabbit' || event.animationName !== 'r4h-roll-rabbit') return;
    var at = now();
    if (run.startedAt === null) run.startedAt = at;
    if (event.type === 'animationstart') run.rabbitStartMs = relative(at);
    if (event.type === 'animationend') run.rabbitEndMs = relative(at);
    if (event.type === 'animationcancel') run.rabbitCancel += 1;
    render();
  }

  function init() {
    overlay = buildOverlay();
    render();

    document.addEventListener('animationstart', onRabbitEvent, true);
    document.addEventListener('animationend', onRabbitEvent, true);
    document.addEventListener('animationcancel', onRabbitEvent, true);

    if (!findReel()) {
      findObserver = new MutationObserver(findReel);
      findObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    root.addEventListener('pagehide', function () {
      stopSampling();
      if (phaseObserver) phaseObserver.disconnect();
      if (findObserver) findObserver.disconnect();
    }, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
