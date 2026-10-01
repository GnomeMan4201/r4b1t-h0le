'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const branch = require('../branch-core.js');

const ORIGIN = 'https://github.com/example/project/docs/start';
const CORPUS = [
  ORIGIN,
  'https://github.com/example/project/docs/advanced',
  'https://github.com/example/other-project/docs/start',
  'https://docs.example.net/project/start',
  'https://research.example.org/unrelated/topic',
  'https://odd.example.com/archive/strange',
  'https://another.example.com/reference/project',
];

test('branch core is deterministic and independent of corpus order', () => {
  const a = branch.generate(ORIGIN, CORPUS);
  const b = branch.generate(ORIGIN, [...CORPUS].reverse());
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  assert.deepEqual(a.map(x => x.type), ['deeper', 'sideways', 'opposite', 'weird']);
  assert.equal(new Set(a.map(x => x.url)).size, 4);
  assert.ok(a.every(x => x.url !== ORIGIN));
});

test('branch core never needs presentation text, history, or ambient randomness', () => {
  const source = branch.generate.toString();
  assert.doesNotMatch(source, /Math\.random|document|localStorage|sessionStorage|fetch\s*\(/);
  assert.equal(branch.generate.length, 2, 'branch authority is only origin URL + corpus');
});

test('DEEPER prefers same stable URL scope before cross-scope fallback', () => {
  const out = branch.generate(ORIGIN, CORPUS);
  assert.equal(out[0].type, 'deeper');
  assert.equal(out[0].url, 'https://github.com/example/project/docs/advanced');
  assert.match(out[0].reason, /same scope/i);
});

test('tie breaking is stable rather than file-order dependent', () => {
  const origin = 'https://origin.example/a';
  const tied = [
    origin,
    'https://one.example/x',
    'https://two.example/x',
    'https://three.example/x',
    'https://four.example/x',
    'https://five.example/x',
  ];
  const expected = branch.generate(origin, tied);
  for (let i = 0; i < 12; i += 1) {
    const rotated = tied.slice(i % tied.length).concat(tied.slice(0, i % tied.length));
    assert.deepEqual(branch.generate(origin, rotated), expected);
  }
});

test('branch outputs state the mechanical driver instead of semantic certainty', () => {
  const out = branch.generate(ORIGIN, CORPUS);
  assert.match(out.find(x => x.type === 'deeper').reason, /scope|overlap/i);
  assert.match(out.find(x => x.type === 'sideways').reason, /different scope|overlap|fallback/i);
  assert.match(out.find(x => x.type === 'opposite').reason, /zero overlap|weakest overlap|different scope/i);
  assert.match(out.find(x => x.type === 'weird').reason, /deterministic/i);
});
