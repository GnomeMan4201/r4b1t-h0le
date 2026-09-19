(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.R4b1tTrailCardShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var ALLOWED_FILES = ['README.txt', 'source.json', 'trail-card.json'];
  var CARD_FORMAT = 'r4b1t-trail-card/v0.1';
  var TRAIL_FORMAT = 'r4b1t-trail/v0.1';
  var NOTICE = 'Verification applies to the source artifact identified by artifact_digest, not to this card representation. Re-verify the source artifact to confirm current validity.';
  var DIAGNOSTIC_NOTICE = 'THIS CARD DOES NOT ESTABLISH TRAIL INTEGRITY.';
  var SHA256 = /^sha256:[0-9a-f]{64}$/;

  function bytes(value) {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (typeof value === 'string') return new TextEncoder().encode(value);
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return new Uint8Array(value);
    throw new TypeError('Trail Card handoff file must be exact bytes or text');
  }

  function text(value) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes(value));
  }

  async function digestOf(value) {
    var input = bytes(value);
    if (root.R4b1tTrail && typeof root.R4b1tTrail.sha256Hex === 'function') {
      return 'sha256:' + await root.R4b1tTrail.sha256Hex(input);
    }
    if (!root.crypto || !root.crypto.subtle) throw new Error('SHA-256 is unavailable');
    var digest = await root.crypto.subtle.digest('SHA-256', input);
    return 'sha256:' + Array.from(new Uint8Array(digest), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + canonical(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function artifactFormat(value) {
    return value && value.manifest && typeof value.manifest.format === 'string'
      ? value.manifest.format
      : value && typeof value.format === 'string' ? value.format : null;
  }

  function parentRef(parent) {
    return parent ? { trail_id: parent.trail_id, fork_at: parent.fork_at } : null;
  }

  function trailDisplay(snapshot) {
    var manifest = snapshot.manifest;
    var stops = manifest.routes.map(function (_, index) { return { index: index, state: 'revealed' }; });
    return {
      kind: 'trail',
      trail_id: snapshot.trail_id,
      manifest_format: manifest.format,
      genesis_id: null,
      stop_count: stops.length,
      concealed_count: 0,
      revealed_count: stops.length,
      parent: parentRef(manifest.parent),
      stops: stops
    };
  }

  function diagnostic(source, state, verifiedAt, reason) {
    return {
      format: CARD_FORMAT,
      source: source,
      verification: {
        state: state,
        verified_digest: null,
        verified_at: verifiedAt,
        verifier: state === 'UNVERIFIED' ? 'r4b1t-card-verifier/v0.1' : 'r4b1t-trail-verifier/v0.1',
        reason: reason
      },
      display: null,
      notice: NOTICE,
      diagnostic_notice: DIAGNOSTIC_NOTICE
    };
  }

  function verificationTime(value) {
    if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
      throw new TypeError('Trail Card handoff verified_at must be an explicit ISO timestamp');
    }
    return value;
  }

  async function projectTrail(sourceInput, options) {
    options = options || {};
    var sourceBytes = bytes(sourceInput);
    var digest = await digestOf(sourceBytes);
    var value;
    try {
      value = JSON.parse(text(sourceBytes));
    } catch (error) {
      return diagnostic(
        { artifact_format: null, artifact_digest: digest },
        'REJECTED',
        verificationTime(options.verified_at),
        error && error.message ? error.message : String(error)
      );
    }

    var format = artifactFormat(value);
    var source = { artifact_format: format, artifact_digest: digest };
    if (format !== TRAIL_FORMAT || !root.R4b1tTrail || typeof root.R4b1tTrail.verify !== 'function') {
      return diagnostic(source, 'UNVERIFIED', null, 'Unsupported source artifact format');
    }

    var verifiedAt = verificationTime(options.verified_at);
    try {
      var verified = await root.R4b1tTrail.verify(value);
      return {
        format: CARD_FORMAT,
        source: source,
        verification: {
          state: 'VERIFIED',
          verified_digest: digest,
          verified_at: verifiedAt,
          verifier: 'r4b1t-trail-verifier/v0.1',
          reason: null
        },
        display: trailDisplay(verified),
        notice: NOTICE
      };
    } catch (error) {
      return diagnostic(
        source,
        'REJECTED',
        verifiedAt,
        error && error.message ? error.message : String(error)
      );
    }
  }

  function readmeFor(card) {
    return [
      'r4b1t Trail Card portable bundle',
      '',
      'Evidence authority: source.json',
      'Presentation only:  trail-card.json',
      '',
      'Source format: ' + (card.source.artifact_format || 'unreadable'),
      'Source digest: ' + card.source.artifact_digest,
      'Card state:    ' + card.verification.state,
      '',
      'The Trail Card is not evidence authority.',
      'Re-verify source.json with the applicable standalone verifier.',
      'A detached card documents a render-time claim only.',
      ''
    ].join('\n');
  }

  async function createTrailBundle(sourceInput, options) {
    var sourceBytes = bytes(sourceInput);
    var card = await projectTrail(sourceBytes, options);
    return {
      card: card,
      files: {
        'source.json': sourceBytes,
        'trail-card.json': new TextEncoder().encode(JSON.stringify(card, null, 2) + '\n'),
        'README.txt': new TextEncoder().encode(readmeFor(card))
      }
    };
  }

  function assertBundleShape(bundle) {
    if (!bundle || !bundle.card || !bundle.files) {
      throw new TypeError('Trail Card handoff requires a portable bundle');
    }
    var names = Object.keys(bundle.files).sort();
    for (var i = 0; i < names.length; i += 1) {
      if (ALLOWED_FILES.indexOf(names[i]) === -1) {
        throw new TypeError('Trail Card handoff bundle contains unsupported file: ' + names[i]);
      }
    }
    if (canonical(names) !== canonical(ALLOWED_FILES.slice().sort())) {
      throw new TypeError('Trail Card handoff requires exactly README.txt, source.json, and trail-card.json');
    }
    if (!bundle.card.source || !SHA256.test(bundle.card.source.artifact_digest || '')) {
      throw new TypeError('Trail Card handoff requires a valid source digest');
    }
  }

  async function validateBundle(bundle) {
    assertBundleShape(bundle);
    var storedCard;
    try {
      storedCard = JSON.parse(text(bundle.files['trail-card.json']));
    } catch (_) {
      throw new Error('Trail Card handoff projection is unreadable');
    }
    if (canonical(storedCard) !== canonical(bundle.card)) {
      throw new Error('Trail Card handoff projection does not match the supplied card');
    }
    if (storedCard.format !== CARD_FORMAT || storedCard.notice !== NOTICE) {
      throw new Error('Trail Card handoff projection is not governed by Trail Cards v1');
    }
    if (storedCard.verification.state !== 'VERIFIED' && storedCard.diagnostic_notice !== DIAGNOSTIC_NOTICE) {
      throw new Error('Trail Card handoff diagnostic notice is missing');
    }

    var digest = await digestOf(bundle.files['source.json']);
    if (storedCard.source.artifact_digest !== digest) {
      throw new Error('Trail Card handoff source digest mismatch');
    }
    if (storedCard.verification.state === 'VERIFIED' && storedCard.verification.verified_digest !== digest) {
      throw new Error('Trail Card handoff verified digest mismatch');
    }
    var fresh = await projectTrail(bundle.files['source.json'], {
      verified_at: storedCard.verification.verified_at
    });
    if (canonical(fresh) !== canonical(storedCard)) {
      throw new Error('Trail Card handoff projection does not match fresh source verification');
    }
    return storedCard;
  }

  function fileType(name) {
    return /\.json$/i.test(name) ? 'application/json' : 'text/plain';
  }

  async function makeFiles(bundle) {
    await validateBundle(bundle);
    return ALLOWED_FILES.slice().sort().map(function (name) {
      return new File([bytes(bundle.files[name])], name, { type: fileType(name) });
    });
  }

  async function download(bundle) {
    await validateBundle(bundle);
    var names = ALLOWED_FILES.slice().sort();
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
    return names;
  }

  async function copyDigest(bundle) {
    var card = await validateBundle(bundle);
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(card.source.artifact_digest);
    return card.source.artifact_digest;
  }

  async function share(bundle) {
    assertBundleShape(bundle);
    if (typeof navigator.share !== 'function') return { status: 'unsupported', files: [] };
    var files = await makeFiles(bundle);
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: files })) {
      return { status: 'unsupported', files: [] };
    }
    await navigator.share({
      title: 'r4b1t Trail Card bundle',
      text: 'Source artifact + presentation card. Re-verify source.json independently.',
      files: files
    });
    return { status: 'shared', files: files.map(function (file) { return file.name; }) };
  }

  function controls(container, bundle) {
    assertBundleShape(bundle);
    if (!container || !container.ownerDocument) {
      throw new TypeError('Trail Card handoff controls require a DOM container');
    }
    var doc = container.ownerDocument;
    var wrap = doc.createElement('div');
    wrap.className = 'trail-card-handoff';
    wrap.setAttribute('role', 'group');
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

    wrap.appendChild(button('DOWNLOAD BUNDLE', async function () {
      try {
        var names = await download(bundle);
        status.textContent = 'Downloaded ' + names.length + ' bundle files.';
      } catch (_) { status.textContent = 'Bundle validation failed.'; }
    }, 'trail-card-download'));

    wrap.appendChild(button('COPY DIGEST', async function () {
      try {
        await copyDigest(bundle);
        status.textContent = 'Source digest copied.';
      } catch (_) { status.textContent = 'Digest copy unavailable.'; }
    }, 'trail-card-copy-digest'));

    if (typeof navigator.share === 'function') {
      wrap.appendChild(button('SHARE BUNDLE', async function () {
        try {
          var result = await share(bundle);
          status.textContent = result.status === 'shared'
            ? 'Bundle handed to the platform share sheet.'
            : 'File sharing is not supported by this browser.';
        } catch (error) {
          status.textContent = error && error.name === 'AbortError' ? 'Share canceled.' : 'Share failed.';
        }
      }, 'trail-card-platform-share'));
    }

    wrap.appendChild(status);
    container.appendChild(wrap);
    return wrap;
  }

  return {
    ALLOWED_FILES: ALLOWED_FILES.slice(),
    createTrailBundle: createTrailBundle,
    validateBundle: validateBundle,
    makeFiles: makeFiles,
    download: download,
    copyDigest: copyDigest,
    share: share,
    controls: controls
  };
});
