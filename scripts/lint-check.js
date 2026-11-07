#!/usr/bin/env node
/**
 * Dependency-free JavaScript syntax check.
 * JSX/TSX and the full application graph are validated by `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'api', 'scripts', 'tests'];
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '.git']);
const files = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
}

for (const root of roots) walk(root);
files.sort();

if (files.length === 0) {
  console.error('No JavaScript files were found to check.');
  process.exit(1);
}

let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(`\n[SYNTAX ERROR] ${file}\n${result.stderr || result.stdout}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${files.length} JavaScript files failed syntax validation.`);
  process.exit(1);
}

console.log(`JavaScript syntax check passed: ${files.length} files.`);
console.log('Note: JSX is validated by the Vite production build, not by this syntax-only check.');
