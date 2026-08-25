#!/usr/bin/env node
// scripts/fix-site-identity.mjs
//
// Correct an identity field (city, business name, site title) on a published site, then republish.
//
//   node scripts/fix-site-identity.mjs --slug cullmantow --key city --from Culllman --to Cullman
//   node scripts/fix-site-identity.mjs --slug cullmantow --key city --from Culllman --to Cullman --apply
//
// ⚠️ KEY-SCOPED AND EXACT-MATCH, NEVER A STRING REPLACE ACROSS THE TREE. On southhilltowing the
// business name "southhilltowing" also appears inside the hero image URL
// (…/templates/demo/southhilltowing/hero/…). A blanket replace would rewrite that path and 404 the
// image. So a value is only rewritten when its KEY is in --key AND the value matches --from
// exactly — and any value that looks like a URL is skipped outright.
//
// Both fixes this was written for are SEO-positive, which is worth stating since these pages rank:
//   • "Culllman" (three l's) → "Cullman" — matches the real city name people search.
//   • "southhilltowing" → "South Hill Towing" — the site ranks #4.6 for "south hill towing" while
//     showing its own slug as the business name.

import fs from 'node:fs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const arg = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const SLUG = arg('slug'), KEYS = (arg('key') || '').split(',').filter(Boolean);
const FROM = arg('from'), TO = arg('to');
if (!SLUG || !KEYS.length || FROM === null || TO === null) {
  throw new Error('need --slug, --key (comma-separated), --from, --to');
}

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
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(body?.message || `${res.status} ${String(text).slice(0, 200)}`);
  return body;
}

/** Rewrite only allow-listed keys whose value matches exactly; never anything URL-shaped. */
function retitle(node, hits = []) {
  if (Array.isArray(node)) { node.forEach((v) => retitle(v, hits)); return hits; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string') {
        if (KEYS.includes(k) && v.trim() === FROM && !/^https?:\/\//i.test(v)) {
          node[k] = TO; hits.push(k);
        }
      } else retitle(v, hits);
    }
  }
  return hits;
}

const [tpl] = await rest(`templates?select=id,slug,rev,published,data&slug=eq.${encodeURIComponent(SLUG)}`);
if (!tpl) throw new Error(`no template "${SLUG}"`);
const data = structuredClone(tpl.data);
const hits = retitle(data);
console.log(`\n  ${tpl.slug} rev=${tpl.rev} — "${FROM}" → "${TO}" on key(s) ${KEYS.join(',')}`);
console.log(`  fields rewritten: ${hits.length}${hits.length ? ' (' + hits.join(', ') + ')' : ''}`);
if (!hits.length) { console.log('  nothing to do.'); process.exit(0); }
if (!APPLY) { console.log('\n  Dry run. Re-run with --apply.'); process.exit(0); }

await rest('rpc/commit_template_http', {
  method: 'POST',
  body: JSON.stringify({ p_payload: { id: tpl.id, base_rev: tpl.rev ?? 0, patch: { data }, actor: null, kind: 'save', org_id: null } }),
});
console.log('  committed');

if (tpl.published) {
  await rest('rpc/publish_template_demo', { method: 'POST', body: JSON.stringify({ p_template_id: tpl.id }) });
  // ⚠️ Legacy `sites` rows shadow the republish — see scripts/strip-hero-image.mjs for the full
  // account. Without this the page never changes.
  const [legacy] = await rest(`sites?select=id,published_snapshot_id&slug=eq.${encodeURIComponent(tpl.slug)}`);
  if (legacy?.published_snapshot_id) {
    const [pinned] = await rest(`snapshots?select=*&id=eq.${legacy.published_snapshot_id}`);
    if (pinned) {
      const clean = structuredClone(pinned);
      retitle(clean);
      const [top] = await rest(`snapshots?select=rev&template_id=eq.${tpl.id}&order=rev.desc&limit=1`);
      clean.id = crypto.randomUUID();
      clean.rev = Math.max(tpl.rev ?? 0, top?.rev ?? 0) + 1;
      clean.created_at = new Date().toISOString();
      clean.commit_message = `identity fix: ${FROM} → ${TO}`;
      await rest('snapshots', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(clean) });
      await rest(`sites?id=eq.${legacy.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ published_snapshot_id: clean.id }),
      });
      console.log(`  legacy snapshot rewritten → ${clean.id.slice(0, 8)}…`);
    }
  }
  console.log('  republished');
}
