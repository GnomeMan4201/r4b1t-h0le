'use strict';

const { test, expect } = require('@playwright/test');

const CORPUS = [
  'https://github.com/example/alpha',
  'https://gist.github.com/example/bravo',
  'https://gitlab.com/example/charlie',
  'https://codeberg.org/example/delta',
  'https://sourceforge.net/projects/example-echo',
  'https://medium.com/@example/foxtrot',
  'https://dev.to/example/golf',
];

const CODE_POOL = CORPUS.slice(0, 5);
const BLOG_POOL = CORPUS.slice(5);

function independentSampler(seed) {
  const bytes = new TextEncoder().encode(String(seed));
  let state = 2166136261;
  for (const byte of bytes) {
    state ^= byte;
    state = Math.imul(state, 16777619);
  }
  state >>>= 0;
  return function nextFloat() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function independentlySelect(pool, seed, priorUrl) {
  const random = independentSampler(seed);
  let selected = null;
  let attempts = 0;
  do {
    selected = pool[Math.floor(random() * pool.length)];
    attempts += 1;
    if (selected !== priorUrl) break;
  } while (attempts < 30);
  return { selected, attempts };
}

async function configurePage(page) {
  await page.addInitScript(() => {
    // Test-only deterministic entropy. Production code and selection APIs are
    // untouched; this makes the declared trail seed stable and makes ambient
    // Math.random use observable when the production path bypasses that seed.
    const nativeGetRandomValues = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array) {
        if (array instanceof Uint8Array) {
          for (let index = 0; index < array.length; index += 1) array[index] = index + 1;
          return array;
        }
        return nativeGetRandomValues(array);
      },
    });
    Math.random = () => 0.999999;
  });

  await page.route('**/urls.txt?*', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: CORPUS.join('\n') + '\n',
  }));
