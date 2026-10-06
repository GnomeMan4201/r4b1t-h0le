(function (root) {
  'use strict';

  var MIN_CHARGE = 0.22;
  var CHARGE_MS = 950;
  var ROW_HEIGHT = 52;
  var OVERSHOOT_ROWS = 0.26;
  var HIT_STOP_MS = 70;
  var SOUND_KEY = 'r4b1t-roll-reel-sound';

  var mounted = false;
  var button = null;
  var ui = null;
  var windowEl = null;
  var strip = null;
  var meter = null;
  var hint = null;
  var soundButton = null;
  var canvas = null;
  var ctx = null;
  var rows = [];
  var leds = [];
  var phase = 'idle';
  var charge = 0;
  var chargeStartedAt = 0;
  var chargeFrame = 0;
  var reelFrame = 0;
  var fxFrame = 0;
  var settleTimer = 0;
  var keyDown = false;
  var suppressGestureClick = false;
  var slamPending = false;
  var spin = null;
  var callbacks = null;
  var particles = [];
  var soundOn = false;
  var audio = null;
  var master = null;
  var noiseBuffer = null;
  var rumble = null;
  var audioNodes = new Set();
  var lastFxAt = 0;

  function enabled() {
    return root.R4B1T_ROLL_REEL_ENABLED !== false;
  }

  function reduced() {
    try {
      return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {
      return false;
    }
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function mod(value, size) {
    return ((value % size) + size) % size;
  }

  function readSoundPreference() {
    try {
      return root.localStorage.getItem(SOUND_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function writeSoundPreference() {
    try {
      root.localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
    } catch (_) {}
  }

  function vibrate(pattern) {
    try {
      if (root.navigator && typeof root.navigator.vibrate === 'function') root.navigator.vibrate(pattern);
    } catch (_) {}
  }

  function trackChain(source, nodes) {
    var chain = nodes.filter(Boolean);
    chain.forEach(function (node) { audioNodes.add(node); });
    source.onended = function () {
      chain.forEach(function (node) {
        audioNodes.delete(node);
        try { node.disconnect(); } catch (_) {}
      });
    };
    return source;
  }

  function ensureAudio() {
    if (!soundOn) return null;
    try {
      if (!audio) {
        var AudioContext = root.AudioContext || root.webkitAudioContext;
        if (!AudioContext) return null;
        audio = new AudioContext();
        master = audio.createGain();
        master.gain.value = 0.72;
        var comp = audio.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 5;
        master.connect(comp);
        comp.connect(audio.destination);
        noiseBuffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
        var data = noiseBuffer.getChannelData(0);
        for (var i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      if (audio.state === 'suspended') audio.resume().catch(function () {});
      return audio;
    } catch (_) {
      return null;
    }
  }

  function envelope(gain, at, peak, attack, release) {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  }

  function tone(type, from, to, duration, peak, delay) {
    var ac = ensureAudio();
    if (!ac || !master) return;
    var at = ac.currentTime + (delay || 0);
    var oscillator = ac.createOscillator();
    var gain = ac.createGain();
    trackChain(oscillator, [oscillator, gain]);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + duration * 0.75);
    envelope(gain, at, peak, 0.003, duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.04);
  }

  function noise(filterType, frequency, duration, peak, delay) {
    var ac = ensureAudio();
    if (!ac || !master || !noiseBuffer) return;
    var at = ac.currentTime + (delay || 0);
    var source = ac.createBufferSource();
    source.buffer = noiseBuffer;
    var filter = ac.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    var gain = ac.createGain();
    trackChain(source, [source, filter, gain]);
    envelope(gain, at, peak, 0.002, duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(at, Math.random());
    source.stop(at + duration + 0.04);
  }

  function rumbleStart() {
    var ac = ensureAudio();
    if (!ac || rumble) return;
    var oscillator = ac.createOscillator();
    var filter = ac.createBiquadFilter();
    var gain = ac.createGain();
    trackChain(oscillator, [oscillator, filter, gain]);
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 44;
    filter.type = 'lowpass';
    filter.frequency.value = 130;
    gain.gain.value = 0.0001;
    oscillator.connect(filter).connect(gain).connect(master);
    oscillator.start();
    rumble = { oscillator: oscillator, filter: filter, gain: gain };
  }

  function rumbleSet(value) {
    if (!rumble || !audio) return;
    var at = audio.currentTime;
    rumble.gain.gain.setTargetAtTime(0.025 + value * 0.18, at, 0.04);
    rumble.oscillator.frequency.setTargetAtTime(44 + value * 34, at, 0.06);
    rumble.filter.frequency.setTargetAtTime(130 + value * 210, at, 0.06);
  }

  function rumbleStop() {
    if (!rumble || !audio) return;
    var active = rumble;
    rumble = null;
    var at = audio.currentTime;
    try {
      active.gain.gain.setTargetAtTime(0.0001, at, 0.025);
      active.oscillator.stop(at + 0.12);
    } catch (_) {}
  }

  function ratchet(step) {
    tone('square', 330 + step * 42, 250 + step * 35, 0.028, 0.045);
    noise('bandpass', 2300 + step * 120, 0.022, 0.08);
  }

  function throwThunk(value) {
    tone('sine', 150, 42, 0.23, 0.48 + value * 0.2);
    noise('lowpass', 1150, 0.075, 0.28);
  }

  function detent(speed) {
    var p = clamp(speed / 36, 0, 1);
    tone('triangle', 1050 + p * 1300, 850 + p * 950, 0.016, 0.04 + p * 0.035);
    noise('highpass', 3200, 0.01, 0.035);
  }

  function latch() {
    tone('sine', 118, 34, 0.31, 0.62);
    noise('lowpass', 850, 0.075, 0.3);
    tone('sine', 780, 780, 0.42, 0.045, 0.005);
    tone('sine', 1230, 1230, 0.34, 0.032, 0.005);
    tone('sine', 2050, 2050, 0.22, 0.018, 0.005);
  }

  function stopAllAudio() {
    rumbleStop();
    audioNodes.forEach(function (node) {
      try { node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    });
    audioNodes.clear();
  }

  function fitCanvas() {
    if (!canvas || !ctx) return;
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(root.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(root.innerHeight * dpr));
    canvas.dataset.dpr = String(dpr);
  }

  function buttonCenter() {
    var rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect: rect };
  }

  function sparks(x, y, count, direction, spread, power) {
    if (reduced() || !ctx) return;
    for (var i = 0; i < count; i += 1) {
      var angle = direction + (Math.random() - 0.5) * spread;
      var velocity = power * (0.45 + Math.random() * 0.7);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0,
        max: 0.3 + Math.random() * 0.38,
        size: 1 + Math.random() * 1.8
      });
    }
    if (!fxFrame) {
      lastFxAt = performance.now();
      fxFrame = root.requestAnimationFrame(drawFx);
    }
  }

  function drawFx(now) {
    if (!ctx || !canvas) {
      fxFrame = 0;
      return;
    }
    var dt = Math.min(0.05, Math.max(0, (now - lastFxAt) / 1000));
    lastFxAt = now;
    var dpr = Number(canvas.dataset.dpr) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
    particles = particles.filter(function (p) {
      p.life += dt;
      if (p.life >= p.max) return false;
      p.vy += 1050 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      var k = 1 - p.life / p.max;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,' + Math.round(70 + k * 120) + ',' + Math.round(70 * k) + ',' + k.toFixed(3) + ')';
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.014, p.y - p.vy * 0.014);
      ctx.stroke();
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
    if (particles.length) fxFrame = root.requestAnimationFrame(drawFx);
    else {
      ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
      fxFrame = 0;
    }
  }

  function hostname(url) {
    try {
      return new URL(url, root.location && root.location.href ? root.location.href : undefined).hostname.replace(/^www\./i, '') || String(url);
    } catch (_) {
      return String(url).replace(/^[a-z]+:\/\//i, '').split('/')[0];
    }
  }

  function createRows() {
    rows = [];
    strip.replaceChildren();
    for (var i = 0; i < 5; i += 1) {
      var row = document.createElement('div');
      row.className = 'r4m-reel-row';
      var label = document.createElement('span');
      label.className = 'r4m-reel-host';
      row.appendChild(label);
      strip.appendChild(row);
      rows.push(row);
    }
  }

  function drawRows(position, speed) {
    if (!spin || !spin.labels.length) return;
    var count = spin.labels.length;
    var base = Math.floor(position);
    var frac = position - base;
    rows.forEach(function (row, index) {
      var k = index - 2;
      var logical = base + k;
      var item = mod(logical, count);
      var y = (k - frac) * ROW_HEIGHT + ROW_HEIGHT;
      row.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
      if (row.dataset.logical !== String(logical)) {
        row.dataset.logical = String(logical);
        row.querySelector('.r4m-reel-host').textContent = spin.labels[item];
        row.dataset.url = spin.pool[item];
      }
      var distance = Math.abs(y - ROW_HEIGHT) / ROW_HEIGHT;
      row.style.opacity = String(Math.max(0.22, 1 - distance * 0.5));
      row.classList.toggle('is-payline', distance < 0.5);
    });
    var blur = reduced() ? 0 : Math.min(6, Math.max(0, (speed - 7) * 0.14));
    strip.style.filter = blur > 0.3 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';
  }

  function timingForCharge(value) {
    if (reduced()) {
      return Object.freeze({
        accelerate: 80,
        decelerate: 100,
        lockHold: 70,
        cardEnter: 90
      });
    }
    var spinMs = Math.round(500 + value * 250);
    var accelerate = Math.round(spinMs * 0.28);
    return Object.freeze({
      accelerate: accelerate,
      decelerate: spinMs - accelerate,
      lockHold: 150,
      cardEnter: 110
    });
  }

  function setMeter(value) {
    var lit = Math.floor(clamp(value, 0, 1) * 10 + 0.001);
    leds.forEach(function (led, index) {
      led.classList.toggle('is-on', index < lit);
    });
    if (button) button.style.setProperty('--r4m-reel-charge', clamp(value, 0, 1).toFixed(3));
  }

  function clearMeter() {
    setMeter(0);
  }

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function updateCharge(now) {
    if (phase !== 'charging') {
      chargeFrame = 0;
      return;
    }
    charge = clamp((now - chargeStartedAt) / CHARGE_MS, 0, 1);
    setMeter(charge);
    rumbleSet(charge);
    var step = Math.floor(charge * 10);
    var previous = Number(ui.dataset.windStep || '0');
    if (step > previous) {
      ui.dataset.windStep = String(step);
      ratchet(step);
      vibrate(5);
    }
    chargeFrame = root.requestAnimationFrame(updateCharge);
  }

  function startCharge(event) {
    if (!mounted || !enabled()) return false;
    if (phase === 'awaiting-commit') {
      slamPending = true;
      setHint('SLAM ARMED');
      return true;
    }
    if (phase === 'spin' || phase === 'lock' || phase === 'armed') {
      return requestSlam(event);
    }
    if (phase === 'charging') return true;
    phase = 'charging';
    charge = 0;
    chargeStartedAt = performance.now();
    ui.dataset.phase = phase;
    ui.dataset.windStep = '0';
    button.classList.remove('r4m-reel-release');
    button.classList.add('r4m-reel-winding');
    setHint('HOLD · WINDING');
    clearMeter();
    rumbleStart();
    if (!chargeFrame) chargeFrame = root.requestAnimationFrame(updateCharge);
    return true;
  }

  function releaseEffects(value) {
    button.classList.remove('r4m-reel-winding');
    button.classList.remove('r4m-reel-release');
    void button.offsetWidth;
    button.classList.add('r4m-reel-release');
    root.setTimeout(function () {
      if (button) button.classList.remove('r4m-reel-release');
    }, 220);
    if (!reduced()) {
      ui.classList.remove('r4m-reel-shake');
      void ui.offsetWidth;
      ui.classList.add('r4m-reel-shake');
      root.setTimeout(function () { if (ui) ui.classList.remove('r4m-reel-shake'); }, 190);
      var center = buttonCenter();
      sparks(center.x, center.rect.top + center.rect.height * 0.34, 12 + Math.round(value * 18), -Math.PI / 2, 1.5, 320 + value * 360);
    }
    throwThunk(value);
    vibrate(Math.round(14 + value * 18));
  }

  function throwCharge() {
    if (phase !== 'charging') return false;
    if (chargeFrame) {
      root.cancelAnimationFrame(chargeFrame);
      chargeFrame = 0;
    }
    rumbleStop();
    var value = Math.max(MIN_CHARGE, charge);
    charge = 0;
    setMeter(value);
    releaseEffects(value);
    phase = 'awaiting-commit';
    ui.dataset.phase = phase;
    setHint('COMMITTING');
    var ok = callbacks && typeof callbacks.roll === 'function' ? callbacks.roll(value) : false;
    if (!ok) resetIdle();
    return !!ok;
  }

  function quickRoll() {
    if (!mounted || !enabled()) return false;
    if (phase === 'awaiting-commit') {
      slamPending = true;
      setHint('SLAM ARMED');
      return true;
    }
    if (phase === 'spin' || phase === 'lock' || phase === 'armed') return requestSlam();
    var value = MIN_CHARGE;
    setMeter(value);
    releaseEffects(value);
    phase = 'awaiting-commit';
    ui.dataset.phase = phase;
    setHint('COMMITTING');
    var ok = callbacks && typeof callbacks.roll === 'function' ? callbacks.roll(value) : false;
    if (!ok) resetIdle();
    return !!ok;
  }

  function prepare(options) {
    if (!mounted || !enabled() || !options || !options.result || !options.result.url) return null;
    var value = clamp(Number(options.charge) || MIN_CHARGE, MIN_CHARGE, 1);
    var pool = Array.isArray(options.result.eligiblePool) ? options.result.eligiblePool.slice() : [];
    if (!pool.length) pool.push(options.result.url);
    var targetIndex = pool.indexOf(options.result.url);
    if (targetIndex < 0) {
      pool.push(options.result.url);
      targetIndex = pool.length - 1;
    }
    pool = Object.freeze(pool.slice());
    var labels = Object.freeze(pool.map(hostname));
    var timing = timingForCharge(value);
    var loops = reduced() ? 0 : 2 + Math.round(value * 4);
    var from = 0;
    var to = loops * pool.length + targetIndex;
    spin = {
      result: options.result,
      pool: pool,
      labels: labels,
      targetIndex: targetIndex,
      from: from,
      to: to,
      over: reduced() ? 0 : OVERSHOOT_ROWS,
      timing: timing,
      spinMs: timing.accelerate + timing.decelerate,
      charge: value,
      position: from,
      startAt: 0,
      lockAt: 0,
      lastPosition: from,
      lastAt: 0,
      lastRow: Math.floor(from + 0.5),
      lastTickAt: 0
    };
    ui.hidden = false;
    ui.dataset.phase = 'armed';
    ui.dataset.targetUrl = options.result.url;
    ui.removeAttribute('data-landed-url');
    phase = 'armed';
    setHint('THROW');
    createRows();
    drawRows(from, 0);
    return Object.freeze({ timing: timing, charge: value });
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function reelStep(now) {
    reelFrame = 0;
    if (!spin || (phase !== 'spin' && phase !== 'lock')) return;

    if (phase === 'spin') {
      if (!spin.startAt) {
        spin.startAt = now;
        spin.lastAt = now;
      }
      var elapsed = now - spin.startAt;
      var u = clamp(elapsed / Math.max(1, spin.spinMs), 0, 1);
      spin.position = spin.from + (spin.to + spin.over - spin.from) * easeOutCubic(u);
    } else {
      if (!spin.lockAt) spin.lockAt = now;
      var lockElapsed = now - spin.lockAt;
      if (reduced()) {
        spin.position = spin.to;
      } else if (lockElapsed <= HIT_STOP_MS) {
        spin.position = spin.to + spin.over;
      } else {
        var settleDuration = Math.max(1, spin.timing.lockHold - HIT_STOP_MS);
        var settle = clamp((lockElapsed - HIT_STOP_MS) / settleDuration, 0, 1);
        var spring = Math.exp(-6.2 * settle) * Math.cos(8.4 * settle);
        spin.position = spin.to + spin.over * spring;
      }
    }

    var dt = Math.max(1, now - (spin.lastAt || now));
    var speed = Math.abs(spin.position - spin.lastPosition) * 1000 / dt;
    var row = Math.floor(spin.position + 0.5);
    if (phase === 'spin' && row !== spin.lastRow && now - spin.lastTickAt > 18) {
      detent(speed);
      spin.lastTickAt = now;
      spin.lastRow = row;
    }
    spin.lastPosition = spin.position;
    spin.lastAt = now;
    drawRows(spin.position, speed);
    reelFrame = root.requestAnimationFrame(reelStep);
  }

  function enterLock() {
    if (!spin) return;
    phase = 'lock';
    ui.dataset.phase = phase;
    spin.position = spin.to + spin.over;
    spin.lockAt = performance.now();
    drawRows(spin.position, 0);
    windowEl.classList.remove('r4m-reel-lock');
    void windowEl.offsetWidth;
    windowEl.classList.add('r4m-reel-lock');
    root.setTimeout(function () { if (windowEl) windowEl.classList.remove('r4m-reel-lock'); }, 100);
    latch();
    vibrate([12, 28, 36]);
    if (!reduced()) {
      var rect = windowEl.getBoundingClientRect();
      sparks(rect.left + 5, rect.top + rect.height / 2, 14, Math.PI, 0.9, 360);
      sparks(rect.right - 5, rect.top + rect.height / 2, 14, 0, 0.9, 360);
    }
    if (!reelFrame) reelFrame = root.requestAnimationFrame(reelStep);
  }

  function onTransition(state) {
    if (!spin) return false;
    if (state === 'STRIP_ACCELERATING') {
      phase = 'spin';
      ui.dataset.phase = phase;
      setHint('TAP TO SLAM');
      spin.startAt = 0;
      spin.lockAt = 0;
      if (!reelFrame) reelFrame = root.requestAnimationFrame(reelStep);
      if (slamPending) {
        slamPending = false;
        root.setTimeout(function () { requestSlam(); }, 0);
      }
      return true;
    }
    if (state === 'LOCKED') {
      enterLock();
      return true;
    }
    if (state === 'CARD_ENTERING') {
      if (reelFrame) {
        root.cancelAnimationFrame(reelFrame);
        reelFrame = 0;
      }
      phase = 'revealed';
      ui.dataset.phase = phase;
      spin.position = spin.to;
      drawRows(spin.position, 0);
      strip.style.filter = 'none';
      ui.dataset.landedUrl = spin.result.url;
      setHint('LOCKED');
      clearMeter();
      return true;
    }
    if (state === 'SETTLED') {
      phase = 'revealed';
      ui.dataset.phase = phase;
      return true;
    }
    if (state === 'CANCELLED' || state === 'IDLE') {
      cancel('machine');
      return true;
    }
    return false;
  }

  function requestSlam(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!spin || (phase !== 'spin' && phase !== 'armed')) return false;
    var ok = callbacks && typeof callbacks.slam === 'function' ? callbacks.slam() : false;
    if (ok) {
      setHint('SLAM');
      vibrate(12);
    }
    return !!ok;
  }

  function resetIdle() {
    if (chargeFrame) root.cancelAnimationFrame(chargeFrame);
    if (reelFrame) root.cancelAnimationFrame(reelFrame);
    chargeFrame = 0;
    reelFrame = 0;
    rumbleStop();
    phase = 'idle';
    charge = 0;
    suppressGestureClick = false;
    slamPending = false;
    spin = null;
    if (ui) {
      ui.dataset.phase = phase;
      ui.removeAttribute('data-target-url');
      ui.removeAttribute('data-landed-url');
      ui.classList.remove('r4m-reel-shake');
    }
    if (strip) {
      strip.style.filter = 'none';
      strip.replaceChildren();
    }
    rows = [];
    if (button) {
      button.classList.remove('r4m-reel-winding', 'r4m-reel-release');
      button.style.removeProperty('--r4m-reel-charge');
    }
    clearMeter();
    setHint('HOLD · RELEASE');
  }

  function cancel() {
    if (settleTimer) root.clearTimeout(settleTimer);
    settleTimer = 0;
    resetIdle();
    particles = [];
    if (fxFrame) {
      root.cancelAnimationFrame(fxFrame);
      fxFrame = 0;
    }
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    stopAllAudio();
    return true;
  }

  function suppressClick(event) {
    if (!enabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (suppressGestureClick) {
      suppressGestureClick = false;
      return;
    }
    if (phase === 'awaiting-commit') {
      slamPending = true;
      setHint('SLAM ARMED');
      return;
    }
    if (phase === 'spin' || phase === 'armed') {
      requestSlam();
      return;
    }
    if (phase === 'idle' || phase === 'revealed') quickRoll();
  }

  function onReelPointerDown(event) {
    if (!mounted || !enabled()) return;
    if (event.target && event.target.closest && event.target.closest('button')) return;
    if (phase === 'awaiting-commit') {
      event.preventDefault();
      slamPending = true;
      setHint('SLAM ARMED');
      return;
    }
    if (phase === 'spin' || phase === 'armed') requestSlam(event);
  }

  function onPointerDown(event) {
    if (!mounted || !enabled()) return;
    event.preventDefault();
    event.stopPropagation();
    try { button.setPointerCapture(event.pointerId); } catch (_) {}
    suppressGestureClick = true;
    ensureAudio();
    startCharge(event);
  }

  function onPointerUp(event) {
    if (!mounted || !enabled()) return;
    event.preventDefault();
    event.stopPropagation();
    if (phase === 'charging') throwCharge();
  }

  function onKeyDown(event) {
    if (!mounted || !enabled()) return;
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    ensureAudio();
    if (!keyDown) {
      keyDown = true;
      suppressGestureClick = true;
      startCharge(event);
    }
  }

  function onKeyUp(event) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (!keyDown) return;
    keyDown = false;
    if (phase === 'charging') throwCharge();
  }

  function onPageHide() {
    cancel('pagehide');
  }

  function onGlobalKeyDown(event) {
    if (event.key !== 'Escape') return;
    if (phase !== 'spin' && phase !== 'armed') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    requestSlam();
  }

  function toggleSound(event) {
    event.preventDefault();
    event.stopPropagation();
    soundOn = !soundOn;
    writeSoundPreference();
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    if (soundOn) {
      ensureAudio();
      tone('sine', 620, 620, 0.05, 0.04);
    } else {
      stopAllAudio();
    }
  }

  function buildUi() {
    ui = document.createElement('section');
    ui.id = 'r4mRollReel';
    ui.className = 'r4m-reel-ui';
    ui.dataset.phase = 'idle';
    ui.setAttribute('aria-label', 'ROLL reel');
    ui.innerHTML =
      '<div class="r4m-reel-window" aria-hidden="true">' +
        '<div class="r4m-reel-strip"></div>' +
        '<div class="r4m-reel-payline"></div>' +
      '</div>' +
      '<div class="r4m-reel-meter" aria-hidden="true"></div>' +
      '<div class="r4m-reel-meta"><span class="r4m-reel-hint">HOLD · RELEASE</span>' +
        '<button type="button" class="r4m-reel-sound" aria-pressed="false">SOUND OFF</button></div>';
    button.parentNode.insertBefore(ui, button);
    windowEl = ui.querySelector('.r4m-reel-window');
    strip = ui.querySelector('.r4m-reel-strip');
    meter = ui.querySelector('.r4m-reel-meter');
    hint = ui.querySelector('.r4m-reel-hint');
    soundButton = ui.querySelector('.r4m-reel-sound');
    leds = [];
    for (var i = 0; i < 10; i += 1) {
      var led = document.createElement('i');
      meter.appendChild(led);
      leds.push(led);
    }
    soundOn = readSoundPreference();
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';

    canvas = document.createElement('canvas');
    canvas.id = 'r4mRollReelFx';
    canvas.className = 'r4m-reel-fx';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    fitCanvas();
  }

  function mount(options) {
    if (mounted) return true;
    if (!enabled() || !options || !options.button || typeof options.roll !== 'function' || typeof options.slam !== 'function') return false;
    button = options.button;
    callbacks = { roll: options.roll, slam: options.slam };
    buildUi();
    document.documentElement.classList.add('r4m-reel-enabled');

    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('pointerup', onPointerUp);
    button.addEventListener('pointercancel', onPointerUp);
    button.addEventListener('click', suppressClick);
    button.addEventListener('contextmenu', suppressClick);
    button.addEventListener('keydown', onKeyDown);
    button.addEventListener('keyup', onKeyUp);
    soundButton.addEventListener('click', toggleSound);
    ui.addEventListener('pointerdown', onReelPointerDown);
    root.addEventListener('keydown', onGlobalKeyDown, true);
    root.addEventListener('resize', fitCanvas);
    root.addEventListener('pagehide', onPageHide);
    mounted = true;
    return true;
  }

  function unmount() {
    if (!mounted) return false;
    cancel('unmount');
    button.removeEventListener('pointerdown', onPointerDown);
    button.removeEventListener('pointerup', onPointerUp);
    button.removeEventListener('pointercancel', onPointerUp);
    button.removeEventListener('click', suppressClick);
    button.removeEventListener('contextmenu', suppressClick);
    button.removeEventListener('keydown', onKeyDown);
    button.removeEventListener('keyup', onKeyUp);
    if (soundButton) soundButton.removeEventListener('click', toggleSound);
    if (ui) ui.removeEventListener('pointerdown', onReelPointerDown);
    root.removeEventListener('keydown', onGlobalKeyDown, true);
    root.removeEventListener('resize', fitCanvas);
    root.removeEventListener('pagehide', onPageHide);
    if (ui && ui.parentNode) ui.parentNode.removeChild(ui);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (audio) {
      try { audio.close(); } catch (_) {}
    }
    document.documentElement.classList.remove('r4m-reel-enabled');
    mounted = false;
    button = null;
    ui = null;
    windowEl = null;
    strip = null;
    meter = null;
    hint = null;
    soundButton = null;
    canvas = null;
    ctx = null;
    callbacks = null;
    spin = null;
    audio = null;
    master = null;
    noiseBuffer = null;
    return true;
  }

  root.R4B1TRollReel = Object.freeze({
    mount: mount,
    unmount: unmount,
    prepare: prepare,
    onTransition: onTransition,
    quickRoll: quickRoll,
    cancel: cancel,
    isMounted: function () { return mounted; },
    isActive: function () { return phase === 'charging' || phase === 'awaiting-commit' || phase === 'armed' || phase === 'spin' || phase === 'lock'; },
    snapshot: function () {
      return Object.freeze({
        mounted: mounted,
        phase: phase,
        charge: charge,
        targetUrl: spin && spin.result ? spin.result.url : null,
        landedUrl: ui ? ui.dataset.landedUrl || null : null,
        soundOn: soundOn,
        chargeFrameActive: Boolean(chargeFrame),
        reelFrameActive: Boolean(reelFrame),
        fxFrameActive: Boolean(fxFrame),
        particleCount: particles.length,
        audioNodeCount: audioNodes.size
      });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
