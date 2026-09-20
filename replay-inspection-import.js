(function (root, factory) {
  'use strict';
  var api = factory(
    root,
    typeof module === 'object' && module.exports ? require('./replay-inspection.js') : root && root.R4b1tReplayInspection,
    typeof module === 'object' && module.exports ? require('./replay-inspection-renderer.js') : root && root.R4b1tReplayInspectionRenderer,
    typeof module === 'object' && module.exports ? require('./replay-inspection-delegation.js') : root && root.R4b1tReplayInspectionDelegation
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tReplayInspectionImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, replayCore, renderer, replayDelegation) {
  'use strict';

  if (!replayCore || !renderer || !replayDelegation) throw new Error('Replay Inspection import requires core, renderer, and delegation');

  function el(doc, tag, className, value) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (typeof value !== 'undefined') node.textContent = String(value);
    return node;
  }

  function mount(container, options) {
    if (!container || !container.ownerDocument) throw new TypeError('Replay Inspection import requires a DOM container');

    var doc = container.ownerDocument;
    var machine = replayCore.createMachine();
    var generation = 0;
    var multiProjection = null;
    var portableResult = null;
    var comparisonResult = null;
    var delegation = options && options.delegation ? options.delegation : replayDelegation;

    var shell = el(doc, 'section', 'replay-inspection-import');
    shell.setAttribute('aria-label', 'Replay Inspection local import');
    shell.setAttribute('tabindex', '0');

    var controls = el(doc, 'div', 'replay-inspection-import-controls');
    var label = el(doc, 'label', 'replay-inspection-file-label', 'LOCAL TRAIL JSON FILES');
    var input = el(doc, 'input', 'replay-inspection-file-input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.multiple = true;
    input.setAttribute('aria-label', 'One or more trail JSON files');
    label.appendChild(input);

    var sessionLabel = el(doc, 'label', 'replay-inspection-file-label', 'PORTABLE PROOF SESSION FILES');
    var sessionInput = el(doc, 'input', 'replay-inspection-session-input');
    sessionInput.type = 'file';
    sessionInput.accept = '.json,.txt,application/json,text/plain';
    sessionInput.multiple = true;
    sessionInput.setAttribute('aria-label', 'Portable Proof Session file set');
    sessionLabel.appendChild(sessionInput);

    var comparisonLabel = el(doc, 'label', 'replay-inspection-file-label', 'PORTABLE TRAIL COMPARISON FILES');
    var comparisonInput = el(doc, 'input', 'replay-inspection-comparison-input');
    comparisonInput.type = 'file';
    comparisonInput.accept = '.json,.txt,application/json,text/plain';
    comparisonInput.multiple = true;
    comparisonInput.setAttribute('aria-label', 'Portable Trail Comparison file set');
    comparisonLabel.appendChild(comparisonInput);

    var resetButton = el(doc, 'button', 'replay-inspection-reset', 'Reset');
    resetButton.type = 'button';

    controls.appendChild(label);
    controls.appendChild(sessionLabel);
    controls.appendChild(comparisonLabel);
    controls.appendChild(resetButton);

    var result = el(doc, 'div', 'replay-inspection-result');
    shell.appendChild(controls);
    shell.appendChild(result);
    container.replaceChildren(shell);

    function render() {
      return renderer.render(result, machine.snapshot());
    }

    function reset() {
      generation += 1;
      machine.reset();
      multiProjection = null;
      portableResult = null;
      comparisonResult = null;
      input.value = '';
      sessionInput.value = '';
      comparisonInput.value = '';
      render();
      return machine.snapshot();
    }

    async function loadBytes(bytes, options) {
      multiProjection = null;
      portableResult = null;
      comparisonResult = null;
      var token = ++generation;
      var pending = machine.load(bytes, options || {});
      render();
      var snapshot = await pending;
      if (token !== generation) return machine.snapshot();
      if (snapshot.phase === 'VERIFIED') {
        machine.begin();
      }
      render();
      return machine.snapshot();
    }

    async function loadFile(file) {
      var token = ++generation;
      machine.reset();
      renderer.render(result, {
        format: replayCore.FORMAT,
        phase: 'READING',
        source: null,
        position: null,
        total_positions: 0,
        current_step: null,
        diagnostic: null
      });

      var bytes;
      try {
        bytes = new Uint8Array(await file.arrayBuffer());
      } catch (error) {
        if (token === generation) reset();
        throw error;
      }
      if (token !== generation) return machine.snapshot();
      generation -= 1;
      return loadBytes(bytes);
    }

    function renderNeutral(phase) {
      return renderer.render(result, {
        format: replayCore.FORMAT,
        phase: phase,
        source: null,
        position: null,
        total_positions: 0,
        current_step: null,
        diagnostic: null
      });
    }

    async function loadFiles(files) {
      var selected = Array.prototype.slice.call(files || []);
      if (selected.length === 0) return reset();
      if (selected.length === 1) return loadFile(selected[0]);
      var token = ++generation;
      machine.reset();
      multiProjection = null;
      portableResult = null;
      comparisonResult = null;
      renderNeutral('READING_MULTI');
      var exactInputs = [];
      for (var index = 0; index < selected.length; index += 1) {
        exactInputs.push(new Uint8Array(await selected[index].arrayBuffer()));
        if (token !== generation) return null;
      }
      renderNeutral('VERIFYING_MULTI');
      var inspected = await delegation.inspectSources(exactInputs, { verified_at: new Date().toISOString() });
      if (token !== generation) return null;
      multiProjection = inspected.projection;
      renderer.renderMulti(result, multiProjection);
      return multiProjection;
    }

    function portableAddress(file) {
      var value = String(file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
      var nested = /(?:^|\/)(proof-session\.json|README\.txt|sources\/S[1-9][0-9]*--sha256-[0-9a-f]{64}\.json|comparisons\/S[1-9][0-9]*--S[1-9][0-9]*--sha256-[0-9a-f]{64}\.json)$/.exec(value);
      if (nested) return nested[1];
      if (/^S[1-9][0-9]*--sha256-[0-9a-f]{64}\.json$/.test(value)) return 'sources/' + value;
      if (/^S[1-9][0-9]*--S[1-9][0-9]*--sha256-[0-9a-f]{64}\.json$/.test(value)) return 'comparisons/' + value;
      throw new Error('Unrecognized portable Proof Session file address');
    }

    async function loadPortableFiles(files) {
      var selected = Array.prototype.slice.call(files || []);
      if (!selected.length) return reset();
      var token = ++generation;
      machine.reset();
      multiProjection = null;
      portableResult = null;
      comparisonResult = null;
      renderNeutral('READING_PORTABLE');
      var bundle = { files: {} };
      for (var index = 0; index < selected.length; index += 1) {
        var address = portableAddress(selected[index]);
        if (bundle.files[address]) throw new Error('Duplicate portable Proof Session file address');
        bundle.files[address] = new Uint8Array(await selected[index].arrayBuffer());
        if (token !== generation) return null;
      }
      renderNeutral('VERIFYING_PORTABLE');
      var inspected = await delegation.inspectProofSession(bundle, { verified_at: new Date().toISOString() });
      if (token !== generation) return null;
      portableResult = inspected;
      renderer.renderPortableSession(result, portableResult);
      return JSON.parse(JSON.stringify(portableResult));
    }

    function comparisonAddress(file) {
      var value = String(file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
      var match = /(?:^|\/)(left-source\.json|right-source\.json|trail-comparison\.json|README\.txt)$/.exec(value);
      if (!match) throw new Error('Unrecognized portable Trail Comparison file address');
      return match[1];
    }

    async function loadComparisonFiles(files) {
      var selected = Array.prototype.slice.call(files || []);
      if (!selected.length) return reset();
      var token = ++generation;
      machine.reset();
      multiProjection = null;
      portableResult = null;
      comparisonResult = null;
      renderNeutral('READING_COMPARISON');
      try {
        var bundle = { files: {} };
        for (var index = 0; index < selected.length; index += 1) {
          var address = comparisonAddress(selected[index]);
          if (bundle.files[address]) throw new Error('Duplicate portable Trail Comparison file address');
          bundle.files[address] = new Uint8Array(await selected[index].arrayBuffer());
          if (token !== generation) return null;
        }
        renderNeutral('VERIFYING_COMPARISON');
        comparisonResult = await delegation.inspectTrailComparison(bundle, { verified_at: new Date().toISOString() });
        if (token !== generation) return null;
        renderer.renderPortableComparison(result, comparisonResult);
        return JSON.parse(JSON.stringify(comparisonResult));
      } catch (error) {
        if (token !== generation) return null;
        renderer.renderPortableComparisonError(result, error);
        return null;
      }
    }

    function navigate(action) {
      var snapshot = machine.snapshot();
      if (snapshot.phase !== 'INSPECTING') return snapshot;
      if (action === 'previous') machine.previous();
      if (action === 'next') machine.next();
      render();
      return machine.snapshot();
    }

    input.addEventListener('change', function () {
      var files = input.files;
      if (!files || files.length === 0) {
        reset();
        return;
      }
      sessionInput.value = '';
      comparisonInput.value = '';
      loadFiles(files).catch(function () {
        reset();
      });
    });

    sessionInput.addEventListener('change', function () {
      var files = sessionInput.files;
      if (!files || files.length === 0) {
        reset();
        return;
      }
      input.value = '';
      comparisonInput.value = '';
      loadPortableFiles(files).catch(function () { reset(); });
    });

    comparisonInput.addEventListener('change', function () {
      var files = comparisonInput.files;
      if (!files || files.length === 0) return reset();
      input.value = '';
      sessionInput.value = '';
      loadComparisonFiles(files);
    });

    resetButton.addEventListener('click', function () {
      reset();
      input.focus();
    });

    result.addEventListener('click', function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest('[data-replay-action]')
        : null;
      if (!target) return;
      var action = target.getAttribute('data-replay-action');
      if (action === 'details') {
        renderer.toggleDetails(result);
        return;
      }
      if (action === 'previous' || action === 'next') navigate(action);
    });

    shell.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate('previous');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigate('next');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        reset();
        input.focus();
      }
    });

    render();

    return Object.freeze({
      loadBytes: loadBytes,
      loadFiles: loadFiles,
      loadPortableFiles: loadPortableFiles,
      loadComparisonFiles: loadComparisonFiles,
      reset: reset,
      snapshot: function () { return machine.snapshot(); },
      multiSnapshot: function () { return multiProjection ? JSON.parse(JSON.stringify(multiProjection)) : null; },
      portableSnapshot: function () { return portableResult ? JSON.parse(JSON.stringify(portableResult)) : null; },
      comparisonSnapshot: function () { return comparisonResult ? JSON.parse(JSON.stringify(comparisonResult)) : null; },
      destroy: function () {
        generation += 1;
        machine.reset();
        multiProjection = null;
        portableResult = null;
        comparisonResult = null;
        input.value = '';
        sessionInput.value = '';
        comparisonInput.value = '';
        container.replaceChildren();
      }
    });
  }

  return Object.freeze({ mount: mount });
});
