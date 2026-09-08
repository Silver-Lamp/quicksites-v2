// scripts/fix-listing-generic-services.ts
//
// Take Google's taxonomy tags out of "Our Services" on every listing-built draft, and give a draft
// whose listing declared nothing usable the trade's standard list (stamped so the page says so).
//
//     ["Car repair", "Point of interest", "Service", "Establishment"]  →  ["Car repair"]           (source: listing)
//     ["Point of interest", "Service", "Establishment"]                →  the towing scaffold list  (source: industry_default,
//                                                                          + "call to confirm" under it)
//     []  (a draft an earlier pass stripped)                           →  the same restore
//
// Why the 2026-07 slug-fix script did not catch these: it keyed on underscores (`looksRaw`), and
// these were already title-cased — the leak is upstream of the prettifier, on the sweep-built path
// (header of lib/rebuild/listingServices.ts). Source fixed in the same PR; this is the backfill.
//
// Drafts render live from templates.data, so no republish is needed. Writes go through the
// sanctioned commit_template RPC (direct UPDATEs are blocked by trigger). Idempotent: a row whose
// lists are already clean and stamped is skipped.
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

async function main() {
  const { data: rows, error } = await db
    .from('templates')
    .select('id, slug, rev, published, industry, data')
    .eq('claim_source', 'listing_import');
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const { commitTemplatePatch } = APPLY ? await import('../lib/templates/commitTemplatePatch') : { commitTemplatePatch: null as any };

  let changed = 0;
  let defaulted = 0;
  let publishedTouched = 0;
  let noIndustry = 0;
  for (const r of (rows ?? []) as any[]) {
    const data = JSON.parse(JSON.stringify(r.data ?? {}));
    const current: string[] = Array.isArray(data.services) ? data.services.map(String) : Array.isArray(data?.meta?.services) ? data.meta.services.map(String) : [];
    const cleaned = cleanListingCategories(current);
    const hasGeneric = !same(cleaned, current);
    // The 13 an earlier pass stripped: empty list AND no block. A restaurant is never one of them —
    // food drafts carry a menu, not a services block, and the food scaffold's default list says
    // "Online Ordering", a promise no unclaimed draft may make.
    const isFood = String(r.industry ?? '') === 'restaurant' || String(r.industry ?? '').startsWith('food');
    const wasStripped = current.length === 0 && countServicesBlocks(data) === 0 && !isFood;
    // ⚠️ Touch ONLY those two cases. A first cut also selected "not stamped yet", which swept in 442
    // rows — every geo pitch site and restaurant draft — and would have relabelled scaffold lists as
    // declared. This script fixes one leak and undoes one over-correction; it does not re-decide
    // every draft's services.
    if (!hasGeneric && !wasStripped) continue;

    const declared = hasGeneric ? cleaned : [];
    const before = countServicesBlocks(data);
    const { services, source, insertedBlocks } = applyListingServices(data, declared, r.industry);
    if (source === 'industry_default' && !services.length) {
      noIndustry++;
      console.log(`SKIP ${r.slug} — nothing declared and no industry to default from`);
      continue;
    }
    changed++;
    if (source === 'industry_default') defaulted++;
    if (r.published) publishedTouched++;
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${r.slug}${r.published ? '  (PUBLISHED — needs a republish to reach the live snapshot)' : ''}`);
    console.log(`       ${JSON.stringify(current)} → ${JSON.stringify(services)} · source ${source}${insertedBlocks ? ` · inserted ${insertedBlocks} block(s) (had ${before})` : ''}`);

    if (!APPLY) continue;
    const err = await commitTemplatePatch(r.id, r.rev ?? 0, { data }, null);
    if (err) console.error(`       ✗ ${err}`);
  }

  console.log(`\n${changed} draft(s) ${APPLY ? 'rewritten' : 'would be rewritten'} · ${defaulted} on the industry default (+ call-to-confirm) · ${publishedTouched} published · ${noIndustry} skipped (no industry).`);
  if (!APPLY && changed) console.log('Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
