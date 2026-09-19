(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./trail-manifest.js') : root.R4b1tTrail,
    typeof module === 'object' && module.exports ? require('./blind-manifest.js') : root.R4b1tBlind
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tTrailComparison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (trail, blind) {
  'use strict';

  var FORMAT = 'r4b1t-trail-comparison/v0.1';
  var NOTICE = 'Comparison describes two independently verified source artifacts identified by their digests. It does not replace either source artifact. Re-verify both sources to confirm current validity.';
  var DIAGNOSTIC_NOTICE = 'THIS RESULT DOES NOT ESTABLISH TRAIL COMPARISON FACTS.';
  var SHA256 = /^sha256:[0-9a-f]{64}$/;
  var STATES = ['VERIFIED', 'REJECTED', 'UNVERIFIED'];

  function exactBytes(input) {
    if (typeof input === 'string') return new TextEncoder().encode(input);
    if (input instanceof Uint8Array) return new Uint8Array(input);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
    throw new TypeError('Trail comparison requires exact source bytes');
  }

  function utf8(bytes) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  async function digestOf(input) {
    var bytes = exactBytes(input);
    return 'sha256:' + await trail.sha256Hex(bytes);
  }

  function isoTimestamp(value) {
    if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
      throw new TypeError('Trail comparison verified_at must be an explicit ISO timestamp');
    }
    return value;
  }

  function artifactFormatOf(value) {
    return value && value.manifest && typeof value.manifest.format === 'string'
      ? value.manifest.format
      : null;
  }

  function verifierFor(format) {
    if (format === trail.FORMAT) return 'r4b1t-trail-verifier/v0.1';
    if (format === blind.FORMAT) return 'r4b1t-blind-verifier/v0.2';
    return 'r4b1t-comparison-verifier/v0.1';
  }

  function parentOf(snapshot) {
    if (!snapshot || !snapshot.manifest) return null;
    if (snapshot.manifest.format === trail.FORMAT) {
      return snapshot.manifest.parent
        ? { trail_id: snapshot.manifest.parent.trail_id, fork_at: snapshot.manifest.parent.fork_at }
        : null;
    }
    var parent = snapshot.manifest.genesis && snapshot.manifest.genesis.parent;
    return parent ? { trail_id: parent.trail_id, fork_at: parent.fork_at } : null;
  }

  function stopsOf(snapshot) {
    if (snapshot.manifest.format === trail.FORMAT) {
      return snapshot.manifest.routes.map(function (route) {
        return { state: 'REVEALED', route_id: route.route_id, commitment: null };
      });
    }
    return snapshot.manifest.steps.map(function (step) {
      if (step.state === 'concealed') {
        return { state: 'CONCEALED', route_id: null, commitment: step.commitment };
      }
      return {
        state: 'REVEALED',
        route_id: step.route.route_id,
        commitment: step.commitment
      };
    });
  }

  function absentStop() {
    return { state: 'ABSENT', route_id: null, commitment: null };
  }

  function positionState(left, right) {
    if (left.state === 'ABSENT') return 'RIGHT_ONLY';
    if (right.state === 'ABSENT') return 'LEFT_ONLY';
    if (left.state === 'REVEALED' && right.state === 'REVEALED') {
      return left.route_id === right.route_id ? 'MATCH_REVEALED' : 'DIFFER_REVEALED';
    }
    if (left.state === 'CONCEALED' && right.state === 'REVEALED') return 'LEFT_CONCEALED';
    if (left.state === 'REVEALED' && right.state === 'CONCEALED') return 'RIGHT_CONCEALED';
    if (left.state === 'CONCEALED' && right.state === 'CONCEALED') {
      return left.commitment === right.commitment
        ? 'BOTH_CONCEALED_SAME_COMMITMENT'
        : 'BOTH_CONCEALED_DIFFERENT_COMMITMENT';
    }
    throw new Error('Unsupported comparison stop state');
  }

  function positionsFor(leftStops, rightStops) {
    var total = Math.max(leftStops.length, rightStops.length);
    var positions = [];
    for (var index = 0; index < total; index += 1) {
      var left = leftStops[index] ? Object.assign({}, leftStops[index]) : absentStop();
      var right = rightStops[index] ? Object.assign({}, rightStops[index]) : absentStop();
      positions.push({
        index: index,
        state: positionState(left, right),
        left: left,
        right: right
      });
    }
    return positions;
  }

  function sharedPrefixLength(positions) {
    var shared = 0;
    for (var index = 0; index < positions.length; index += 1) {
      if (positions[index].state !== 'MATCH_REVEALED' &&
          positions[index].state !== 'BOTH_CONCEALED_SAME_COMMITMENT') {
        break;
      }
      shared += 1;
    }
    return shared;
  }

  async function verifySide(input, verifiedAt) {
    var sourceBytes = exactBytes(input);
    var artifactDigest = await digestOf(sourceBytes);
    var value;
    try {
      value = JSON.parse(utf8(sourceBytes));
    } catch (error) {
      return {
        source: { artifact_format: null, artifact_digest: artifactDigest },
        verification: {
          state: 'REJECTED',
          verified_digest: null,
          verified_at: verifiedAt,
          verifier: 'r4b1t-comparison-verifier/v0.1',
          reason: error && error.message ? error.message : String(error)
        },
        snapshot: null
      };
    }

    var format = artifactFormatOf(value);
    var source = { artifact_format: format, artifact_digest: artifactDigest };
    var verifier = verifierFor(format);

    if (format !== trail.FORMAT && format !== blind.FORMAT) {
      return {
        source: source,
        verification: {
          state: 'UNVERIFIED',
          verified_digest: null,
          verified_at: null,
          verifier: verifier,
          reason: 'Unsupported source artifact format'
        },
        snapshot: null
      };
    }

    try {
      var snapshot = format === trail.FORMAT ? await trail.verify(value) : await blind.verify(value);
      return {
        source: source,
        verification: {
          state: 'VERIFIED',
          verified_digest: artifactDigest,
          verified_at: verifiedAt,
          verifier: verifier,
          reason: null
        },
        snapshot: snapshot
      };
    } catch (error) {
      return {
        source: source,
        verification: {
          state: 'REJECTED',
          verified_digest: null,
          verified_at: verifiedAt,
          verifier: verifier,
          reason: error && error.message ? error.message : String(error)
        },
        snapshot: null
      };
    }
  }

  function rejectSide(side, reason, verifiedAt) {
    side.verification = {
      state: 'REJECTED',
      verified_digest: null,
      verified_at: verifiedAt,
      verifier: verifierFor(side.source.artifact_format),
      reason: reason
    };
    side.snapshot = null;
  }

  async function verifyDirectLineage(left, right, verifiedAt) {
    if (!left.snapshot || !right.snapshot) return { relation: null, fork_at: null };

    var leftParent = parentOf(left.snapshot);
    var rightParent = parentOf(right.snapshot);

    if (rightParent && rightParent.trail_id === left.snapshot.trail_id) {
      try {
        var rightLineage = right.snapshot.manifest.format === trail.FORMAT
          ? await trail.verifyLineage(right.snapshot, left.snapshot)
          : await blind.verifyLineage(right.snapshot, left.snapshot);
        return { relation: 'LEFT_PARENT_OF_RIGHT', fork_at: rightLineage.fork_at };
      } catch (error) {
        rejectSide(right, error && error.message ? error.message : String(error), verifiedAt);
        return { relation: null, fork_at: null };
      }
    }

    if (leftParent && leftParent.trail_id === right.snapshot.trail_id) {
      try {
        var leftLineage = left.snapshot.manifest.format === trail.FORMAT
          ? await trail.verifyLineage(left.snapshot, right.snapshot)
          : await blind.verifyLineage(left.snapshot, right.snapshot);
        return { relation: 'RIGHT_PARENT_OF_LEFT', fork_at: leftLineage.fork_at };
      } catch (error) {
        rejectSide(left, error && error.message ? error.message : String(error), verifiedAt);
        return { relation: null, fork_at: null };
      }
    }

    return { relation: null, fork_at: null };
  }

  function diagnosticProjection(left, right) {
    return {
      format: FORMAT,
      sources: { left: left.source, right: right.source },
      verification: { left: left.verification, right: right.verification },
      comparison: null,
      notice: NOTICE,
      diagnostic_notice: DIAGNOSTIC_NOTICE
    };
  }

  function verifiedProjection(left, right, lineage) {
    var leftStops = stopsOf(left.snapshot);
    var rightStops = stopsOf(right.snapshot);
    var positions = positionsFor(leftStops, rightStops);
    var shared = sharedPrefixLength(positions);
    var firstDivergence = shared === positions.length ? null : shared;

    var lineageState;
    if (left.snapshot.trail_id === right.snapshot.trail_id) {
      lineageState = 'SAME_TRAIL';
    } else if (lineage.relation) {
      lineageState = lineage.relation;
    } else if (shared > 0) {
      lineageState = 'SHARED_ANCESTRY_NOT_PROVEN';
    } else {
      lineageState = 'NO_SHARED_PREFIX';
    }

    return {
      format: FORMAT,
      sources: { left: left.source, right: right.source },
      verification: { left: left.verification, right: right.verification },
      comparison: {
        left_trail_id: left.snapshot.trail_id,
        right_trail_id: right.snapshot.trail_id,
        lineage_state: lineageState,
        direct_fork_at: lineage.relation ? lineage.fork_at : null,
        shared_prefix_length: shared,
        first_divergence_index: firstDivergence,
        left_stop_count: leftStops.length,
        right_stop_count: rightStops.length,
        positions: positions
      },
      notice: NOTICE
    };
  }

  function validateSideStop(side) {
    if (!side || ['REVEALED', 'CONCEALED', 'ABSENT'].indexOf(side.state) === -1) {
      throw new Error('Comparison side stop state is invalid');
    }
    if (side.route_id !== null && !SHA256.test(side.route_id)) {
      throw new Error('Comparison route ID is invalid');
    }
    if (side.commitment !== null && !SHA256.test(side.commitment)) {
      throw new Error('Comparison commitment is invalid');
    }
    if (side.state === 'CONCEALED' && side.route_id !== null) {
      throw new Error('Concealed comparison side cannot expose route identity');
    }
    if (side.state === 'ABSENT' && (side.route_id !== null || side.commitment !== null)) {
      throw new Error('Absent comparison side cannot carry proof material');
    }
  }

  function validateVerification(source, verification) {
    if (!verification || STATES.indexOf(verification.state) === -1) {
      throw new Error('Comparison verification state is invalid');
    }
    if (verification.state === 'VERIFIED') {
      if (verification.verified_digest !== source.artifact_digest) {
        throw new Error('Comparison verified digest does not match source digest');
      }
      isoTimestamp(verification.verified_at);
      if (!verification.verifier || verification.reason !== null) {
        throw new Error('Comparison VERIFIED result is incomplete');
      }
    } else {
      if (verification.verified_digest !== null || typeof verification.reason !== 'string' || !verification.reason) {
        throw new Error('Comparison diagnostic verification result is incomplete');
      }
      if (verification.state === 'REJECTED') isoTimestamp(verification.verified_at);
      if (verification.state === 'UNVERIFIED' && verification.verified_at !== null) {
        isoTimestamp(verification.verified_at);
      }
    }
  }

  function validateProjection(result) {
    if (!result || result.format !== FORMAT) throw new Error('Comparison projection format is invalid');
    if (!result.sources || !result.verification) throw new Error('Comparison projection is incomplete');

    ['left', 'right'].forEach(function (side) {
      var source = result.sources[side];
      if (!source || !SHA256.test(source.artifact_digest || '')) {
        throw new Error('Comparison source digest is invalid');
      }
      validateVerification(source, result.verification[side]);
    });

    if (result.notice !== NOTICE) throw new Error('Comparison notice is invalid');

    var bothVerified = result.verification.left.state === 'VERIFIED' &&
      result.verification.right.state === 'VERIFIED';

    if (!bothVerified) {
      if (result.comparison !== null || result.diagnostic_notice !== DIAGNOSTIC_NOTICE) {
        throw new Error('Diagnostic comparison projection is invalid');
      }
      return result;
    }

    if (!result.comparison || Object.prototype.hasOwnProperty.call(result, 'diagnostic_notice')) {
      throw new Error('Verified comparison projection is incomplete');
    }

    var comparison = result.comparison;
    if (!SHA256.test(comparison.left_trail_id || '') || !SHA256.test(comparison.right_trail_id || '')) {
      throw new Error('Comparison trail ID is invalid');
    }
    if (['SAME_TRAIL', 'LEFT_PARENT_OF_RIGHT', 'RIGHT_PARENT_OF_LEFT', 'SHARED_ANCESTRY_NOT_PROVEN', 'NO_SHARED_PREFIX'].indexOf(comparison.lineage_state) === -1) {
      throw new Error('Comparison lineage state is invalid');
    }
    if (!Number.isSafeInteger(comparison.shared_prefix_length) || comparison.shared_prefix_length < 0) {
      throw new Error('Comparison shared prefix length is invalid');
    }
    if (comparison.first_divergence_index !== null &&
        (!Number.isSafeInteger(comparison.first_divergence_index) || comparison.first_divergence_index < 0)) {
      throw new Error('Comparison first divergence index is invalid');
    }
    if (!Array.isArray(comparison.positions) ||
        comparison.positions.length !== Math.max(comparison.left_stop_count, comparison.right_stop_count)) {
      throw new Error('Comparison position count mismatch');
    }
    comparison.positions.forEach(function (position, index) {
      if (position.index !== index) throw new Error('Comparison position indexes must be contiguous');
      validateSideStop(position.left);
      validateSideStop(position.right);
      if (position.state !== positionState(position.left, position.right)) {
        throw new Error('Comparison position state derivation mismatch');
      }
    });

    var expectedShared = sharedPrefixLength(comparison.positions);
    if (comparison.shared_prefix_length !== expectedShared) {
      throw new Error('Comparison shared prefix derivation mismatch');
    }
    var expectedFirst = expectedShared === comparison.positions.length ? null : expectedShared;
    if (comparison.first_divergence_index !== expectedFirst) {
      throw new Error('Comparison first divergence derivation mismatch');
    }

    if (comparison.lineage_state === 'LEFT_PARENT_OF_RIGHT' ||
        comparison.lineage_state === 'RIGHT_PARENT_OF_LEFT') {
      if (!Number.isSafeInteger(comparison.direct_fork_at) || comparison.direct_fork_at < 0) {
        throw new Error('Direct comparison lineage requires fork position');
      }
    } else if (comparison.direct_fork_at !== null) {
      throw new Error('Non-parent comparison lineage cannot carry fork position');
    }

    return result;
  }

  async function compare(leftInput, rightInput, options) {
    options = options || {};
    var verifiedAt = isoTimestamp(options.verified_at);
    var left = await verifySide(leftInput, verifiedAt);
    var right = await verifySide(rightInput, verifiedAt);

    if (left.verification.state !== 'VERIFIED' || right.verification.state !== 'VERIFIED') {
      return validateProjection(diagnosticProjection(left, right));
    }

    var lineage = await verifyDirectLineage(left, right, verifiedAt);
    if (left.verification.state !== 'VERIFIED' || right.verification.state !== 'VERIFIED') {
      return validateProjection(diagnosticProjection(left, right));
    }

    return validateProjection(verifiedProjection(left, right, lineage));
  }

  return {
    FORMAT: FORMAT,
    NOTICE: NOTICE,
    DIAGNOSTIC_NOTICE: DIAGNOSTIC_NOTICE,
    compare: compare,
    validateProjection: validateProjection,
    digestOf: digestOf
  };
});
