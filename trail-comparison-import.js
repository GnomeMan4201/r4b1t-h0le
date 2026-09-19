(function (root, factory) {
  'use strict';
  var api = factory(root.R4b1tTrailComparison, root.R4b1tTrailComparisonRenderer);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tTrailComparisonImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (comparisonCore, comparisonRenderer) {
  'use strict';

  var previousFocus = null;

  function el(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (typeof text !== 'undefined') node.textContent = String(text);
    return node;
  }

  async function exactFileBytes(file) {
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new TypeError('Select a local trail JSON file');
    }
    return new Uint8Array(await file.arrayBuffer());
  }

  async function compareFiles(leftFile, rightFile, options) {
    if (!comparisonCore || typeof comparisonCore.compare !== 'function') {
      throw new Error('Trail Comparison core is unavailable');
    }
    var leftBytes = await exactFileBytes(leftFile);
    var rightBytes = await exactFileBytes(rightFile);
    var verifiedAt = options && options.verified_at
      ? options.verified_at
      : new Date().toISOString();
    return comparisonCore.compare(leftBytes, rightBytes, { verified_at: verifiedAt });
  }

  function mount(container) {
    if (!container || !container.ownerDocument) {
      throw new TypeError('Trail Comparison import requires a DOM container');
    }
    if (container.dataset.mounted === 'true') return container;
    container.dataset.mounted = 'true';

    var doc = container.ownerDocument;
    var intro = el(doc, 'p', 'trail-comparison-import-intro',
      'Choose two canonical trail JSON files. Both are read and verified locally on this device.');
    container.appendChild(intro);

    var fields = el(doc, 'div', 'trail-comparison-import-fields');

    function fileField(side, labelText) {
      var wrap = el(doc, 'div', 'trail-comparison-import-field');
      var label = el(doc, 'label', 'trail-comparison-import-label', labelText);
      var input = doc.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.className = 'trail-comparison-import-file';
      input.id = 'trailComparison' + side + 'File';
      label.setAttribute('for', input.id);
      wrap.appendChild(label);
      wrap.appendChild(input);
      return { wrap: wrap, input: input };
    }

    var left = fileField('Left', 'Left trail JSON');
    var right = fileField('Right', 'Right trail JSON');
    fields.appendChild(left.wrap);
    fields.appendChild(right.wrap);
    container.appendChild(fields);

    var actions = el(doc, 'div', 'trail-comparison-import-actions');
    var compareButton = el(doc, 'button', 'trail-comparison-import-button', 'Compare locally');
    compareButton.type = 'button';
    compareButton.disabled = true;
    var clearButton = el(doc, 'button', 'trail-comparison-import-button', 'Clear');
    clearButton.type = 'button';
    actions.appendChild(compareButton);
    actions.appendChild(clearButton);
    container.appendChild(actions);

    var status = el(doc, 'div', 'trail-comparison-import-status', '');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    container.appendChild(status);

    var result = el(doc, 'div', 'trail-comparison-import-result');
    container.appendChild(result);

    function updateReady() {
      compareButton.disabled = !(left.input.files && left.input.files[0] && right.input.files && right.input.files[0]);
    }

    left.input.addEventListener('change', updateReady);
    right.input.addEventListener('change', updateReady);

    compareButton.addEventListener('click', async function () {
      compareButton.disabled = true;
      status.textContent = 'Verifying both files locally…';
      result.replaceChildren();
      try {
        var projection = await compareFiles(left.input.files[0], right.input.files[0]);
        if (!comparisonRenderer || typeof comparisonRenderer.render !== 'function') {
          throw new Error('Trail Comparison renderer is unavailable');
        }
        comparisonRenderer.render(result, projection);
        status.textContent = projection.comparison
          ? 'Local comparison complete.'
          : 'Local verification completed with diagnostic result.';
      } catch (error) {
        status.textContent = error && error.message ? error.message : String(error);
      } finally {
        updateReady();
      }
    });

    clearButton.addEventListener('click', function () {
      left.input.value = '';
      right.input.value = '';
      result.replaceChildren();
      status.textContent = '';
      updateReady();
      left.input.focus();
    });

    return container;
  }

  function focusables(overlay) {
    return Array.from(overlay.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])'))
      .filter(function (node) { return !node.disabled && node.offsetParent !== null; });
  }

  function openOverlay() {
    var overlay = document.getElementById('trailComparisonOverlay');
    if (!overlay) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    var list = focusables(overlay);
    (list[0] || overlay).focus();
  }

  function closeOverlay() {
    var overlay = document.getElementById('trailComparisonOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    previousFocus = null;
  }

  function toggleOverlay() {
    var overlay = document.getElementById('trailComparisonOverlay');
    if (!overlay) return;
    if (overlay.hidden) openOverlay();
    else closeOverlay();
  }

  function handleKeydown(event) {
    var overlay = document.getElementById('trailComparisonOverlay');
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
    var mountPoint = document.getElementById('trailComparisonMount');
    if (mountPoint) mount(mountPoint);
    document.addEventListener('keydown', handleKeydown);
    root.toggleTrailComparison = toggleOverlay;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }

  return {
    mount: mount,
    compareFiles: compareFiles,
    openOverlay: openOverlay,
    closeOverlay: closeOverlay,
    toggleOverlay: toggleOverlay
  };
});
