// scripts/fix-listing-generic-services.ts
//
// Re-decide "Our Services" on the listing-built drafts this pipeline governs, from the three honest
// layers in lib/rebuild/listingServices.ts: the business's own NAME, what it declared to Google,
// and — only when those two are thin — the trade's standard list (stamped, with "call to confirm").
//
//     "Ferry Street Towing & Roadside Assistance", ["Car repair", "Point of interest", …]
//        → ["Roadside Assistance", "Towing", "Auto Repair"]                       source: listing
//     "Watertown Towing", ["Point of interest", "Service", "Establishment"]
//        → ["Towing & Recovery", "Roadside Assistance", "Battery Jump Start", …]  source: industry_default
//
// Which rows: a generic Places tag present, an empty list with no block (an earlier pass stripped
// it), or a row already stamped by this pipeline (so a new layer re-decides it). ⚠️ NOTHING ELSE —
// a first cut selected "not stamped yet", swept in 442 rows (every geo pitch site and restaurant
// draft) and would have handed restaurants "Online Ordering". Restaurants never enter here.
//
// Declared categories come from the prospect row (`outreach_prospects.categories`, the raw sweep
// types) when one points at the template, else from the stored list. Drafts render live from
// templates.data (no republish); writes go through the sanctioned commit_template RPC. Idempotent.
//
//   npx tsx --env-file=.env.local scripts/fix-listing-generic-services.ts            # dry run
//   npx tsx --env-file=.env.local scripts/fix-listing-generic-services.ts --apply
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

import { createClient } from '@supabase/supabase-js';
import { applyListingServices, cleanListingCategories, countServicesBlocks } from '../lib/rebuild/listingServices';

const APPLY = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!url || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  process.exit(1);
}
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const isFood = (industry: unknown) => String(industry ?? '') === 'restaurant' || String(industry ?? '').startsWith('food');

async function main() {
  const [{ data: rows, error }, { data: prospects, error: pErr }] = await Promise.all([
    db.from('templates').select('id, slug, rev, published, industry, business_name, data').eq('claim_source', 'listing_import'),
    db.from('outreach_prospects').select('template_id, business_name, categories').not('template_id', 'is', null),
  ]);
  if (error || pErr) {
    console.error(error?.message || pErr?.message);
    process.exit(1);
  }
  const prospectByTemplate = new Map<string, { business_name: string | null; categories: string[] }>();
  for (const p of (prospects ?? []) as any[]) prospectByTemplate.set(p.template_id, { business_name: p.business_name, categories: Array.isArray(p.categories) ? p.categories : [] });

  const { commitTemplatePatch } = APPLY ? await import('../lib/templates/commitTemplatePatch') : { commitTemplatePatch: null as any };

  let changed = 0;
  let defaulted = 0;
  let publishedTouched = 0;
  for (const r of (rows ?? []) as any[]) {
    if (isFood(r.industry)) continue;
    const data = JSON.parse(JSON.stringify(r.data ?? {}));
    const current: string[] = Array.isArray(data.services) ? data.services.map(String) : Array.isArray(data?.meta?.services) ? data.meta.services.map(String) : [];
    const hasGeneric = !same(cleanListingCategories(current), current);
    const wasStripped = current.length === 0 && countServicesBlocks(data) === 0;
    const stamped = data?.meta?.services_source === 'listing' || data?.meta?.services_source === 'industry_default';
    const prospect = prospectByTemplate.get(r.id);
    // A prospect row pointing here means the sweep built this draft — the population this pipeline
    // governs (geo pitch sites have no prospect; restaurants were excluded above).
    if (!hasGeneric && !wasStripped && !stamped && !prospect) continue;
    // Declared categories: the prospect's raw sweep types when we have them; else the stored list
    // when it is (or contains) declared categories; else nothing (a stamped default list is not
    // a declaration).
    const categories = prospect?.categories?.length
      ? prospect.categories
      : hasGeneric || data?.meta?.services_source === 'listing'
        ? current
        : [];
    const businessName = r.business_name || prospect?.business_name || data?.meta?.business_name || null;
    const before = countServicesBlocks(data);
    const beforeSource = data?.meta?.services_source ?? null;
    const { services, source, insertedBlocks } = applyListingServices(data, { categories, industryKey: r.industry, businessName });
    if (same(services, current) && source === beforeSource && !insertedBlocks) continue;

    changed++;
    if (source === 'industry_default') defaulted++;
    if (r.published) publishedTouched++;
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${r.slug}${r.published ? '  (PUBLISHED — needs a republish to reach the live snapshot)' : ''}`);
    console.log(`       "${businessName ?? ''}" · ${JSON.stringify(current)} → ${JSON.stringify(services)} · ${beforeSource ?? 'unstamped'} → ${source}${insertedBlocks ? ` · inserted ${insertedBlocks} block(s) (had ${before})` : ''}`);

    if (!APPLY) continue;
    const err = await commitTemplatePatch(r.id, r.rev ?? 0, { data }, null);
    if (err) console.error(`       ✗ ${err}`);
  }

  console.log(`\n${changed} draft(s) ${APPLY ? 'rewritten' : 'would be rewritten'} · ${defaulted} carry the standard list (+ call-to-confirm) · ${publishedTouched} published.`);
  if (!APPLY && changed) console.log('Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
