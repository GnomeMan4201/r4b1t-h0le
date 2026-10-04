'use strict';
// Independent JS vectors use the repository's existing CJ-1 authority.
const cj1 = require('../../../cj1.js');
const { createHash } = require('node:crypto');
const VERSION = 'r4b1t-cj1-ledger-v1';
const domains = Object.freeze(['event', 'projection', 'policy', 'manifest', 'heartbeat']);
function serialize(value) { return cj1.serialize(value); }
function digest(domain, value) {
  if (!domains.includes(domain)) throw new TypeError('unknown ledger domain');
  const framed = Buffer.concat([Buffer.from(`r4b1t:${domain}:v1\0`, 'ascii'), Buffer.from(serialize(value), 'utf8')]);
  return 'sha256:' + createHash('sha256').update(framed).digest('hex');
}
function sortedCollection(values) {
  const pairs = values.map(value => [Buffer.from(serialize(value), 'utf8'), value]);
  pairs.sort((a,b) => Buffer.compare(a[0], b[0]));
  if (pairs.some((p,i) => i && p[0].equals(pairs[i-1][0]))) throw new TypeError('duplicate collection member');
  return pairs.map(p => p[1]);
}
module.exports = Object.freeze({ VERSION, serialize, digest, sortedCollection });
