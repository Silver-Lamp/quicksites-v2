#!/usr/bin/env node
// scripts/set-apex-canonical.mjs
//
// Nominate ONE host for a site that answers on several, by writing `data.meta.canonical_origin`
// (honoured by the public render — lib/seo/canonicalUrl.ts#canonicalOriginFromMeta) and
// republishing so the served snapshot carries it.
//
//   node scripts/set-apex-canonical.mjs <slug> <https-origin> [--dry-run]
//   node scripts/set-apex-canonical.mjs renton-restaurant https://www.renton-restaurant.com
//
// ⚠️ THE PREFLIGHT IS THE POINT. The canonical helper's own note says cross-host consolidation
// needs "the domain's real attachment state", because a canonical pointing at a host whose DNS is
// not live is worse than the duplicate it replaces. So this script REFUSES to write unless the
// nominated origin, fetched right now, answers 200 without redirecting away and serves the same
// <title> as the site's own delivered.menu/platform host. A campaign row saying `attached` is not
// evidence (60 of 100 "attached" domains were never registered — CLAUDE.md §8); an HTTP response is.
//
// When the campaign row for this apex exists and still reads `planned`/`failed` while the .com
// verifiably serves, the row is corrected to `attached` — the same evidence, recorded once.
import { loadEnv, makeRest, republishTemplate } from './lib/republishTemplate.mjs';

const [slug, originArg, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry-run');
if (!slug || !originArg) {
  console.error('usage: set-apex-canonical.mjs <slug> <https-origin> [--dry-run]');
  process.exit(2);
}

let origin;
try {
  const u = new URL(originArg);
  if (u.protocol !== 'https:' || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) throw new Error('not a bare https origin');
  origin = `https://${u.host.toLowerCase()}`;
} catch (e) {
  console.error(`refusing: ${originArg} — ${e.message}`);
  process.exit(2);
}

const env = loadEnv();
const rest = makeRest(env);
const MENU_BASE = (env.NEXT_PUBLIC_MENU_BASE_DOMAIN || 'delivered.menu').trim();

async function fetchPage(url) {
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'quicksites-canonical-preflight' } });
  const html = res.status === 200 ? await res.text() : '';
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  const canonical = html.match(/rel="canonical" href="([^"]*)"/i)?.[1] ?? null;
  return { status: res.status, location: res.headers.get('location'), title, canonical };
}

const [tpl] = await rest(`templates?select=id,slug,rev,data,published&slug=eq.${encodeURIComponent(slug)}`);
if (!tpl) { console.error(`no template with slug ${slug}`); process.exit(1); }
if (!tpl.published) { console.error(`refusing: ${slug} is not published — a canonical on an unpublished site points at nothing`); process.exit(1); }

// The site's own host: what the visitor who typed the duplicate sees.
const own = await fetchPage(`https://${slug}.${MENU_BASE}/`);
const target = await fetchPage(`${origin}/`);
console.log(`own    https://${slug}.${MENU_BASE}/ → ${own.status} "${own.title}" canonical=${own.canonical}`);
console.log(`target ${origin}/ → ${target.status}${target.location ? ` → ${target.location}` : ''} "${target.title}" canonical=${target.canonical}`);

if (own.status !== 200) { console.error('refusing: the site does not serve on its own host, so nothing to consolidate'); process.exit(1); }
if (target.status !== 200) { console.error(`refusing: ${origin} answers ${target.status}${target.location ? ` (→ ${target.location})` : ''}, not 200 — DNS or attachment is not live`); process.exit(1); }
if (!target.title || target.title !== own.title) { console.error(`refusing: titles differ — the target is not verifiably this page`); process.exit(1); }

const current = tpl.data?.meta?.canonical_origin ?? null;
console.log(`canonical_origin: ${current ?? '(unset)'} → ${origin}`);
if (current === origin) { console.log('already set; nothing to do'); process.exit(0); }
if (DRY) { console.log('dry run — not written'); process.exit(0); }

const data = structuredClone(tpl.data ?? {});
data.meta = { ...(data.meta ?? {}), canonical_origin: origin };
const setOnSnapshot = (snap) => {
  if (snap?.data && typeof snap.data === 'object') snap.data.meta = { ...(snap.data.meta ?? {}), canonical_origin: origin };
  if (snap?.meta && typeof snap.meta === 'object') snap.meta = { ...snap.meta, canonical_origin: origin };
};
const { repointed } = await republishTemplate(rest, tpl, data, setOnSnapshot, `set canonical_origin ${origin}`);
console.log(`committed + published${repointed ? `; legacy snapshot repointed → ${repointed}` : ''}`);

// Correct a stale campaign row with the evidence we just collected.
const host = new URL(origin).host.replace(/^www\./, '');
const [camp] = await rest(`geo_industry_campaigns?select=id,domain,domain_status&domain=eq.${encodeURIComponent(host)}`);
if (camp && !['attached', 'registered'].includes(camp.domain_status)) {
  await rest(`geo_industry_campaigns?id=eq.${camp.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ domain_status: 'attached', updated_at: new Date().toISOString() }),
  });
  console.log(`campaign ${camp.domain}: domain_status ${camp.domain_status} → attached (it answered 200 just now)`);
}

// Read the served artifact back, not the row: the canonical is only real once the page says it.
const after = await fetchPage(`https://${slug}.${MENU_BASE}/`);
console.log(`served canonical now: ${after.canonical}`);
if (after.canonical !== `${origin}/`) {
  console.error(`⚠️ served canonical is ${after.canonical}, expected ${origin}/ — the deploy may not carry the render change yet; re-run to verify`);
  process.exit(3);
}
