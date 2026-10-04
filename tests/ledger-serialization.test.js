'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const profile = require('../corpus/ledger/schema/serialization.js');
const vectors = JSON.parse(fs.readFileSync('corpus/ledger/fixtures/serialization-v1.json','utf8'));
for (const vector of vectors.accept) test(`ledger independent CJ-1 vector: ${vector.name}`, () => {
  assert.equal(profile.serialize(vector.value), vector.canonical);
  for (const [domain, hash] of Object.entries(vector.hashes)) assert.equal(profile.digest(domain, vector.value),hash);
  const result = spawnSync('python3',['-c','from corpus.ledger.schema.serialization import serialize,digest; import json,sys; v=json.loads(sys.stdin.read()); print(json.dumps({"canonical":serialize(v),"hashes":{d:digest(d,v) for d in ("event","projection","policy","manifest","heartbeat")}},ensure_ascii=False))'],{input:JSON.stringify(vector.value),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{canonical:vector.canonical,hashes:vector.hashes});
});
test('ledger collections have independent UTF-8 byte ordering', () => {
  assert.deepEqual(profile.sortedCollection(['😀','\ue000','a']), ['a','\ue000','😀']);
  assert.throws(() => profile.sortedCollection(['a','a']));
});
