(function (root, factory) {
  'use strict';
  var commonJs = typeof module === 'object' && module.exports;
  var api = factory(
    commonJs ? require('./trail-manifest.js') : root && root.R4b1tTrail,
    commonJs ? require('./blind-manifest.js') : root && root.R4b1tBlind
  );
  if (commonJs) module.exports = api;
  if (root) root.R4b1tReplayInspection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (trail, blind) {
  'use strict';

  if (!trail || !blind) throw new Error('Replay Inspection requires frozen trail verifiers');

  var FORMAT = 'r4b1t-replay-inspection/v0.1';
  var PHASES = [
    'UNLOADED',
    'READING',
    'VERIFYING',
    'VERIFIED',
    'REJECTED',
    'UNVERIFIED',
    'INSPECTING'
  ];

  function clone(value) {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function exactBytes(input) {
    if (typeof input === 'string') return new TextEncoder().encode(input);
    if (input instanceof Uint8Array) return new Uint8Array(input);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
    throw new TypeError('Replay Inspection requires exact source bytes');
  }

  function optionalTimestamp(value) {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
      throw new TypeError('Replay Inspection verified_at must be an explicit ISO timestamp');
    }
    return value;
  }

  function utf8(bytes) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  async function digestBytes(bytes) {
    return 'sha256:' + await trail.sha256Hex(bytes);
  }

  function artifactFormatOf(parsed) {
    return parsed && parsed.manifest && typeof parsed.manifest.format === 'string'
      ? parsed.manifest.format
      : null;
  }

  function verifierFor(format) {
    if (format === trail.FORMAT) return 'r4b1t-trail-verifier/v0.1';
    if (format === blind.FORMAT) return 'r4b1t-blind-verifier/v0.2';
    return 'r4b1t-replay-inspection-verifier/v0.1';
  }

  function v01Steps(snapshot) {
    return snapshot.manifest.routes.map(function (route, position) {
      return {
        position: position,
        source_index: route.index,
        state: 'REVEALED',
        commitment: null,
        route_id: route.route_id,
        url: route.url,
        action: route.action
      };
    });
  }

  function v02Steps(snapshot) {
    return snapshot.manifest.steps.map(function (step, position) {
      if (step.state === 'concealed') {
        return {
          position: position,
          source_index: step.index,
          state: 'CONCEALED',
          commitment: step.commitment,
          route_id: null,
          url: null,
          action: null
        };
      }
      return {
        position: position,
        source_index: step.index,
        state: 'REVEALED',
        commitment: step.commitment,
        route_id: step.route.route_id,
        url: step.route.url,
        action: null
      };
    });
  }

  function diagnosticRecord(format, digest, state, reason, verifiedAt) {
    return {
      artifact_format: format,
      artifact_digest: digest,
      canonical_trail_id: null,
      verification: {
        state: state,
        verified_digest: null,
        verified_at: state === 'REJECTED' ? verifiedAt : null,
        verifier: verifierFor(format),
        reason: reason
      },
      steps: []
    };
  }

  async function verifyExactSource(bytes, verifiedAt) {
    var digest = await digestBytes(bytes);
    var sourceText;
    var parsed;

    try {
      sourceText = utf8(bytes);
    } catch (error) {
      return diagnosticRecord(null, digest, 'UNVERIFIED', 'Source bytes are not valid UTF-8', verifiedAt);
    }

    try {
      parsed = JSON.parse(sourceText);
    } catch (error) {
      return diagnosticRecord(null, digest, 'UNVERIFIED', 'Source is not valid JSON', verifiedAt);
    }

    var format = artifactFormatOf(parsed);
    if (format !== trail.FORMAT && format !== blind.FORMAT) {
      return diagnosticRecord(format, digest, 'UNVERIFIED', 'Unsupported source artifact format', verifiedAt);
    }

    try {
      var snapshot = format === trail.FORMAT
        ? await trail.verify(parsed)
        : await blind.verify(parsed);
      return {
        artifact_format: format,
        artifact_digest: digest,
        canonical_trail_id: snapshot.trail_id,
        verification: {
          state: 'VERIFIED',
          verified_digest: digest,
          verified_at: verifiedAt,
          verifier: verifierFor(format),
          reason: null
        },
        steps: format === trail.FORMAT ? v01Steps(snapshot) : v02Steps(snapshot)
      };
    } catch (error) {
      return diagnosticRecord(
        format,
        digest,
        'REJECTED',
        error && error.message ? error.message : String(error),
        verifiedAt
      );
    }
  }

  function neutralSnapshot(phase) {
    return {
      format: FORMAT,
      phase: phase,
      source: null,
      position: null,
      total_positions: 0,
      current_step: null,
      diagnostic: null
    };
  }

  function publicSource(record) {
    return {
      artifact_format: record.artifact_format,
      artifact_digest: record.artifact_digest,
      canonical_trail_id: record.canonical_trail_id,
      verification: clone(record.verification)
    };
  }

  function createMachine() {
    var phase = 'UNLOADED';
    var record = null;
    var position = null;
    var generation = 0;

    function snapshot() {
      if (phase === 'UNLOADED' || phase === 'READING' || phase === 'VERIFYING') {
        return neutralSnapshot(phase);
      }

      var value = {
        format: FORMAT,
        phase: phase,
        source: publicSource(record),
        position: null,
        total_positions: record.verification.state === 'VERIFIED' ? record.steps.length : 0,
        current_step: null,
        diagnostic: record.verification.state === 'VERIFIED'
          ? null
          : {
              state: record.verification.state,
              reason: record.verification.reason
            }
      };

      if (phase === 'INSPECTING' && position !== null) {
        value.position = position;
        value.current_step = clone(record.steps[position]);
      }

      return value;
    }

    async function load(input, options) {
      options = options || {};
      var verifiedAt = optionalTimestamp(options.verified_at);
      var token = ++generation;

      phase = 'READING';
      record = null;
      position = null;

      var bytes;
      try {
        bytes = exactBytes(input);
      } catch (error) {
        if (token === generation) phase = 'UNLOADED';
        throw error;
      }

      phase = 'VERIFYING';
      var result = await verifyExactSource(bytes, verifiedAt);

      if (token !== generation) return snapshot();

      record = result;
      phase = result.verification.state;
      position = null;
      return snapshot();
    }

    function begin() {
      if (phase !== 'VERIFIED') throw new Error('Replay Inspection requires a VERIFIED source before inspection');
      phase = 'INSPECTING';
      position = record.steps.length ? 0 : null;
      return snapshot();
    }

    function seek(nextPosition) {
      if (phase !== 'INSPECTING') throw new Error('Replay Inspection is not active');
      if (!Number.isSafeInteger(nextPosition) || nextPosition < 0 || nextPosition >= record.steps.length) {
        throw new RangeError('Replay Inspection position is out of range');
      }
      position = nextPosition;
      return snapshot();
    }

    function next() {
      if (phase !== 'INSPECTING') throw new Error('Replay Inspection is not active');
      if (position === null || position >= record.steps.length - 1) return snapshot();
      position += 1;
      return snapshot();
    }

    function previous() {
      if (phase !== 'INSPECTING') throw new Error('Replay Inspection is not active');
      if (position === null || position <= 0) return snapshot();
      position -= 1;
      return snapshot();
    }

    function reset() {
      generation += 1;
      phase = 'UNLOADED';
      record = null;
      position = null;
      return snapshot();
    }

    return Object.freeze({
      load: load,
      begin: begin,
      seek: seek,
      next: next,
      previous: previous,
      reset: reset,
      snapshot: snapshot
    });
  }

  return {
    FORMAT: FORMAT,
    PHASES: PHASES.slice(),
    createMachine: createMachine
  };
});
