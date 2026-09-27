'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const MODULE = path.resolve(__dirname, '..', 'corpus-authority.js');
const LEGACY_DIGEST = 'sha256:5d7339b8cbfe7bd35bb8502ca753e5b4663bc2fc4ba3721b23b791dbace01c41';
const CANDIDATE_DIGEST = 'sha256:5bb70a7289ca6048275737ed771720e4e7d76c33bbd9fb34c3bc092956a693d1';

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

test('runtime corpus authority keeps legacy corpus active with an exact digest', () => {
  const authority = freshAuthority();
  assert.equal(authority.schema, 'r4b1t-runtime-corpus-authority-v2');
  assert.deepEqual(authority.active(), {
    id: 'legacy-urls-v1',
    url: 'urls.txt',
    expectedDigest: LEGACY_DIGEST,
    status: 'active',
    selectionAuthority: true,
  });
});

test('typed candidate remains explicitly non-authoritative and digest-bound', () => {
  const authority = freshAuthority();
  assert.deepEqual(authority.candidate(), {
    id: 'typed-candidate-v0.1',
    url: 'corpus/releases/typed-candidate-v0.1/urls.txt',
    resourcesUrl: 'corpus/releases/typed-candidate-v0.1/resources.json',
    manifestUrl: 'corpus/releases/typed-candidate-v0.1/manifest.json',
    expectedDigest: CANDIDATE_DIGEST,
    status: 'candidate',
    selectionAuthority: false,
  });
});

test('shared active loader verifies bytes and caches one page-session load', async () => {
  const authority = freshAuthority();
  const bytes = fs.readFileSync(path.resolve(__dirname, '..', 'urls.txt'));
  let calls = 0;

  const first = await authority.loadActive({
    fetch: async () => {
      calls += 1;
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
  assert.equal(first.revision, LEGACY_DIGEST);
  assert.equal(first.source.id, 'legacy-urls-v1');
  assert.ok(first.urls.length > 0);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.urls), true);
});

test('shared active loader fails closed on a digest mismatch and permits retry', async () => {
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
});

test('authority descriptors cannot be mutated into a corpus promotion', () => {
  const authority = freshAuthority();
  const active = authority.active();
  const candidate = authority.candidate();

  assert.equal(Object.isFrozen(authority), true);
  assert.equal(Object.isFrozen(active), true);
  assert.equal(Object.isFrozen(candidate), true);

  assert.throws(() => {
    candidate.selectionAuthority = true;
  }, TypeError);
  assert.equal(authority.candidate().selectionAuthority, false);
  assert.equal(authority.active().id, 'legacy-urls-v1');
});
