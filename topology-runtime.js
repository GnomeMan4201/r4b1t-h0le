(function () {
  'use strict';

  var api = window.R4b1tTopology;
  var wear = window.R4b1tWear;
  var blind = window.R4b1tBlind;
  if (!api || !wear || !blind) return;
  var STORAGE_KEY = 'r4b1t_topology_atlas_v1';
  var LIMIT = 64;
  var activeExportInputs = [];
  var currentGraph = null;

  function readAtlas() {
    try {
      var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeAtlas(values) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values.slice(-LIMIT)));
  }

  async function remember(input) {
    var verified = await api.verifyAny(input);
    var values = readAtlas().filter(function (item) { return item.trail_id !== verified.trail_id; });
    values.push(verified); writeAtlas(values); return verified;
  }

  function ensureOverlay() {
    if (document.getElementById('trailTopologyOverlay')) return;
    var style = document.createElement('style');
    style.textContent =
      '#trailTopologyOverlay{display:none;position:fixed;inset:0;z-index:10060;background:#090807f5;color:#e8e0d0;font-family:"DM Mono",monospace;overflow:auto}' +
      '#trailTopologyOverlay.open{display:block}.topology-shell{width:min(1040px,100%);min-height:100%;margin:auto;padding:24px}' +
      '.topology-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:1px solid #49312c;padding-bottom:16px;position:sticky;top:0;background:#090807fa;z-index:12}' +
      '.topology-kicker{font-size:9px;letter-spacing:.22em;color:#ff3333}.topology-title{font:58px/.9 "Bebas Neue",sans-serif;letter-spacing:.05em;margin:6px 0}' +
      '.topology-note{font-size:9px;line-height:1.6;color:#9a8f7a;max-width:620px}.topology-controls{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}' +
      '.topology-controls button{border:1px solid #49312c;background:#141210;color:#e8e0d0;padding:12px;font:9px "DM Mono",monospace;letter-spacing:.1em}.topology-controls .topology-sample{border-color:#cc1111;color:#ff3333}.topology-controls .topology-export{border-color:#8b7767}.topology-controls button:disabled{opacity:.45;cursor:not-allowed}' +
      '.topology-map{padding:28px 0 70px}.topology-empty{border:1px dashed #49312c;padding:30px;color:#9a8f7a;font-size:10px}' +
      '.topology-forest{display:grid;gap:28px}.topology-branch{position:relative;min-width:0}.topology-branch:focus{outline:2px solid #ff3333;outline-offset:6px}.topology-branch[aria-selected="true"]>.topology-node-wrap>.topology-card{border-color:#80564d}' +
      '.topology-node-wrap{position:relative;padding-left:28px}.topology-node-wrap:before{content:"";position:absolute;left:8px;top:0;bottom:-16px;width:2px;background:#49312c}.topology-node-wrap:after{content:"";position:absolute;left:8px;top:28px;width:20px;height:2px;background:#49312c}' +
      '.topology-children{margin:18px 0 0 34px;padding-left:20px;border-left:2px solid #49312c;display:grid;gap:22px}' +
      '.topology-parent-stub{margin:0 0 10px 28px;border:1px dashed #80564d;background:#0d0b0a;padding:9px 11px;font-size:8px;color:#cc9b7f;letter-spacing:.08em}' +
      '.topology-card{border:1px solid #49312c;background:#141210;padding:17px;box-shadow:7px 7px 0 #250b09}' +
      '.topology-card-head{display:flex;justify-content:space-between;gap:12px}.topology-id{font:28px "Bebas Neue",sans-serif;letter-spacing:.08em}.topology-format{font-size:8px;color:#ff3333;letter-spacing:.15em}' +
      '.topology-proof{display:inline-block;margin-top:8px;border:1px solid #49312c;padding:5px 7px;font-size:8px;letter-spacing:.12em;color:#e8e0d0}.topology-proof[data-proof-state="PARENT ABSENT"]{border-style:dashed;color:#cc9b7f}' +
      '.topology-meta{font-size:8px;color:#9a8f7a;margin-top:5px;overflow-wrap:anywhere}.topology-parent{margin:12px 0;padding:8px;border-left:3px solid #cc1111;background:#0d0b0a;font-size:8px;color:#9a8f7a}' +
      '.topology-parent.missing{border-left-style:dashed;color:#cc9b7f}.topology-wear{margin-top:14px}.topology-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:8px;color:#9a8f7a}.topology-legend b{color:#e8e0d0}' +
      '.topology-inspect{margin-top:14px;border:1px solid #49312c;background:#0d0b0a;color:#e8e0d0;padding:9px 11px;font:8px "DM Mono",monospace;letter-spacing:.12em}.topology-inspect:focus{outline:2px solid #ff3333;outline-offset:2px}' +
      '.topology-inspector{margin:0 0 24px;border:1px solid #49312c;background:#0d0b0a;padding:16px}.topology-inspector:focus{outline:2px solid #ff3333;outline-offset:2px}.topology-inspector[hidden]{display:none}.topology-inspector h3{font:28px "Bebas Neue",sans-serif;letter-spacing:.08em;margin:0 0 10px}.topology-inspector-grid{display:grid;grid-template-columns:minmax(110px,160px) 1fr;gap:7px 14px;font-size:8px;line-height:1.5}.topology-inspector-grid dt{color:#9a8f7a}.topology-inspector-grid dd{margin:0;overflow-wrap:anywhere}.topology-inspector-stops{margin-top:12px;border-top:1px solid #49312c;padding-top:10px;font-size:8px}.topology-inspector-stop{padding:5px 0;border-bottom:1px dotted #49312c}.topology-diagnostics{margin:0 0 24px;border:1px dashed #80564d;background:#0d0b0a;padding:12px;color:#cc9b7f;font-size:8px}.topology-diagnostics[hidden]{display:none}.topology-diagnostic{margin-top:6px;overflow-wrap:anywhere}' +
      '@media(max-width:600px){.topology-shell{padding:16px 13px}.topology-title{font-size:44px}.topology-head{position:static;display:block}.topology-controls{justify-content:flex-start;margin-top:12px}.topology-card-head{display:block}.topology-node-wrap{padding-left:18px}.topology-node-wrap:before{left:4px}.topology-node-wrap:after{left:4px;width:14px}.topology-children{margin-left:14px;padding-left:12px}.topology-parent-stub{margin-left:18px}}';
    document.head.appendChild(style);
    var overlay = document.createElement('section');
    overlay.id = 'trailTopologyOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'trailTopologyTitle');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('tabindex', '-1');
    overlay.innerHTML = '<div class="topology-shell"><header class="topology-head"><div><div class="topology-kicker">LOCAL ATLAS / VERIFIED SNAPSHOTS</div><h2 class="topology-title" id="trailTopologyTitle">TRAIL TOPOLOGY</h2><div class="topology-note">Geometry follows verified parent/fork structure only. Wear remains diagnostic: black-red blocks stay concealed, inherited paper continues to the fork, and divergent paper begins after it.</div></div><div class="topology-controls"><button class="topology-sample" type="button">VIEW SAMPLE</button><button class="topology-export" type="button">EXPORT TOPOLOGY</button><button class="topology-close" type="button">CLOSE</button></div></header><aside class="topology-inspector" id="trailTopologyInspector" aria-live="polite" hidden></aside><section class="topology-diagnostics" id="trailTopologyDiagnostics" aria-label="Rejected trail diagnostics" hidden></section><main class="topology-map" id="trailTopologyMap"></main><div class="topology-legend"><span><b>PAPER</b> REVEALED</span><span><b>BLACK-RED</b> CONCEALED</span><span><b>WHITE EDGE</b> INHERITED</span><span><b>RED EDGE</b> DIVERGENT</span></div></div>';
    overlay.querySelector('.topology-close').addEventListener('click', close);
    overlay.querySelector('.topology-sample').addEventListener('click', function () { sample().catch(showError); });
    overlay.querySelector('.topology-export').addEventListener('click', function () {
      exportCurrentTopology().catch(showError);
    });
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  function findParent(snapshot, graph) {
    if (!snapshot.parent || !snapshot.parent_known) return null;
    return graph.snapshots.find(function (candidate) { return candidate.trail_id === snapshot.parent.trail_id; }) || null;
  }

  function lineageForest(graph) {
    var byId = Object.create(null);
    var children = Object.create(null);
    graph.snapshots.forEach(function (snapshot) {
      byId[snapshot.trail_id] = snapshot;
      children[snapshot.trail_id] = [];
    });
    var roots = [];
    graph.snapshots.forEach(function (snapshot) {
      if (snapshot.parent && snapshot.parent_known && byId[snapshot.parent.trail_id]) {
        children[snapshot.parent.trail_id].push(snapshot);
      } else {
        roots.push(snapshot);
      }
    });
    return { roots: roots, byId: byId, children: children };
  }

  function renderProofBadge(state) {
    var badge = document.createElement('div');
    badge.className = 'topology-proof';
    badge.setAttribute('data-proof-state', state || 'VERIFIED');
    badge.textContent = 'PROOF / ' + (state || 'VERIFIED');
    return badge;
  }

  function textRow(grid, label, value) {
    var term = document.createElement('dt');
    term.textContent = label;
    var detail = document.createElement('dd');
    detail.textContent = value === null || typeof value === 'undefined' ? 'NONE' : String(value);
    grid.appendChild(term);
    grid.appendChild(detail);
  }

  function inspectNode(snapshot) {
    var panel = document.getElementById('trailTopologyInspector');
    if (!panel) return;
    panel.innerHTML = '';
    panel.hidden = false;
    panel.setAttribute('tabindex', '-1');
    panel.setAttribute('data-proof-state', snapshot.proof_state || 'VERIFIED');
    panel.setAttribute('data-trail-id', snapshot.trail_id);

    var title = document.createElement('h3');
    title.textContent = 'PROOF INSPECTOR / ' + snapshot.short_id;
    panel.appendChild(title);

    var grid = document.createElement('dl');
    grid.className = 'topology-inspector-grid';
    textRow(grid, 'ARTIFACT', snapshot.proof_state || 'VERIFIED');
    textRow(grid, 'FORMAT', snapshot.format);
    textRow(grid, 'TRAIL ID', snapshot.trail_id);
    textRow(grid, 'CREATED', snapshot.created_at);
    textRow(grid, 'TERRAIN', snapshot.terrain);
    textRow(grid, 'RELATIONSHIP', snapshot.relationship_state || 'ROOT');
    textRow(grid, 'PARENT ID', snapshot.parent ? snapshot.parent.trail_id : null);
    textRow(grid, 'FORK POSITION', snapshot.parent ? snapshot.parent.fork_at : null);
    panel.appendChild(grid);

    var stops = document.createElement('div');
    stops.className = 'topology-inspector-stops';
    var heading = document.createElement('div');
    heading.textContent = 'RECORDED STOPS / CATEGORICAL STATE';
    stops.appendChild(heading);
    snapshot.stops.forEach(function (stop) {
      var row = document.createElement('div');
      row.className = 'topology-inspector-stop';
      row.setAttribute('data-proof-state', stop.proof_state);
      row.textContent = String(stop.index).padStart(3, '0') + ' / ' + stop.proof_state +
        (stop.proof_state === 'REVEALED' && stop.url ? ' / ' + stop.url : '');
      stops.appendChild(row);
    });
    panel.appendChild(stops);
  }

  function renderDiagnostics(diagnostics) {
    var panel = document.getElementById('trailTopologyDiagnostics');
    if (!panel) return;
    panel.innerHTML = '';
    if (!diagnostics || !diagnostics.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var heading = document.createElement('strong');
    heading.textContent = 'REJECTED ARTIFACTS / NOT ADMITTED TO VERIFIED GRAPH';
    panel.appendChild(heading);
    diagnostics.forEach(function (diagnostic) {
      var row = document.createElement('div');
      row.className = 'topology-diagnostic';
      row.setAttribute('data-proof-state', 'REJECTED');
      row.textContent = 'REJECTED / ' + (diagnostic.trail_id || 'UNKNOWN TRAIL') + ' / ' + diagnostic.reason;
      panel.appendChild(row);
    });
  }

  function renderNode(snapshot, graph, forest, visited, depth) {
    if (visited[snapshot.trail_id]) return null;
    visited[snapshot.trail_id] = true;

    var branch = document.createElement('section');
    branch.className = 'topology-branch';
    branch.setAttribute('data-trail-id', snapshot.trail_id);
    branch.setAttribute('data-depth', String(depth));
    branch.setAttribute('data-proof-state', snapshot.proof_state || 'VERIFIED');
    branch.setAttribute('role', 'treeitem');
    branch.setAttribute('aria-level', String(depth + 1));
    branch.setAttribute('tabindex', '-1');
    branch.setAttribute('aria-selected', 'false');
    branch.setAttribute('aria-label', 'Trail ' + snapshot.short_id + ', proof ' + (snapshot.proof_state || 'VERIFIED') + ', depth ' + String(depth + 1));
    branch.addEventListener('keyup', function (event) {
      if (event.code === 'Space' || event.key === 'Space' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        event.stopPropagation();
        activateTreeItem(branch);
      }
    });

    if (snapshot.parent && snapshot.relationship_state === 'PARENT ABSENT') {
      var stub = document.createElement('div');
      stub.className = 'topology-parent-stub';
      stub.setAttribute('data-proof-state', 'PARENT ABSENT');
      stub.textContent = 'PARENT ABSENT / ' + api.shortId(snapshot.parent.trail_id) +
        ' / FORK ' + String(snapshot.parent.fork_at).padStart(3, '0');
      branch.appendChild(stub);
    }

    var nodeWrap = document.createElement('div');
    nodeWrap.className = 'topology-node-wrap';

    var parentSnapshot = findParent(snapshot, graph);
    var displayStops = wear.composeFork(snapshot, parentSnapshot);
    var card = document.createElement('article');
    card.className = 'topology-card';
    card.setAttribute('data-proof-state', snapshot.proof_state || 'VERIFIED');
    card.setAttribute('aria-label', 'Trail ' + snapshot.short_id + ', proof state ' + (snapshot.proof_state || 'VERIFIED'));

    var head = document.createElement('div');
    head.className = 'topology-card-head';
    var id = document.createElement('div');
    id.className = 'topology-id';
    id.textContent = 'TRAIL / ' + snapshot.short_id;
    var format = document.createElement('div');
    format.className = 'topology-format';
    format.textContent = snapshot.format.toUpperCase();
    head.appendChild(id);
    head.appendChild(format);
    card.appendChild(head);
    card.appendChild(renderProofBadge(snapshot.proof_state));

    var meta = document.createElement('div');
    meta.className = 'topology-meta';
    meta.textContent = snapshot.terrain + ' / ' + displayStops.length + ' VISIBLE SEGMENTS / DEPTH ' +
      String(depth).padStart(2, '0') + ' / ' + snapshot.created_at;
    card.appendChild(meta);

    if (snapshot.parent) {
      var parent = document.createElement('div');
      parent.className = 'topology-parent' + (snapshot.parent_known ? '' : ' missing');
      parent.setAttribute('data-proof-state', snapshot.relationship_state || 'PARENT ABSENT');
      parent.textContent = (snapshot.parent_known ? 'VERIFIED PARENT PRESENT / ' : 'DECLARED PARENT ABSENT / ') +
        api.shortId(snapshot.parent.trail_id) + ' / FORK ' + String(snapshot.parent.fork_at).padStart(3, '0');
      card.appendChild(parent);
    }

    var inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.className = 'topology-inspect';
    inspect.textContent = 'INSPECT PROOF';
    inspect.setAttribute('aria-label', 'Inspect proof for trail ' + snapshot.short_id);
    inspect.addEventListener('click', function () {
      selectTreeItem(branch);
      inspectNode(snapshot);
      var panel = document.getElementById('trailTopologyInspector');
      if (panel) panel.focus();
    });
    card.appendChild(inspect);

    var mount = document.createElement('div');
    mount.className = 'topology-wear';
    wear.render(mount, {
      stops: displayStops,
      parent: snapshot.parent,
      depth: displayStops.length,
      crease_count: displayStops.length + (snapshot.parent ? snapshot.parent.fork_at + 1 : 0),
      fold_size: Math.min(28, 4 + displayStops.length * 2)
    }, {
      onOpen: function (url) {
        if (typeof window.selectUrl === 'function') window.selectUrl(url);
        close();
      }
    });
    card.appendChild(mount);
    nodeWrap.appendChild(card);
    branch.appendChild(nodeWrap);

    var childNodes = forest.children[snapshot.trail_id] || [];
    if (childNodes.length) {
      var childrenMount = document.createElement('div');
      childrenMount.className = 'topology-children';
      childrenMount.setAttribute('role', 'group');
      childrenMount.setAttribute('aria-label', 'Verified child trails');
      childNodes.forEach(function (child) {
        var childBranch = renderNode(child, graph, forest, visited, depth + 1);
        if (childBranch) childrenMount.appendChild(childBranch);
      });
      branch.appendChild(childrenMount);
    }

    return branch;
  }

  function treeItems() {
    return Array.from(document.querySelectorAll('#trailTopologyMap [role="treeitem"]'));
  }

  function selectTreeItem(item) {
    treeItems().forEach(function (node) {
      var selected = node === item;
      node.setAttribute('aria-selected', selected ? 'true' : 'false');
      node.setAttribute('tabindex', selected ? '0' : '-1');
    });
  }

  function initializeTreeFocus() {
    var items = treeItems();
    if (!items.length) return;
    var selected = items.find(function (item) { return item.getAttribute('aria-selected') === 'true'; }) || items[0];
    selectTreeItem(selected);
  }

  function focusTreeItem(item) {
    if (!item) return false;
    selectTreeItem(item);
    item.focus();
    return true;
  }

  function directChildTreeItem(item) {
    var group = Array.from(item.children).find(function (child) {
      return child.getAttribute && child.getAttribute('role') === 'group';
    });
    if (!group) return null;
    return Array.from(group.children).find(function (child) {
      return child.getAttribute && child.getAttribute('role') === 'treeitem';
    }) || null;
  }

  function parentTreeItem(item) {
    var group = item.parentElement;
    if (!group || group.getAttribute('role') !== 'group') return null;
    return group.parentElement && group.parentElement.getAttribute('role') === 'treeitem'
      ? group.parentElement
      : null;
  }

  function snapshotForTreeItem(item) {
    var id = item && item.getAttribute('data-trail-id');
    return currentGraph && currentGraph.snapshots
      ? currentGraph.snapshots.find(function (snapshot) { return snapshot.trail_id === id; }) || null
      : null;
  }

  function activateTreeItem(item) {
    var snapshot = snapshotForTreeItem(item);
    if (!snapshot) return false;
    selectTreeItem(item);
    inspectNode(snapshot);
    var panel = document.getElementById('trailTopologyInspector');
    if (panel) panel.focus();
    return true;
  }

  function handleTreeKey(event) {
    var item = event.target && event.target.getAttribute &&
      event.target.getAttribute('role') === 'treeitem' ? event.target : null;
    if (!item) return false;

    var items = treeItems();
    var index = items.indexOf(item);
    var target = null;

    if (event.code === 'ArrowDown') target = items[Math.min(items.length - 1, index + 1)];
    else if (event.code === 'ArrowUp') target = items[Math.max(0, index - 1)];
    else if (event.code === 'Home') target = items[0];
    else if (event.code === 'End') target = items[items.length - 1];
    else if (event.code === 'ArrowRight') target = directChildTreeItem(item);
    else if (event.code === 'ArrowLeft') target = parentTreeItem(item);
    else if (event.code === 'Enter' || event.key === 'Enter') {
      event.preventDefault();
      return activateTreeItem(item);
    } else return false;

    event.preventDefault();
    return focusTreeItem(target || item);
  }

  function updateExportControl() {
    var button = document.querySelector('#trailTopologyOverlay .topology-export');
    if (!button) return;
    button.disabled = activeExportInputs.length === 0;
    button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
  }

  async function buildExportArtifact(createdAt) {
    if (!activeExportInputs.length) throw new Error('No local topology artifacts available for export');
    return api.exportTopology(activeExportInputs, { created_at: createdAt });
  }

  function downloadJson(filename, value) {
    var blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  async function exportCurrentTopology(createdAt) {
    var exportTime = createdAt || new Date().toISOString();
    var artifact = await buildExportArtifact(exportTime);
    var stamp = exportTime.replace(/[:.]/g, '-');
    downloadJson('r4b1t-topology-' + stamp + '.json', artifact);
    return artifact;
  }

  function render(graph, status) {
    ensureOverlay();
    currentGraph = graph;
    var map = document.getElementById('trailTopologyMap');
    map.innerHTML = '';
    var inspector = document.getElementById('trailTopologyInspector');
    if (inspector) { inspector.hidden = true; inspector.innerHTML = ''; }
    renderDiagnostics(graph.diagnostics || []);
    updateExportControl();
    if (status) {
      var banner = document.createElement('div');
      banner.className = 'topology-parent';
      banner.textContent = status;
      map.appendChild(banner);
    }
    if (!graph.snapshots.length) {
      map.innerHTML += '<div class="topology-empty">NO VERIFIED SNAPSHOTS IN THIS LOCAL ATLAS. CHOOSE VIEW SAMPLE TO INSPECT EVERY WEAR STATE.</div>';
      return;
    }

    var forest = lineageForest(graph);
    var mount = document.createElement('div');
    mount.className = 'topology-forest';
    mount.setAttribute('role', 'tree');
    mount.setAttribute('aria-label', 'Verified trail lineage');
    var visited = Object.create(null);

    forest.roots.forEach(function (root) {
      var branch = renderNode(root, graph, forest, visited, 0);
      if (branch) mount.appendChild(branch);
    });

    graph.snapshots.forEach(function (snapshot) {
      if (!visited[snapshot.trail_id]) {
        var branch = renderNode(snapshot, graph, forest, visited, 0);
        if (branch) mount.appendChild(branch);
      }
    });

    map.appendChild(mount);
    initializeTreeFocus();
  }

  async function validLocalGraph(current) {
    if (current) await remember(current);
    var valid = [], diagnostics = [], values = readAtlas();
    activeExportInputs = values.slice();
    for (var index = 0; index < values.length; index += 1) {
      var classified = await api.classify(values[index]);
      if (classified.proof_state === 'VERIFIED') valid.push(classified.snapshot);
      else diagnostics.push({
        proof_state: 'REJECTED',
        trail_id: classified.trail_id,
        reason: classified.reason
      });
    }
    writeAtlas(valid);
    var graph = await api.build(valid);
    graph.diagnostics = diagnostics;
    return graph;
  }

  var topologyFocus = null;

  function topologyFocusables(overlay) {
    return Array.from(overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null; });
  }

  function focusTopology(overlay) {
    var items = topologyFocusables(overlay);
    (items[0] || overlay).focus();
  }

  function trapTopologyTab(event, overlay) {
    if (event.code !== 'Tab') return false;
    var items = topologyFocusables(overlay);
    if (!items.length) {
      event.preventDefault();
      overlay.focus();
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

  function activateTopology(overlay) {
    topologyFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(function () { focusTopology(overlay); }, 0);
  }

  async function open(current) {
    ensureOverlay(); render(await validLocalGraph(current));
    activateTopology(document.getElementById('trailTopologyOverlay'));
  }

  async function sample() {
    ensureOverlay();
    activeExportInputs = [];
    updateExportControl();
    var parentManifest = await blind.create({
      created_at: '2026-09-14T20:00:00.000Z',
      corpus_revision: 'sha256:' + 'a'.repeat(64),
      terrain: 'SAMPLE / MIXED',
      trail_salt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    });
    var first = await blind.commit(parentManifest, 'https://example.org/revealed', 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE');
    parentManifest = await blind.reveal(first.manifest, first.secret);
    var second = await blind.commit(parentManifest, 'https://concealed.invalid/withheld', 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI');
    parentManifest = second.manifest;
    var parent = await blind.envelope(parentManifest);
    var childManifest = await blind.create({
      created_at: '2026-09-14T21:00:00.000Z',
      corpus_revision: 'sha256:' + 'a'.repeat(64),
      terrain: 'SAMPLE / FORK',
      trail_salt: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM',
      parent: {
        trail_id: parent.trail_id,
        genesis_id: parent.manifest.genesis_id,
        fork_at: 1,
        commitment: parent.manifest.steps[1].commitment
      }
    });
    var childStep = await blind.commit(childManifest, 'https://example.net/divergent', 'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ');
    childManifest = await blind.reveal(childStep.manifest, childStep.secret);
    var child = await blind.envelope(childManifest);
    render(await api.build([parent, child]), 'SAMPLE / VALID ARTIFACTS / NOT SAVED TO LOCAL ATLAS');
    activateTopology(document.getElementById('trailTopologyOverlay'));
  }

  function showError(error) {
    var map = document.getElementById('trailTopologyMap');
    if (map) map.textContent = 'REJECTED / ' + String(error && error.message || error).toUpperCase();
  }
  function close() {
    var overlay = document.getElementById('trailTopologyOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    var restore = topologyFocus;
    topologyFocus = null;
    if (restore && typeof restore.focus === 'function') setTimeout(function () { restore.focus(); }, 0);
  }
  function clear() { activeExportInputs = []; localStorage.removeItem(STORAGE_KEY); return open(); }

  window.openTrailTopology = open;
  window.openTrailWearSample = sample;
  window.closeTrailTopology = close;
  window.rememberTopologySnapshot = remember;
  window.clearTrailTopology = clear;
  window.exportTrailTopology = exportCurrentTopology;
  document.addEventListener('DOMContentLoaded', ensureOverlay);
  document.addEventListener('keydown', function (event) {
    var overlay = document.getElementById('trailTopologyOverlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    if (handleTreeKey(event)) {
      event.stopImmediatePropagation();
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (trapTopologyTab(event, overlay)) event.stopImmediatePropagation();
  }, true);
})();
