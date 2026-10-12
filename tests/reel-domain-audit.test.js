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
    assert.deepEqual(row.observed_transitions, {
      same_url: row.adjacent_same_url, same_host: row.adjacent_same_host
    });
    assert.ok(row.expected_transitions.independent_iid.same_url > 0);
    assert.ok(row.expected_transitions.independent_iid.same_host >=
      row.expected_transitions.uniform_with_repeat_guard_v1.same_host);
    assert.ok(row.expected_transitions.uniform_with_repeat_guard_v1.same_url > 0,
      'bounded 30-draw guard must not claim consecutive repeats are impossible');
  }

  const byTerrain = Object.fromEntries(a.results.map(r => [r.terrain, r]));
  const article = byTerrain.article;
  assert.equal(article.observed_transitions.same_url, 0);
  assert.equal(article.observed_transitions.same_host, 106);
  assert.ok(Math.abs(article.expected_transitions.independent_iid.same_url - 299 / 24) < 1e-12);
  assert.ok(Math.abs(article.expected_transitions.independent_iid.same_host - 299 * 206 / 576) < 1e-12);
  assert.ok(Math.abs(article.expected_transitions.uniform_with_repeat_guard_v1.same_url -
    299 * Math.pow(1 / 24, 30)) < 1e-48);
  assert.ok(Math.abs(article.expected_transitions.uniform_with_repeat_guard_v1.same_host -
    (299 * ((1 - Math.pow(1 / 24, 30)) * 182 / 552 + Math.pow(1 / 24, 30)))) < 1e-12);

  // Golden seeded observations: changed simulation or guard behavior cannot pass silently.
  assert.deepEqual(a.results.map(r => [
    r.terrain, r.observed_transitions.same_url, r.observed_transitions.same_host
  ]), [['ALL', 0, 23], ['article', 0, 106], ['reference', 0, 120]]);
});

const vm = require('node:vm');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');

function productionSelector() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('function ee(');
  const end = html.indexOf('function te(', start);
  assert.ok(start >= 0 && end > start, 'production ee() must be present');
  // Execute the actual production function, rather than copying its retry rule.
  return vm.runInNewContext(html.slice(start, end) + '; ee;', {});
}

test('production selector: no-reference is unrestricted, previous URL retries until different', () => {
  const select = productionSelector();
  const a = 'https://same.example/a';
  const b = 'https://same.example/b';
  let calls = 0;
  assert.equal(select([a, b], () => { calls++; return 0; }, null), a);
  assert.equal(calls, 1, 'first committed ROLL is unguarded');

  calls = 0;
  const next = select([a, b], () => {
    calls++;
    return calls <= 2 ? 0 : 0.75;
  }, a);
  assert.equal(next, b, 'reject previous URL, not previous domain');
  assert.equal(calls, 3, 'draw consumption must include rejected attempts');

  calls = 0;
  assert.equal(select([a, b], () => { calls++; return 0.75; }, a), b);
  assert.equal(calls, 1);
});

test('production selector: bounded at 30, with singleton repeat and cross-terrain references', () => {
  const select = productionSelector();
  const a = 'https://same.example/a';
  const b = 'https://same.example/b';
  let draws = 0;
  assert.equal(select([a, b], () => { draws++; return 0; }, a), a,
    'same URL can be emitted after exhausting 30 retries');
  assert.equal(draws, 30);
  draws = 0;
  assert.equal(select([a], () => { draws++; return 0; }, a), a);
  assert.equal(draws, 30);
  draws = 0;
  assert.equal(select([a], () => { draws++; return 0; }, b), a);
  assert.equal(draws, 1, 'reference from other terrain is not excluded');
});

test('expected transition counts are mathematical, not a side effect of the simulator', () => {
  const a = report();
  const article = a.results.find(r => r.terrain === 'article');
  assert.equal(article.pool, 24);
  assert.equal(article.unique_hosts, 4);
  assert.ok(article.expected_transitions.uniform_with_repeat_guard_v1.same_host > 98);
  assert.ok(article.expected_transitions.uniform_with_repeat_guard_v1.same_host < 99);
  assert.ok(article.expected_transitions.uniform_with_repeat_guard_v1.same_url < 1e-30);
  assert.ok(article.expected_transitions.independent_iid.same_url > 12);
});
