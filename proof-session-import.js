(function (root, factory) {
  'use strict';
  var api = factory(root, root.R4b1tProofSession, root.R4b1tProofSessionRenderer);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tProofSessionImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, sessionCore, sessionRenderer) {
  'use strict';

  var selectedFiles = [];
  var previousFocus = null;
  var hasBuilt = false;

  function el(doc, tag, className, value) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (typeof value !== 'undefined') node.textContent = String(value);
    return node;
  }

  async function exactFileBytes(file) {
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new TypeError('Select local trail JSON files');
    }
    return new Uint8Array(await file.arrayBuffer());
  }

  async function buildFiles(files, options) {
    if (!sessionCore || typeof sessionCore.build !== 'function') {
      throw new Error('Proof Session core is unavailable');
    }
    var inputs = [];
    for (var index = 0; index < files.length; index += 1) {
      inputs.push(await exactFileBytes(files[index]));
    }
    var verifiedAt = options && options.verified_at
      ? options.verified_at
      : new Date().toISOString();
    return sessionCore.build(inputs, { verified_at: verifiedAt });
  }

  function focusables(overlay) {
    return Array.from(overlay.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])'))
      .filter(function (node) { return !node.disabled && node.offsetParent !== null; });
  }

  function selectedList(container, onRemove) {
    container.replaceChildren();
    if (!selectedFiles.length) {
      container.appendChild(el(container.ownerDocument, 'p', 'proof-session-import-empty', 'NO FILES SELECTED'));
      return;
    }

    selectedFiles.forEach(function (file, index) {
      var row = el(container.ownerDocument, 'div', 'proof-session-import-selected-item');
      row.setAttribute('data-selected-index', String(index));

      var meta = el(container.ownerDocument, 'div', 'proof-session-import-selected-meta');
      meta.appendChild(el(container.ownerDocument, 'span', 'proof-session-import-selected-name', file.name || ('source-' + (index + 1))));
      meta.appendChild(el(container.ownerDocument, 'span', 'proof-session-import-selected-size', String(file.size) + ' bytes'));
      row.appendChild(meta);

      var remove = el(container.ownerDocument, 'button', 'proof-session-import-remove', 'remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + (file.name || ('source-' + (index + 1))));
      remove.addEventListener('click', function () { onRemove(index); });
      row.appendChild(remove);

      container.appendChild(row);
    });
  }

  function mount(container) {
    if (!container || !container.ownerDocument) {
      throw new TypeError('Proof Session import requires a DOM container');
    }
    if (container.dataset.mounted === 'true') return container;
    container.dataset.mounted = 'true';

    var doc = container.ownerDocument;
    var intro = el(
      doc,
      'p',
      'proof-session-import-intro',
      'Choose one or more canonical trail JSON files. Files are read, verified, compared, and rendered only in this browser session.'
    );
    container.appendChild(intro);

    var pickerWrap = el(doc, 'div', 'proof-session-import-picker-wrap');
    var label = el(doc, 'label', 'proof-session-import-label', 'Trail JSON files');
    label.setAttribute('for', 'proofSessionFiles');
    var picker = doc.createElement('input');
    picker.id = 'proofSessionFiles';
    picker.type = 'file';
    picker.accept = '.json,application/json';
    picker.multiple = true;
    picker.className = 'proof-session-import-file';
    pickerWrap.appendChild(label);
    pickerWrap.appendChild(picker);
    container.appendChild(pickerWrap);

    var selected = el(doc, 'div', 'proof-session-import-selected');
    selected.setAttribute('aria-label', 'Selected local files');
    container.appendChild(selected);

    var actions = el(doc, 'div', 'proof-session-import-actions');
    var buildButton = el(doc, 'button', 'proof-session-import-button', 'Build locally');
    buildButton.type = 'button';
    buildButton.disabled = true;
    var clearButton = el(doc, 'button', 'proof-session-import-button', 'Clear');
    clearButton.type = 'button';
    actions.appendChild(buildButton);
    actions.appendChild(clearButton);
    container.appendChild(actions);

    var status = el(doc, 'div', 'proof-session-import-status', '');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    container.appendChild(status);

    var result = el(doc, 'div', 'proof-session-import-result');
    container.appendChild(result);

    function updateReady() {
      buildButton.disabled = selectedFiles.length === 0;
    }

    async function compute() {
      if (!selectedFiles.length) {
        result.replaceChildren();
        status.textContent = '';
        hasBuilt = false;
        updateReady();
        return;
      }

      buildButton.disabled = true;
      status.textContent = 'Verifying local files and rebuilding session…';
      result.replaceChildren();

      try {
        var projection = await buildFiles(selectedFiles);
        if (!sessionRenderer || typeof sessionRenderer.render !== 'function') {
          throw new Error('Proof Session renderer is unavailable');
        }
        sessionRenderer.render(result, projection);
        hasBuilt = true;
        status.textContent = 'Local Proof Session ready.';
      } catch (error) {
        hasBuilt = false;
        status.textContent = error && error.message ? error.message : String(error);
      } finally {
        updateReady();
      }
    }

    async function removeAt(index) {
      selectedFiles.splice(index, 1);
      selectedList(selected, removeAt);
      picker.value = '';
      updateReady();
      if (hasBuilt) await compute();
      else if (!selectedFiles.length) result.replaceChildren();
    }

    picker.addEventListener('change', function () {
      selectedFiles = Array.from(picker.files || []);
      hasBuilt = false;
      result.replaceChildren();
      status.textContent = '';
      selectedList(selected, removeAt);
      updateReady();
    });

    buildButton.addEventListener('click', compute);

    clearButton.addEventListener('click', function () {
      selectedFiles = [];
      hasBuilt = false;
      picker.value = '';
      result.replaceChildren();
      status.textContent = '';
      selectedList(selected, removeAt);
      updateReady();
      picker.focus();
    });

    selectedList(selected, removeAt);
    updateReady();
    return container;
  }

  function resetOverlayState() {
    selectedFiles = [];
    hasBuilt = false;

    var overlay = document.getElementById('proofSessionOverlay');
    if (!overlay) return;

    var picker = overlay.querySelector('.proof-session-import-file');
    if (picker) picker.value = '';

    var selected = overlay.querySelector('.proof-session-import-selected');
    if (selected) {
      selected.replaceChildren();
      selected.appendChild(el(document, 'p', 'proof-session-import-empty', 'NO FILES SELECTED'));
    }

    var result = overlay.querySelector('.proof-session-import-result');
    if (result) result.replaceChildren();

    var status = overlay.querySelector('.proof-session-import-status');
    if (status) status.textContent = '';

    var buildButton = overlay.querySelector('.proof-session-import-button');
    if (buildButton) buildButton.disabled = true;
  }

  function openOverlay() {
    var overlay = document.getElementById('proofSessionOverlay');
    if (!overlay) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');

    var picker = overlay.querySelector('.proof-session-import-file');
    if (picker) picker.focus();
    else {
      var list = focusables(overlay);
      (list[0] || overlay).focus();
    }
  }

  function closeOverlay() {
    var overlay = document.getElementById('proofSessionOverlay');
    if (!overlay) return;
    resetOverlayState();
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    previousFocus = null;
  }

  function toggleOverlay() {
    var overlay = document.getElementById('proofSessionOverlay');
    if (!overlay) return;
    if (overlay.hidden) openOverlay();
    else closeOverlay();
  }

  function handleKeydown(event) {
    var overlay = document.getElementById('proofSessionOverlay');
    if (!overlay || overlay.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverlay();
      return;
    }

    if (event.key !== 'Tab') return;
    var list = focusables(overlay);
    if (!list.length) {
      event.preventDefault();
      overlay.focus();
      return;
    }

    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function init() {
    var mountPoint = document.getElementById('proofSessionMount');
    if (mountPoint) mount(mountPoint);
    document.addEventListener('keydown', handleKeydown);
    root.toggleProofSession = toggleOverlay;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }

  return {
    mount: mount,
    buildFiles: buildFiles,
    openOverlay: openOverlay,
    closeOverlay: closeOverlay,
    toggleOverlay: toggleOverlay,
    getSelectedCount: function () { return selectedFiles.length; }
  };
});
