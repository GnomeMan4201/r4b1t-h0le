(function (root, factory) {
  'use strict';

  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.R4b1tCorpusAuthority = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var activeSource = Object.freeze({
    id: 'legacy-urls-v1',
    url: 'urls.txt',
    status: 'active',
    selectionAuthority: true
  });

  var candidateSource = Object.freeze({
    id: 'typed-candidate-v0.1',
    url: 'corpus/releases/typed-candidate-v0.1/urls.txt',
    resourcesUrl: 'corpus/releases/typed-candidate-v0.1/resources.json',
    manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json',
    status: 'candidate',
    selectionAuthority: false
  });

  function active() {
    return activeSource;
  }

  function candidate() {
    return candidateSource;
  }

  function activeFetchUrl(tag) {
    var value = String(tag || '').trim();
    if (!value) return activeSource.url;
    return activeSource.url + '?v=' + encodeURIComponent(value);
  }

  return Object.freeze({
    schema: 'r4b1t-runtime-corpus-authority-v1',
    active: active,
    candidate: candidate,
    activeFetchUrl: activeFetchUrl
  });
}));
