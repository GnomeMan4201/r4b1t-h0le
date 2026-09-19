(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tTrailCardRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var NOTICE = 'Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.';
  var DIAGNOSTIC_NOTICE = 'THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.';
  var STATES = ['VERIFIED', 'REJECTED', 'UNVERIFIED'];

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

  function field(doc, label, value, className) {
    var row = el(doc, 'div', 'trail-card-field' + (className ? ' ' + className : ''));
    row.appendChild(el(doc, 'span', 'trail-card-field-label', label));
    row.appendChild(el(doc, 'span', 'trail-card-field-value', value));
    return row;
  }

  function stateHeader(doc, card) {
    var header = el(doc, 'header', 'trail-card-header');
    var marker = el(doc, 'span', 'trail-card-state-marker', card.verification.state === 'VERIFIED' ? '✓' : '!');
    marker.setAttribute('aria-hidden', 'true');
    var group = el(doc, 'div', 'trail-card-state-group');
    group.appendChild(el(doc, 'div', 'trail-card-kicker', 'TRAIL CARD'));
    group.appendChild(el(doc, 'h2', 'trail-card-state', card.verification.state));
    header.appendChild(marker);
    header.appendChild(group);
    return header;
  }

  function renderTrailDisplay(doc, display) {
    var section = el(doc, 'section', 'trail-card-display trail-card-display-trail');
    section.setAttribute('aria-label', 'Trail structure');

    var summary = el(doc, 'div', 'trail-card-summary');
    summary.appendChild(field(doc, 'STOPS', display.stop_count));
    summary.appendChild(field(doc, 'REVEALED', display.revealed_count));
    summary.appendChild(field(doc, 'CONCEALED', display.concealed_count));
    section.appendChild(summary);

    section.appendChild(field(doc, 'TRAIL', shortDigest(display.trail_id), 'trail-card-id'));
    if (display.genesis_id) section.appendChild(field(doc, 'GENESIS', shortDigest(display.genesis_id), 'trail-card-id'));

    if (display.parent) {
      section.appendChild(field(
        doc,
        'PARENT',
        shortDigest(display.parent.trail_id) + ' @ ' + display.parent.fork_at,
        'trail-card-id'
      ));
    } else {
      section.appendChild(field(doc, 'PARENT', 'ORIGIN'));
    }

    var stops = el(doc, 'ol', 'trail-card-stops');
    stops.setAttribute('aria-label', 'Recorded stops');
    display.stops.forEach(function (stop) {
      var item = el(doc, 'li', 'trail-card-stop trail-card-stop-' + stop.state);
      item.setAttribute('data-stop-state', stop.state);
      item.appendChild(el(doc, 'span', 'trail-card-stop-index', String(stop.index + 1).padStart(2, '0')));
      item.appendChild(el(doc, 'span', 'trail-card-stop-state', stop.state.toUpperCase()));
      stops.appendChild(item);
    });
    section.appendChild(stops);
    return section;
  }

  function renderTopologyDisplay(doc, display) {
    var section = el(doc, 'section', 'trail-card-display trail-card-display-topology');
    section.setAttribute('aria-label', 'Topology structure');

    var summary = el(doc, 'div', 'trail-card-summary');
    summary.appendChild(field(doc, 'NODES', display.node_count));
    summary.appendChild(field(doc, 'EDGES', display.edge_count));
    summary.appendChild(field(doc, 'STOPS', display.stop_count));
    summary.appendChild(field(doc, 'PARENT ABSENT', display.parent_absent_count));
    section.appendChild(summary);

    var diagram = el(doc, 'ol', 'trail-card-branches');
    diagram.setAttribute('aria-label', 'Topology lineage');

    display.branch_diagram.nodes.forEach(function (node) {
      var item = el(doc, 'li', 'trail-card-branch');
      item.setAttribute('data-relationship-state', node.relationship_state || 'ORIGIN');

      var title = el(doc, 'div', 'trail-card-branch-title');
      title.appendChild(el(doc, 'span', 'trail-card-branch-id', shortDigest(node.trail_id)));
      title.appendChild(el(
        doc,
        'span',
        'trail-card-relationship-state',
        node.relationship_state || 'ORIGIN'
      ));
      item.appendChild(title);

      var counts = el(doc, 'div', 'trail-card-branch-counts',
        node.stop_count + ' stops · ' + node.revealed_count + ' revealed · ' + node.concealed_count + ' concealed'
      );
      item.appendChild(counts);

      if (node.parent) {
        item.appendChild(el(
          doc,
          'div',
          'trail-card-branch-parent',
          'parent ' + shortDigest(node.parent.trail_id) + ' @ ' + node.parent.fork_at
        ));
      }
      diagram.appendChild(item);
    });

    section.appendChild(diagram);
    return section;
  }

  function renderVerified(doc, card) {
    var body = el(doc, 'div', 'trail-card-body trail-card-body-verified');
    body.appendChild(field(doc, 'SOURCE', card.source.artifact_format));
    body.appendChild(field(doc, 'DIGEST', shortDigest(card.source.artifact_digest), 'trail-card-id'));
    body.appendChild(field(doc, 'VERIFIED AT', card.verification.verified_at));
    body.appendChild(field(doc, 'VERIFIER', card.verification.verifier));

    if (card.display.kind === 'trail') body.appendChild(renderTrailDisplay(doc, card.display));
    else body.appendChild(renderTopologyDisplay(doc, card.display));

    var note = el(doc, 'p', 'trail-card-notice', card.notice);
    body.appendChild(note);
    return body;
  }

  function renderDiagnostic(doc, card) {
    var body = el(doc, 'div', 'trail-card-body trail-card-body-diagnostic');
    var warning = el(doc, 'div', 'trail-card-diagnostic-banner');
    warning.appendChild(el(doc, 'strong', 'trail-card-diagnostic-title', card.diagnostic_notice || DIAGNOSTIC_NOTICE));
    warning.appendChild(el(doc, 'p', 'trail-card-diagnostic-reason', card.verification.reason));
    body.appendChild(warning);

    body.appendChild(field(doc, 'SOURCE', card.source.artifact_format || 'UNREADABLE'));
    body.appendChild(field(doc, 'ATTEMPTED DIGEST', shortDigest(card.source.artifact_digest), 'trail-card-id'));
    body.appendChild(field(doc, 'CONFIRMED DIGEST', card.verification.verified_digest ? shortDigest(card.verification.verified_digest) : 'NONE'));
    body.appendChild(field(doc, 'VERIFICATION ATTEMPT', card.verification.verified_at || 'NOT RUN'));
    body.appendChild(field(doc, 'VERIFIER', card.verification.verifier));
    body.appendChild(el(doc, 'p', 'trail-card-notice', card.notice || NOTICE));
    return body;
  }

  function assertCard(card) {
    if (!card || !card.verification || STATES.indexOf(card.verification.state) === -1) {
      throw new TypeError('Trail Card renderer requires a valid projection state');
    }
    if (!card.source || typeof card.source.artifact_digest !== 'string') {
      throw new TypeError('Trail Card renderer requires a source digest');
    }
    if (card.verification.state === 'VERIFIED' && !card.display) {
      throw new TypeError('Verified Trail Card renderer input requires display data');
    }
    if (card.verification.state !== 'VERIFIED' && card.diagnostic_notice !== DIAGNOSTIC_NOTICE) {
      throw new TypeError('Diagnostic Trail Card renderer input requires the governed diagnostic notice');
    }
  }

  function build(doc, card) {
    assertCard(card);
    var article = el(
      doc,
      'article',
      'trail-card trail-card-' + card.verification.state.toLowerCase()
    );
    article.setAttribute('data-proof-state', card.verification.state);
    article.setAttribute('aria-label', 'Trail Card — ' + card.verification.state);
    article.tabIndex = 0;

    article.appendChild(stateHeader(doc, card));
    article.appendChild(
      card.verification.state === 'VERIFIED'
        ? renderVerified(doc, card)
        : renderDiagnostic(doc, card)
    );
    return article;
  }

  function render(container, card) {
    if (!container || !container.ownerDocument) {
      throw new TypeError('Trail Card renderer requires a DOM container');
    }
    var article = build(container.ownerDocument, card);
    container.replaceChildren(article);
    return article;
  }

  function serialize(card) {
    if (typeof document === 'undefined' || !document.implementation) {
      throw new Error('Trail Card serialization requires a DOM');
    }
    var doc = document.implementation.createHTMLDocument('');
    var root = doc.createElement('div');
    root.appendChild(build(doc, card));
    return root.innerHTML;
  }

  return {
    render: render,
    serialize: serialize,
    shortDigest: shortDigest
  };
});
