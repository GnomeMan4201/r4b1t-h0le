(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tTrailComparisonRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FORMAT = 'r4b1t-trail-comparison/v0.1';
  var NOTICE = 'Comparison describes two independently verified source artifacts identified by their digests. It does not replace either source artifact. Re-verify both sources to confirm current validity.';
  var DIAGNOSTIC_NOTICE = 'THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.';
  var SOURCE_STATES = ['VERIFIED', 'REJECTED', 'UNVERIFIED'];
  var POSITION_STATES = [
    'MATCH_REVEALED',
    'DIFFER_REVEALED',
    'LEFT_CONCEALED',
    'RIGHT_CONCEALED',
    'BOTH_CONCEALED_SAME_COMMITMENT',
    'BOTH_CONCEALED_DIFFERENT_COMMITMENT',
    'LEFT_ONLY',
    'RIGHT_ONLY'
  ];

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
    var row = el(doc, 'div', 'trail-comparison-field' + (className ? ' ' + className : ''));
    row.appendChild(el(doc, 'span', 'trail-comparison-field-label', label));
    row.appendChild(el(doc, 'span', 'trail-comparison-field-value', value));
    return row;
  }

  function assertProjection(value) {
    if (!value || value.format !== FORMAT) {
      throw new TypeError('Trail Comparison renderer requires a valid projection format');
    }
    if (!value.sources || !value.verification || !value.sources.left || !value.sources.right ||
        !value.verification.left || !value.verification.right) {
      throw new TypeError('Trail Comparison renderer requires both source and verification records');
    }
    ['left', 'right'].forEach(function (side) {
      if (SOURCE_STATES.indexOf(value.verification[side].state) === -1) {
        throw new TypeError('Trail Comparison renderer source verification state is invalid');
      }
      if (typeof value.sources[side].artifact_digest !== 'string') {
        throw new TypeError('Trail Comparison renderer requires source digests');
      }
    });

    var bothVerified = value.verification.left.state === 'VERIFIED' &&
      value.verification.right.state === 'VERIFIED';

    if (bothVerified) {
      if (!value.comparison) throw new TypeError('Verified Trail Comparison renderer input requires comparison facts');
      if (!Array.isArray(value.comparison.positions)) throw new TypeError('Verified Trail Comparison positions are invalid');
      value.comparison.positions.forEach(function (position) {
        if (POSITION_STATES.indexOf(position.state) === -1) {
          throw new TypeError('Trail Comparison position state is invalid');
        }
      });
      if (Object.prototype.hasOwnProperty.call(value, 'diagnostic_notice')) {
        throw new TypeError('Verified Trail Comparison cannot carry diagnostic notice');
      }
    } else {
      if (value.comparison !== null || value.diagnostic_notice !== DIAGNOSTIC_NOTICE) {
        throw new TypeError('Diagnostic Trail Comparison renderer input is invalid');
      }
    }
    if (value.notice !== NOTICE) throw new TypeError('Trail Comparison notice is invalid');
  }

  function sourceBlock(doc, sideName, source, verification) {
    var block = el(doc, 'section', 'trail-comparison-source');
    block.setAttribute('data-source-side', sideName.toLowerCase());
    block.setAttribute('data-proof-state', verification.state);
    block.appendChild(el(doc, 'h3', 'trail-comparison-source-title', sideName));
    block.appendChild(field(doc, 'STATE', verification.state, 'trail-comparison-source-state'));
    block.appendChild(field(doc, 'FORMAT', source.artifact_format || 'UNREADABLE'));
    block.appendChild(field(doc, 'DIGEST', shortDigest(source.artifact_digest), 'trail-comparison-id'));
    block.appendChild(field(doc, 'VERIFIER', verification.verifier));
    block.appendChild(field(doc, 'VERIFIED AT', verification.verified_at || 'NOT RUN'));
    if (verification.reason) block.appendChild(field(doc, 'REASON', verification.reason, 'trail-comparison-reason'));
    return block;
  }

  function sideStop(doc, label, side) {
    var wrap = el(doc, 'div', 'trail-comparison-side');
    wrap.setAttribute('data-side-state', side.state);
    wrap.appendChild(el(doc, 'div', 'trail-comparison-side-label', label));
    wrap.appendChild(el(doc, 'strong', 'trail-comparison-side-state', side.state));

    if (side.state === 'REVEALED') {
      if (side.route_id) wrap.appendChild(field(doc, 'ROUTE', shortDigest(side.route_id), 'trail-comparison-id'));
      if (side.commitment) wrap.appendChild(field(doc, 'COMMITMENT', shortDigest(side.commitment), 'trail-comparison-id'));
    } else if (side.state === 'CONCEALED') {
      if (side.commitment) wrap.appendChild(field(doc, 'COMMITMENT', shortDigest(side.commitment), 'trail-comparison-id'));
    }

    return wrap;
  }

  function positionRow(doc, position) {
    var item = el(doc, 'li', 'trail-comparison-position');
    item.setAttribute('data-position-state', position.state);

    var header = el(doc, 'div', 'trail-comparison-position-header');
    header.appendChild(el(doc, 'span', 'trail-comparison-position-index', String(position.index + 1).padStart(2, '0')));
    header.appendChild(el(doc, 'strong', 'trail-comparison-position-state', position.state));
    item.appendChild(header);

    var sides = el(doc, 'div', 'trail-comparison-position-sides');
    sides.appendChild(sideStop(doc, 'LEFT', position.left));
    sides.appendChild(sideStop(doc, 'RIGHT', position.right));
    item.appendChild(sides);
    return item;
  }

  function verifiedBody(doc, value) {
    var comparison = value.comparison;
    var body = el(doc, 'div', 'trail-comparison-body trail-comparison-body-verified');

    var sources = el(doc, 'div', 'trail-comparison-sources');
    sources.appendChild(sourceBlock(doc, 'LEFT', value.sources.left, value.verification.left));
    sources.appendChild(sourceBlock(doc, 'RIGHT', value.sources.right, value.verification.right));
    body.appendChild(sources);

    var summary = el(doc, 'section', 'trail-comparison-summary');
    summary.setAttribute('aria-label', 'Comparison summary');
    summary.appendChild(field(doc, 'LINEAGE', comparison.lineage_state));
    summary.appendChild(field(doc, 'SHARED PREFIX', comparison.shared_prefix_length));
    summary.appendChild(field(
      doc,
      'FIRST DIVERGENCE',
      comparison.first_divergence_index === null ? 'NONE' : comparison.first_divergence_index
    ));
    summary.appendChild(field(
      doc,
      'DIRECT FORK',
      comparison.direct_fork_at === null ? 'NONE' : comparison.direct_fork_at
    ));
    body.appendChild(summary);

    body.appendChild(field(doc, 'LEFT TRAIL', shortDigest(comparison.left_trail_id), 'trail-comparison-id'));
    body.appendChild(field(doc, 'RIGHT TRAIL', shortDigest(comparison.right_trail_id), 'trail-comparison-id'));

    var list = el(doc, 'ol', 'trail-comparison-positions');
    list.setAttribute('aria-label', 'Trail divergence positions');
    comparison.positions.forEach(function (position) {
      list.appendChild(positionRow(doc, position));
    });
    body.appendChild(list);

    body.appendChild(el(doc, 'p', 'trail-comparison-notice', value.notice));
    return body;
  }

  function diagnosticBody(doc, value) {
    var body = el(doc, 'div', 'trail-comparison-body trail-comparison-diagnostic');

    var warning = el(doc, 'div', 'trail-comparison-diagnostic-banner');
    warning.appendChild(el(doc, 'strong', 'trail-comparison-diagnostic-title', value.diagnostic_notice));
    warning.appendChild(el(
      doc,
      'p',
      'trail-comparison-diagnostic-copy',
      'Comparison facts are suppressed because both source artifacts did not verify.'
    ));
    body.appendChild(warning);

    var sources = el(doc, 'div', 'trail-comparison-sources');
    sources.appendChild(sourceBlock(doc, 'LEFT', value.sources.left, value.verification.left));
    sources.appendChild(sourceBlock(doc, 'RIGHT', value.sources.right, value.verification.right));
    body.appendChild(sources);

    body.appendChild(el(doc, 'p', 'trail-comparison-notice', value.notice));
    return body;
  }

  function build(doc, value) {
    assertProjection(value);
    var bothVerified = value.verification.left.state === 'VERIFIED' &&
      value.verification.right.state === 'VERIFIED';
    var state = bothVerified ? 'VERIFIED' : 'DIAGNOSTIC';

    var article = el(doc, 'article', 'trail-comparison trail-comparison-' + state.toLowerCase());
    article.setAttribute('data-comparison-state', state);
    article.setAttribute('aria-label', 'Trail Comparison — ' + state);
    article.tabIndex = 0;

    var header = el(doc, 'header', 'trail-comparison-header');
    header.appendChild(el(doc, 'span', 'trail-comparison-marker', bothVerified ? '⇄' : '!'));
    var group = el(doc, 'div', 'trail-comparison-heading-group');
    group.appendChild(el(doc, 'div', 'trail-comparison-kicker', 'TRAIL COMPARISON'));
    group.appendChild(el(doc, 'h2', 'trail-comparison-heading', state));
    header.appendChild(group);
    article.appendChild(header);

    article.appendChild(bothVerified ? verifiedBody(doc, value) : diagnosticBody(doc, value));
    return article;
  }

  function render(container, value) {
    if (!container || !container.ownerDocument) {
      throw new TypeError('Trail Comparison renderer requires a DOM container');
    }
    var article = build(container.ownerDocument, value);
    container.replaceChildren(article);
    return article;
  }

  function serialize(value) {
    if (typeof document === 'undefined' || !document.implementation) {
      throw new Error('Trail Comparison serialization requires a DOM');
    }
    var doc = document.implementation.createHTMLDocument('');
    var root = doc.createElement('div');
    root.appendChild(build(doc, value));
    return root.innerHTML;
  }

  return {
    render: render,
    serialize: serialize,
    shortDigest: shortDigest
  };
});
