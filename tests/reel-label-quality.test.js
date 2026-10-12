'use strict';

// Guards reel naming without confusing display labels with selection authority.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const reel = fs.readFileSync(require('node:path').join(__dirname, '..', 'roll-reel.js'), 'utf8');

function reelLabel(url) {
  const context = vm.createContext({ URL, location: { href: 'https://r4b1t.example/' } });
  const exposed = reel.replace(
    'root.R4B1TRollReel = Object.freeze({',
    'root.__testResourceName = resourceName; root.R4B1TRollReel = Object.freeze({'
  );
  assert.notEqual(exposed, reel, 'test hook must expose the live label function');
  vm.runInContext(exposed, context);
  return context.__testResourceName(url);
}

test('numeric/date-only URL slugs retain origin plus full original path', () => {
  assert.equal(reelLabel('https://sector035.nl/articles/2024-30'), 'sector035.nl/articles/2024-30');
  assert.equal(reelLabel('https://binary.golf/4'), 'binary.golf/4');
  assert.equal(reelLabel('https://tmpout.sh/4/4.html'), 'tmpout.sh/4/4.html');
  assert.equal(reelLabel('https://example.org/2024-01'), 'example.org/2024-01');
  assert.equal(reelLabel('https://example.org/1234'), 'example.org/1234');
});

test('informative titles are retained, including descriptive repository names', () => {
  assert.equal(reelLabel('https://github.com/example/interesting-research'), 'interesting research');
  assert.equal(reelLabel('https://example.org/research/interesting-article.html'), 'interesting article');
  assert.equal(reelLabel('https://gtfobins.github.io/'), 'gtfobins');
});

test('display-only fix does not introduce network title lookups or alter sampler', () => {
  assert.match(reel, /var labels = Object\.freeze\(pool\.map\(resourceName\)\)/);
  assert.match(reel, /var targetIndex = pool\.indexOf\(options\.result\.url\)/);
  assert.doesNotMatch(reel, /loadResourceMetadata|resourceFor\(/);
});
