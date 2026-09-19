(function (root) {
  'use strict';

  var SOURCE_FILE = 'source.json';
  var CARD_FILE = 'trail-card.json';
  var README_FILE = 'README.txt';

  function readme(card) {
    return [
      'r4b1t Trail Card portable bundle',
      '',
      'Evidence authority: ' + SOURCE_FILE,
      'Presentation only:  ' + CARD_FILE,
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

  function file(name, contents, type) {
    return new File([contents], name, { type: type });
  }

  function downloadFile(entry) {
    var url = URL.createObjectURL(entry);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = entry.name;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  async function buildCurrent(verifiedAt) {
    if (!root.buildTrailTopologyExport) throw new Error('No local topology artifacts available for Trail Card handoff');
    if (!root.R4b1tTrailCard) throw new Error('Trail Card projection core is unavailable');

    var stamp = verifiedAt || new Date().toISOString();
    var artifact = await root.buildTrailTopologyExport(stamp);
    var sourceText = JSON.stringify(artifact, null, 2) + '\n';
    var card = await root.R4b1tTrailCard.project(sourceText, { verified_at: stamp });

    var files = [
      file(SOURCE_FILE, sourceText, 'application/json'),
      file(CARD_FILE, JSON.stringify(card, null, 2) + '\n', 'application/json'),
      file(README_FILE, readme(card), 'text/plain')
    ];

    return { artifact: artifact, card: card, files: files };
  }

  async function shareCurrent(verifiedAt) {
    var bundle = await buildCurrent(verifiedAt);
    var shareData = {
      title: 'r4b1t Trail Card bundle',
      text: 'Canonical trail evidence plus presentation card. Re-verify source.json independently.',
      files: bundle.files
    };

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: bundle.files }))) {
      await navigator.share(shareData);
      return { method: 'share-sheet', card: bundle.card, files: bundle.files };
    }

    bundle.files.forEach(downloadFile);
    return { method: 'download', card: bundle.card, files: bundle.files };
  }

  root.R4b1tTrailCardShare = {
    buildCurrent: buildCurrent,
    shareCurrent: shareCurrent
  };
  root.shareCard = shareCurrent;
})(typeof globalThis !== 'undefined' ? globalThis : this);
