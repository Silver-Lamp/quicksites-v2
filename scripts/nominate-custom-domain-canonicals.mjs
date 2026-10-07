#!/usr/bin/env node
// scripts/nominate-custom-domain-canonicals.mjs
//
// Fleet version of set-apex-canonical.mjs: for every PUBLISHED site served on a custom domain,
// nominate that domain as the one canonical host (`data.meta.canonical_origin`), so the copies
// at `<slug>.quicksites.ai` and `/sites/<slug>` stop declaring themselves canonical.
//
//   node scripts/nominate-custom-domain-canonicals.mjs            # dry run: table only
//   node scripts/nominate-custom-domain-canonicals.mjs --apply    # write + republish
//   node scripts/nominate-custom-domain-canonicals.mjs --apply --limit 10 --only bremerton-towing.com
//
// ⚠️ WHY. Search Console mailed "Duplicate, Google chose different canonical than user" for
// bremerton-towing.com (2026-10-07). The site answers on three hosts and each one canonicalised to
// ITSELF — the renderer is self-referencing by design unless a site nominates a host, and 54 of
// 55 published custom-domain campaign sites had nominated nothing. Google saw three originals and
// picked one. Fleet-wide, not one site.
//
// ⚠️ THE PREFLIGHT IS THE POINT, and it is per row at write time. A canonical pointing at a host
// whose DNS is not live is worse than the duplicate it replaces, and a campaign row saying
// `attached` is not evidence (60 of 100 "attached" domains were never registered — CLAUDE.md §8).
// So each candidate is written only if, right now: the domain answers (following its own
// apex→www / http→https redirects, staying on the same registrable domain) with a 200 whose
// <title> matches the same page on the site's platform host. The nominated origin is the FINAL
// host of that chain — the one Google lands on — never the bare apex if the apex redirects.
//
// ⚠️ Writes the DRAFT and republishes (same path as set-apex-canonical.mjs via republishTemplate),
// so a draft holding unreviewed edits would ship them. Geo pitch sites are machine-built and not
// hand-edited, which is why this is acceptable here and would not be for a customer's site.
import { loadEnv, makeRest, republishTemplate } from './lib/republishTemplate.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = Number(args[args.indexOf('--limit') + 1] || 0) || Infinity;
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const PLATFORM = 'quicksites.ai';

const env = loadEnv();
const rest = makeRest(env);

const registrable = (host) => host.toLowerCase().replace(/^www\./, '');

async function fetchPage(url) {
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'quicksites-canonical-preflight' } });
  const html = res.status === 200 ? await res.text() : '';
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  const canonical = html.match(/rel="canonical" href="([^"]*)"/i)?.[1] ?? null;
  return { status: res.status, location: res.headers.get('location'), title, canonical };
}

/** Follow the domain's own redirects (≤3 hops, same registrable domain) to its final 200. */
async function resolveFinal(domain) {
  let url = `https://${domain}/`;
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetchPage(url);
    if (r.status === 200) return { ok: true, origin: new URL(url).origin.toLowerCase(), ...r };
    if ([301, 302, 307, 308].includes(r.status) && r.location) {
      const next = new URL(r.location, url);
      if (next.protocol !== 'https:' || registrable(next.host) !== registrable(domain)) {
        return { ok: false, reason: `redirects off-domain to ${next.host}` };
      }
      url = `${next.origin}/`;
      continue;
    }
    return { ok: false, reason: `answers ${r.status}` };
  }
  return { ok: false, reason: 'redirect loop' };
}

// Candidates: campaign-bound custom domains + templates with their own custom_domain.
const campaigns = await rest(
  `geo_industry_campaigns?select=domain,domain_status,template_id&domain=not.is.null&domain_status=in.(attached,registered)`,
);
// A campaign can hold a domain and no template yet; nothing to canonicalise there.
const byTemplate = new Map(campaigns.filter((c) => c.template_id).map((c) => [c.template_id, c.domain]));
const ids = [...byTemplate.keys()];
const templates = [];
for (let i = 0; i < ids.length; i += 50) {
  const chunk = ids.slice(i, i + 50);
  templates.push(...(await rest(`templates?select=id,slug,rev,data,published,archived,custom_domain&id=in.(${chunk.join(',')})`)));
}
const own = await rest(`templates?select=id,slug,rev,data,published,archived,custom_domain&custom_domain=neq.&published=eq.true`);
for (const t of own) if (!byTemplate.has(t.id)) { byTemplate.set(t.id, t.custom_domain); templates.push(t); }

const rows = [];
let written = 0;
for (const tpl of templates) {
  const domain = registrable(byTemplate.get(tpl.id) ?? '');
  if (!domain) continue;
  if (ONLY && domain !== ONLY) continue;
  if (!tpl.published || tpl.archived) { rows.push([domain, tpl.slug, 'skip', 'not published']); continue; }
  const current = tpl.data?.meta?.canonical_origin ?? null;
  let fin = await resolveFinal(domain);
  if (!fin.ok) { rows.push([domain, tpl.slug, 'refuse', fin.reason]); continue; }
  // ⚠️ FOLLOW GOOGLE'S PICK WHEN BOTH HOSTS SERVE. On the first run three sites answered 200 on
  // BOTH apex and www (no redirect between them), the chain ended on the apex, and the URL
  // Inspection sweep then showed Google had chosen www every time. Nominating the host Google
  // did not choose leaves the duplicate in place. So if the sweep has recorded a Google canonical
  // for this site on a different host of the same domain, and that host serves this page too,
  // nominate THAT one — it is the only choice that ends the disagreement.
  const seen = await rest(`gsc_url_inspections?select=google_canonical&template_id=eq.${tpl.id}&google_canonical=not.is.null&order=inspected_at.desc&limit=1`).catch(() => []);
  const googleHost = seen?.[0]?.google_canonical ? new URL(seen[0].google_canonical).host.toLowerCase() : null;
  if (googleHost && googleHost !== new URL(fin.origin).host && registrable(googleHost) === domain) {
    const alt = await fetchPage(`https://${googleHost}/`);
    if (alt.status === 200 && alt.title && alt.title === fin.title) {
      fin = { ...fin, origin: `https://${googleHost}`, title: alt.title, note: 'Google-chosen host' };
    }
  }
  const ownPage = await fetchPage(`https://${tpl.slug}.${PLATFORM}/`);
  if (ownPage.status !== 200) { rows.push([domain, tpl.slug, 'refuse', `platform host answers ${ownPage.status}`]); continue; }
  if (!fin.title || fin.title !== ownPage.title) { rows.push([domain, tpl.slug, 'refuse', `titles differ: "${fin.title}" vs "${ownPage.title}"`]); continue; }
  if (current === fin.origin) { rows.push([domain, tpl.slug, 'ok', `already ${fin.origin}`]); continue; }
  if (!APPLY) { rows.push([domain, tpl.slug, 'would set', `${current ?? '(unset)'} → ${fin.origin}${fin.note ? ` (${fin.note})` : ''}`]); continue; }
  if (written >= LIMIT) { rows.push([domain, tpl.slug, 'deferred', 'limit reached']); continue; }
  const data = structuredClone(tpl.data ?? {});
  data.meta = { ...(data.meta ?? {}), canonical_origin: fin.origin };
  const setOnSnapshot = (snap) => {
    if (snap?.data && typeof snap.data === 'object') snap.data.meta = { ...(snap.data.meta ?? {}), canonical_origin: fin.origin };
    if (snap?.meta && typeof snap.meta === 'object') snap.meta = { ...snap.meta, canonical_origin: fin.origin };
  };
  try {
    const { repointed } = await republishTemplate(rest, tpl, data, setOnSnapshot, `set canonical_origin ${fin.origin}`);
    // Read the served artifact back: the canonical is only real once the platform copy says it.
    const after = await fetchPage(`https://${tpl.slug}.${PLATFORM}/`);
    const served = after.canonical === `${fin.origin}/` ? 'served ✓' : `served ${after.canonical} ✗`;
    rows.push([domain, tpl.slug, 'set', `${fin.origin} · ${served}${repointed ? ' · legacy snapshot repointed' : ''}`]);
    written += 1;
  } catch (e) {
    rows.push([domain, tpl.slug, 'error', e?.message ?? String(e)]);
  }
}

const w = [Math.max(...rows.map((r) => r[0].length), 6), Math.max(...rows.map((r) => r[1].length), 4), 9];
for (const r of rows) console.log(r[0].padEnd(w[0]), r[1].padEnd(w[1]), r[2].padEnd(w[2]), r[3]);
const tally = rows.reduce((a, r) => ((a[r[2]] = (a[r[2]] ?? 0) + 1), a), {});
console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'} · ${rows.length} candidates ·`, JSON.stringify(tally));
