#!/usr/bin/env node
// Repository navigation only: pinned source snapshots are corpus inputs, not authored docs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve('.');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];
let checked = 0;

function fencedProse(source) {
  return source.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1[^\n]*$/gm, '');
}

function prose(source) {
  return fencedProse(source).replace(/`[^`\n]*`/g, '');
}

function anchors(source) {
  const ids = new Set();
  const repeats = new Map();
  for (const match of fencedProse(source).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const slug = match[1].toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    const count = repeats.get(slug) || 0;
    repeats.set(slug, count + 1);
    ids.add(slug + (count ? `-${count}` : ''));
  }
  for (const match of source.matchAll(/(?:id|name)=["']([^"']+)["']/g)) ids.add(match[1]);
  return ids;
}

function check(file, raw) {
  const href = raw.trim().replace(/^<|>$/g, '').split(/\s+["']/)[0];
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return;
  const [target, fragment] = href.split('#', 2);
  const resolved = target ? path.resolve(path.dirname(path.join(root, file)), decodeURIComponent(target.split('?')[0])) : path.join(root, file);
  checked++;
  if (!fs.existsSync(resolved)) {
    failures.push(`${file}: missing link target ${href}`);
  } else if (fragment && resolved.endsWith('.md') && !anchors(fs.readFileSync(resolved, 'utf8')).has(decodeURIComponent(fragment))) {
    failures.push(`${file}: missing Markdown anchor ${href}`);
  }
}

for (const file of files) {
  if (file.endsWith('.md') && !file.startsWith('corpus/sources/')) {
    const source = prose(fs.readFileSync(file, 'utf8'));
    for (const match of source.matchAll(/\]\(([^)]+)\)/g)) check(file, match[1]);
    for (const match of source.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)) check(file, match[1]);
    for (const match of source.matchAll(/(?:href|src)=["']([^"']+)["']/g)) check(file, match[1]);
  }
  if (file.startsWith('.github/workflows/') && /\.ya?ml$/.test(file)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/^\s*-\s*['"](docs\/[^'"*]+)['"]\s*$/gm)) {
      checked++;
      if (!fs.existsSync(path.join(root, match[1]))) failures.push(`${file}: missing documentation path filter ${match[1]}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Repository documentation verification passed (${checked} local links and CI paths).`);
}
