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
const ACTIVE_DIGEST = 'sha256:ba52be7e2fc9120f3bd1ac2a6bacbc61fc937764e6d4637df8711ec2212bf75c';
const RESOURCES_DIGEST = 'sha256:529a3bcf10b0933ce92428932035750ae0fe93f1490aaa1a40c1384d7ec57aca';

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
    id: 'diverse-candidate-v0.2',
    releaseId: 'diverse-candidate-v0.2',
    url: 'corpus/releases/diverse-candidate-v0.2/urls.txt',
    resourcesUrl: 'corpus/releases/diverse-candidate-v0.2/resources.json',
    manifestUrl: 'corpus/releases/diverse-candidate-v0.2/manifest.json',
    expectedDigest: ACTIVE_DIGEST,
    expectedResourcesDigest: RESOURCES_DIGEST,
    expectedResourceCount: 6859,
    promotionId: 'diverse-candidate-v0.2-active-v1',
    status: 'active',
    selectionAuthority: true,
  });
  assert.equal(authority.promotion().id, PROMOTION.promotion_id);
});

test('release assertion remains historically non-authoritative', () => {
  const authority = freshAuthority();
  assert.deepEqual(authority.candidate(), {
    id: 'diverse-candidate-v0.2',
    url: 'corpus/releases/diverse-candidate-v0.2/urls.txt',
    resourcesUrl: 'corpus/releases/diverse-candidate-v0.2/resources.json',
    manifestUrl: 'corpus/releases/diverse-candidate-v0.2/manifest.json',
    expectedDigest: ACTIVE_DIGEST,
    expectedResourcesDigest: RESOURCES_DIGEST,
    expectedResourceCount: 6859,
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
    path.join(ROOT, 'corpus', 'releases', 'diverse-candidate-v0.2', 'urls.txt'),
  );
  let calls = 0;

  const first = await authority.loadActive({
    fetch: async url => {
      calls += 1;
      assert.match(String(url), /corpus\/releases\/diverse-candidate-v0\.2\/urls\.txt\?v=/);
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
  assert.equal(first.source.id, 'diverse-candidate-v0.2');
  assert.equal(first.urls.length, 6859);
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
  assert.equal(authority.active().id, 'diverse-candidate-v0.2');
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


test('resource metadata stays lazy until explicitly requested after selection', async () => {
  const authority = freshAuthority();
  const urlBytes = fs.readFileSync(
    path.join(ROOT, 'corpus', 'releases', 'diverse-candidate-v0.2', 'urls.txt'),
  );
  const resourceBytes = fs.readFileSync(
    path.join(ROOT, 'corpus', 'releases', 'diverse-candidate-v0.2', 'resources.json'),
  );
  const requests = [];

  const active = await authority.loadActive({
    fetch: async url => {
      requests.push(String(url));
      return responseFor(urlBytes);
    },
  });

  assert.equal(active.urls.length, 6859);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/urls\.txt\?v=/);
  assert.equal(requests.some(url => url.includes('resources.json')), false);

  const record = await authority.resourceFor('http://bittwist.sourceforge.net/', {
    fetch: async url => {
      requests.push(String(url));
      return responseFor(resourceBytes);
    },
  });

  assert.deepEqual(record, {
    url: 'http://bittwist.sourceforge.net/',
    resource_type: 'security_tool',
    provenance: 'provenance:sha256:96432d916dd42c686bd0b6fcca11b9d1084a22d9aaba7d9ed6f27278668b10b2',
    eligibility_reason: 'CONCRETE_SECURITY_TOOL',
  });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(requests.filter(url => url.includes('resources.json')).length, 1);

  const cached = await authority.resourceFor('http://bittwist.sourceforge.net/', {
    fetch: async () => {
      throw new Error('metadata was fetched twice');
    },
  });
  assert.strictEqual(cached, record);
});

test('resource metadata is digest-bound and cannot invalidate selected URLs', async () => {
  const authority = freshAuthority();
  const urlBytes = fs.readFileSync(
    path.join(ROOT, 'corpus', 'releases', 'diverse-candidate-v0.2', 'urls.txt'),
  );

  const active = await authority.loadActive({
    fetch: async () => responseFor(urlBytes),
  });

  await assert.rejects(
    authority.resourceFor(active.urls[0], {
      fetch: async () => responseFor(Buffer.from('{"tampered":true}\n', 'utf8')),
    }),
    /metadata digest mismatch/i,
  );

  const stillActive = await authority.loadActive({
    fetch: async () => {
      throw new Error('active URL corpus should remain cached');
    },
  });

  assert.strictEqual(stillActive, active);
  assert.equal(stillActive.urls.length, 6859);
});

test('verified metadata requires one unique record for every active URL', async () => {
  const authority = freshAuthority();
  const urlBytes = fs.readFileSync(
    path.join(ROOT, 'corpus', 'releases', 'diverse-candidate-v0.2', 'urls.txt'),
  );
  const resourceBytes = fs.readFileSync(
    path.join(ROOT, 'corpus', 'releases', 'diverse-candidate-v0.2', 'resources.json'),
  );

  await authority.loadActive({ fetch: async () => responseFor(urlBytes) });
  const metadata = await authority.loadResourceMetadata({
    fetch: async () => responseFor(resourceBytes),
  });

  assert.equal(metadata.count, 6859);
  assert.equal(metadata.releaseId, 'diverse-candidate-v0.2');
  assert.equal(metadata.digest, RESOURCES_DIGEST);
  assert.equal(Object.keys(metadata.byUrl).length, 6859);
  assert.equal(Object.isFrozen(metadata), true);
  assert.equal(Object.isFrozen(metadata.byUrl), true);
});
