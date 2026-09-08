#!/usr/bin/env node
// scripts/scrub-live-claims.mjs
//
// Remove operational claims from the SAFE fields of our own live geo sites: FAQ answers,
// subheadlines, subheadings and descriptions.
//
//   npx tsx scripts/scrub-live-claims.mjs                 # dry run
//   npx tsx scripts/scrub-live-claims.mjs --apply
//   npx tsx scripts/scrub-live-claims.mjs --apply --only spanawaytowing
//
// ⚠️ DELIBERATELY NARROW, and the exclusions are the point. An earlier dry run over every string
// showed what a blanket pass would do: delete `cta_text: "Get a Free Quote"` leaving a blank
// button, and delete `name: "24/7 Emergency Towing"` leaving a nameless service. Those need
// RENAMING, not removal. Blog prose (`html`/`value`/`text`) hides claims inside markup, where
// sentence surgery breaks pages. Both are excluded here and left as separate, deliberate work.
// #857 learned the same lesson the expensive way — its first cut produced "ready around the clock
// where we can to help you" and rewrote an FAQ question into nonsense.
//
// ⚠️ A QUESTION IS NOT A CLAIM. "Do you offer 24/7 service?" is fine and industryCopy already
// answers it honestly. Only answers are inspected; question fields are never touched.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { scrubText, makesOperationalClaim, honestAnswerFor, claimKind } from '../lib/rebuild/scrubInventedClaims.ts';

const APPLY = process.argv.includes('--apply');
// --drafts: the unpublished listing-import drafts the claim postcard would mail. Committed and
// NEVER published here — publishing an unclaimed draft takes a stranger's site live.
const DRAFTS = process.argv.includes('--drafts');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

/** The fields where removing a sentence leaves valid, readable copy. */
const ANSWER_FIELDS = new Set(['answer', 'a']);
const TRIM_FIELDS = new Set(['subheadline', 'subheading', 'description']);

// ⚠️ "Get a free quote today" in a subheadline is an INVITATION, the same thing as the
// `Get a Free Quote` button this script deliberately does not touch. Scrubbing it from marketing
// lines but leaving it on the button next to it would be inconsistent, and would rewrite 79 sites'
// subheadlines for the softest item on the list. In an ANSWER it is different — "we'll get back to
// you with a free, no-obligation quote" is a commitment someone made, not a button — so answers
// still replace it.
const SOFT_IN_MARKETING = new Set(['pricing']);

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Rewrite every safe string in the tree. Walks the WHOLE structure rather than known paths:
 * the same content lives at .pages[].content_blocks[].content, .pages[].blocks[].content and
 * .pages[].blocks[].props, and a path-specific edit updates one copy while the renderer may read
 * another (CLAUDE.md §8).
 */
function scrubTree(node, onChange) {
  if (Array.isArray(node)) return node.forEach((v) => scrubTree(v, onChange));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') {
      if (!makesOperationalClaim(v)) continue;
      // An ANSWER is replaced wholesale with an honest one; trimming it leaves a blank answer or a
      // fragment. A subheadline is trimmed, because the remaining sentence still reads.
      const next = ANSWER_FIELDS.has(k)
        ? honestAnswerFor(v)
        : TRIM_FIELDS.has(k) && !SOFT_IN_MARKETING.has(claimKind(v) ?? '')
          ? scrubText(v).text
          : null;
      if (next && next !== v) {
        node[k] = next;
        onChange(k, v, next);
      }
    } else scrubTree(v, onChange);
  }
}

const rows = await rest(
  DRAFTS
    ? `templates?select=id,slug,rev,published,data&published=eq.false&claim_source=eq.listing_import&limit=400`
    : `templates?select=id,slug,rev,published,data&published=eq.true&limit=400`,
);
const targets = rows.filter((t) => !ONLY || t.slug === ONLY);

const tot = { scanned: 0, changed: 0, strings: 0, done: 0, fail: 0, emptied: 0 };
for (const tpl of targets) {
  tot.scanned++;
  const data = structuredClone(tpl.data);
  const changes = [];
  scrubTree(data, (k, before, after) => changes.push({ k, before, after }));
  if (!changes.length) continue;

  tot.changed++;
  tot.strings += changes.length;
  console.log(`\n── ${tpl.slug} — ${changes.length} string${changes.length === 1 ? '' : 's'}`);
  for (const c of changes.slice(0, 4)) {
    console.log(`   [${c.k}] - ${c.before.slice(0, 120)}`);
    console.log(`   ${' '.repeat(c.k.length)}  + ${c.after ? c.after.slice(0, 120) : '(empty — field cleared)'}`);
    if (!c.after) tot.emptied++;
  }

  if (!APPLY) continue;
  try {
    await rest('rpc/commit_template_http', {
      method: 'POST',
      body: JSON.stringify({
        p_payload: { id: tpl.id, base_rev: tpl.rev ?? 0, patch: { data }, actor: null, kind: 'save', org_id: null },
      }),
    });
    if (DRAFTS) {
      tot.done++;
      continue; // commit only — an unclaimed draft is never published from here
    }
    await rest('rpc/publish_template_demo', { method: 'POST', body: JSON.stringify({ p_template_id: tpl.id }) });

    // ⚠️ Legacy `sites` rows shadow the republish: a custom domain is served from
    // sites.published_snapshot_id, which NO publish path writes. Without this the page never
    // changes, and the fix silently does nothing. Mint-and-repoint — never null the pointer,
    // which 404'd a position-1 domain once already.
    const [legacy] = await rest(`sites?select=id,published_snapshot_id&slug=eq.${encodeURIComponent(tpl.slug)}`);
    if (legacy?.published_snapshot_id) {
      const [pinned] = await rest(`snapshots?select=*&id=eq.${legacy.published_snapshot_id}`);
      if (pinned) {
        const clean = structuredClone(pinned);
        scrubTree(clean, () => {});
        clean.id = crypto.randomUUID();
        clean.created_at = new Date().toISOString();
        // (template_id, rev) is unique; reusing the template's current rev collides with any
        // snapshot already minted at it. Ask the table for its high-water mark.
        const [top] = await rest(`snapshots?select=rev&template_id=eq.${tpl.id}&order=rev.desc&limit=1`);
        clean.rev = Math.max(tpl.rev ?? 0, top?.rev ?? 0) + 1;
        clean.commit_message = 'scrub operational claims from answers/subheadlines';
        await rest('snapshots', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(clean) });
        await rest(`sites?id=eq.${legacy.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ published_snapshot_id: clean.id }),
        });
        console.log(`     legacy snapshot repointed → ${clean.id.slice(0, 8)}…`);
      }
    }
    tot.done++;
  } catch (e) {
    tot.fail++;
    console.log(`   ✗ ${tpl.slug} — ${e.message}`);
  }
}

console.log(
  `\nscanned ${tot.scanned} · would change ${tot.changed} sites / ${tot.strings} strings` +
  (tot.emptied ? ` · ${tot.emptied} fields would be left EMPTY — check those` : '') +
  (APPLY ? ` · applied ${tot.done}, failed ${tot.fail}` : '\nDry run. Re-run with --apply to write.'),
);
