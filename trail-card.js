'use strict';

const trail = require('./trail-manifest.js');
const blind = require('./blind-manifest.js');
const topologyVerifier = require('./tools/verify-topology-export.js');

const FORMAT = 'r4b1t-trail-card/v0.1';
const TOPOLOGY_FORMAT = 'r4b1t-topology-export/v0.1';
const NOTICE = 'Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.';
const DIAGNOSTIC_NOTICE = 'THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.';
const SHA256 = /^sha256:[0-9a-f]{64}$/;

function bytesOf(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return new Uint8Array(input);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
  throw new TypeError('Trail Card projection requires exact UTF-8 source bytes');
}

function textOf(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function digestOf(bytes) {
  return 'sha256:' + await trail.sha256Hex(bytes);
}

function artifactFormatOf(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.format === 'string') return value.format;
  if (value.manifest && typeof value.manifest.format === 'string') return value.manifest.format;
  return null;
}

function verifierFor(format) {
  if (format === trail.FORMAT) return 'r4b1t-trail-verifier/v0.1';
  if (format === blind.FORMAT) return 'r4b1t-blind-verifier/v0.2';
  if (typeof format === 'string' && format.indexOf('r4b1t-topology-export/') === 0) {
    return 'r4b1t-topology-verifier/v0.1';
  }
  return 'r4b1t-card-verifier/v0.1';
}

function isoTimestamp(value) {
  if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
    throw new TypeError('Trail Card verified_at must be an explicit ISO timestamp');
  }
  return value;
}

function parentRef(parent) {
  if (!parent) return null;
  return { trail_id: parent.trail_id, fork_at: parent.fork_at };
}

function trailDisplay(snapshot) {
  const manifest = snapshot.manifest;
  if (manifest.format === trail.FORMAT) {
    const stops = manifest.routes.map((route, index) => ({ index, state: 'revealed' }));
    return {
      kind: 'trail',
      trail_id: snapshot.trail_id,
      manifest_format: manifest.format,
      genesis_id: null,
      stop_count: stops.length,
      concealed_count: 0,
      revealed_count: stops.length,
      parent: parentRef(manifest.parent),
      stops,
    };
  }

  const stops = manifest.steps.map((step, index) => ({ index, state: step.state }));
  const concealed = stops.filter((stop) => stop.state === 'concealed').length;
  return {
    kind: 'trail',
    trail_id: snapshot.trail_id,
    manifest_format: manifest.format,
    genesis_id: manifest.genesis_id,
    stop_count: stops.length,
    concealed_count: concealed,
    revealed_count: stops.length - concealed,
    parent: parentRef(manifest.genesis.parent),
    stops,
  };
}

function topologyDisplay(value) {
  const nodes = value.nodes.map((node) => {
    const concealed = node.stops.filter((stop) => stop.proof_state === 'CONCEALED').length;
    return {
      trail_id: node.trail_id,
      manifest_format: node.manifest_format,
      relationship_state: node.relationship_state,
      stop_count: node.stops.length,
      concealed_count: concealed,
      revealed_count: node.stops.length - concealed,
      parent: parentRef(node.parent),
    };
  });

  const edges = value.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    fork_at: edge.fork_at,
    relationship_state: edge.proof_state,
  }));

  const concealed = nodes.reduce((sum, node) => sum + node.concealed_count, 0);
  const revealed = nodes.reduce((sum, node) => sum + node.revealed_count, 0);

  return {
    kind: 'topology',
    node_count: nodes.length,
    edge_count: edges.length,
    stop_count: concealed + revealed,
    concealed_count: concealed,
    revealed_count: revealed,
    parent_absent_count: nodes.filter((node) => node.relationship_state === 'PARENT ABSENT').length,
    branch_diagram: { nodes, edges },
  };
}

function diagnosticCard(source, verification) {
  return {
    format: FORMAT,
    source,
    verification,
    display: null,
    notice: NOTICE,
    diagnostic_notice: DIAGNOSTIC_NOTICE,
  };
}

function verifiedCard(source, verification, display) {
  return {
    format: FORMAT,
    source,
    verification,
    display,
    notice: NOTICE,
  };
}

async function project(sourceBytes, options) {
  options = options || {};
  const bytes = bytesOf(sourceBytes);
  const artifactDigest = await digestOf(bytes);

  let text;
  let value;
  try {
    text = textOf(bytes);
    value = JSON.parse(text);
  } catch (error) {
    const verifiedAt = isoTimestamp(options.verified_at);
    return diagnosticCard(
      { artifact_format: null, artifact_digest: artifactDigest },
      {
        state: 'REJECTED',
        verified_digest: null,
        verified_at: verifiedAt,
        verifier: 'r4b1t-card-verifier/v0.1',
        reason: error && error.message ? error.message : String(error),
      },
    );
  }

  const artifactFormat = artifactFormatOf(value);
  const source = { artifact_format: artifactFormat, artifact_digest: artifactDigest };
  const verifier = verifierFor(artifactFormat);

  if (artifactFormat !== trail.FORMAT &&
      artifactFormat !== blind.FORMAT &&
      artifactFormat !== TOPOLOGY_FORMAT) {
    return diagnosticCard(source, {
      state: 'UNVERIFIED',
      verified_digest: null,
      verified_at: null,
      verifier,
      reason: artifactFormat && artifactFormat.indexOf('r4b1t-topology-export/') === 0
        ? 'Unsupported topology export format'
        : 'Unsupported source artifact format',
    });
  }

  const verifiedAt = isoTimestamp(options.verified_at);

  try {
    let display;
    if (artifactFormat === TOPOLOGY_FORMAT) {
      await topologyVerifier.verifyExport(value);
      display = topologyDisplay(value);
    } else if (artifactFormat === blind.FORMAT) {
      display = trailDisplay(await blind.verify(value));
    } else {
      display = trailDisplay(await trail.verify(value));
    }

    const card = verifiedCard(source, {
      state: 'VERIFIED',
      verified_digest: artifactDigest,
      verified_at: verifiedAt,
      verifier,
      reason: null,
    }, display);

    validateProjection(card);
    return card;
  } catch (error) {
    const card = diagnosticCard(source, {
      state: 'REJECTED',
      verified_digest: null,
      verified_at: verifiedAt,
      verifier,
      reason: error && error.message ? error.message : String(error),
    });
    validateProjection(card);
    return card;
  }
}

function validateCounts(display) {
  if (display === null) return;
  if (display.stop_count !== display.concealed_count + display.revealed_count) {
    throw new Error('Trail Card display stop count mismatch');
  }
  if (display.kind === 'trail') {
    if (!Array.isArray(display.stops) || display.stop_count !== display.stops.length) {
      throw new Error('Trail Card trail display stop derivation mismatch');
    }
    return;
  }
  if (display.kind !== 'topology') throw new Error('Trail Card display kind is invalid');
  if (!display.branch_diagram ||
      display.node_count !== display.branch_diagram.nodes.length ||
      display.edge_count !== display.branch_diagram.edges.length) {
    throw new Error('Trail Card topology display count mismatch');
  }
  for (const node of display.branch_diagram.nodes) {
    if (node.stop_count !== node.concealed_count + node.revealed_count) {
      throw new Error('Trail Card topology node stop count mismatch');
    }
  }
}

function validateProjection(card) {
  if (!card || card.format !== FORMAT) throw new Error('Trail Card projection format is invalid');
  if (!card.source || !SHA256.test(card.source.artifact_digest || '')) {
    throw new Error('Trail Card source digest is invalid');
  }
  if (card.notice !== NOTICE) throw new Error('Trail Card notice is invalid');
  if (!card.verification) throw new Error('Trail Card verification result is missing');

  const state = card.verification.state;
  if (state === 'VERIFIED') {
    if (card.verification.verified_digest !== card.source.artifact_digest) {
      throw new Error('Trail Card verified digest does not match source digest');
    }
    isoTimestamp(card.verification.verified_at);
    if (!card.verification.verifier || card.verification.reason !== null || !card.display) {
      throw new Error('Trail Card VERIFIED projection is incomplete');
    }
    if (Object.prototype.hasOwnProperty.call(card, 'diagnostic_notice')) {
      throw new Error('Trail Card VERIFIED projection cannot carry diagnostic notice');
    }
  } else if (state === 'REJECTED' || state === 'UNVERIFIED') {
    if (card.verification.verified_digest !== null ||
        typeof card.verification.reason !== 'string' ||
        !card.verification.reason ||
        card.diagnostic_notice !== DIAGNOSTIC_NOTICE) {
      throw new Error('Trail Card diagnostic projection is incomplete');
    }
    if (state === 'REJECTED') isoTimestamp(card.verification.verified_at);
    if (state === 'UNVERIFIED' && card.verification.verified_at !== null) {
      isoTimestamp(card.verification.verified_at);
    }
  } else {
    throw new Error('Trail Card verification state is invalid');
  }

  validateCounts(card.display);
  return card;
}

module.exports = {
  FORMAT,
  TOPOLOGY_FORMAT,
  NOTICE,
  DIAGNOSTIC_NOTICE,
  project,
  validateProjection,
  digestOf,
};
