(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tTrailCardShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ALLOWED_FILES = ['README.txt', 'source.json', 'trail-card.json'];

  function bytes(value) {
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string') return new TextEncoder().encode(value);
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return new Uint8Array(value);
    throw new TypeError('Trail Card share file must be bytes or text');
  }

  function assertBundle(bundle) {
    if (!bundle || !bundle.card || !bundle.files) {
      throw new TypeError('Trail Card share requires a portable bundle');
    }
    if (!bundle.card.source || typeof bundle.card.source.artifact_digest !== 'string') {
      throw new TypeError('Trail Card share requires a source digest');
    }
    var names = Object.keys(bundle.files).sort();
    for (var i = 0; i < names.length; i += 1) {
      if (ALLOWED_FILES.indexOf(names[i]) === -1) {
        throw new TypeError('Trail Card share bundle contains unsupported file: ' + names[i]);
      }
    }
    if (names.indexOf('source.json') === -1 || names.indexOf('trail-card.json') === -1) {
      throw new TypeError('Trail Card share bundle is missing required files');
    }
  }

  function fileType(name) {
    if (/\.json$/i.test(name)) return 'application/json';
    return 'text/plain';
  }

  function makeFiles(bundle) {
    assertBundle(bundle);
    return Object.keys(bundle.files).sort().map(function (name) {
      return new File([bytes(bundle.files[name])], name, { type: fileType(name) });
    });
  }

  function download(bundle) {
    assertBundle(bundle);
    var names = Object.keys(bundle.files).sort();
    names.forEach(function (name) {
      var blob = new Blob([bytes(bundle.files[name])], { type: fileType(name) });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
    return names.slice();
  }

  async function copyDigest(bundle) {
    assertBundle(bundle);
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      throw new Error('Clipboard API unavailable');
    }
    var digest = bundle.card.source.artifact_digest;
    await navigator.clipboard.writeText(digest);
    return digest;
  }

  async function share(bundle) {
    assertBundle(bundle);
    if (typeof navigator.share !== 'function') {
      return { status: 'unsupported', files: [] };
    }

    var files = makeFiles(bundle);
    var payload = {
      title: 'r4b1t Trail Card bundle',
      text: 'Source artifact + presentation card. Re-verify source.json independently.',
      files: files
    };

    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: files })) {
      return { status: 'unsupported', files: [] };
    }

    await navigator.share(payload);
    return { status: 'shared', files: files.map(function (file) { return file.name; }) };
  }

  function controls(container, bundle) {
    assertBundle(bundle);
    if (!container || !container.ownerDocument) {
      throw new TypeError('Trail Card share controls require a DOM container');
    }
    var doc = container.ownerDocument;
    var wrap = doc.createElement('div');
    wrap.className = 'trail-card-handoff';
    wrap.setAttribute('aria-label', 'Trail Card handoff');

    function button(label, action, className) {
      var node = doc.createElement('button');
      node.type = 'button';
      node.className = 'trail-card-handoff-button ' + className;
      node.textContent = label;
      node.addEventListener('click', action);
      return node;
    }

    var status = doc.createElement('div');
    status.className = 'trail-card-handoff-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    wrap.appendChild(button('DOWNLOAD BUNDLE', function () {
      var names = download(bundle);
      status.textContent = 'Downloaded ' + names.length + ' bundle files.';
    }, 'trail-card-download'));

    wrap.appendChild(button('COPY DIGEST', async function () {
      try {
        await copyDigest(bundle);
        status.textContent = 'Source digest copied.';
      } catch (_) {
        status.textContent = 'Clipboard unavailable.';
      }
    }, 'trail-card-copy-digest'));

    if (typeof navigator.share === 'function') {
      wrap.appendChild(button('SHARE BUNDLE', async function () {
        try {
          var result = await share(bundle);
          status.textContent = result.status === 'shared'
            ? 'Bundle handed to the platform share sheet.'
            : 'File sharing is not supported by this browser.';
        } catch (error) {
          if (error && error.name === 'AbortError') {
            status.textContent = 'Share canceled.';
          } else {
            status.textContent = 'Share failed.';
          }
        }
      }, 'trail-card-platform-share'));
    }

    wrap.appendChild(status);
    container.appendChild(wrap);
    return wrap;
  }

  return {
    ALLOWED_FILES: ALLOWED_FILES.slice(),
    makeFiles: makeFiles,
    download: download,
    copyDigest: copyDigest,
    share: share,
    controls: controls
  };
});
