'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkSource, checkProduction } = require('../corpus/ledger/tools/production-boundary.js');
const selection = require('../selection-core.js');

test('shadow imports and reads fail the production boundary gate', () => {
  for (const source of ["require('./corpus/ledger/projection')", "fetch('corpus/ledger/shadow/projection.json')", 'const source = "ledger/shadow/projection.json"']) assert.throws(() => checkSource(source));
  assert.doesNotThrow(() => checkProduction(path.resolve(__dirname,'..')));
});

test('malicious shadow globals/data never change public authority or eligible pools', async () => {
  const promotion=JSON.parse(fs.readFileSync('corpus/runtime/active-v1.json','utf8'));
  const bytes=fs.readFileSync(promotion.active.url);
  const index=JSON.parse(fs.readFileSync('corpus/terrains/experience-candidate-v0.4/terrain-index-v1.json','utf8'));
  const requests=[];
  async function loaded(shadow) {
    globalThis.R4b1tShadowProjection=shadow;
    delete require.cache[require.resolve('../corpus-authority.js')];
    const authority=require('../corpus-authority.js');
    return authority.loadActive({fetch: async url => {
      requests.push(String(url));
      if(String(url).includes('ledger/')) throw new Error('shadow became selection input');
      return {ok:true,status:200,async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}};
    }});
  }
  try {
    const before=await loaded({resources:[]});
    const after=await loaded({resources:[{url:'https://evil.invalid/',eligibility:'ACTIVE',availability:'LIVE'}],event_head:'tampered'});
    assert.equal(after.revision,before.revision);
    assert.deepEqual(after.urls,before.urls);
    for(const terrain of ['ALL',...index.terrains.map(x=>x.id)]) {
      const constraint={terrain,protocolPolicy:{version:1,excludeOnion:false}};
      assert.deepEqual(selection.eligiblePool(after.urls,index,constraint),selection.eligiblePool(before.urls,index,constraint));
    }
    assert.equal(requests.length,2);
  } finally {delete globalThis.R4b1tShadowProjection;}
});
