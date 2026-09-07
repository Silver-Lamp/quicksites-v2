#!/usr/bin/env node
// scripts/audit-live-claims.mjs
//
// What would a claim scrub actually change on our LIVE geo sites?
//
// ⚠️ Read-only unless --apply. clean-portfolio-copy.mjs (#857) deliberately does NOT touch bare
// "24/7" — its first cut rewrote every occurrence and produced garbage — so the claims that survive
// today are the ones it was written to leave alone: long-form and blog prose like "our local
// experts are here to help you 24/7" and headings like "24/7 Emergency Assistance".
//
//   npx tsx scripts/audit-live-claims.mjs            # dry run, published sites
//   npx tsx scripts/audit-live-claims.mjs --drafts   # include unpublished
import fs from 'node:fs';
import { scrubText, makesOperationalClaim } from '../lib/rebuild/scrubInventedClaims.ts';

const INCLUDE_DRAFTS = process.argv.includes('--drafts');
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const q = `templates?select=id,slug,published,data${INCLUDE_DRAFTS ? '' : '&published=eq.true'}&limit=400`;
const rows = await (await fetch(`${BASE}/rest/v1/${q}`, { headers: H })).json();

/** Walk every string in the tree — a fourth copy appearing later must not defeat the sweep (§8). */
function walkStrings(node, fn, keyPath = '') {
  if (Array.isArray(node)) return node.forEach((v, i) => walkStrings(v, fn, keyPath));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') fn(v, k);
      else walkStrings(v, fn, k);
    }
  }
}

let sites = 0;
let total = 0;
const report = [];
for (const t of rows) {
  const hits = [];
  walkStrings(t.data, (s, key) => {
    // A QUESTION is not a claim. "Do you offer 24/7 service?" is a fine thing to be asked, and
    // industryCopy already answers it honestly. Counting these is how I over-reported twice.
    if (key === 'question' || key === 'q') return;
    if (s.trim().endsWith('?')) return;
    if (!makesOperationalClaim(s)) return;
    const after = scrubText(s).text;
    hits.push({ key, before: s.slice(0, 140), after: after.slice(0, 140) });
  });
  if (hits.length) {
    sites += 1;
    total += hits.length;
    report.push({ slug: t.slug, published: t.published, hits });
  }
}

// Where do the claims live? That decides whether a scrub is safe or destructive.
const byKey = new Map();
for (const r of report) for (const h of r.hits) byKey.set(h.key, (byKey.get(h.key) ?? 0) + 1);
console.log('\nBy field:');
for (const [k, n] of [...byKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`   ${String(n).padStart(4)}  ${k}`);
}

report.sort((a, b) => b.hits.length - a.hits.length);
console.log(`\n${sites} sites carry ${total} claim strings (questions excluded).\n`);
for (const r of report.slice(0, 6)) {
  console.log(`── ${r.slug}${r.published ? '' : ' (draft)'} — ${r.hits.length}`);
  for (const h of r.hits.slice(0, 3)) {
    console.log(`   [${h.key}] BEFORE: ${h.before}`);
    console.log(`   ${' '.repeat(h.key.length)}  AFTER : ${h.after || '(sentence removed entirely)'}`);
  }
  console.log('');
}
console.log(`Totals — sites: ${sites}, strings: ${total}`);
console.log('Dry run only. Nothing written.');
