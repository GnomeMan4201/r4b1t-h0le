'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const trail = require('../trail-manifest.js');
const comparison = require('../trail-comparison.js');
const bundle = require('../trail-comparison-bundle.js');

const CORPUS = 'sha256:' + 'c'.repeat(64);

async function snapshot(urls, seed, parent) {
  const manifest = await trail.createManifest({
    created_at: '2026-09-19T23:30:00.000Z',
    corpus_revision: CORPUS,
    seed,
    terrain: 'RESEARCH',
    routes: urls.map((url) => ({ url, action: 'ROLL' })),
    parent: parent || null,
  });
  return trail.envelope(manifest);
}

test('comparison bundle preserves both exact canonical source byte sequences', async () => {
  const left = JSON.stringify(await snapshot(['https://example.org/a'], 'left'), null, 2) + '\n';
  const right = JSON.stringify(await snapshot(['https://example.org/a', 'https://example.org/b'], 'right'));

  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-19T23:31:00.000Z',
  });

  assert.deepEqual(bundle.fileNames(portable), [
    'README.txt',
    'left-source.json',
    'right-source.json',
    'trail-comparison.json',
  ]);
  assert.equal(Buffer.from(portable.files['left-source.json']).toString('utf8'), left);
  assert.equal(Buffer.from(portable.files['right-source.json']).toString('utf8'), right);
  assert.equal(portable.projection.sources.left.artifact_digest, await comparison.digestOf(new TextEncoder().encode(left)));
  assert.equal(portable.projection.sources.right.artifact_digest, await comparison.digestOf(new TextEncoder().encode(right)));
});

test('comparison bundle is a file set and not a new evidence manifest', async () => {
  const left = JSON.stringify(await snapshot(['https://example.org/a'], 'left-manifest'));
  const right = JSON.stringify(await snapshot(['https://example.org/b'], 'right-manifest'));
  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-19T23:32:00.000Z',
  });

  for (const name of bundle.fileNames(portable)) {
    assert.doesNotMatch(name, /evidence|proof|bundle-manifest/i);
  }
  assert.equal(Object.prototype.hasOwnProperty.call(portable.projection, 'bundle_format'), false);
});

test('bundle inspection validates stored digest binding and freshly recomputes comparison', async () => {
  const left = JSON.stringify(await snapshot(['https://example.org/a'], 'left-inspect'));
  const right = JSON.stringify(await snapshot(['https://example.org/a', 'https://example.org/right'], 'right-inspect'));

  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-19T23:33:00.000Z',
  });
  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-19T23:34:00.000Z',
  });

  assert.equal(inspected.left_source_matches, true);
  assert.equal(inspected.right_source_matches, true);
  assert.equal(inspected.stored_projection.comparison.shared_prefix_length, 1);
  assert.equal(inspected.fresh_projection.comparison.shared_prefix_length, 1);
  assert.equal(inspected.fresh_projection.verification.left.verified_at, '2026-09-19T23:34:00.000Z');
  assert.equal(inspected.fresh_projection.verification.right.verified_at, '2026-09-19T23:34:00.000Z');
});

test('inspection rejects changed left source bytes', async () => {
  const left = JSON.stringify(await snapshot(['https://example.org/a'], 'left-tamper'));
  const right = JSON.stringify(await snapshot(['https://example.org/b'], 'right-tamper'));
  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-19T23:35:00.000Z',
  });
  portable.files['left-source.json'] = new TextEncoder().encode(left + ' ');

  await assert.rejects(
    () => bundle.inspect(portable, { verified_at: '2026-09-19T23:36:00.000Z' }),
    /left source digest mismatch/,
  );
});

test('inspection rejects changed right source bytes', async () => {
  const left = JSON.stringify(await snapshot(['https://example.org/a'], 'left-tamper-r'));
  const right = JSON.stringify(await snapshot(['https://example.org/b'], 'right-tamper-r'));
  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-19T23:37:00.000Z',
  });
  portable.files['right-source.json'] = new TextEncoder().encode(right + ' ');

  await assert.rejects(
    () => bundle.inspect(portable, { verified_at: '2026-09-19T23:38:00.000Z' }),
    /right source digest mismatch/,
  );
});

test('inspection rejects edited stored projection digest even when projection remains internally shaped', async () => {
  const left = JSON.stringify(await snapshot(['https://example.org/a'], 'left-proj'));
  const right = JSON.stringify(await snapshot(['https://example.org/b'], 'right-proj'));
  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-19T23:39:00.000Z',
  });

  const projection = JSON.parse(Buffer.from(portable.files['trail-comparison.json']).toString('utf8'));
  projection.sources.left.artifact_digest = 'sha256:' + 'e'.repeat(64);
  projection.verification.left.verified_digest = projection.sources.left.artifact_digest;
  portable.files['trail-comparison.json'] = new TextEncoder().encode(JSON.stringify(projection));

  await assert.rejects(
    () => bundle.inspect(portable, { verified_at: '2026-09-19T23:40:00.000Z' }),
    /left source digest mismatch/,
  );
});

test('diagnostic comparison remains diagnostic through bundle creation and inspection', async () => {
  const left = await snapshot(['https://example.org/a'], 'left-diag');
  const right = await snapshot(['https://example.org/b'], 'right-diag');
  right.manifest.routes[0].url = 'https://attacker.invalid/';

  const portable = await bundle.create(JSON.stringify(left), JSON.stringify(right), {
    verified_at: '2026-09-19T23:41:00.000Z',
  });
  assert.equal(portable.projection.verification.right.state, 'REJECTED');
  assert.equal(portable.projection.comparison, null);

  const inspected = await bundle.inspect(portable, {
    verified_at: '2026-09-19T23:42:00.000Z',
  });
  assert.equal(inspected.stored_projection.verification.right.state, 'REJECTED');
  assert.equal(inspected.fresh_projection.verification.right.state, 'REJECTED');
  assert.equal(inspected.fresh_projection.comparison, null);
});

test('README keeps both canonical sources authoritative and projection derived', async () => {
  const left = JSON.stringify(await snapshot(['https://example.org/a'], 'left-readme'));
  const right = JSON.stringify(await snapshot(['https://example.org/b'], 'right-readme'));
  const portable = await bundle.create(left, right, {
    verified_at: '2026-09-19T23:43:00.000Z',
  });
  const readme = Buffer.from(portable.files['README.txt']).toString('utf8');

  assert.match(readme, /Authority: left-source\.json/);
  assert.match(readme, /Authority: right-source\.json/);
  assert.match(readme, /Derived presentation: trail-comparison\.json/);
  assert.match(readme, /Re-verify both source files/);
});

test('comparison bundle has no network, account, storage, social, ranking, or selection hooks', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'trail-comparison-bundle.js'), 'utf8').toLowerCase();

  for (const forbidden of [
    'fetch(', 'xmlhttprequest', 'websocket', 'localstorage', 'sessionstorage',
    'account', 'login', 'gallery', 'view_count', 'like_count', 'follower',
    'trending', 'popularity', 'recommendation', 'sampler', 'selection_weight',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
