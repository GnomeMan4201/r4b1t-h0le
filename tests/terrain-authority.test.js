'use strict';

// T1-02, T1-03, T1-07, T1-14 and loader fail-closed behavior for the terrain authority.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel));
const sha = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
const INDEX_PATH = 'corpus/terrains/typed-candidate-v0.1/terrain-index-v1.json';
const REGISTRY_PATH = 'corpus/runtime/eligibility-profiles-v1.json';
const INDEX_DIGEST = 'sha256:8bddd48835eeb2a2a17be2966ff02965e3d7f50b1721f7e1a54b1a898189acfb';

function loadAuthority() {
  return require(path.join(ROOT, 'terrain-authority.js'));
}

test('T1-02: an independent recompute from resources.json equals the committed index', () => {
  const urls = read('corpus/releases/typed-candidate-v0.1/urls.txt').toString('utf8').slice(0, -1).split('\n');
  const resources = JSON.parse(read('corpus/releases/typed-candidate-v0.1/resources.json')).resources;
  assert.deepEqual(resources.map(r => r.url), urls, 'resource order must equal urls.txt order');
  const types = [...new Set(resources.map(r => r.resource_type))].sort();
  const expected = types.map(id => {
    const members = [];
    resources.forEach((r, i) => { if (r.resource_type === id) members.push(i); });
    return { id, label: id.replace(/_/g, ' ').toUpperCase(), rule: { resource_type: [id] }, count: members.length, members };
  });
  const index = JSON.parse(read(INDEX_PATH));
  assert.equal(index.schema, 'r4b1t-terrain-index-v1');
  assert.equal(index.vocabulary, 'resource-type-identity-v1');
  assert.deepEqual(index.terrains, expected);
  assert.ok(index.terrains.every(t => t.count >= 1), 'no dry terrain');
  assert.equal(sha(read(INDEX_PATH)), INDEX_DIGEST);
});

test('T1-03: promotion → registry → runtime pins → index bytes form one authority chain', () => {
  const authority = loadAuthority();
  const corpus = require(path.join(ROOT, 'corpus-authority.js'));
  const promotion = JSON.parse(read('corpus/runtime/active-v1.json'));
  const registry = JSON.parse(read(REGISTRY_PATH));
  assert.equal(registry.schema, 'r4b1t-eligibility-profiles-v1');
  const active = registry.profiles.filter(p => p.status === 'active' && p.release.release_id === promotion.active.release_id);
  assert.equal(active.length, 1, 'exactly one active profile for the active release');
  const profile = active[0];
  const pins = authority.profile();
  assert.equal(pins.profileId, profile.profile_id);
  assert.equal(pins.mapping, profile.mapping);
  assert.equal(pins.promotionId, promotion.promotion_id);
  assert.equal(pins.releaseId, profile.release.release_id);
  assert.equal(pins.urlsDigest, promotion.active.expected_digest);
  assert.equal(pins.urlsDigest, corpus.active().expectedDigest);
  assert.equal(pins.resourcesDigest, corpus.active().expectedResourcesDigest);
  assert.equal(pins.indexPath, profile.terrain_index.path);
  assert.equal(pins.indexSchema, profile.terrain_index.schema);
  assert.equal(pins.expectedIndexDigest, profile.terrain_index.digest);
  assert.equal(sha(read(profile.terrain_index.path)), pins.expectedIndexDigest);
  const index = JSON.parse(read(profile.terrain_index.path));
  assert.deepEqual(index.release, profile.release);
});

test('T1-07: terrain control state — DRY is not armable; tiny pools are disclosed', () => {
  const { terrainControlState } = loadAuthority();
  const dry = terrainControlState({ authority: 'READY', count: 0 });
  assert.equal(dry.armable, false);
  assert.equal(dry.reason, '0 ELIGIBLE');
  assert.equal(terrainControlState({ authority: 'READY', count: 1 }).note, 'SINGLE ROUTE');
  assert.equal(terrainControlState({ authority: 'READY', count: 1 }).armable, true);
  assert.equal(terrainControlState({ authority: 'READY', count: 2 }).note, 'ALTERNATES');
  assert.equal(terrainControlState({ authority: 'READY', count: 3 }).note, null);
  assert.equal(terrainControlState({ authority: 'LOADING', count: 5 }).armable, false);
  assert.equal(terrainControlState({ authority: 'UNAVAILABLE', count: 5 }).armable, false);
});

test('T1-14: classifyBinding distinguishes use from authority', () => {
  const { classifyBinding } = loadAuthority();
  const registry = JSON.parse(read(REGISTRY_PATH));
  const urls = registry.profiles[0].release.urls_digest;
  assert.equal(classifyBinding(registry, urls, INDEX_DIGEST), 'AUTHORITATIVE_ACTIVE');
  assert.equal(classifyBinding(registry, urls, 'sha256:' + 'f'.repeat(64)), 'UNREGISTERED_MAP');
  assert.equal(classifyBinding(registry, 'sha256:' + '0'.repeat(64), INDEX_DIGEST), 'UNREGISTERED_RELEASE');
  const superseded = JSON.parse(JSON.stringify(registry));
  superseded.profiles.unshift({ ...JSON.parse(JSON.stringify(registry.profiles[0])), profile_id: 'old', status: 'superseded', terrain_index: { ...registry.profiles[0].terrain_index, digest: 'sha256:' + 'e'.repeat(64) } });
  assert.equal(classifyBinding(superseded, urls, 'sha256:' + 'e'.repeat(64)), 'AUTHORITATIVE_SUPERSEDED');
});

test('validateIndexDocument rejects structural violations', () => {
  const { validateIndexDocument } = loadAuthority();
  const good = JSON.parse(read(INDEX_PATH));
  const binding = good.release;
  assert.doesNotThrow(() => validateIndexDocument(good, { activeCount: 841, release: binding }));
  const mutations = {
    unsorted: d => d.terrains.reverse(),
    dry: d => { d.terrains[0].members = []; d.terrains[0].count = 0; },
    outOfRange: d => { d.terrains[0].members.push(841); d.terrains[0].count += 1; },
    duplicate: d => { d.terrains[0].members.push(d.terrains[0].members[0]); d.terrains[0].count += 1; },
    wrongLabel: d => { d.terrains[0].label = 'DATA'; },
    extraKey: d => { d.terrains[0].weight = 1; },
    reservedId: d => { d.terrains[0].id = 'all'; },
    countMismatch: d => { d.terrains[0].count += 1; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const doc = JSON.parse(JSON.stringify(good));
    mutate(doc);
    assert.throws(() => validateIndexDocument(doc, { activeCount: 841, release: binding }), e => e.code === 'TERRAIN_INDEX_INVALID', name);
  }
});

test('loadIndex fails closed: digest, canonical form, and release binding', async () => {
  const authority = loadAuthority();
  const bytes = read(INDEX_PATH);
  const fetchBytes = body => async () => ({ ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) });
  const corpusStub = { active: () => ({ releaseId: 'typed-candidate-v0.1', expectedDigest: authority.profile().urlsDigest, expectedResourcesDigest: authority.profile().resourcesDigest }), loadActive: async () => ({ urls: new Array(841).fill('https://example.org/') }) };
  const base = { crypto: globalThis.crypto, corpusAuthority: corpusStub };

  const ok = await authority.loadIndex({ ...base, fetch: fetchBytes(bytes), fresh: true });
  assert.equal(ok.digest, INDEX_DIGEST);
  assert.equal(ok.terrains.length, 7);

  const tampered = Buffer.from(bytes.toString('utf8').replace('"lab"', '"lbb"'));
  await assert.rejects(authority.loadIndex({ ...base, fetch: fetchBytes(tampered), fresh: true }), e => e.code === 'TERRAIN_INDEX_DIGEST_MISMATCH');

  const pretty = Buffer.from(JSON.stringify(JSON.parse(bytes), null, 2) + '\n');
  await assert.rejects(authority.loadIndex({ ...base, fetch: fetchBytes(pretty), fresh: true, expectedIndexDigest: sha(pretty) }), e => e.code === 'TERRAIN_INDEX_NOT_CANONICAL');

  const rebound = JSON.parse(bytes); rebound.release.urls_digest = 'sha256:' + '1'.repeat(64);
  const reboundBytes = Buffer.from(require(path.join(ROOT, 'cj1.js')).serialize(rebound) + '\n');
  await assert.rejects(authority.loadIndex({ ...base, fetch: fetchBytes(reboundBytes), fresh: true, expectedIndexDigest: sha(reboundBytes) }), e => e.code === 'TERRAIN_INDEX_BINDING_MISMATCH');

  await assert.rejects(authority.loadIndex({ ...base, fetch: async () => ({ ok: false }), fresh: true }), e => e.code === 'TERRAIN_INDEX_UNAVAILABLE');
});
