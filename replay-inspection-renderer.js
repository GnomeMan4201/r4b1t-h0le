(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./trail-comparison-renderer.js') : root && root.R4b1tTrailComparisonRenderer
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tReplayInspectionRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (comparisonRenderer) {
  'use strict';

  function text(value) {
    return value === null || typeof value === 'undefined' ? '' : String(value);
  }

  function shortDigest(value) {
    var raw = text(value).replace(/^sha256:/, '');
    return raw ? 'sha256:' + raw.slice(0, 12) + '…' + raw.slice(-8) : '—';
  }

  function el(doc, tag, className, value) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (typeof value !== 'undefined') node.textContent = text(value);
    return node;
  }

  function button(doc, label, action, disabled) {
    var node = el(doc, 'button', 'replay-inspection-button', label);
    node.type = 'button';
    node.setAttribute('data-replay-action', action);
    node.disabled = Boolean(disabled);
    return node;
  }

  function field(doc, label, value) {
    var row = el(doc, 'div', 'replay-inspection-field');
    row.appendChild(el(doc, 'span', 'replay-inspection-field-label', label));
    row.appendChild(el(doc, 'span', 'replay-inspection-field-value', value));
    return row;
  }

  function neutralLabel(phase) {
    if (phase === 'READING_COMPARISON') return 'READING TRAIL COMPARISON';
    if (phase === 'VERIFYING_COMPARISON') return 'VERIFYING TRAIL COMPARISON';
    if (phase === 'READING_PORTABLE') return 'READING PROOF SESSION';
    if (phase === 'VERIFYING_PORTABLE') return 'VERIFYING PROOF SESSION';
    if (phase === 'READING_MULTI') return 'READING SOURCES';
    if (phase === 'VERIFYING_MULTI') return 'VERIFYING SOURCES';
    if (phase === 'READING') return 'READING SOURCE';
    if (phase === 'VERIFYING') return 'VERIFYING SOURCE';
    return 'NO SOURCE LOADED';
  }

  function renderNeutral(doc, root, snapshot) {
    root.setAttribute('data-replay-phase', snapshot.phase);
    var neutral = el(doc, 'div', 'replay-inspection-neutral');
    neutral.setAttribute('role', 'status');
    neutral.setAttribute('aria-live', 'polite');
    neutral.appendChild(el(doc, 'strong', 'replay-inspection-neutral-state', neutralLabel(snapshot.phase)));
    neutral.appendChild(el(doc, 'p', 'replay-inspection-neutral-copy', 'No evidentiary content is presented before verification completes.'));
    root.appendChild(neutral);
  }

  function renderDiagnostic(doc, root, snapshot) {
    var source = snapshot.source;
    var diagnostic = snapshot.diagnostic;
    root.setAttribute('data-replay-phase', snapshot.phase);
    root.setAttribute('data-proof-state', diagnostic.state);

    var header = el(doc, 'header', 'replay-inspection-header');
    header.appendChild(el(doc, 'span', 'replay-inspection-kicker', 'REPLAY / INSPECTION'));
    header.appendChild(el(doc, 'strong', 'replay-inspection-proof-state', diagnostic.state));
    root.appendChild(header);

    var body = el(doc, 'section', 'replay-inspection-diagnostic');
    body.setAttribute('aria-label', 'Verification diagnostic');
    body.appendChild(field(doc, 'SOURCE', shortDigest(source.artifact_digest)));
    body.appendChild(field(doc, 'FORMAT', source.artifact_format || 'UNKNOWN'));
    body.appendChild(field(doc, 'REASON', diagnostic.reason));
    root.appendChild(body);
  }

  function renderVerified(doc, root, snapshot) {
    var source = snapshot.source;
    var step = snapshot.current_step;
    root.setAttribute('data-replay-phase', snapshot.phase);
    root.setAttribute('data-proof-state', source.verification.state);

    var header = el(doc, 'header', 'replay-inspection-header');
    var heading = el(doc, 'div', 'replay-inspection-heading');
    heading.appendChild(el(doc, 'span', 'replay-inspection-kicker', 'REPLAY / INSPECTION'));
    heading.appendChild(el(doc, 'strong', 'replay-inspection-proof-state', source.verification.state));
    header.appendChild(heading);
    header.appendChild(button(doc, 'Verification details', 'details', false));
    root.appendChild(header);

    var primary = el(doc, 'section', 'replay-inspection-primary');
    primary.setAttribute('aria-label', 'Verified replay state');

    var position = snapshot.position === null ? 0 : snapshot.position + 1;
    primary.appendChild(field(doc, 'POSITION', position + ' / ' + snapshot.total_positions));
    primary.appendChild(field(doc, 'SOURCE', shortDigest(source.artifact_digest)));

    if (step) {
      primary.appendChild(field(doc, 'STATE', step.state));
      var evidence = el(doc, 'div', 'replay-inspection-step');
      evidence.setAttribute('data-step-state', step.state);
      if (step.state === 'CONCEALED') {
        evidence.appendChild(el(doc, 'strong', 'replay-inspection-step-title', 'CONCEALED'));
        evidence.appendChild(el(doc, 'p', 'replay-inspection-step-copy', 'Route identity is not disclosed at this historical position.'));
        evidence.appendChild(field(doc, 'COMMITMENT', shortDigest(step.commitment)));
      } else {
        evidence.appendChild(el(doc, 'strong', 'replay-inspection-step-title', 'REVEALED'));
        evidence.appendChild(field(doc, 'ROUTE', step.url));
        evidence.appendChild(field(doc, 'ROUTE ID', shortDigest(step.route_id)));
        if (step.action) evidence.appendChild(field(doc, 'ACTION', step.action));
      }
      primary.appendChild(evidence);
    }
    root.appendChild(primary);

    var nav = el(doc, 'nav', 'replay-inspection-nav');
    nav.setAttribute('aria-label', 'Replay navigation');
    nav.appendChild(button(doc, 'Previous', 'previous', snapshot.position === null || snapshot.position <= 0));
    nav.appendChild(button(doc, 'Next', 'next', snapshot.position === null || snapshot.position >= snapshot.total_positions - 1));
    root.appendChild(nav);

    var details = el(doc, 'section', 'replay-inspection-details');
    details.hidden = true;
    details.setAttribute('data-replay-details', '');
    details.setAttribute('aria-label', 'Verification details');
    details.appendChild(field(doc, 'FULL DIGEST', source.artifact_digest));
    details.appendChild(field(doc, 'CANONICAL ID', source.canonical_trail_id));
    details.appendChild(field(doc, 'FORMAT', source.artifact_format));
    details.appendChild(field(doc, 'VERIFIER', source.verification.verifier));
    details.appendChild(field(doc, 'VERIFIED AT', source.verification.verified_at || 'NOT RECORDED'));
    root.appendChild(details);
  }

  function render(container, snapshot) {
    if (!container || !container.ownerDocument) throw new TypeError('Replay renderer requires a DOM container');
    if (!snapshot || typeof snapshot.phase !== 'string') throw new TypeError('Replay renderer requires a machine snapshot');

    var doc = container.ownerDocument;
    var root = el(doc, 'article', 'replay-inspection');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-label', 'Replay Inspection');

    if (snapshot.phase === 'UNLOADED' || snapshot.phase === 'READING' || snapshot.phase === 'VERIFYING' || snapshot.phase === 'READING_MULTI' || snapshot.phase === 'VERIFYING_MULTI' || snapshot.phase === 'READING_PORTABLE' || snapshot.phase === 'VERIFYING_PORTABLE' || snapshot.phase === 'READING_COMPARISON' || snapshot.phase === 'VERIFYING_COMPARISON') {
      renderNeutral(doc, root, snapshot);
    } else if (snapshot.phase === 'REJECTED' || snapshot.phase === 'UNVERIFIED') {
      renderDiagnostic(doc, root, snapshot);
    } else if (snapshot.phase === 'VERIFIED' || snapshot.phase === 'INSPECTING') {
      renderVerified(doc, root, snapshot);
    } else {
      throw new Error('Unsupported Replay phase');
    }

    container.replaceChildren(root);
    return root;
  }

  function renderMulti(container, projection) {
    if (!container || !container.ownerDocument) throw new TypeError('Replay renderer requires a DOM container');
    if (!projection || !Array.isArray(projection.sources)) throw new TypeError('Replay renderer requires a Proof Session projection');
    var doc = container.ownerDocument;
    var root = el(doc, 'article', 'replay-inspection replay-inspection-multi');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-label', 'Replay multi-source inspection');
    root.setAttribute('data-replay-mode', 'multi-source');
    var supplied = projection.sources.reduce(function (count, source) { return count + source.supplied_count; }, 0);
    var header = el(doc, 'header', 'replay-inspection-header');
    var heading = el(doc, 'div', 'replay-inspection-heading');
    heading.appendChild(el(doc, 'span', 'replay-inspection-kicker', 'REPLAY / MULTI-SOURCE'));
    heading.appendChild(el(doc, 'strong', 'replay-inspection-proof-state', projection.sources.length + ' UNIQUE / ' + supplied + ' SUPPLIED'));
    header.appendChild(heading);
    root.appendChild(header);

    var sources = el(doc, 'section', 'replay-inspection-multi-sources');
    sources.setAttribute('aria-label', 'Source slots');
    projection.sources.forEach(function (source) {
      var card = el(doc, 'article', 'replay-inspection-source-slot');
      card.setAttribute('data-proof-state', source.verification.state);
      card.appendChild(field(doc, 'SLOT', source.slot_id));
      card.appendChild(field(doc, 'STATE', source.verification.state));
      card.appendChild(field(doc, 'SOURCE', shortDigest(source.artifact_digest)));
      card.appendChild(field(doc, 'FORMAT', source.artifact_format || 'UNKNOWN'));
      card.appendChild(field(doc, 'SUPPLIED', source.supplied_count + '×'));
      if (source.verification.reason) card.appendChild(field(doc, 'REASON', source.verification.reason));
      sources.appendChild(card);
    });
    root.appendChild(sources);

    var derived = el(doc, 'section', 'replay-inspection-multi-derived');
    derived.setAttribute('aria-label', 'Delegated comparisons and direct relationships');
    derived.appendChild(field(doc, 'VERIFIED PAIRS', projection.pairs.length));
    projection.pairs.forEach(function (pair) {
      derived.appendChild(field(doc, 'PAIR ' + pair.left_slot + ' ↔ ' + pair.right_slot, shortDigest(pair.comparison_projection_digest)));
    });
    projection.relationships.forEach(function (edge) {
      derived.appendChild(field(doc, 'DIRECT PARENT', edge.parent_slot + ' → ' + edge.child_slot));
    });
    root.appendChild(derived);

    var summary = el(doc, 'section', 'replay-inspection-multi-summary');
    summary.setAttribute('aria-label', 'Proof Session summary');
    projection.summary.forEach(function (item) { summary.appendChild(field(doc, item.label, item.count)); });
    root.appendChild(summary);
    container.replaceChildren(root);
    return root;
  }

  function renderPortableSession(container, delegated) {
    if (!container || !container.ownerDocument) throw new TypeError('Replay renderer requires a DOM container');
    if (!delegated || !delegated.result) throw new TypeError('Replay renderer requires a delegated portable result');
    var result = delegated.result;
    var classification = delegated.portable_classification;
    var doc = container.ownerDocument;
    var root = el(doc, 'article', 'replay-inspection replay-inspection-portable');
    root.setAttribute('data-replay-mode', 'portable-proof-session');
    root.setAttribute('data-portable-classification', classification);
    root.setAttribute('aria-label', 'Portable Proof Session inspection');
    var header = el(doc, 'header', 'replay-inspection-header');
    var heading = el(doc, 'div', 'replay-inspection-heading');
    heading.appendChild(el(doc, 'span', 'replay-inspection-kicker', 'REPLAY / PORTABLE PROOF SESSION'));
    heading.appendChild(el(doc, 'strong', 'replay-inspection-proof-state', classification));
    header.appendChild(heading);
    root.appendChild(header);
    var diagnostic = el(doc, 'section', 'replay-inspection-portable-diagnostic');
    if (result.reason) diagnostic.appendChild(field(doc, 'REASON', result.reason));
    (result.mismatches || []).forEach(function (name) { diagnostic.appendChild(field(doc, 'MISMATCH', name)); });
    (result.warnings || []).forEach(function (warning) { diagnostic.appendChild(field(doc, 'WARNING', warning)); });
    if (diagnostic.childNodes.length) root.appendChild(diagnostic);
    if (result.fresh_projection) {
      var fresh = el(doc, 'div', 'replay-inspection-portable-fresh');
      root.appendChild(fresh);
      renderMulti(fresh, result.fresh_projection);
    }
    container.replaceChildren(root);
    return root;
  }

  function renderPortableComparison(container, delegated) {
    if (!container || !container.ownerDocument) throw new TypeError('Replay renderer requires a DOM container');
    if (!delegated || !delegated.result || !delegated.result.fresh_projection) throw new TypeError('Replay renderer requires a fresh delegated comparison');
    if (!comparisonRenderer || typeof comparisonRenderer.render !== 'function') throw new Error('Trail Comparison renderer is unavailable');
    var result = delegated.result;
    var doc = container.ownerDocument;
    var root = el(doc, 'article', 'replay-inspection replay-inspection-portable-comparison');
    root.setAttribute('data-replay-mode', 'portable-trail-comparison');
    root.setAttribute('data-portable-comparison-status', 'FRESHLY_VERIFIED');
    root.setAttribute('aria-label', 'Portable Trail Comparison inspection');
    var header = el(doc, 'header', 'replay-inspection-header');
    var heading = el(doc, 'div', 'replay-inspection-heading');
    heading.appendChild(el(doc, 'span', 'replay-inspection-kicker', 'REPLAY / PORTABLE TRAIL COMPARISON'));
    heading.appendChild(el(doc, 'strong', 'replay-inspection-proof-state', 'FRESHLY VERIFIED'));
    header.appendChild(heading);
    root.appendChild(header);
    var bindings = el(doc, 'section', 'replay-inspection-portable-diagnostic');
    bindings.appendChild(field(doc, 'LEFT SOURCE', shortDigest(result.left_source_digest)));
    bindings.appendChild(field(doc, 'LEFT BOUND', result.left_source_matches));
    bindings.appendChild(field(doc, 'RIGHT SOURCE', shortDigest(result.right_source_digest)));
    bindings.appendChild(field(doc, 'RIGHT BOUND', result.right_source_matches));
    root.appendChild(bindings);
    var fresh = el(doc, 'div', 'replay-inspection-portable-fresh');
    root.appendChild(fresh);
    comparisonRenderer.render(fresh, result.fresh_projection);
    container.replaceChildren(root);
    return root;
  }

  function renderPortableComparisonError(container, error) {
    var doc = container.ownerDocument;
    var root = el(doc, 'article', 'replay-inspection replay-inspection-portable-comparison');
    root.setAttribute('data-replay-mode', 'portable-trail-comparison');
    root.setAttribute('data-portable-comparison-status', 'ERROR');
    root.setAttribute('aria-label', 'Portable Trail Comparison diagnostic');
    var body = el(doc, 'section', 'replay-inspection-portable-diagnostic');
    body.appendChild(el(doc, 'strong', 'replay-inspection-proof-state', 'FAIL CLOSED'));
    body.appendChild(field(doc, 'REASON', error && error.message ? error.message : String(error)));
    root.appendChild(body);
    container.replaceChildren(root);
    return root;
  }

  function toggleDetails(container) {
    var details = container && container.querySelector('[data-replay-details]');
    var trigger = container && container.querySelector('[data-replay-action="details"]');
    if (!details || !trigger) return false;
    details.hidden = !details.hidden;
    trigger.setAttribute('aria-expanded', details.hidden ? 'false' : 'true');
    return !details.hidden;
  }

  return Object.freeze({
    render: render,
    renderMulti: renderMulti,
    renderPortableSession: renderPortableSession,
    renderPortableComparison: renderPortableComparison,
    renderPortableComparisonError: renderPortableComparisonError,
    toggleDetails: toggleDetails,
    shortDigest: shortDigest
  });
});
