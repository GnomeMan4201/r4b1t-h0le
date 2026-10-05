(function () {
  'use strict';

  var api = window.R4b1tTrail;
  var v03 = window.R4b1tTrailV03;
  var corpusAuthority = window.R4b1tCorpusAuthority;
  if (!api || !v03) return;
  if (!corpusAuthority) throw new Error('Corpus authority unavailable');

  var STORAGE_KEY = 'r4b1t_trail_draft_v1';
  // A saved draft that cannot be continued is kept here verbatim, never silently discarded.
  var QUARANTINE_KEY = 'r4b1t_trail_draft_quarantine_v1';
  var MAX_DRAWS_PER_ROLL = 30;
  var authorityOriginalCommit = null;
  var authorityReadyResolve = null;
  var authorityReadyReject = null;
  window.__r4b1tTrailAuthorityReady = new Promise(function (resolve, reject) {
    authorityReadyResolve = resolve;
    authorityReadyReject = reject;
  });
  // Trail runtime is also exercised in isolation by integrity tests and may be
  // embedded without the authority consumer. Mark the promise as handled here;
  // consumers awaiting the original promise still observe the rejection.
  window.__r4b1tTrailAuthorityReady.catch(function () {});
  var state = {
    seed: randomSeed(),
    createdAt: new Date().toISOString(),
    corpusRevision: null,
    corpusSourceId: null,
    restoredFromStorage: false,
    restoredCorpusRevision: null,
    restoredCorpusSourceId: null,
    routes: [],
    parent: null,
    sampler: null,
    imported: null,
    replayIndex: 0,
    suppressRecord: false,
    samplerCursor: 0,
    transactionSequence: 0,
    selectionTerrain: null,
    repeatGuardReference: null,
    restoreNotice: null,
    preservationBlocked: false
  };

  function randomSeed() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }

  function advanceSamplerTo(cursor) {
    state.sampler = api.createSampler(state.seed);
    for (var consumed = 0; consumed < cursor; consumed += 1) state.sampler();
    state.samplerCursor = cursor;
  }

  // Validates every persisted v2 ROLL as one chain (the rule export enforces in trail-v03.js):
  // sequence 1..n, draw_start equal to the running cursor, 1..30 draws each, one seed, and the
  // previous ROLL as repeat-guard reference. The cursor is therefore at most 30 x ROLL count.
  // Returns null when the draft can be continued, otherwise the reason it cannot.
  function restoreSamplerContinuity() {
    var cursor = 0;
    var sequence = 0;
    var previousRollUrl = null;

    for (var index = 0; index < state.routes.length; index += 1) {
      var route = state.routes[index];
      var transaction = route && route.selection_transaction;
      // Historical v1 draft evidence remains available through legacy export.
      if (!transaction || transaction.transaction_version === 'r4b1t-selection-transaction/v1') continue;
      try {
        v03.validateTransaction(transaction, route, state.restoredCorpusRevision);
      } catch (error) {
        return 'ROLL continuity/declaration mismatch at step ' + (index + 1) + ': ' + error.message;
      }
      var sampler = transaction.sampler;
      var guard = sampler && sampler.repeat_guard;
      var routeUrl = transaction.route && transaction.route.url;
      sequence += 1;
      if (
        !sampler ||
        sampler.seed !== state.seed ||
        transaction.sequence !== sequence ||
        sampler.draw_start !== cursor ||
        !Number.isSafeInteger(sampler.draw_count) || sampler.draw_count < 1 || sampler.draw_count > MAX_DRAWS_PER_ROLL ||
        !guard || guard.reference !== previousRollUrl ||
        routeUrl !== route.url
      ) {
        return 'ROLL continuity mismatch at step ' + (index + 1);
      }
      cursor += sampler.draw_count;
      previousRollUrl = route.url;
    }

    advanceSamplerTo(cursor);
    state.transactionSequence = sequence;
    state.repeatGuardReference = previousRollUrl;
    return null;
  }

  function quarantineDraft(raw, reason) {
    try {
      var previous = quarantinedDraft();
      var history = previous && Array.isArray(previous.history) ? previous.history.slice() : [];
      if (previous && previous.raw !== raw) {
        history.push({ quarantined_at: previous.quarantined_at, reason: previous.reason, raw: previous.raw });
      }
      localStorage.setItem(QUARANTINE_KEY, JSON.stringify({
        history: history,
        quarantined_at: new Date().toISOString(),
        reason: reason,
        raw: raw
      }));
    } catch (_) {
      state.preservationBlocked = true;
      state.restoreNotice = 'DRAFT PRESERVATION UNAVAILABLE / ORIGINAL DRAFT RETAINED / ROLL BLOCKED';
      return false;
    }
    state.restoreNotice = 'PREVIOUS DRAFT NOT CONTINUED / ' + reason.toUpperCase() + ' / PRESERVED';
    return true;
  }

  function quarantinedDraft() {
    try { return JSON.parse(localStorage.getItem(QUARANTINE_KEY) || 'null'); } catch (_) { return null; }
  }

  function restore() {
    var raw = null;
    var draftRead = false;
    var failure = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      draftRead = true;
      var saved = JSON.parse(raw || 'null');
      if (saved) {
        if (typeof saved.seed !== 'string' || !saved.seed || !Array.isArray(saved.routes)) {
          throw new Error('Invalid draft shape');
        }
        state.restoredFromStorage = true;
        state.restoredCorpusRevision = typeof saved.corpusRevision === 'string' ? saved.corpusRevision : null;
        state.restoredCorpusSourceId = typeof saved.corpusSourceId === 'string' ? saved.corpusSourceId : null;
        state.seed = saved.seed;
        state.createdAt = typeof saved.createdAt === 'string' ? saved.createdAt : state.createdAt;
        // Never filter saved steps: even malformed evidence must survive rejection.
        state.routes = saved.routes;
        state.parent = saved.parent || null;
        for (var index = 0; index < state.routes.length; index += 1) {
          var route = state.routes[index];
          if (!route || !/^https?:\/\//i.test(route.url || '')) {
            throw new Error('Invalid draft route at step ' + (index + 1));
          }
          new URL(route.url);
        }
      }
      failure = restoreSamplerContinuity();
    } catch (error) {
      // Without the original bytes, no quarantine or replacement can preserve evidence.
      if (!draftRead) {
        state.preservationBlocked = true;
        state.restoreNotice = 'DRAFT READ UNAVAILABLE / ORIGINAL DRAFT RETAINED / ROLL BLOCKED';
        return;
      }
      failure = 'Draft restore rejected: ' + error.message;
    }
    if (failure && quarantineDraft(raw, failure)) clearDraftState();
  }

  function persist() {
    if (state.preservationBlocked) throw new Error('Draft preservation unavailable');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      seed: state.seed,
      createdAt: state.createdAt,
      corpusRevision: state.corpusRevision,
      corpusSourceId: state.corpusSourceId,
      routes: state.routes,
      parent: state.parent
    }));
  }

  function clearDraftState() {
    state.seed = randomSeed();
    state.createdAt = new Date().toISOString();
    state.sampler = api.createSampler(state.seed);
    state.samplerCursor = 0;
    state.transactionSequence = 0;
    state.selectionTerrain = null;
    state.repeatGuardReference = null;
    state.routes = [];
    state.parent = null;
    state.imported = null;
    state.replayIndex = 0;
  }

  async function loadCorpusRevision() {
    if (state.preservationBlocked) throw new Error('Draft preservation unavailable');
    var loaded = await corpusAuthority.loadActive();
    var restoredHasState = state.routes.length > 0 || Boolean(state.parent);

    if (state.restoredFromStorage && restoredHasState) {
      if (state.restoredCorpusRevision) {
        if (state.restoredCorpusRevision !== loaded.revision) {
          if (!quarantineDraft(localStorage.getItem(STORAGE_KEY), 'Corpus revision mismatch')) {
            throw new Error('Draft preservation unavailable');
          }
          clearDraftState();
        }
      } else if (loaded.source.id !== 'legacy-urls-v1') {
        if (!quarantineDraft(localStorage.getItem(STORAGE_KEY), 'Corpus revision absent')) {
          throw new Error('Draft preservation unavailable');
        }
        clearDraftState();
      }
    }

    state.corpusRevision = loaded.revision;
    state.corpusSourceId = loaded.source.id;
    state.restoredFromStorage = false;
    state.restoredCorpusRevision = null;
    state.restoredCorpusSourceId = null;
    persist();
    renderPanel();
  }

  // The armed terrain comes from the explicit selection constraint, never from presentation.
  function terrain() {
    return typeof window.__r4b1tCaptureSelectionConstraint === 'function'
      ? window.__r4b1tCaptureSelectionConstraint().terrain
      : 'ALL';
  }

  // Replay suppresses only the replayed route's own SELECT. A ROLL is always a user commit
  // (replay never samples), so it is recorded even inside the replay window.
  function record(url, action, transaction, evidence) {
    if ((state.suppressRecord && action !== 'ROLL') || !/^https?:\/\//i.test(url || '')) return false;
    var route = { url: url, action: action || 'SELECT' };
    if (transaction) route.selection_transaction = transaction;
    if (evidence && evidence.navigation) route.navigation = evidence.navigation;
    if (evidence && evidence.imported_source) route.imported_source = evidence.imported_source;
    if (evidence && evidence.authority_transaction_id) route.authority_transaction_id = evidence.authority_transaction_id;
    state.routes.push(route);
    try {
      persist();
    } catch (_) {
      state.routes.pop();
      renderPanel('RECORDING UNAVAILABLE / NO SELECTION COMMITTED');
      return false;
    }
    state.imported = null;
    renderPanel();
    return true;
  }

  function lastRecordedStepForUrl(url) {
    if (!url) return null;
    for (var index = state.routes.length - 1; index >= 0; index -= 1) {
      if (state.routes[index] && state.routes[index].url === url) return index + 1;
    }
    return null;
  }

  function recordNavigation(detail) {
    if (state.suppressRecord || !detail || !/^https?:\/\//i.test(detail.url || '')) return false;
    if (detail.kind === 'BRANCH') {
      var fromStep = lastRecordedStepForUrl(detail.from_url);
      if (!fromStep) {
        renderPanel('UNVERIFIED / BRANCH SOURCE STEP ABSENT');
        return false;
      }
      return record(detail.url, 'BRANCH', null, {
        navigation: {
          from_step: fromStep,
          branch_label: String(detail.branch_label || 'BRANCH')
        }
      });
    }
    if (detail.kind === 'SELECT') return record(detail.url, 'SELECT');
    return false;
  }

  // DOM mutation is presentation only. Authoritative provenance is recorded
  // from the immutable ROLL transaction or explicit navigation events.
  function watchSelections() {}

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function wrapRoll() {
    if (typeof window.__r4b1tCommitRoll !== 'function' || window.__r4b1tCommitRoll.__r4b1tAuthority) return false;
    var originalCommit = window.__r4b1tCommitRoll;
    authorityOriginalCommit = originalCommit;
    var wrappedCommit = function () {
      // Fail closed: without the explicit constraint capture there is no selection.
      if (state.preservationBlocked) return null;
      if (typeof window.__r4b1tCaptureSelectionConstraint !== 'function') return null;
      var selectionConstraint = window.__r4b1tCaptureSelectionConstraint();
      var selectionTerrain = selectionConstraint.terrain;
      var drawStart = state.samplerCursor;
      var drawCount = 0;
      var nextFloat = function () {
        drawCount += 1;
        state.samplerCursor += 1;
        return state.sampler();
      };
      var repeatGuardReference = state.repeatGuardReference;
      var result = originalCommit(nextFloat, selectionConstraint, repeatGuardReference);
      if (!result || !result.url) {
        if (drawCount) advanceSamplerTo(drawStart);
        return result;
      }

      var transaction = deepFreeze({
        transaction_version: 'r4b1t-selection-transaction/v2',
        sequence: state.transactionSequence + 1,
        action: 'ROLL',
        constraint: selectionConstraint,
        corpus_revision: state.corpusRevision,
        eligible_count: result.eligibleCount,
        sampler: {
          algorithm: 'uniform-with-repeat-guard-v1',
          prng: 'mulberry32-v1',
          seed: state.seed,
          draw_start: drawStart,
          draw_count: drawCount,
          // The guard reference actually used by this draw (SELECTION_TRANSACTION_V2.md §3).
          repeat_guard: { reference: result.repeatGuardReference == null ? null : result.repeatGuardReference, max_draws: 30 }
        },
        route: { url: result.url }
      });

      // Sampler state advances only together with the recorded step, so the draft can never
      // hold a gap in the ROLL chain.
      if (!record(result.url, 'ROLL', transaction)) {
        advanceSamplerTo(drawStart);
        return null;
      }
      state.transactionSequence = transaction.sequence;
      state.selectionTerrain = selectionTerrain;
      state.repeatGuardReference = result.url;
      return Object.freeze({ url: result.url, transaction: transaction });
    };
    wrappedCommit.__r4b1tAuthority = true;
    window.__r4b1tCommitRoll = wrappedCommit;
    return true;
  }

  function authorityRouteFor(transactionId) {
    if (!transactionId) return null;
    for (var index = state.routes.length - 1; index >= 0; index -= 1) {
      var route = state.routes[index];
      if (route && route.authority_transaction_id === transactionId) return route;
    }
    return null;
  }

  async function authorityEligibleSnapshot(constraint) {
    var selectionCore = window.R4b1tSelectionCore;
    if (!selectionCore || typeof selectionCore.eligiblePool !== 'function') {
      throw new Error('SELECTION_CORE_UNAVAILABLE');
    }
    var loaded = await corpusAuthority.loadActive();
    if (state.corpusRevision && loaded.revision !== state.corpusRevision) {
      throw new Error('CORPUS_REVISION_CHANGED');
    }
    var terrainIndex = null;
    if (constraint.terrain !== 'ALL') {
      var terrainAuthority = window.R4b1tTerrainAuthority;
      if (!terrainAuthority || typeof terrainAuthority.loadIndex !== 'function') {
        throw new Error('TERRAIN_AUTHORITY_UNAVAILABLE');
      }
      terrainIndex = await terrainAuthority.loadIndex();
    }
    return selectionCore.eligiblePool(loaded.urls, terrainIndex, constraint);
  }

  function refreshAuthorityDraftFromStorage() {
    if (state.preservationBlocked) throw new Error('DRAFT_PRESERVATION_UNAVAILABLE');
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('DRAFT_AUTHORITY_STATE_UNAVAILABLE');
    var previous = Object.assign({}, state);
    try {
      var saved = JSON.parse(raw);
      if (!saved || typeof saved.seed !== 'string' || !saved.seed || !Array.isArray(saved.routes)) {
        throw new Error('Invalid durable draft shape');
      }
      if (typeof saved.corpusRevision !== 'string' || saved.corpusRevision !== state.corpusRevision) {
        throw new Error('Durable draft corpus revision mismatch');
      }
      for (var index = 0; index < saved.routes.length; index += 1) {
        var route = saved.routes[index];
        if (!route || !/^https?:\/\//i.test(route.url || '')) {
          throw new Error('Invalid durable draft route at step ' + (index + 1));
        }
        new URL(route.url);
      }
      state.seed = saved.seed;
      state.createdAt = typeof saved.createdAt === 'string' ? saved.createdAt : state.createdAt;
      state.corpusSourceId = typeof saved.corpusSourceId === 'string' ? saved.corpusSourceId : state.corpusSourceId;
      state.routes = saved.routes;
      state.parent = saved.parent || null;
      state.imported = null;
      state.replayIndex = 0;
      var failure = restoreSamplerContinuity();
      if (failure) throw new Error(failure);
      return true;
    } catch (error) {
      Object.assign(state, previous);
      throw error;
    }
  }

  async function prepareAuthorityRoll(transactionId) {
    var authorityCore = window.R4B1TRollAuthorityCore;
    if (!authorityCore || typeof authorityCore.createPrepared !== 'function') {
      throw new Error('ROLL_AUTHORITY_CORE_UNAVAILABLE');
    }
    if (state.preservationBlocked) throw new Error('DRAFT_PRESERVATION_UNAVAILABLE');
    if (!authorityOriginalCommit) wrapRoll();
    if (!authorityOriginalCommit) throw new Error('ROLL_COMMIT_ADAPTER_UNAVAILABLE');
    if (!state.corpusRevision) await loadCorpusRevision();
    refreshAuthorityDraftFromStorage();
    if (typeof window.__r4b1tCaptureSelectionConstraint !== 'function') {
      throw new Error('SELECTION_CONSTRAINT_UNAVAILABLE');
    }
    var constraint = window.__r4b1tCaptureSelectionConstraint();
    var eligibleSnapshot = await authorityEligibleSnapshot(constraint);
    var envelope = await currentEnvelope();
    return authorityCore.createPrepared({
      transactionId: transactionId,
      trailId: envelope.trail_id,
      trailSequence: state.transactionSequence + 1,
      corpusDigest: state.corpusRevision,
      constraint: constraint,
      eligibleSnapshot: eligibleSnapshot,
      samplerVersion: authorityCore.SAMPLER_VERSION,
      seedSource: { kind: 'local-csprng' },
      seedMaterial: state.seed,
      drawStart: state.samplerCursor,
      repeatGuardReference: state.repeatGuardReference
    });
  }

  function transactionFromAuthority(terminal) {
    var prepared = terminal.prepared;
    return deepFreeze({
      transaction_version: 'r4b1t-selection-transaction/v2',
      sequence: prepared.trailSequence,
      action: 'ROLL',
      constraint: prepared.constraint,
      corpus_revision: prepared.corpusDigest,
      eligible_count: prepared.eligibleCount,
      sampler: {
        algorithm: 'uniform-with-repeat-guard-v1',
        prng: 'mulberry32-v1',
        seed: prepared.seedMaterial,
        draw_start: prepared.drawStart,
        draw_count: terminal.result.drawCount,
        repeat_guard: {
          reference: prepared.repeatGuardReference,
          max_draws: MAX_DRAWS_PER_ROLL
        }
      },
      route: { url: terminal.result.url }
    });
  }

  function adoptAuthoritySelection(terminal) {
    if (typeof authorityOriginalCommit !== 'function') throw new Error('ROLL_COMMIT_ADAPTER_UNAVAILABLE');
    var prepared = terminal.prepared;
    var sampler = api.createSampler(prepared.seedMaterial);
    for (var consumed = 0; consumed < prepared.drawStart; consumed += 1) sampler();
    var drawCount = 0;
    var result = authorityOriginalCommit(function () {
      drawCount += 1;
      return sampler();
    }, prepared.constraint, prepared.repeatGuardReference);
    if (!result || result.url !== terminal.result.url || drawCount !== terminal.result.drawCount) {
      throw new Error('AUTHORITY_PROJECTION_MISMATCH');
    }
    return result;
  }

  function showAuthorityTerminal(terminal) {
    if (!terminal || terminal.state !== 'COMMITTED' || !terminal.result || !terminal.result.url) return false;
    if (typeof window.selectUrl !== 'function') return false;
    var previous = state.suppressRecord;
    state.suppressRecord = true;
    try {
      window.selectUrl(terminal.result.url);
    } finally {
      state.suppressRecord = previous;
    }
    if (typeof window.__r4b1tSyncMobileRoute === 'function') {
      window.requestAnimationFrame(function () { window.__r4b1tSyncMobileRoute(); });
    }
    return true;
  }

  async function projectAuthorityTerminal(terminal, context) {
    if (!terminal || terminal.state !== 'COMMITTED') return { projected: false };
    refreshAuthorityDraftFromStorage();
    var transactionId = terminal.transactionId;
    var existing = authorityRouteFor(transactionId);
    if (existing) {
      return { projected: true, existing: true };
    }

    var prepared = terminal.prepared;
    if (!prepared || prepared.corpusDigest !== state.corpusRevision) {
      throw new Error('AUTHORITY_CORPUS_REVISION_MISMATCH');
    }
    if (prepared.seedMaterial !== state.seed ||
        prepared.trailSequence !== state.transactionSequence + 1 ||
        prepared.drawStart !== state.samplerCursor) {
      throw new Error('AUTHORITY_TRAIL_CONTINUITY_MISMATCH');
    }

    var recovered = Boolean(context && context.recovered);
    var reveal = Boolean(context && context.reveal);

    // Commit fixes selection authority and adopts the selected route into the
    // existing application state, but does not append Trail evidence yet.
    // The Trail step is created only when the machine-owned reveal boundary
    // completes, or during recovery of a committed-but-unrevealed transaction.
    if (!recovered && !reveal) {
      adoptAuthoritySelection(terminal);
      return { projected: false, adopted: true, deferCompletion: true };
    }

    var transaction = transactionFromAuthority(terminal);
    if (!record(terminal.result.url, 'ROLL', transaction, {
      authority_transaction_id: transactionId
    })) {
      throw new Error('AUTHORITY_TRAIL_RECORD_FAILED');
    }

    state.transactionSequence = transaction.sequence;
    state.selectionTerrain = prepared.constraint.terrain;
    state.repeatGuardReference = terminal.result.url;
    advanceSamplerTo(prepared.drawStart + terminal.result.drawCount);

    return recovered
      ? { projected: true, recovered: true }
      : { projected: true, reveal: true };
  }

  async function showAuthorityTransaction(terminal) {
    return showAuthorityTerminal(terminal);
  }

  async function buildV03Steps() {
    var steps = [];
    for (var index = 0; index < state.routes.length; index += 1) {
      var draft = state.routes[index];
      var route = {
        route_id: await api.routeId(draft.url),
        url: draft.url
      };
      var stepIndex = index + 1;

      if (draft.selection_transaction &&
          draft.selection_transaction.transaction_version === 'r4b1t-selection-transaction/v2') {
        steps.push({
          index: stepIndex,
          kind: 'ROLL',
          route: route,
          transaction: draft.selection_transaction
        });
        continue;
      }

      if (draft.imported_source) {
        steps.push({
          index: stepIndex,
          kind: 'IMPORTED',
          route: route,
          source: draft.imported_source
        });
        continue;
      }

      if (draft.action === 'BRANCH' && draft.navigation) {
        steps.push({
          index: stepIndex,
          kind: 'BRANCH',
          route: route,
          navigation: draft.navigation
        });
        continue;
      }

      if (draft.action === 'SELECT') {
        steps.push({ index: stepIndex, kind: 'SELECT', route: route });
        continue;
      }

      throw new Error('Legacy draft step lacks v0.3 evidence; export legacy v0.1 or start a new trail');
    }
    return steps;
  }

  async function currentEnvelope() {
    if (state.preservationBlocked) throw new Error('Draft preservation unavailable');
    if (!state.corpusRevision) await loadCorpusRevision();
    return v03.envelope({
      format: v03.FORMAT,
      created_at: state.createdAt,
      corpus_revision: state.corpusRevision,
      steps: await buildV03Steps(),
      parent: state.parent
    });
  }

  async function currentLegacyEnvelope() {
    if (state.preservationBlocked) throw new Error('Draft preservation unavailable');
    if (!state.corpusRevision) await loadCorpusRevision();
    var manifest = await api.createManifest({
      created_at: state.createdAt,
      corpus_revision: state.corpusRevision,
      seed: state.seed,
      terrain: state.selectionTerrain || terrain(),
      routes: state.routes,
      parent: state.parent
    });
    return api.envelope(manifest);
  }

  function downloadTrail(result, suffix) {
    var blob = new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json' });
    var link = document.createElement('a');
    link.download = 'r4b1t-trail-' + result.trail_id.slice(7, 19) + (suffix || '') + '.json';
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
  }

  async function exportTrail() {
    var result = await currentEnvelope();
    downloadTrail(result, '-v03');
    state.imported = result;
    // Topology v2 currently verifies only trail v0.1 and Blind Descent v0.2.
    // Do not project v0.3 through it or let an unsupported verifier break export.
    renderPanel('VERIFIED V0.3 / DOWNSTREAM ADAPTERS PENDING');
    return result;
  }

  async function exportLegacyTrail() {
    var result = await currentLegacyEnvelope();
    downloadTrail(result, '-legacy-v01');
    state.imported = result;
    if (window.rememberTopologySnapshot) {
      try { await window.rememberTopologySnapshot(result); } catch (_) {}
    }
    renderPanel('LEGACY V0.1 / INTEGRITY ONLY');
    return result;
  }

  function artifactFormat(input) {
    var value = typeof input === 'string' ? JSON.parse(input) : input;
    return value && value.manifest && value.manifest.format;
  }

  async function verifyArtifact(input) {
    var format = artifactFormat(input);
    if (format === v03.FORMAT) return v03.verify(input);
    if (format === api.FORMAT) return api.verify(input);
    throw new TypeError('Unsupported trail format');
  }

  async function replayUrls(input) {
    var verified = await verifyArtifact(input);
    if (verified.manifest.format === v03.FORMAT) {
      return verified.manifest.steps.map(function (step) { return step.route.url; });
    }
    return api.replay(verified);
  }

  async function importTrail(input) {
    var verified = await verifyArtifact(input);
    state.imported = verified;
    if (verified.manifest.format === api.FORMAT && window.rememberTopologySnapshot) {
      try { await window.rememberTopologySnapshot(verified); } catch (_) {}
    }
    state.replayIndex = 0;
    renderPanel(verified.manifest.format === v03.FORMAT
      ? 'VERIFIED V0.3 / READY TO REPLAY'
      : 'VERIFIED LEGACY V0.1 / READY TO REPLAY');
    return verified;
  }

  async function replayStep(index) {
    if (!state.imported) throw new Error('Import or export a trail first');
    var urls = await replayUrls(state.imported);
    var selected = typeof index === 'number' ? index : state.replayIndex;
    if (selected >= urls.length) selected = 0;
    state.suppressRecord = true;
    try {
      if (typeof window.selectUrl !== 'function') throw new Error('Route engine is unavailable');
      window.selectUrl(urls[selected]);
    } finally {
      setTimeout(function () { state.suppressRecord = false; }, 0);
    }
    state.replayIndex = selected + 1;
    renderPanel('REPLAY ' + String(selected + 1).padStart(3, '0') + ' / ' + String(urls.length).padStart(3, '0'));
    return urls[selected];
  }

  async function forkTrail(index) {
    if (state.preservationBlocked) throw new Error('Draft preservation unavailable');
    if (!state.imported) throw new Error('Import or export a trail first');
    var parent = await verifyArtifact(state.imported);
    var parentFormat = parent.manifest.format;
    var loaded = await corpusAuthority.loadActive();
    if (parent.manifest.corpus_revision !== loaded.revision) {
      throw new Error('Corpus revision mismatch: imported trail cannot fork into the active corpus');
    }

    var parentRoutes = parentFormat === v03.FORMAT
      ? parent.manifest.steps.map(function (step) { return step.route; })
      : parent.manifest.routes;
    var forkAt = typeof index === 'number' ? index : state.replayIndex;
    if (!Number.isSafeInteger(forkAt) || forkAt < 0 || forkAt > parentRoutes.length) {
      throw new Error('Fork position is invalid');
    }

    var previousScope = Object.assign({}, state);
    state.corpusRevision = loaded.revision;
    state.corpusSourceId = loaded.source.id;
    state.seed = randomSeed();
    state.createdAt = new Date().toISOString();
    state.sampler = api.createSampler(state.seed);
    state.samplerCursor = 0;
    state.transactionSequence = 0;
    state.selectionTerrain = null;
    state.repeatGuardReference = null;
    state.routes = parentRoutes.slice(0, forkAt).map(function (route, routeIndex) {
      return {
        url: route.url,
        action: 'IMPORTED',
        imported_source: {
          format: parentFormat,
          trail_id: parent.trail_id,
          step_index: routeIndex + 1
        }
      };
    });
    state.parent = { trail_id: parent.trail_id, fork_at: forkAt };
    state.imported = null;
    state.replayIndex = 0;
    if (!persistScopeChange(previousScope)) throw new Error('Draft storage unavailable; fork not committed');
    renderPanel('FORKED V0.3 / STEP ' + String(forkAt).padStart(3, '0'));
    return currentEnvelope();
  }

  // Scope replacement is reversible until the new draft bytes have persisted.
  function persistScopeChange(previousScope) {
    try {
      persist();
      return true;
    } catch (_) {
      Object.assign(state, previousScope);
      renderPanel('DRAFT STORAGE UNAVAILABLE / SCOPE UNCHANGED');
      return false;
    }
  }

  function resetTrail() {
    if (state.preservationBlocked) {
      renderPanel();
      return false;
    }
    var previousScope = Object.assign({}, state);
    clearDraftState();
    state.restoreNotice = null;
    state.restoredFromStorage = false;
    state.restoredCorpusRevision = null;
    state.restoredCorpusSourceId = null;
    if (!persistScopeChange(previousScope)) return false;
    renderPanel('NEW SEED / TRAIL EMPTY');
  }

  function ensurePanel() {
    if (document.getElementById('trailLedgerOverlay')) return;
    if (!document.getElementById('trailLedgerStyles')) {
      var style = document.createElement('style');
      style.id = 'trailLedgerStyles';
      style.textContent =
        '#trailLedgerOverlay .trail-ledger-panel{background:#141210;border:1px solid #2a2825;border-top:2px solid #cc1111;padding:24px;width:min(560px,96vw);max-height:86vh;display:flex;flex-direction:column;gap:14px;overflow:auto}' +
        '#trailLedgerOverlay .trail-ledger-meta{margin:0;font-size:.52rem;line-height:1.9;color:#9a8f7a;overflow-wrap:anywhere}' +
        '#trailLedgerOverlay .trail-ledger-value{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;color:#e8e0d0;margin:0 0 6px}' +
        '#trailLedgerOverlay .trail-ledger-value>span{min-width:0;overflow-wrap:anywhere}' +
        '#trailLedgerOverlay .trail-ledger-copy{flex:0 0 auto;border:1px solid #5a332e;background:transparent;color:#c8bba6;padding:5px 7px;font:500 .43rem "DM Mono",monospace;letter-spacing:.1em;cursor:pointer}' +
        '#trailLedgerOverlay .trail-ledger-hint{margin:0;color:#9a8f7a;font:400 .5rem/1.55 "DM Mono",monospace;letter-spacing:.04em}' +
        '#trailLedgerOverlay .trail-ledger-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}' +
        '#trailLedgerOverlay .btn-share-trail{min-height:44px;border:1px solid #5a463d;background:#17130f;color:#d8cdb9;font:500 .48rem "DM Mono",monospace;letter-spacing:.1em;cursor:pointer}' +
        '#trailLedgerOverlay .btn-share-trail:disabled{border-color:#302922;background:#100e0c;color:#706658;cursor:not-allowed}' +
        '#trailLedgerOverlay .btn-share-trail:focus-visible,#trailLedgerOverlay .trail-ledger-copy:focus-visible{outline:2px solid #cc1111;outline-offset:2px}' +
        '@media(max-width:600px){#trailLedgerOverlay{align-items:flex-start!important;padding:12px!important}#trailLedgerOverlay .trail-ledger-panel{width:100%;max-height:calc(100dvh - 24px);padding:20px 16px}}';
      document.head.appendChild(style);
    }
    var overlay = document.createElement('div');
    overlay.id = 'trailLedgerOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'trailLedgerTitle');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('tabindex', '-1');
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:#000000e8;z-index:10020;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML = '<div class="trail-ledger-panel">' +
      '<div id="trailLedgerTitle" style="font-family:Bebas Neue,sans-serif;font-size:1.35rem;letter-spacing:.12em">REPRODUCIBLE RABBIT TRAIL</div>' +
      '<div id="trailLedgerStatus" role="status" style="font-size:.48rem;letter-spacing:.12em;color:#cc1111">LOCAL / UNSIGNED</div>' +
      '<dl id="trailLedgerMeta" class="trail-ledger-meta"></dl>' +
      '<input id="trailLedgerFile" type="file" accept="application/json,.json" hidden>' +
      '<p id="trailLedgerHint" class="trail-ledger-hint" role="status">Import or export a trail to enable replay and fork.</p>' +
      '<div class="trail-ledger-actions">' +
        '<button class="btn-share-trail" type="button" data-trail-action="export">EXPORT V0.3</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="export-legacy">LEGACY V0.1</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="import">IMPORT JSON</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="replay">REPLAY NEXT</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="fork">FORK HERE</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="blind">BLIND DESCENT</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="topology">MAP TRAILS</button>' +
        '<button class="btn-share-trail" type="button" data-trail-action="reset">NEW TRAIL</button>' +
      '</div>' +
      '<button class="btn-share-trail" type="button" data-trail-action="close">CLOSE [ESC]</button>' +
    '</div>';
    overlay.addEventListener('click', function (event) {
      var copyButton = event.target.closest('[data-copy-value]');
      if (copyButton) return copyLedgerValue(copyButton);
      var button = event.target.closest('[data-trail-action]');
      if (!button) return;
      var action = button.dataset.trailAction;
      if (action === 'close') return closePanel();
      if (action === 'export') return exportTrail().catch(showError);
      if (action === 'export-legacy') return exportLegacyTrail().catch(showError);
      if (action === 'import') return document.getElementById('trailLedgerFile').click();
      if (action === 'replay') return replayStep().catch(showError);
      if (action === 'fork') return forkTrail().catch(showError);
      if (action === 'blind') { closePanel(); return window.openBlindDescent(); }
      if (action === 'topology') {
        // Topology v2 still verifies trail v0.1/v0.2. Preserve the existing
        // "map the current local trail" behavior through the explicit legacy
        // projection until a dedicated v0.3 topology adapter lands.
        return currentLegacyEnvelope()
          .then(function (snapshot) { closePanel(); return window.openTrailTopology(snapshot); })
          .catch(showError);
      }
      if (action === 'reset') return resetTrail();
    });
    overlay.addEventListener('click', function (event) { if (event.target === overlay) closePanel(); });
    document.body.appendChild(overlay);
    document.getElementById('trailLedgerFile').addEventListener('change', async function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      try { await importTrail(await file.text()); } catch (error) { showError(error); }
      event.target.value = '';
    });
  }

  function renderPanel(status) {
    var meta = document.getElementById('trailLedgerMeta');
    if (!meta) return;
    var trailId = state.imported ? state.imported.trail_id : 'GENERATED ON EXPORT';
    meta.replaceChildren();
    appendLedgerField(meta, 'TRAIL ID', trailId, state.imported ? 'trail ID' : null);
    appendLedgerField(meta, 'CORPUS REVISION', state.corpusRevision || 'CALCULATING', state.corpusRevision ? 'corpus revision' : null);
    appendLedgerField(meta, 'SEED', state.seed, 'seed');
    appendLedgerField(meta, 'RECORDED ROUTES', state.routes.length);
    appendLedgerField(meta, 'PARENT / FORK', state.parent ? state.parent.trail_id + ' / ' + String(state.parent.fork_at).padStart(3, '0') : 'ORIGIN', state.parent ? 'parent trail' : null);
    var available = Boolean(state.imported);
    var replay = document.querySelector('[data-trail-action="replay"]');
    var fork = document.querySelector('[data-trail-action="fork"]');
    if (replay) replay.disabled = !available;
    if (fork) fork.disabled = !available;
    var hint = document.getElementById('trailLedgerHint');
    if (hint) hint.textContent = available
      ? 'Verified trail loaded. Replay and fork are available.'
      : 'Import or export a trail to enable replay and fork.';
    status = status || state.restoreNotice;
    if (status) document.getElementById('trailLedgerStatus').textContent = status;
  }

  function appendLedgerField(meta, label, value, copyField) {
    var term = document.createElement('dt');
    term.textContent = label;
    var detail = document.createElement('dd');
    detail.className = 'trail-ledger-value';
    var text = document.createElement('span');
    text.textContent = String(value);
    detail.appendChild(text);
    if (copyField) {
      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'trail-ledger-copy';
      copy.textContent = 'COPY';
      copy.dataset.copyField = copyField;
      copy.dataset.copyValue = String(value);
      copy.setAttribute('aria-label', 'Copy ' + copyField);
      detail.appendChild(copy);
    }
    meta.appendChild(term);
    meta.appendChild(detail);
  }

  function copyLedgerValue(button) {
    var value = button.dataset.copyValue || '';
    var field = button.dataset.copyField || 'value';
    var write = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(value)
      : new Promise(function (resolve, reject) {
          var area = document.createElement('textarea');
          area.value = value;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          try { document.execCommand('copy') ? resolve() : reject(new Error('Copy unavailable')); }
          catch (error) { reject(error); }
          area.remove();
        });
    return Promise.resolve(write).then(function () {
      var original = button.textContent;
      button.textContent = 'COPIED';
      var hint = document.getElementById('trailLedgerHint');
      if (hint) hint.textContent = field.toUpperCase() + ' COPIED.';
      setTimeout(function () { button.textContent = original; renderPanel(); }, 1200);
    }).catch(showError);
  }

  function showError(error) {
    renderPanel('REJECTED / ' + String(error && error.message || error).toUpperCase());
  }

  var panelFocus = null;

  function panelFocusables(panel) {
    return Array.from(panel.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null; });
  }

  function focusPanel(panel) {
    var items = panelFocusables(panel);
    (items[0] || panel).focus();
  }

  function trapPanelTab(event, panel) {
    if (event.code !== 'Tab') return false;
    var items = panelFocusables(panel);
    if (!items.length) {
      event.preventDefault();
      panel.focus();
      return true;
    }
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function openPanel() {
    ensurePanel();
    renderPanel();
    var panel = document.getElementById('trailLedgerOverlay');
    panelFocus = document.activeElement;
    panel.style.display = 'flex';
    panel.setAttribute('aria-hidden', 'false');
    setTimeout(function () { focusPanel(panel); }, 0);
  }

  function closePanel() {
    var panel = document.getElementById('trailLedgerOverlay');
    if (panel) {
      panel.style.display = 'none';
      panel.setAttribute('aria-hidden', 'true');
    }
    var restore = panelFocus;
    panelFocus = null;
    if (restore && typeof restore.focus === 'function') setTimeout(function () { restore.focus(); }, 0);
  }

  restore();
  window.openTrailLedger = openPanel;
  window.closeTrailLedger = closePanel;
  window.exportTrailManifest = exportTrail;
  window.exportLegacyTrailManifest = exportLegacyTrail;
  window.importTrailManifest = importTrail;
  window.replayTrailManifest = replayStep;
  window.forkTrailManifest = forkTrail;
  window.getTrailManifest = currentEnvelope;
  window.getLegacyTrailManifest = currentLegacyEnvelope;
  window.resetReproducibleTrail = resetTrail;
  window.getQuarantinedTrailDraft = quarantinedDraft;
  window.__r4b1tPrepareAuthorityRoll = prepareAuthorityRoll;
  window.__r4b1tProjectAuthorityTerminal = projectAuthorityTerminal;
  window.__r4b1tShowAuthorityTransaction = showAuthorityTransaction;

  document.addEventListener('DOMContentLoaded', function () {
    ensurePanel();
    watchSelections();
    var corpusReady = loadCorpusRevision();
    corpusReady.catch(showError);
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (wrapRoll()) {
        clearInterval(timer);
        corpusReady.then(function () {
          authorityReadyResolve(true);
        }, authorityReadyReject);
        return;
      }
      if (authorityOriginalCommit && window.__r4b1tCommitRoll && window.__r4b1tCommitRoll.__r4b1tAuthority) {
        clearInterval(timer);
        corpusReady.then(function () {
          authorityReadyResolve(true);
        }, authorityReadyReject);
        return;
      }
      if (attempts > 100) {
        clearInterval(timer);
        authorityReadyReject(new Error('ROLL authority bridge unavailable'));
      }
    }, 25);
  });

  document.addEventListener('keydown', function (event) {
    var panel = document.getElementById('trailLedgerOverlay');
    if (panel?.style.display === 'flex') {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePanel();
        return;
      }
      if (trapPanelTab(event, panel)) {
        event.stopImmediatePropagation();
        return;
      }
    }
    if ((event.code === 'Space' || event.code === 'KeyS') &&
        !event.target.closest('input, textarea, select, button, a') &&
        typeof window.roll === 'function' && window.roll.__r4b1tSeeded) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.roll();
    }
  }, true);

  document.addEventListener('r4b1t:navigation', function (event) {
    recordNavigation(event && event.detail);
  });
  document.addEventListener('r4b1t:reset', resetTrail);
})();
