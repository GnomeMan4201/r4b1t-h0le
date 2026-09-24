'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const trail = require('../trail-manifest.js');
const blind = require('../blind-manifest.js');

async function fixture(group, name) {
  return JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', group, name), 'utf8'));
}

test('historical v0.1 golden IDs remain byte-for-byte stable', async () => {
  const parent = await trail.verify(await fixture('trails', 'parent.json'));
  const child = await trail.verify(await fixture('trails', 'child.json'));
  assert.equal(parent.trail_id, 'sha256:f3157a79164b07f2f3fa40902981e06e0f5417a4565a8efa279984706fe2596c');
  assert.equal(child.trail_id, 'sha256:26d7e7b5585123024fe1ab5de428e030c7da3d45d9ad62fa597b5a03591dee74');
});

test('Blind Descent v0.2 golden identities remain unchanged', async () => {
  const concealed = await blind.verify(await fixture('blind', 'concealed.json'));
  const revealed = await blind.verify(await fixture('blind', 'revealed.json'));
  assert.equal(concealed.trail_id, 'sha256:d3acbe0ee784626e6ebceff5ed5012b2e08899b43b6a220e4f5e281b609dfad0');
  assert.equal(revealed.trail_id, 'sha256:f6ba66bd58f40217aa27d996d4f504011ab3695b4af8808d7aa0b53d83fc4f5c');
});
