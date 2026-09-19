(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./trail-manifest.js') : root.R4b1tTrail,
    typeof module === 'object' && module.exports ? require('./blind-manifest.js') : root.R4b1tBlind,
    typeof module === 'object' && module.exports ? require('./trail-comparison.js') : root.R4b1tTrailComparison
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tProofSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (trail, blind, comparison) {
  'use strict';

  var FORMAT = 'r4b1t-proof-session/v0.1';
  var NOTICE = 'Proof Session organizes independently verified source artifacts and derived comparison projections. It does not replace any source artifact. Re-verify sources and recompute comparisons to confirm current validity.';
  var COMPARISON_FORMAT = 'r4b1t-trail-comparison/v0.1';
  var SHA256 = /^sha256:[0-9a-f]{64}$/;
  var STATES = ['VERIFIED', 'REJECTED', 'UNVERIFIED'];
  var SUMMARY_LABELS = [
    'SOURCES',
    'VERIFIED',
    'REJECTED',
    'UNVERIFIED',
    'VERIFIED PAIRS',
    'DIRECT RELATIONSHIPS',
    'DIVERGENT PAIRS',
    'IDENTICAL TRAIL PAIRS',
    'SHARED PREFIX ONLY PAIRS',
    'NO SHARED PREFIX PAIRS'
  ];

  function exactBytes(input) {
    if (typeof input === 'string') return new TextEncoder().encode(input);
    if (input instanceof Uint8Array) return new Uint8Array(input);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
    throw new TypeError('Proof Session requires exact source bytes');
  }

  function utf8(bytes) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  function isoTimestamp(value) {
    if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
      throw new TypeError('Proof Session verified_at must be an explicit ISO timestamp');
    }
    return value;
  }

  async function digestBytes(bytes) {
    return 'sha256:' + await trail.sha256Hex(bytes);
  }

  async function digestProjection(value) {
    comparison.validateProjection(value);
    return digestBytes(new TextEncoder().encode(trail.canonicalJson(value)));
  }

  function artifactFormatOf(value) {
    return value && value.manifest && typeof value.manifest.format === 'string'
      ? value.manifest.format
      : null;
  }

  function verifierFor(format) {
    if (format === trail.FORMAT) return 'r4b1t-trail-verifier/v0.1';
    if (format === blind.FORMAT) return 'r4b1t-blind-verifier/v0.2';
    return 'r4b1t-proof-session-verifier/v0.1';
  }

  async function verifySource(bytes, verifiedAt) {
    var artifactDigest = await digestBytes(bytes);
    var parsed;
    try {
      parsed = JSON.parse(utf8(bytes));
    } catch (error) {
      return {
        artifact_format: null,
        artifact_digest: artifactDigest,
        canonical_trail_id: null,
        verification: {
          state: 'REJECTED',
          verified_digest: null,
          verified_at: verifiedAt,
          verifier: 'r4b1t-proof-session-verifier/v0.1',
          reason: error && error.message ? error.message : String(error)
        }
      };
    }

    var format = artifactFormatOf(parsed);
    var verifier = verifierFor(format);
    if (format !== trail.FORMAT && format !== blind.FORMAT) {
      return {
        artifact_format: format,
        artifact_digest: artifactDigest,
        canonical_trail_id: null,
        verification: {
          state: 'UNVERIFIED',
          verified_digest: null,
          verified_at: null,
          verifier: verifier,
          reason: 'Unsupported source artifact format'
        }
      };
    }

    try {
      var snapshot = format === trail.FORMAT ? await trail.verify(parsed) : await blind.verify(parsed);
      return {
        artifact_format: format,
        artifact_digest: artifactDigest,
        canonical_trail_id: snapshot.trail_id,
        verification: {
          state: 'VERIFIED',
          verified_digest: artifactDigest,
          verified_at: verifiedAt,
          verifier: verifier,
          reason: null
        }
      };
    } catch (error) {
      return {
        artifact_format: format,
        artifact_digest: artifactDigest,
        canonical_trail_id: null,
        verification: {
          state: 'REJECTED',
          verified_digest: null,
          verified_at: verifiedAt,
          verifier: verifier,
          reason: error && error.message ? error.message : String(error)
        }
      };
    }
  }

  function copyVerification(value) {
    return {
      state: value.state,
      verified_digest: value.verified_digest,
      verified_at: value.verified_at,
      verifier: value.verifier,
      reason: value.reason
    };
  }

  function demoteFromComparison(slot, sideVerification) {
    if (slot.verification.state !== 'VERIFIED' || sideVerification.state === 'VERIFIED') return false;
    slot.verification = copyVerification(sideVerification);
    slot.canonical_trail_id = null;
    return true;
  }

  function summaryArray(counts) {
    return SUMMARY_LABELS.map(function (label) {
      return { label: label, count: counts[label] || 0 };
    });
  }

  function pairKey(left, right) {
    return left.slot_id + ':' + right.slot_id;
  }

  function assertSlotId(value, expected) {
    if (value !== 'S' + expected) throw new Error('Proof Session source slot order is invalid');
  }

  function validateVerification(source) {
    var verification = source && source.verification;
    if (!verification || STATES.indexOf(verification.state) === -1) {
      throw new Error('Proof Session verification state is invalid');
    }
    if (!SHA256.test(source.artifact_digest || '')) throw new Error('Proof Session source digest is invalid');
    if (!Number.isSafeInteger(source.supplied_count) || source.supplied_count < 1) {
      throw new Error('Proof Session supplied count is invalid');
    }
    if (verification.state === 'VERIFIED') {
      if (verification.verified_digest !== source.artifact_digest ||
          !SHA256.test(source.canonical_trail_id || '') ||
          verification.reason !== null) {
        throw new Error('Proof Session VERIFIED source is invalid');
      }
      isoTimestamp(verification.verified_at);
    } else {
      if (verification.verified_digest !== null ||
          source.canonical_trail_id !== null ||
          typeof verification.reason !== 'string' ||
          !verification.reason) {
        throw new Error('Proof Session diagnostic source is invalid');
      }
      if (verification.state === 'REJECTED') isoTimestamp(verification.verified_at);
      if (verification.state === 'UNVERIFIED' && verification.verified_at !== null) {
        isoTimestamp(verification.verified_at);
      }
    }
  }

  function validateProjection(result) {
    if (!result || result.format !== FORMAT) throw new Error('Proof Session projection format is invalid');
    if (result.notice !== NOTICE) throw new Error('Proof Session notice is invalid');
    if (!Array.isArray(result.sources) || !Array.isArray(result.pairs) ||
        !Array.isArray(result.relationships) || !Array.isArray(result.summary)) {
      throw new Error('Proof Session projection is incomplete');
    }

    var digests = Object.create(null);
    var verified = Object.create(null);
    result.sources.forEach(function (source, index) {
      assertSlotId(source.slot_id, index + 1);
      validateVerification(source);
      if (digests[source.artifact_digest]) throw new Error('Proof Session source digests must be unique');
      digests[source.artifact_digest] = true;
      if (source.verification.state === 'VERIFIED') verified[source.slot_id] = true;
    });

    var expectedPairs = [];
    for (var leftIndex = 0; leftIndex < result.sources.length; leftIndex += 1) {
      var left = result.sources[leftIndex];
      if (!verified[left.slot_id]) continue;
      for (var rightIndex = leftIndex + 1; rightIndex < result.sources.length; rightIndex += 1) {
        var right = result.sources[rightIndex];
        if (verified[right.slot_id]) expectedPairs.push(pairKey(left, right));
      }
    }

    var seenPairs = Object.create(null);
    result.pairs.forEach(function (pair, index) {
      if (!verified[pair.left_slot] || !verified[pair.right_slot]) {
        throw new Error('Proof Session pair contains diagnostic source');
      }
      if (pair.comparison_format !== COMPARISON_FORMAT ||
          !SHA256.test(pair.comparison_projection_digest || '')) {
        throw new Error('Proof Session pair reference is invalid');
      }
      var key = pair.left_slot + ':' + pair.right_slot;
      if (key !== expectedPairs[index]) throw new Error('Proof Session pair order is invalid');
      if (seenPairs[key]) throw new Error('Proof Session pair is duplicated');
      seenPairs[key] = true;
    });
    if (result.pairs.length !== expectedPairs.length) {
      throw new Error('Proof Session verified pair set is incomplete');
    }

    var seenEdges = Object.create(null);
    result.relationships.forEach(function (edge) {
      if (edge.type !== 'DIRECT_PARENT' ||
          !verified[edge.parent_slot] ||
          !verified[edge.child_slot] ||
          edge.parent_slot === edge.child_slot ||
          !SHA256.test(edge.comparison_projection_digest || '')) {
        throw new Error('Proof Session direct relationship is invalid');
      }
      var forward = edge.parent_slot + ':' + edge.child_slot;
      var reverse = edge.child_slot + ':' + edge.parent_slot;
      if (!seenPairs[forward] && !seenPairs[reverse]) {
        throw new Error('Proof Session relationship has no verified pair');
      }
      if (seenEdges[forward]) throw new Error('Proof Session direct relationship is duplicated');
      seenEdges[forward] = true;
    });

    if (result.summary.length !== SUMMARY_LABELS.length) {
      throw new Error('Proof Session summary length is invalid');
    }
    var counts = {};
    result.summary.forEach(function (item, index) {
      if (!item || item.label !== SUMMARY_LABELS[index] ||
          !Number.isSafeInteger(item.count) || item.count < 0) {
        throw new Error('Proof Session summary vocabulary is invalid');
      }
      counts[item.label] = item.count;
    });

    var verifiedCount = result.sources.filter(function (source) {
      return source.verification.state === 'VERIFIED';
    }).length;
    var rejectedCount = result.sources.filter(function (source) {
      return source.verification.state === 'REJECTED';
    }).length;
    var unverifiedCount = result.sources.filter(function (source) {
      return source.verification.state === 'UNVERIFIED';
    }).length;

    if (counts.SOURCES !== result.sources.length ||
        counts.VERIFIED !== verifiedCount ||
        counts.REJECTED !== rejectedCount ||
        counts.UNVERIFIED !== unverifiedCount ||
        counts['VERIFIED PAIRS'] !== result.pairs.length ||
        counts['DIRECT RELATIONSHIPS'] !== result.relationships.length) {
      throw new Error('Proof Session summary structural counts are invalid');
    }

    return result;
  }

  async function build(inputs, options) {
    options = options || {};
    var verifiedAt = isoTimestamp(options.verified_at);
    if (!Array.isArray(inputs)) throw new TypeError('Proof Session inputs must be an array');

    var slots = [];
    var byDigest = Object.create(null);

    for (var inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
      var bytes = exactBytes(inputs[inputIndex]);
      var digest = await digestBytes(bytes);
      if (byDigest[digest]) {
        byDigest[digest].supplied_count += 1;
        continue;
      }

      var verifiedSource = await verifySource(bytes, verifiedAt);
      var slot = {
        slot_id: 'S' + (slots.length + 1),
        artifact_format: verifiedSource.artifact_format,
        artifact_digest: verifiedSource.artifact_digest,
        canonical_trail_id: verifiedSource.canonical_trail_id,
        supplied_count: 1,
        verification: verifiedSource.verification,
        _bytes: bytes
      };
      slots.push(slot);
      byDigest[digest] = slot;
    }

    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < slots.length; i += 1) {
        if (slots[i].verification.state !== 'VERIFIED') continue;
        for (var j = i + 1; j < slots.length; j += 1) {
          if (slots[j].verification.state !== 'VERIFIED') continue;
          var diagnosticCheck = await comparison.compare(slots[i]._bytes, slots[j]._bytes, {
            verified_at: verifiedAt
          });
          if (demoteFromComparison(slots[i], diagnosticCheck.verification.left)) changed = true;
          if (demoteFromComparison(slots[j], diagnosticCheck.verification.right)) changed = true;
        }
      }
    }

    var pairs = [];
    var relationships = [];
    var pairProjections = [];
    var counts = {
      'SOURCES': slots.length,
      'VERIFIED': 0,
      'REJECTED': 0,
      'UNVERIFIED': 0,
      'VERIFIED PAIRS': 0,
      'DIRECT RELATIONSHIPS': 0,
      'DIVERGENT PAIRS': 0,
      'IDENTICAL TRAIL PAIRS': 0,
      'SHARED PREFIX ONLY PAIRS': 0,
      'NO SHARED PREFIX PAIRS': 0
    };

    slots.forEach(function (slot) {
      counts[slot.verification.state] += 1;
    });

    for (var leftIndex = 0; leftIndex < slots.length; leftIndex += 1) {
      var leftSlot = slots[leftIndex];
      if (leftSlot.verification.state !== 'VERIFIED') continue;
      for (var rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex += 1) {
        var rightSlot = slots[rightIndex];
        if (rightSlot.verification.state !== 'VERIFIED') continue;

        var projection = await comparison.compare(leftSlot._bytes, rightSlot._bytes, {
          verified_at: verifiedAt
        });
        comparison.validateProjection(projection);
        if (!projection.comparison) {
          throw new Error('Proof Session verified pair unexpectedly produced diagnostic comparison');
        }

        var projectionDigest = await digestProjection(projection);
        pairs.push({
          left_slot: leftSlot.slot_id,
          right_slot: rightSlot.slot_id,
          comparison_format: COMPARISON_FORMAT,
          comparison_projection_digest: projectionDigest
        });
        pairProjections.push(projection);
        counts['VERIFIED PAIRS'] += 1;

        var fact = projection.comparison;
        if (fact.first_divergence_index !== null) counts['DIVERGENT PAIRS'] += 1;
        if (fact.lineage_state === 'SAME_TRAIL') counts['IDENTICAL TRAIL PAIRS'] += 1;
        if (fact.lineage_state === 'SHARED_ANCESTRY_NOT_PROVEN') counts['SHARED PREFIX ONLY PAIRS'] += 1;
        if (fact.lineage_state === 'NO_SHARED_PREFIX') counts['NO SHARED PREFIX PAIRS'] += 1;

        if (fact.lineage_state === 'LEFT_PARENT_OF_RIGHT' ||
            fact.lineage_state === 'RIGHT_PARENT_OF_LEFT') {
          var parentSlot = fact.lineage_state === 'LEFT_PARENT_OF_RIGHT' ? leftSlot : rightSlot;
          var childSlot = fact.lineage_state === 'LEFT_PARENT_OF_RIGHT' ? rightSlot : leftSlot;
          relationships.push({
            type: 'DIRECT_PARENT',
            parent_slot: parentSlot.slot_id,
            child_slot: childSlot.slot_id,
            comparison_projection_digest: projectionDigest
          });
          counts['DIRECT RELATIONSHIPS'] += 1;
        }
      }
    }

    var publicSources = slots.map(function (slot) {
      return {
        slot_id: slot.slot_id,
        artifact_format: slot.artifact_format,
        artifact_digest: slot.artifact_digest,
        canonical_trail_id: slot.canonical_trail_id,
        supplied_count: slot.supplied_count,
        verification: copyVerification(slot.verification)
      };
    });

    var result = {
      format: FORMAT,
      sources: publicSources,
      pairs: pairs,
      relationships: relationships,
      summary: summaryArray(counts),
      notice: NOTICE
    };

    validateProjection(result);
    return result;
  }

  return {
    FORMAT: FORMAT,
    NOTICE: NOTICE,
    SUMMARY_LABELS: SUMMARY_LABELS.slice(),
    build: build,
    validateProjection: validateProjection,
    digestProjection: digestProjection
  };
});
