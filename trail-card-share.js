'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.R4b1tTrailCardShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FORMAT = 'r4b1t-trail-card/v0.1';
  const STATES = new Set(['VERIFIED', 'REJECTED', 'UNVERIFIED']);
  const SHA256 = /^sha256:[0-9a-f]{64}$/;
  const SOURCE_FILE = 'source.json';
  const CARD_FILE = 'trail-card.json';
  const README_FILE = 'README.txt';

  function exactBytes(input) {
    if (typeof input === 'string') return new TextEncoder().encode(input);
    if (input instanceof Uint8Array) return new Uint8Array(input);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
    throw new TypeError('Trail Card handoff requires exact source bytes');
  }

  async function sha256(bytes) {
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
      throw new Error('Web Crypto SHA-256 is unavailable');
    }
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return 'sha256:' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function validateCardShape(card) {
    if (!card || card.format !== FORMAT) throw new Error('Trail Card projection format is invalid');
    if (!card.source || !SHA256.test(card.source.artifact_digest || '')) {
      throw new Error('Trail Card source digest is invalid');
    }
    if (!card.verification || !STATES.has(card.verification.state)) {
      throw new Error('Trail Card verification state is invalid');
    }

    if (card.verification.state === 'VERIFIED') {
      if (card.verification.verified_digest !== card.source.artifact_digest || !card.display) {
        throw new Error('VERIFIED Trail Card is not bound to its source digest');
      }
    } else {
      if (card.verification.verified_digest !== null || card.display !== null) {
        throw new Error('Diagnostic Trail Card cannot claim verified display material');
      }
    }
  }

  async function validatePair(pair) {
    if (!pair || !Object.prototype.hasOwnProperty.call(pair, 'source_bytes') || !pair.card) {
      throw new TypeError('Trail Card handoff requires source_bytes and card');
    }
    const sourceBytes = exactBytes(pair.source_bytes);
    validateCardShape(pair.card);
    const digest = await sha256(sourceBytes);
    if (digest !== pair.card.source.artifact_digest) {
      throw new Error('Trail Card handoff source digest mismatch');
    }
    return { sourceBytes, card: JSON.parse(JSON.stringify(pair.card)), digest };
  }

  function readmeFor(card) {
    return [
      'r4b1t Trail Card point-to-point handoff',
      '',
      'Evidence authority: ' + SOURCE_FILE,
      'Presentation only:  ' + CARD_FILE,
      '',
      'Source format: ' + (card.source.artifact_format || 'unreadable'),
      'Source digest: ' + card.source.artifact_digest,
      'Card state:    ' + card.verification.state,
      '',
      'The Trail Card is presentation only and does not establish current integrity.',
      'Re-verify source.json locally with the applicable standalone verifier.',
      'This handoff creates no server-side share record or public collection.',
      ''
    ].join('\n');
  }

  async function bundleFiles(pair) {
    const checked = await validatePair(pair);
    return [
      {
        name: SOURCE_FILE,
        type: 'application/json',
        bytes: checked.sourceBytes,
      },
      {
        name: CARD_FILE,
        type: 'application/json',
        bytes: new TextEncoder().encode(JSON.stringify(checked.card, null, 2) + '\n'),
      },
      {
        name: README_FILE,
        type: 'text/plain',
        bytes: new TextEncoder().encode(readmeFor(checked.card)),
      },
    ];
  }

  function browserFiles(files) {
    if (typeof File !== 'function') return null;
    return files.map((entry) => new File([entry.bytes], entry.name, { type: entry.type }));
  }

  function revokeLater(url) {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function directDownload(entry) {
    const url = URL.createObjectURL(new Blob([entry.bytes], { type: entry.type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = entry.name;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    revokeLater(url);
  }

  async function copyArtifactInfo(pair) {
    const checked = await validatePair(pair);
    const text = [
      'format=' + (checked.card.source.artifact_format || 'unreadable'),
      'digest=' + checked.digest,
      'state=' + checked.card.verification.state,
    ].join('\n');

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return text;
    }

    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
    return text;
  }

  async function share(pair) {
    const files = await bundleFiles(pair);
    const nativeFiles = browserFiles(files);
    if (!nativeFiles || !navigator.share) return { shared: false, files };

    const payload = {
      title: 'r4b1t Trail Card handoff',
      text: 'Point-to-point Trail Card bundle. Re-verify source.json locally.',
      files: nativeFiles,
    };

    if (navigator.canShare && !navigator.canShare({ files: nativeFiles })) {
      return { shared: false, files };
    }

    await navigator.share(payload);
    return { shared: true, files };
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function button(label, action, className) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className || 'trail-card-handoff-button';
    el.textContent = label;
    el.addEventListener('click', action);
    return el;
  }

  async function showDownloads(panel, pair) {
    const files = await bundleFiles(pair);
    clearNode(panel);
    panel.hidden = false;
    const note = document.createElement('p');
    note.className = 'trail-card-handoff-note';
    note.textContent = 'Local files only. source.json remains the evidence authority.';
    panel.appendChild(note);
    for (const entry of files) {
      panel.appendChild(button('Download ' + entry.name, () => directDownload(entry), 'trail-card-handoff-file'));
    }
    const first = panel.querySelector('button');
    if (first) first.focus();
  }

  function mount(container, pair) {
    if (!container || typeof container.appendChild !== 'function') {
      throw new TypeError('Trail Card handoff requires a DOM container');
    }

    const cardState = pair && pair.card && pair.card.verification ? pair.card.verification.state : 'UNKNOWN';
    const root = document.createElement('section');
    root.className = 'trail-card-handoff';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Trail Card point-to-point handoff');
    root.dataset.proofState = cardState;

    const heading = document.createElement('div');
    heading.className = 'trail-card-handoff-heading';
    heading.textContent = 'POINT-TO-POINT HANDOFF — ' + cardState;

    const actions = document.createElement('div');
    actions.className = 'trail-card-handoff-actions';

    const panel = document.createElement('div');
    panel.className = 'trail-card-handoff-downloads';
    panel.hidden = true;
    panel.setAttribute('aria-live', 'polite');

    const status = document.createElement('div');
    status.className = 'trail-card-handoff-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    actions.appendChild(button('Export bundle', async () => {
      try {
        await showDownloads(panel, pair);
        status.textContent = 'Bundle ready for local download.';
      } catch (error) {
        status.textContent = error.message;
      }
    }));

    actions.appendChild(button('Share directly', async () => {
      try {
        const result = await share(pair);
        if (result.shared) {
          status.textContent = 'Handoff opened in the platform share sheet.';
        } else {
          await showDownloads(panel, pair);
          status.textContent = 'Share sheet unavailable. Local download fallback ready.';
        }
      } catch (error) {
        if (error && error.name === 'AbortError') {
          status.textContent = 'Share cancelled.';
        } else {
          status.textContent = error.message;
        }
      }
    }));

    actions.appendChild(button('Copy artifact info', async () => {
      try {
        await copyArtifactInfo(pair);
        status.textContent = 'Artifact format, digest, and proof state copied.';
      } catch (error) {
        status.textContent = error.message;
      }
    }));

    root.appendChild(heading);
    root.appendChild(actions);
    root.appendChild(panel);
    root.appendChild(status);
    container.appendChild(root);
    return root;
  }

  return {
    SOURCE_FILE,
    CARD_FILE,
    README_FILE,
    validatePair,
    bundleFiles,
    copyArtifactInfo,
    share,
    mount,
  };
});
