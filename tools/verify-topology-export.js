#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');

const FORMAT = 'r4b1t-topology-export/v0.1';
const VERIFIED = 'VERIFIED';
const PARENT_ABSENT = 'PARENT ABSENT';
const CONCEALED = 'CONCEALED';
const REVEALED = 'REVEALED';
const REJECTED = 'REJECTED';
const SHA256 = /^sha256:[0-9a-f]{64}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, expected, label) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(label + ' must be an object');
  }
  if (Object.keys(value).sort().join(',') !== expected.slice().sort().join(',')) {
    throw new TypeError(label + ' contains unsupported fields');
  }
}

function sha256(value, label) {
  if (!SHA256.test(value || '')) throw new TypeError(label + ' must be a sha256 identifier');
}

function timestamp(value, label) {
  if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
    throw new TypeError(label + ' must be an ISO timestamp');
  }
}

async function verifyEnvelope(envelope) {
  if (!envelope || !envelope.manifest) throw new TypeError('Embedded trail envelope is malformed');
  if (envelope.manifest.format === trail.FORMAT) return trail.verify(envelope);
  if (envelope.manifest.format === blind.FORMAT) return blind.verify(envelope);
  throw new TypeError('Unsupported embedded trail format');
}

function parentOf(snapshot) {
  if (snapshot.manifest.format === trail.FORMAT) {
    const parent = snapshot.manifest.parent;
    return parent ? { trail_id: parent.trail_id, fork_at: parent.fork_at } : null;
  }
  const parent = snapshot.manifest.genesis.parent;
  return parent ? { trail_id: parent.trail_id, fork_at: parent.fork_at } : null;
}

function expectedStops(snapshot) {
  if (snapshot.manifest.format === trail.FORMAT) {
    return snapshot.manifest.routes.map((route, index) => ({
      index,
      proof_state: REVEALED,
      commitment: null,
      route_id: route.route_id,
      url: route.url,
    }));
  }
  return snapshot.manifest.steps.map((step, index) => ({
    index,
    proof_state: step.state === 'concealed' ? CONCEALED : REVEALED,
    commitment: step.commitment,
    route_id: step.state === 'revealed' ? step.route.route_id : null,
    url: step.state === 'revealed' ? step.route.url : null,
  }));
}

function normalizeStop(stop, index) {
  exactKeys(stop, ['index', 'proof_state', 'commitment', 'route_id', 'url'], 'Topology stop ' + index);
  if (stop.proof_state !== CONCEALED && stop.proof_state !== REVEALED) {
    throw new TypeError('Topology stop proof state is invalid');
  }
  if (stop.commitment !== null) sha256(stop.commitment, 'Topology stop commitment');
  if (stop.route_id !== null) sha256(stop.route_id, 'Topology stop route ID');
  if (stop.url !== null && typeof stop.url !== 'string') throw new TypeError('Topology stop URL is invalid');
  if (stop.proof_state === CONCEALED && (stop.route_id !== null || stop.url !== null)) {
    throw new Error('Concealed topology stop leaks route identity');
  }
  return stop;
}

async function verifyExport(input) {
  const value = typeof input === 'string' ? JSON.parse(input) : clone(input);
  exactKeys(value, ['format', 'created_at', 'nodes', 'edges', 'diagnostics'], 'Topology export');
  if (value.format !== FORMAT) throw new TypeError('Unsupported topology export format');
  timestamp(value.created_at, 'Topology export creation time');
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.diagnostics)) {
    throw new TypeError('Topology export collections are invalid');
  }

  const verified = [];
  const byId = new Map();

  for (let index = 0; index < value.nodes.length; index += 1) {
    const node = value.nodes[index];
    exactKeys(node, [
      'trail_id', 'manifest_format', 'proof_state', 'manifest',
      'relationship_state', 'parent', 'stops'
    ], 'Topology node ' + index);
    sha256(node.trail_id, 'Topology node trail ID');
    if (node.proof_state !== VERIFIED) throw new TypeError('Topology node proof state must be VERIFIED');
    if (node.manifest_format !== trail.FORMAT && node.manifest_format !== blind.FORMAT) {
      throw new TypeError('Topology node manifest format is invalid');
    }
    if (!node.manifest || node.manifest.format !== node.manifest_format) {
      throw new Error('Topology node manifest format mismatch');
    }

    const snapshot = await verifyEnvelope({ trail_id: node.trail_id, manifest: node.manifest });
    if (byId.has(snapshot.trail_id)) throw new Error('Duplicate topology node trail ID');
    byId.set(snapshot.trail_id, snapshot);
    verified.push({ node, snapshot });
  }

  for (const entry of verified) {
    const { node, snapshot } = entry;
    const parent = parentOf(snapshot);
    const parentKnown = Boolean(parent && byId.has(parent.trail_id));
    const expectedRelationship = !parent ? null : (parentKnown ? VERIFIED : PARENT_ABSENT);

    const expectedParent = parent ? { trail_id: parent.trail_id, fork_at: parent.fork_at } : null;
    if (trail.canonicalJson(node.parent) !== trail.canonicalJson(expectedParent)) {
      throw new Error('Topology node parent derivation mismatch');
    }
    if (node.relationship_state !== expectedRelationship) {
      throw new Error('Topology node relationship derivation mismatch');
    }

    if (!Array.isArray(node.stops)) throw new TypeError('Topology node stops are invalid');
    node.stops.forEach(normalizeStop);
    if (trail.canonicalJson(node.stops) !== trail.canonicalJson(expectedStops(snapshot))) {
      throw new Error('Topology node stop derivation mismatch');
    }

    if (parentKnown) {
      const parentSnapshot = byId.get(parent.trail_id);
      if (snapshot.manifest.format === trail.FORMAT) {
        await trail.verifyLineage(snapshot, parentSnapshot);
      } else {
        await blind.verifyLineage(snapshot, parentSnapshot);
      }
    }
  }

  const expectedEdges = verified
    .map(({ snapshot }) => {
      const parent = parentOf(snapshot);
      if (!parent) return null;
      return {
        from: parent.trail_id,
        to: snapshot.trail_id,
        fork_at: parent.fork_at,
        proof_state: byId.has(parent.trail_id) ? VERIFIED : PARENT_ABSENT,
      };
    })
    .filter(Boolean);

  value.edges.forEach((edge, index) => {
    exactKeys(edge, ['from', 'to', 'fork_at', 'proof_state'], 'Topology edge ' + index);
    sha256(edge.from, 'Topology edge source');
    sha256(edge.to, 'Topology edge target');
    if (!Number.isSafeInteger(edge.fork_at) || edge.fork_at < 0) {
      throw new TypeError('Topology edge fork position is invalid');
    }
    if (edge.proof_state !== VERIFIED && edge.proof_state !== PARENT_ABSENT) {
      throw new TypeError('Topology edge proof state is invalid');
    }
  });

  if (trail.canonicalJson(value.edges) !== trail.canonicalJson(expectedEdges)) {
    throw new Error('Topology edge derivation mismatch');
  }

  value.diagnostics.forEach((diagnostic, index) => {
    const allowed = ['proof_state', 'reason', 'trail_id'];
    if (!diagnostic || Object.getPrototypeOf(diagnostic) !== Object.prototype) {
      throw new TypeError('Topology diagnostic ' + index + ' must be an object');
    }
    for (const key of Object.keys(diagnostic)) {
      if (!allowed.includes(key)) throw new TypeError('Topology diagnostic ' + index + ' contains unsupported fields');
    }
    if (diagnostic.proof_state !== REJECTED) throw new TypeError('Topology diagnostic state must be REJECTED');
    if (typeof diagnostic.reason !== 'string' || !diagnostic.reason) throw new TypeError('Topology diagnostic reason is invalid');
    if (diagnostic.trail_id != null) sha256(diagnostic.trail_id, 'Topology diagnostic trail ID');
  });

  return {
    format: value.format,
    created_at: value.created_at,
    nodes: value.nodes.length,
    edges: value.edges.length,
    diagnostics: value.diagnostics.length,
    proof_state: VERIFIED,
  };
}

async function readStdin() {
  var chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))).toString('utf8');
}

async function readJson(path) {
  if (path === '-') return JSON.parse(await readStdin());
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

async function main() {
  const [, , file] = process.argv;
  if (!file) throw new Error('Usage: npm run topology:verify -- <topology-export.json|->');
  const result = await verifyExport(await readJson(file));
  console.log('TOPOLOGY VERIFIED');
  console.log('format:      ' + result.format);
  console.log('nodes:       ' + result.nodes);
  console.log('edges:       ' + result.edges);
  console.log('diagnostics: ' + result.diagnostics);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('REJECTED / ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = { verifyExport };
