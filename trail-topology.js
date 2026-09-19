(function (root, factory) {
  'use strict';
  var commonJs = typeof module === 'object' && module.exports;
  var api = factory(
    commonJs ? require('./trail-manifest.js') : root && root.R4b1tTrail,
    commonJs ? require('./blind-manifest.js') : root && root.R4b1tBlind
  );
  if (commonJs) module.exports = api;
  if (root) root.R4b1tTopology = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (trail, blind) {
  'use strict';

  if (!trail || !blind) throw new Error('Trail v0.1 and v0.2 APIs are required');

  var PROOF_STATES = Object.freeze({
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED',
    PARENT_ABSENT: 'PARENT ABSENT',
    CONCEALED: 'CONCEALED',
    REVEALED: 'REVEALED'
  });
  var EXPORT_FORMAT = 'r4b1t-topology-export/v0.1';
  var SHA256 = /^sha256:[0-9a-f]{64}$/;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function shortId(value) {
    return typeof value === 'string' ? value.replace(/^sha256:/, '').slice(0, 12) : 'unknown';
  }

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (_) { return 'invalid route'; }
  }

  async function verifyAny(input) {
    var value = typeof input === 'string' ? JSON.parse(input) : clone(input);
    if (!value || !value.manifest) throw new TypeError('Trail snapshot is malformed');
    if (value.manifest.format === trail.FORMAT) return trail.verify(value);
    if (value.manifest.format === blind.FORMAT) return blind.verify(value);
    throw new TypeError('Unsupported trail format');
  }

  function safeTrailId(input) {
    try {
      var value = typeof input === 'string' ? JSON.parse(input) : input;
      return value && typeof value.trail_id === 'string' ? value.trail_id : null;
    } catch (_) {
      return null;
    }
  }

  async function classify(input) {
    try {
      return {
        proof_state: PROOF_STATES.VERIFIED,
        snapshot: await verifyAny(input),
        reason: null
      };
    } catch (error) {
      return {
        proof_state: PROOF_STATES.REJECTED,
        snapshot: null,
        trail_id: safeTrailId(input),
        reason: error && error.message ? error.message : String(error)
      };
    }
  }

  function parentOf(snapshot) {
    var manifest = snapshot.manifest;
    if (manifest.format === trail.FORMAT) {
      return manifest.parent ? {
        trail_id: manifest.parent.trail_id,
        fork_at: manifest.parent.fork_at,
        commitment: null
      } : null;
    }
    var parent = manifest.genesis && manifest.genesis.parent;
    return parent ? {
      trail_id: parent.trail_id,
      fork_at: parent.fork_at,
      commitment: parent.commitment
    } : null;
  }

  function relationshipState(snapshot, known) {
    var parent = parentOf(snapshot);
    if (!parent) return null;
    return known && known[parent.trail_id]
      ? PROOF_STATES.VERIFIED
      : PROOF_STATES.PARENT_ABSENT;
  }

  function stopProofState(step) {
    if (!step || (step.state !== 'concealed' && step.state !== 'revealed')) {
      throw new TypeError('Topology stop state is invalid');
    }
    return step.state === 'concealed'
      ? PROOF_STATES.CONCEALED
      : PROOF_STATES.REVEALED;
  }

  function stopsOf(snapshot) {
    var manifest = snapshot.manifest;
    var parent = parentOf(snapshot);
    if (manifest.format === trail.FORMAT) {
      return manifest.routes.map(function (route, position) {
        return {
          index: position,
          state: 'revealed',
          proof_state: PROOF_STATES.REVEALED,
          label: host(route.url),
          url: route.url,
          action: route.action,
          inherited: Boolean(parent && position < parent.fork_at)
        };
      });
    }
    return manifest.steps.map(function (step, position) {
      return {
        index: position,
        state: step.state,
        proof_state: stopProofState(step),
        label: step.state === 'revealed' ? host(step.route.url) : 'concealed',
        url: step.state === 'revealed' ? step.route.url : null,
        action: step.state === 'revealed' ? 'REVEAL' : 'COMMIT',
        inherited: false,
        commitment: step.commitment
      };
    });
  }

  async function build(inputs) {
    if (!Array.isArray(inputs)) throw new TypeError('Topology input must be an array');
    var snapshots = [];
    var seen = Object.create(null);
    for (var index = 0; index < inputs.length; index += 1) {
      var snapshot = await verifyAny(inputs[index]);
      if (!seen[snapshot.trail_id]) {
        seen[snapshot.trail_id] = true;
        snapshots.push(snapshot);
      }
    }
    snapshots.sort(function (left, right) {
      var leftTime = left.manifest.created_at || left.manifest.genesis.created_at;
      var rightTime = right.manifest.created_at || right.manifest.genesis.created_at;
      return leftTime.localeCompare(rightTime) || left.trail_id.localeCompare(right.trail_id);
    });
    var known = Object.create(null);
    snapshots.forEach(function (snapshot) { known[snapshot.trail_id] = snapshot; });
    for (var childIndex = 0; childIndex < snapshots.length; childIndex += 1) {
      var child = snapshots[childIndex];
      var declaration = parentOf(child);
      var parent = declaration && known[declaration.trail_id];
      if (!parent) continue;
      if (child.manifest.format === trail.FORMAT) await trail.verifyLineage(child, parent);
      else await blind.verifyLineage(child, parent);
    }
    return {
      snapshots: snapshots.map(function (snapshot) {
        var parent = parentOf(snapshot);
        var format = snapshot.manifest.format;
        return {
          trail_id: snapshot.trail_id,
          short_id: shortId(snapshot.trail_id),
          format: format,
          created_at: format === trail.FORMAT ? snapshot.manifest.created_at : snapshot.manifest.genesis.created_at,
          terrain: format === trail.FORMAT ? snapshot.manifest.terrain : snapshot.manifest.genesis.terrain,
          proof_state: PROOF_STATES.VERIFIED,
          parent: parent,
          relationship_state: relationshipState(snapshot, known),
          parent_known: !parent || Boolean(known[parent.trail_id]),
          stops: stopsOf(snapshot)
        };
      })
    };
  }

  function assertExactKeys(value, expected, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(label + ' must be an object');
    }
    if (Object.keys(value).sort().join(',') !== expected.slice().sort().join(',')) {
      throw new TypeError(label + ' contains unsupported fields');
    }
  }

  function assertSha256(value, label) {
    if (!SHA256.test(value || '')) throw new TypeError(label + ' must be a sha256 identifier');
  }

  function assertIsoTimestamp(value, label) {
    if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
      throw new TypeError(label + ' must be an ISO timestamp');
    }
  }

  function exportStop(snapshot, stop) {
    var manifest = snapshot.manifest;
    if (manifest.format === trail.FORMAT) {
      var route = manifest.routes[stop.index];
      return {
        index: stop.index,
        proof_state: PROOF_STATES.REVEALED,
        commitment: null,
        route_id: route.route_id,
        url: route.url
      };
    }
    var step = manifest.steps[stop.index];
    return {
      index: stop.index,
      proof_state: stop.proof_state,
      commitment: step.commitment,
      route_id: step.state === 'revealed' ? step.route.route_id : null,
      url: step.state === 'revealed' ? step.route.url : null
    };
  }

  async function exportTopology(inputs, options) {
    if (!Array.isArray(inputs)) throw new TypeError('Topology export input must be an array');
    options = options || {};
    assertIsoTimestamp(options.created_at, 'Topology export creation time');

    var verified = [];
    var diagnostics = [];
    for (var index = 0; index < inputs.length; index += 1) {
      var classified = await classify(inputs[index]);
      if (classified.proof_state === PROOF_STATES.VERIFIED) verified.push(classified.snapshot);
      else diagnostics.push({
        proof_state: PROOF_STATES.REJECTED,
        reason: classified.reason,
        trail_id: classified.trail_id
      });
    }

    diagnostics.sort(function (left, right) {
      return String(left.trail_id || '').localeCompare(String(right.trail_id || '')) ||
        left.reason.localeCompare(right.reason);
    });

    var graph = await build(verified);
    var verifiedById = Object.create(null);
    verified.forEach(function (snapshot) { verifiedById[snapshot.trail_id] = snapshot; });

    var nodes = graph.snapshots.map(function (node) {
      var snapshot = verifiedById[node.trail_id];
      return {
        trail_id: node.trail_id,
        manifest_format: node.format,
        proof_state: PROOF_STATES.VERIFIED,
        manifest: clone(snapshot.manifest),
        relationship_state: node.relationship_state,
        parent: node.parent ? {
          trail_id: node.parent.trail_id,
          fork_at: node.parent.fork_at
        } : null,
        stops: node.stops.map(function (stop) { return exportStop(snapshot, stop); })
      };
    });

    var edges = graph.snapshots.filter(function (node) { return Boolean(node.parent); }).map(function (node) {
      return {
        from: node.parent.trail_id,
        to: node.trail_id,
        fork_at: node.parent.fork_at,
        proof_state: node.relationship_state
      };
    });

    return {
      format: EXPORT_FORMAT,
      created_at: options.created_at,
      nodes: nodes,
      edges: edges,
      diagnostics: diagnostics
    };
  }

  function validateDiagnostic(diagnostic, index) {
    assertExactKeys(diagnostic, ['proof_state', 'reason', 'trail_id'], 'Topology diagnostic ' + index);
    if (diagnostic.proof_state !== PROOF_STATES.REJECTED) {
      throw new TypeError('Topology diagnostic state must be REJECTED');
    }
    if (typeof diagnostic.reason !== 'string' || !diagnostic.reason) {
      throw new TypeError('Topology diagnostic reason is invalid');
    }
    if (diagnostic.trail_id !== null) assertSha256(diagnostic.trail_id, 'Topology diagnostic trail ID');
  }

  function validateExportShape(value) {
    assertExactKeys(value, ['format', 'created_at', 'nodes', 'edges', 'diagnostics'], 'Topology export');
    if (value.format !== EXPORT_FORMAT) throw new TypeError('Unsupported topology export format');
    assertIsoTimestamp(value.created_at, 'Topology export creation time');
    if (!Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.diagnostics)) {
      throw new TypeError('Topology export collections are invalid');
    }

    value.nodes.forEach(function (node, index) {
      assertExactKeys(node, [
        'trail_id', 'manifest_format', 'proof_state', 'manifest',
        'relationship_state', 'parent', 'stops'
      ], 'Topology node ' + index);
      assertSha256(node.trail_id, 'Topology node trail ID');
      if (node.manifest_format !== trail.FORMAT && node.manifest_format !== blind.FORMAT) {
        throw new TypeError('Topology node manifest format is invalid');
      }
      if (node.proof_state !== PROOF_STATES.VERIFIED) {
        throw new TypeError('Topology node proof state must be VERIFIED');
      }
      if (node.relationship_state !== null &&
          node.relationship_state !== PROOF_STATES.VERIFIED &&
          node.relationship_state !== PROOF_STATES.PARENT_ABSENT) {
        throw new TypeError('Topology node relationship state is invalid');
      }
      if (node.parent !== null) {
        assertExactKeys(node.parent, ['trail_id', 'fork_at'], 'Topology node parent');
        assertSha256(node.parent.trail_id, 'Topology parent trail ID');
        if (!Number.isSafeInteger(node.parent.fork_at) || node.parent.fork_at < 0) {
          throw new TypeError('Topology parent fork position is invalid');
        }
      }
      if (!Array.isArray(node.stops)) throw new TypeError('Topology node stops are invalid');
      node.stops.forEach(function (stop, stopIndex) {
        assertExactKeys(stop, ['index', 'proof_state', 'commitment', 'route_id', 'url'], 'Topology stop ' + stopIndex);
        if (!Number.isSafeInteger(stop.index) || stop.index < 0) throw new TypeError('Topology stop index is invalid');
        if (stop.proof_state !== PROOF_STATES.CONCEALED && stop.proof_state !== PROOF_STATES.REVEALED) {
          throw new TypeError('Topology stop proof state is invalid');
        }
        if (stop.commitment !== null) assertSha256(stop.commitment, 'Topology stop commitment');
        if (stop.route_id !== null) assertSha256(stop.route_id, 'Topology stop route ID');
        if (stop.url !== null && typeof stop.url !== 'string') throw new TypeError('Topology stop URL is invalid');
        if (stop.proof_state === PROOF_STATES.CONCEALED && (stop.route_id !== null || stop.url !== null)) {
          throw new Error('Concealed topology stop leaks route identity');
        }
      });
    });

    value.edges.forEach(function (edge, index) {
      assertExactKeys(edge, ['from', 'to', 'fork_at', 'proof_state'], 'Topology edge ' + index);
      assertSha256(edge.from, 'Topology edge source');
      assertSha256(edge.to, 'Topology edge target');
      if (!Number.isSafeInteger(edge.fork_at) || edge.fork_at < 0) throw new TypeError('Topology edge fork position is invalid');
      if (edge.proof_state !== PROOF_STATES.VERIFIED && edge.proof_state !== PROOF_STATES.PARENT_ABSENT) {
        throw new TypeError('Topology edge proof state is invalid');
      }
    });

    value.diagnostics.forEach(validateDiagnostic);
  }

  async function importTopology(input) {
    var value = typeof input === 'string' ? JSON.parse(input) : clone(input);
    validateExportShape(value);

    var envelopes = value.nodes.map(function (node) {
      if (!node.manifest || node.manifest.format !== node.manifest_format) {
        throw new Error('Topology node manifest format mismatch');
      }
      return { trail_id: node.trail_id, manifest: clone(node.manifest) };
    });

    var expected = await exportTopology(envelopes, { created_at: value.created_at });
    expected.diagnostics = clone(value.diagnostics);

    if (trail.canonicalJson(value.nodes) !== trail.canonicalJson(expected.nodes)) {
      throw new Error('Topology export node derivation mismatch');
    }
    if (trail.canonicalJson(value.edges) !== trail.canonicalJson(expected.edges)) {
      throw new Error('Topology export edge derivation mismatch');
    }

    var graph = await build(envelopes);
    return {
      export: value,
      snapshots: envelopes,
      graph: graph,
      diagnostics: clone(value.diagnostics)
    };
  }

  return {
    PROOF_STATES: PROOF_STATES,
    EXPORT_FORMAT: EXPORT_FORMAT,
    verifyAny: verifyAny,
    classify: classify,
    parentOf: parentOf,
    relationshipState: relationshipState,
    stopProofState: stopProofState,
    stopsOf: stopsOf,
    build: build,
    exportTopology: exportTopology,
    importTopology: importTopology,
    shortId: shortId
  };
});
