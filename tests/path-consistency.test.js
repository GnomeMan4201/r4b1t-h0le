'use strict';

// Regression guard for the repository rename and GitHub Pages deployment path.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const legacyRepoUrl = /https:\/\/github\.com\/GnomeMan4201\/r4b1t(?=[/?#"'\s<]|$)/;
const legacyPagesUrl = 'https://gnomeman4201.github.io/r4b1t/';
const staleTrailOrigin = /gnomeman4201\.github\.io\/r4b1t(?!-h0le)/;

const repoLinkedFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'dual-shell.js',
  'index.html',
  '.github/ISSUE_TEMPLATE/config.yml',
];

test('public surfaces do not reference the pre-rename GitHub repository URL', () => {
  for (const file of repoLinkedFiles) {
    assert.doesNotMatch(read(file), legacyRepoUrl, file);
  }
});

test('public surfaces do not reference the dead pre-rename GitHub Pages URL', () => {
  for (const file of ['README.md', 'r4b1t.html']) {
    assert.ok(!read(file).includes(legacyPagesUrl), file);
  }
});

test('trail exports do not stamp the pre-rename project origin', () => {
  assert.doesNotMatch(read('index.html'), staleTrailOrigin);
});

test('PWA paths are deployment-relative instead of tied to the old repository slug', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');

  const index = read('index.html');
  assert.ok(index.includes('navigator.serviceWorker.register("./sw.js")'));

  const sw = read('sw.js');
  assert.ok(!sw.includes("'/r4b1t/"));
  assert.match(sw, /const CACHE = 'r4b1t-v17-path-consistency'/);
});

test('CI stages the site at the current GitHub Pages repository path', () => {
  const workflow = read('.github/workflows/test.yml');
  assert.ok(workflow.includes('test-site/r4b1t-h0le'));
  assert.ok(workflow.includes('http://127.0.0.1:8080/r4b1t-h0le/'));
  assert.ok(!workflow.includes('test-site/r4b1t/'));
});

test('Worker deploy workflow stages the browser suite at the deployed Pages path', () => {
  const workflow = read('.github/workflows/deploy-worker.yml');
  assert.ok(workflow.includes('test-site/r4b1t-h0le'));
  assert.ok(workflow.includes('BASE_URL: http://127.0.0.1:8080/r4b1t-h0le/'));
  assert.ok(workflow.includes("CI: 'true'"));
});

test('tooling examples use the renamed repository directory', () => {
  const classifier = read('tools/r4b1t_classifier.py');
  assert.ok(classifier.includes('~/r4b1t-h0le/tools/generate_branch_injection.py'));
  assert.ok(!classifier.includes('~/r4b1t/tools/generate_branch_injection.py'));
});

test('contributor guidance names the current deployed project path', () => {
  const contributing = read('CONTRIBUTING.md');
  assert.ok(contributing.includes('`/r4b1t-h0le/`'));
  assert.ok(!contributing.includes('`/r4b1t/`'));
});

test('README does not display the dead pre-rename GitHub Pages path', () => {
  assert.ok(!read('README.md').includes('gnomeman4201.github.io/r4b1t/'));
});
