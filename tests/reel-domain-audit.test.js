'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const script = path.join(__dirname, '..', 'tools', 'reel_domain_audit.js');
function report() {
  return JSON.parse(execFileSync(process.execPath, [script,
    '--terrain', 'ALL,article,reference', '--rolls', '300',
    '--seed', '4201', '--json'], { encoding: 'utf8' }));
}
test('audit verifies active release and exposes concentration by terrain', () => {
  const a = report();
  assert.equal(a.results[0].pool, 7033);
  assert.equal(a.results[1].pool, 24);
  assert.equal(a.results[2].pool, 897);
  assert.equal(a.results[0].requested['gtfobins.org'].eligible, 478);
  assert.equal(a.results[0].requested['tmpout.sh'].eligible, 12);
  assert.equal(a.results[1].requested['tmpout.sh'].eligible, 12);
  assert.equal(a.results[2].requested['gtfobins.org'].eligible, 478);
  assert.deepEqual(a, report(), 'seeded audit must be reproducible');
  for (const row of a.results) {
    assert.equal(row.draws, 300);
    assert.equal(row.adjacent_same_url, 0, '30-retry guard should avoid consecutive URL repeats in this sample');
  }
});
