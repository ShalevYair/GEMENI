#!/usr/bin/env node
// Guards the one failure mode that takes the whole app down silently.
//
// Browsers key ES modules by full URL, query string included. If the same
// file is imported as './deps.js' from one place and './modals/deps.js?v=1'
// from another, the browser loads it twice as two unrelated instances.
// agent-chat.js fills one, the modals read the other (all nulls), and every
// agent button stops responding with no visible error. It looks like a
// deploy problem, not a code problem, which is what makes it expensive.
//
// Run: node tools/check-module-graph.mjs

import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { dirname, normalize, join } from 'path';

const files = globSync('{*.js,modals/*.js,spec-king/*.js,tools/*.mjs}', { cwd: process.cwd() })
  .filter(f => !f.startsWith('tools/'));

const specifiersFor = new Map(); // resolved path -> Set of raw specifiers
const IMPORT_RE = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const [, spec] of src.matchAll(IMPORT_RE)) {
    const resolved = normalize(join(dirname(f), spec.split('?')[0]));
    if (!specifiersFor.has(resolved)) specifiersFor.set(resolved, new Set());
    specifiersFor.get(resolved).add(spec);
  }
}

// Two specifiers for one file are fine when they differ only by relative
// path ('./deps.js' vs './modals/deps.js') — those resolve to the same URL.
// The fault is a query string on some importers but not all.
const problems = [];
for (const [target, specs] of specifiersFor) {
  const queried = [...specs].filter(s => s.includes('?'));
  const bare    = [...specs].filter(s => !s.includes('?'));
  if (queried.length && bare.length) {
    problems.push({ target, queried, bare });
  } else if (new Set([...specs].map(s => s.split('?')[1] || '')).size > 1) {
    problems.push({ target, queried, bare, note: 'conflicting query strings' });
  }
}

if (problems.length) {
  console.error('✗ Duplicate module instances — the app will break silently:\n');
  for (const p of problems) {
    console.error(`  ${p.target}${p.note ? ` (${p.note})` : ''}`);
    for (const s of p.queried) console.error(`      versioned: ${s}`);
    for (const s of p.bare)    console.error(`      bare:      ${s}`);
    console.error('');
  }
  console.error('Cache versions belong on HTML script tags, never on import specifiers.');
  process.exit(1);
}

console.log(`✓ module graph clean — ${specifiersFor.size} modules, no duplicate instances`);
