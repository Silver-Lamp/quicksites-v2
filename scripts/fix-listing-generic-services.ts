// scripts/fix-listing-generic-services.ts
//
// Take Google's taxonomy tags out of "Our Services" on every listing-built draft.
//
//     ["Car repair", "Point of interest", "Service", "Establishment"]  →  ["Car repair"]
//     ["Point of interest", "Service", "Establishment"]                →  []  + the services block removed
//
// Why the 2026-07 slug-fix script did not catch these: it keyed on underscores (`looksRaw`), and
// these were already title-cased — the leak is upstream of the prettifier, on the sweep-built path
// (header of lib/rebuild/listingServices.ts). Source fixed in the same PR; this is the backfill.
//
// Drafts render live from templates.data, so no republish is needed. Writes go through the
// sanctioned commit_template RPC (direct UPDATEs are blocked by trigger).
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
    .select('id, slug, rev, published, data')
    .eq('claim_source', 'listing_import');
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const { commitTemplatePatch } = APPLY ? await import('../lib/templates/commitTemplatePatch') : { commitTemplatePatch: null as any };

  let changed = 0;
  let stripped = 0;
  let publishedTouched = 0;
  for (const r of (rows ?? []) as any[]) {
    const data = JSON.parse(JSON.stringify(r.data ?? {}));
    const current: string[] = Array.isArray(data.services) ? data.services.map(String) : Array.isArray(data?.meta?.services) ? data.meta.services.map(String) : [];
    const cleaned = cleanListingCategories(current);
    // Only rows where a generic tag is actually present. A draft whose list is already clean — or
    // already empty — is left exactly as it is, scaffold block included: this script fixes one leak,
    // it does not re-decide every draft's services.
    if (same(cleaned, current)) continue;

    const blocksBefore = countServicesBlocks(data);
    const { services, removedBlocks } = applyListingServices(data, current);
    changed++;
    if (removedBlocks) stripped++;
    if (r.published) publishedTouched++;
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${r.slug}${r.published ? '  (PUBLISHED — needs a republish to reach the live snapshot)' : ''}`);
    console.log(`       services ${JSON.stringify(current)} → ${JSON.stringify(services)}${removedBlocks ? ` · removed ${removedBlocks} of ${blocksBefore} services block(s)` : ''}`);

    if (!APPLY) continue;
    const err = await commitTemplatePatch(r.id, r.rev ?? 0, { data }, null);
    if (err) console.error(`       ✗ ${err}`);
  }

  console.log(`\n${changed} draft(s) ${APPLY ? 'rewritten' : 'would be rewritten'} · ${stripped} lose the services block entirely · ${publishedTouched} published.`);
  if (!APPLY && changed) console.log('Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
