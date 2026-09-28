'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'corpus-authority.js');
const PROMOTION = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'corpus', 'runtime', 'active-v1.json'), 'utf8'),
);
const LEGACY_DIGEST = 'sha256:5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41';
const ACTIVE_DIGEST = 'sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1';

function freshAuthority() {
  delete require.cache[require.resolve(MODULE)];
  return require(MODULE);
}

function responseFor(buffer) {
  const bytes = Buffer.from(buffer);
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

test('runtime corpus authority promotes the typed release explicitly', () => {
  const authority = freshAuthority();
  assert.equal(authority.schema, 'r4b1t-runtime-corpus-authority-v3');
  assert.deepEqual(authority.active(), {
    id: 'typed-candidate-v0.1',
    releaseId: 'typed-candidate-v0.1',
    url: 'corpus/releases/typed-candidate-v0.1/urls.txt',
    resourcesUrl: 'corpus/releases/typed-candidate-v0.1/resources.json',
    manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json',
    expectedDigest: ACTIVE_DIGEST,
    promotionId: 'typed-candidate-v0.1-active-v1',
    status: 'active',
    selectionAuthority: true,
  });
  assert.equal(authority.promotion().id, PROMOTION.promotion_id);
});

test('release assertion remains historically non-authoritative', () => {
  const authority = freshAuthority();
  assert.deepEqual(authority.candidate(), {
    id: 'typed-candidate-v0.1',
    url: 'corpus/releases/typed-candidate-v0.1/urls.txt',
    resourcesUrl: 'corpus/releases/typed-candidate-v0.1/resources.json',
    manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json',
    expectedDigest: ACTIVE_DIGEST,
    status: 'candidate',
    selectionAuthority: false,
  });
  assert.equal(PROMOTION.release_assertion.selection_authority, false);
  assert.equal(PROMOTION.active.selection_authority, true);
});

test('legacy corpus remains immutable rollback material only', () => {
  const authority = freshAuthority();
  assert.deepEqual(authority.legacy(), {
    id: 'legacy-urls-v1',
    url: 'urls.txt',
    expectedDigest: LEGACY_DIGEST,
    status: 'rollback',
    selectionAuthority: false,
  });
  assert.equal(PROMOTION.rollback.expected_digest, LEGACY_DIGEST);
});

test('shared active loader verifies exact promoted bytes and caches one page-session load', async () => {
  const authority = freshAuthority();
  const bytes = fs.readFileSync(
    path.join(ROOT, 'corpus', 'releases', 'typed-candidate-v0.1', 'urls.txt'),
  );
  let calls = 0;

  const first = await authority.loadActive({
    fetch: async url => {
      calls += 1;
      assert.match(String(url), /corpus\/releases\/typed-candidate-v0\.1\/urls\.txt\?v=/);
      return responseFor(bytes);
    },
  });
  const second = await authority.loadActive({
    fetch: async () => {
      throw new Error('shared loader fetched active corpus twice');
    },
  });

  assert.strictEqual(second, first);
  assert.equal(calls, 1);
  assert.equal(first.revision, ACTIVE_DIGEST);
  assert.equal(first.source.id, 'typed-candidate-v0.1');
  assert.equal(first.urls.length, 841);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.urls), true);
});

test('shared active loader fails closed on digest mismatch and never falls back', async () => {
  const authority = freshAuthority();
  let calls = 0;

  await assert.rejects(
    authority.loadActive({
      fetch: async () => {
        calls += 1;
        return responseFor(Buffer.from('https://tampered.example/\n', 'utf8'));
      },
    }),
    /digest mismatch/i,
  );

  await assert.rejects(
    authority.loadActive({
      fetch: async () => {
        calls += 1;
        return responseFor(Buffer.from('https://tampered-again.example/\n', 'utf8'));
      },
    }),
    /digest mismatch/i,
  );

  assert.equal(calls, 2);
  assert.equal(authority.active().id, 'typed-candidate-v0.1');
  assert.equal(authority.legacy().selectionAuthority, false);
});

test('authority and promotion descriptors are deeply immutable', () => {
  const authority = freshAuthority();
  for (const descriptor of [
    authority.active(),
    authority.candidate(),
    authority.legacy(),
    authority.promotion(),
  ]) {
    assert.equal(Object.isFrozen(descriptor), true);
  }
  assert.equal(Object.isFrozen(authority), true);
  assert.throws(() => {
    authority.active().selectionAuthority = false;
  }, TypeError);
  assert.equal(authority.active().selectionAuthority, true);
});
