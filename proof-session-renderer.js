(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./proof-session.js') : root.R4b1tProofSession
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tProofSessionRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (session) {
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

  function field(doc, label, value, className) {
    var row = el(doc, 'div', 'proof-session-field' + (className ? ' ' + className : ''));
    row.appendChild(el(doc, 'span', 'proof-session-field-label', label));
    row.appendChild(el(doc, 'span', 'proof-session-field-value', value));
    return row;
  }

  function sourceBlock(doc, source) {
    var diagnostic = source.verification.state !== 'VERIFIED';
    var block = el(
      doc,
      'section',
      diagnostic ? 'proof-session-source proof-session-diagnostic-source' : 'proof-session-source'
    );
    block.setAttribute('data-source-slot', source.slot_id);
    block.setAttribute('data-proof-state', source.verification.state);

    var header = el(doc, 'div', 'proof-session-source-header');
    header.appendChild(el(doc, 'h3', 'proof-session-source-title', source.slot_id));
    header.appendChild(el(doc, 'strong', 'proof-session-source-state', source.verification.state));
    block.appendChild(header);

    block.appendChild(field(doc, 'FORMAT', source.artifact_format || 'UNREADABLE'));
    block.appendChild(field(doc, 'DIGEST', shortDigest(source.artifact_digest), 'proof-session-id'));
    block.appendChild(field(doc, 'SUPPLIED', source.supplied_count));

    if (source.canonical_trail_id) {
      block.appendChild(field(doc, 'TRAIL', shortDigest(source.canonical_trail_id), 'proof-session-id'));
    }

    block.appendChild(field(doc, 'VERIFIER', source.verification.verifier));
    block.appendChild(field(doc, 'VERIFIED AT', source.verification.verified_at || 'NOT RUN'));

    if (source.verification.reason) {
      block.appendChild(field(doc, 'REASON', source.verification.reason, 'proof-session-reason'));
    }

    return block;
  }

  function summaryGrid(doc, projection) {
    var section = el(doc, 'section', 'proof-session-summary');
    section.setAttribute('aria-label', 'Proof Session summary');

    projection.summary.forEach(function (item) {
      var cell = el(doc, 'div', 'proof-session-summary-item');
      cell.appendChild(el(doc, 'span', 'proof-session-summary-label', item.label));
      cell.appendChild(el(doc, 'strong', 'proof-session-summary-count', item.count));
      section.appendChild(cell);
    });

    return section;
  }

  function sourceSections(doc, projection) {
    var verified = projection.sources.filter(function (source) {
      return source.verification.state === 'VERIFIED';
    });
    var diagnostic = projection.sources.filter(function (source) {
      return source.verification.state !== 'VERIFIED';
    });

    var wrap = el(doc, 'div', 'proof-session-source-sections');

    var verifiedSection = el(doc, 'section', 'proof-session-source-group proof-session-source-group-verified');
    verifiedSection.setAttribute('aria-label', 'Verified session sources');
    verifiedSection.appendChild(el(doc, 'h2', 'proof-session-section-title', 'VERIFIED SOURCES'));
    var verifiedGrid = el(doc, 'div', 'proof-session-source-grid');
    verified.forEach(function (source) {
      verifiedGrid.appendChild(sourceBlock(doc, source));
    });
    if (!verified.length) {
      verifiedGrid.appendChild(el(doc, 'p', 'proof-session-empty', 'NO VERIFIED SOURCES'));
    }
    verifiedSection.appendChild(verifiedGrid);
    wrap.appendChild(verifiedSection);

    if (diagnostic.length) {
      var diagnosticSection = el(doc, 'section', 'proof-session-source-group proof-session-source-group-diagnostic');
      diagnosticSection.setAttribute('aria-label', 'Diagnostic session sources');
      diagnosticSection.appendChild(el(doc, 'h2', 'proof-session-section-title', 'DIAGNOSTIC SOURCES'));
      var diagnosticGrid = el(doc, 'div', 'proof-session-source-grid');
      diagnostic.forEach(function (source) {
        diagnosticGrid.appendChild(sourceBlock(doc, source));
      });
      diagnosticSection.appendChild(diagnosticGrid);
      wrap.appendChild(diagnosticSection);
    }

    return wrap;
  }

  function relationshipSection(doc, projection) {
    var section = el(doc, 'section', 'proof-session-relationships');
    section.setAttribute('aria-label', 'Direct verified relationships');
    section.appendChild(el(doc, 'h2', 'proof-session-section-title', 'DIRECT RELATIONSHIPS'));

    if (!projection.relationships.length) {
      section.appendChild(el(doc, 'p', 'proof-session-empty', 'NONE'));
      return section;
    }

    var list = el(doc, 'ol', 'proof-session-relationship-list');
    projection.relationships.forEach(function (edge) {
      var item = el(doc, 'li', 'proof-session-relationship');
      item.setAttribute('data-parent-slot', edge.parent_slot);
      item.setAttribute('data-child-slot', edge.child_slot);

      var line = el(doc, 'div', 'proof-session-relationship-line');
      line.appendChild(el(doc, 'strong', 'proof-session-relationship-parent', edge.parent_slot));
      line.appendChild(el(doc, 'span', 'proof-session-relationship-arrow', '→'));
      line.appendChild(el(doc, 'strong', 'proof-session-relationship-child', edge.child_slot));
      item.appendChild(line);
      item.appendChild(field(doc, 'TYPE', 'DIRECT PARENT'));
      item.appendChild(field(doc, 'COMPARISON', shortDigest(edge.comparison_projection_digest), 'proof-session-id'));
      list.appendChild(item);
    });

    section.appendChild(list);
    return section;
  }

  function pairSection(doc, projection) {
    var section = el(doc, 'section', 'proof-session-pairs');
    section.setAttribute('aria-label', 'Verified pair references');
    section.appendChild(el(doc, 'h2', 'proof-session-section-title', 'VERIFIED PAIRS'));

    if (!projection.pairs.length) {
      section.appendChild(el(doc, 'p', 'proof-session-empty', 'NONE'));
      return section;
    }

    var list = el(doc, 'ol', 'proof-session-pair-list');
    projection.pairs.forEach(function (pair) {
      var item = el(doc, 'li', 'proof-session-pair');
      item.setAttribute('data-left-slot', pair.left_slot);
      item.setAttribute('data-right-slot', pair.right_slot);

      var endpoints = el(doc, 'div', 'proof-session-pair-endpoints');
      endpoints.appendChild(el(doc, 'strong', 'proof-session-pair-slot', pair.left_slot));
      endpoints.appendChild(el(doc, 'span', 'proof-session-pair-arrow', '⇄'));
      endpoints.appendChild(el(doc, 'strong', 'proof-session-pair-slot', pair.right_slot));
      item.appendChild(endpoints);
      item.appendChild(field(doc, 'FORMAT', pair.comparison_format));
      item.appendChild(field(doc, 'PROJECTION', shortDigest(pair.comparison_projection_digest), 'proof-session-id'));
      list.appendChild(item);
    });

    section.appendChild(list);
    return section;
  }

  function build(doc, projection) {
    if (!session || typeof session.validateProjection !== 'function') {
      throw new Error('Proof Session renderer requires the Proof Session core validator');
    }
    session.validateProjection(projection);

    var article = el(doc, 'article', 'proof-session');
    article.setAttribute('aria-label', 'Proof Session');
    article.setAttribute('tabindex', '0');

    var header = el(doc, 'header', 'proof-session-header');
    var mark = el(doc, 'span', 'proof-session-marker', 'PS');
    mark.setAttribute('aria-hidden', 'true');
    header.appendChild(mark);

    var heading = el(doc, 'div', 'proof-session-heading-group');
    heading.appendChild(el(doc, 'div', 'proof-session-kicker', 'PROOF SESSION'));
    heading.appendChild(el(doc, 'h1', 'proof-session-heading', 'EPHEMERAL WORKSPACE'));
    header.appendChild(heading);
    article.appendChild(header);

    article.appendChild(summaryGrid(doc, projection));
    article.appendChild(sourceSections(doc, projection));
    article.appendChild(relationshipSection(doc, projection));
    article.appendChild(pairSection(doc, projection));
    article.appendChild(el(doc, 'p', 'proof-session-notice', projection.notice));

    return article;
  }

  function render(container, projection) {
    if (!container || !container.ownerDocument) {
      throw new TypeError('Proof Session renderer requires a DOM container');
    }
    var article = build(container.ownerDocument, projection);
    container.replaceChildren(article);
    return article;
  }

  function serialize(projection) {
    if (typeof document === 'undefined' || !document.implementation) {
      throw new Error('Proof Session serialization requires a DOM');
    }
    var doc = document.implementation.createHTMLDocument('');
    var root = doc.createElement('div');
    root.appendChild(build(doc, projection));
    return root.innerHTML;
  }

  return {
    render: render,
    serialize: serialize,
    shortDigest: shortDigest
  };
});
