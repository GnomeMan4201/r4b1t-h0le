(function (root) {
  'use strict';

  var controller = null;
  var priorFocus = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function focusables(overlay) {
    return Array.from(overlay.querySelectorAll(
      'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(function (node) {
      return !node.hidden && node.getAttribute('aria-hidden') !== 'true';
    });
  }

  function mountFresh() {
    var mount = byId('replayInspectionMount');
    if (!mount || !root.R4b1tReplayInspectionImport) {
      throw new Error('Replay Inspection entry point requires the verified local import surface');
    }
    if (controller) controller.destroy();
    controller = root.R4b1tReplayInspectionImport.mount(mount);
  }

  function open() {
    var overlay = byId('replayInspectionOverlay');
    if (!overlay || !overlay.hidden) return;

    priorFocus = document.activeElement;
    mountFresh();
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('replay-inspection-open');

    var nodes = focusables(overlay);
    (nodes[0] || overlay).focus();
  }

  function close() {
    var overlay = byId('replayInspectionOverlay');
    if (!overlay || overlay.hidden) return;

    if (controller) {
      controller.destroy();
      controller = null;
    }

    var mount = byId('replayInspectionMount');
    if (mount) mount.replaceChildren();

    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('replay-inspection-open');

    if (priorFocus && typeof priorFocus.focus === 'function') {
      priorFocus.focus();
    }
    priorFocus = null;
  }

  function toggle() {
    var overlay = byId('replayInspectionOverlay');
    if (!overlay) return;
    if (overlay.hidden) open();
    else close();
  }

  function handleKeydown(event) {
    var overlay = byId('replayInspectionOverlay');
    if (!overlay || overlay.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }

    if (event.key !== 'Tab') return;
    var nodes = focusables(overlay);
    if (!nodes.length) {
      event.preventDefault();
      overlay.focus();
      return;
    }

    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', handleKeydown);
  root.openReplayInspection = open;
  root.closeReplayInspection = close;
  root.toggleReplayInspection = toggle;
})(typeof globalThis !== 'undefined' ? globalThis : window);
