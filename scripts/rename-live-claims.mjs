#!/usr/bin/env node
// scripts/rename-live-claims.mjs
//
// The pass #906 left by choice: RENAME the claims a filter cannot safely remove — service names,
// headings, blog prose, the scaffold's "Why choose us" bullets — and fill a literal
// "[Your Company Name]" placeholder that shipped on three live custom domains.
//
//   npx tsx scripts/rename-live-claims.mjs                  # dry run, published sites
//   npx tsx scripts/rename-live-claims.mjs --apply
//   npx tsx scripts/rename-live-claims.mjs --apply --only graftontowing
//
// Every replacement is a hand-read entry in lib/rebuild/liveClaimRewrites.ts (tested: each target
// is a claim, each replacement is not). Applied to EVERY string in the tree, so the html / text /
// value copies all change together (CLAUDE.md §8). An entry that matches nothing is reported —
// a rewrite that finds no target is exactly the silent-success failure the last handoff named.
import { REWRITES, PLACEHOLDER, PLACEHOLDER_NAMES } from '../lib/rebuild/liveClaimRewrites.ts';
import { makesOperationalClaim } from '../lib/rebuild/scrubInventedClaims.ts';
import { loadEnv, makeRest, republishTemplate } from './lib/republishTemplate.mjs';

const APPLY = process.argv.includes('--apply');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const rest = makeRest(loadEnv());

/** Rewrite every string in place. Returns the changes; throws if a placeholder has no known name. */
function rewriteTree(node, slug, changes, matched) {
  if (Array.isArray(node)) return node.forEach((v) => rewriteTree(v, slug, changes, matched));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v !== 'string') { rewriteTree(v, slug, changes, matched); continue; }
    let next = v;
    if (next.includes(PLACEHOLDER)) {
      const name = PLACEHOLDER_NAMES[slug];
      if (!name) throw new Error(`"${PLACEHOLDER}" on ${slug} with no name in PLACEHOLDER_NAMES — refusing to guess`);
      next = next.split(PLACEHOLDER).join(name);
      matched.set(PLACEHOLDER, (matched.get(PLACEHOLDER) ?? 0) + 1);
    }
    for (const r of REWRITES) {
      if (!next.includes(r.from)) continue;
      next = next.split(r.from).join(r.to);
      matched.set(r.from, (matched.get(r.from) ?? 0) + 1);
    }
    if (next !== v) {
      node[k] = next;
      changes.push({ k, before: v, after: next });
    }
  }
}

const rows = await rest(`templates?select=id,slug,rev,published,data&published=eq.true&limit=400`);
const targets = rows.filter((t) => !ONLY || t.slug === ONLY);
const matched = new Map();
const tot = { scanned: 0, changed: 0, strings: 0, done: 0, fail: 0, repointed: 0 };

for (const tpl of targets) {
  tot.scanned++;
  const data = structuredClone(tpl.data);
  const changes = [];
  try {
    rewriteTree(data, tpl.slug, changes, matched);
  } catch (e) {
    console.log(`\n✗ ${tpl.slug} — ${e.message}`);
    tot.fail++;
    continue;
  }
  if (!changes.length) continue;

  tot.changed++;
  tot.strings += changes.length;
  console.log(`\n── ${tpl.slug} — ${changes.length} string${changes.length === 1 ? '' : 's'}`);
  for (const c of changes.slice(0, 3)) {
    const show = (s) => s.replace(/\s+/g, ' ').slice(0, 110);
    console.log(`   [${c.k}] - ${show(c.before)}`);
    console.log(`   ${' '.repeat(c.k.length)}  + ${show(c.after)}`);
  }

  if (!APPLY) continue;
  try {
    const { repointed } = await republishTemplate(
      rest, tpl, data,
      (snap) => rewriteTree(snap, tpl.slug, [], new Map()),
      'rename operational claims; fill company-name placeholder',
    );
    tot.done++;
    if (repointed) { tot.repointed++; console.log(`     legacy snapshot repointed → ${repointed.slice(0, 8)}…`); }
  } catch (e) {
    tot.fail++;
    console.log(`   ✗ ${tpl.slug} — ${e.message}`);
  }
}

// ── Which entries did work, and which found nothing? ─────────────────────────────────────────
console.log('\nRewrites by target:');
for (const r of [{ from: PLACEHOLDER, why: 'placeholder' }, ...REWRITES]) {
  const n = matched.get(r.from) ?? 0;
  console.log(`   ${String(n).padStart(4)}  ${n === 0 ? '⚠️ NO MATCH  ' : ''}${r.from.replace(/\s+/g, ' ').slice(0, 90)}`);
}
if (!ONLY) {
  const dead = REWRITES.filter((r) => !(matched.get(r.from) > 0));
  if (dead.length) console.log(`\n⚠️ ${dead.length} rewrite(s) matched nothing — either already applied, or the live string differs from the map.`);
}

// Positive control: three replacement strings, read back from the rewritten data, must be clean.
const sampled = [...matched.keys()].filter((k) => k !== PLACEHOLDER).slice(0, 3)
  .map((k) => REWRITES.find((r) => r.from === k)?.to ?? '');
for (const s of sampled) if (makesOperationalClaim(s)) throw new Error(`replacement still claims: ${s}`);

console.log(
  `\nscanned ${tot.scanned} · would change ${tot.changed} sites / ${tot.strings} strings` +
  (APPLY ? ` · applied ${tot.done}, repointed ${tot.repointed}, failed ${tot.fail}` : '\nDry run. Re-run with --apply to write.'),
);
