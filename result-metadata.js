(function (root) {
  'use strict';

  var sequence = 0;

  function byId(id) {
    return root.document ? root.document.getElementById(id) : null;
  }

  function currentUrl() {
    var node = byId('previewUrl');
    var value = node ? node.textContent.trim() : '';
    return value && value !== '—' ? value : '';
  }

  function humanize(value) {
    return String(value || '').replace(/_/g, ' ').trim().toUpperCase();
  }

  function sourceState(state) {
    var host = byId('typedResourceMeta');
    if (!host) return;
    host.dataset.state = state;
    host.hidden = state !== 'verified';
  }

  function clearNodes(state) {
    sequence += 1;
    ['typedResourceType', 'typedEligibilityReason', 'typedProvenance'].forEach(function (id) {
      var node = byId(id);
      if (node) node.textContent = '';
    });
    sourceState(state || 'idle');
    if (typeof root.__r4b1tSyncMobileRoute === 'function') {
      root.__r4b1tSyncMobileRoute();
    }
  }

  async function render(url) {
    var token = ++sequence;
    var authority = root.R4b1tCorpusAuthority;

    ['typedResourceType', 'typedEligibilityReason', 'typedProvenance'].forEach(function (id) {
      var node = byId(id);
      if (node) node.textContent = '';
    });
    sourceState('loading');

    if (!authority || typeof authority.resourceFor !== 'function' || !url) {
      sourceState('unavailable');
      return null;
    }

    try {
      var record = await authority.resourceFor(url);
      if (token !== sequence || currentUrl() !== url) return null;

      if (!record) {
        sourceState('missing');
        if (typeof root.__r4b1tSyncMobileRoute === 'function') root.__r4b1tSyncMobileRoute();
        return null;
      }

      var type = byId('typedResourceType');
      var reason = byId('typedEligibilityReason');
      var provenance = byId('typedProvenance');
      if (type) type.textContent = humanize(record.resource_type);
      if (reason) reason.textContent = humanize(record.eligibility_reason);
      if (provenance) provenance.textContent = record.provenance;
      sourceState('verified');

      if (typeof root.__r4b1tSyncMobileRoute === 'function') {
        root.__r4b1tSyncMobileRoute();
      }
      return record;
    } catch (_) {
      if (token !== sequence || currentUrl() !== url) return null;
      sourceState('unavailable');
      if (typeof root.__r4b1tSyncMobileRoute === 'function') {
        root.__r4b1tSyncMobileRoute();
      }
      return null;
    }
  }

  function clear() {
    clearNodes('idle');
  }

  if (root.document) {
    root.document.addEventListener('r4b1t:reset', clear);
  }

  root.R4b1tResultMetadata = Object.freeze({
    render: render,
    clear: clear
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
