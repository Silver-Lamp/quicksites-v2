// scripts/fix-listing-ordering-claims.ts
//
// Remove "order online" promises from auto-built sites that cannot take an order.
//
// Every listing-import restaurant draft shipped copy asserting online ordering:
//
//     hero  → "Chinese restaurant · Sushi restaurant — order online or stop by."
//     about → "King Buffet — chinese_restaurant. Order online for pickup, or come visit us."
//     seo   → "Eyman's Pizza — restaurant. Order online for pickup, or stop by."
//
// None of it is true. These are sites we built for real businesses from their public
// listings: no claimed owner, no merchant account, no Stripe, and for most of them no menu we
// could honestly publish. There is no order button, and nothing behind it if there were.
//
// The generators are fixed (lib/rebuild/importListing.ts + listingSeo.ts) so new drafts never
// carry the claim. This rewrites the sites already live.
//
// Deterministic string replacement, NOT an LLM regeneration. The phrasings are templated and
// known, so a substitution is cheaper, predictable, and cannot invent a fresh claim while
// removing this one — which re-running the copy model could. Replacements mirror the new
// generator output exactly, so backfilled and newly-built sites read identically.
//
//   npx tsx scripts/fix-listing-ordering-claims.ts            # dry run
//   npx tsx scripts/fix-listing-ordering-claims.ts --apply
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!url || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  process.exit(1);
}
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/**
 * Ordered, case-insensitive. Longest/most-specific first so a broad rule can't eat a phrase a
 * narrower one handles better. Each replacement promises the phone and the door — both true
 * on day one — and never ordering, which becomes true only after a claim.
 */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/Order online for pickup, or come visit us\./gi, 'Give us a call, or come visit us.'],
  [/Order online for pickup, or stop by\./gi, 'See hours and call ahead, or stop by.'],
  [/Order online for pickup\./gi, 'Call ahead for pickup.'],
  [/—\s*order online or stop by\./gi, '— call ahead or stop by.'],
  [/\border online or stop by\./gi, 'call ahead or stop by.'],
  [/\bOrder online\b/g, 'Call ahead'],
  [/\border online\b/g, 'call ahead'],
];

function rewrite(json: string): { out: string; hits: number } {
  let out = json;
  let hits = 0;
  for (const [re, to] of REPLACEMENTS) {
    out = out.replace(re, () => {
      hits += 1;
      return to;
    });
  }
  return { out, hits };
}

async function main() {
  const { data: rows, error } = await db
    .from('templates')
    .select('id, slug, rev, data')
    .eq('claim_source', 'listing_import');
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const { commitTemplatePatch } = APPLY
    ? await import('../lib/templates/commitTemplatePatch')
    : { commitTemplatePatch: null as any };

  let changed = 0;
  for (const r of (rows ?? []) as any[]) {
    const before = JSON.stringify(r.data ?? {});
    const { out, hits } = rewrite(before);
    if (!hits) continue;

    changed += 1;
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${r.slug.padEnd(46)} ${hits} claim(s)`);

    // Show what actually changes, so a dry run is reviewable rather than a count.
    const beforeCopy = JSON.parse(before);
    const afterCopy = JSON.parse(out);
    const heroBefore = beforeCopy?.pages?.[0]?.content_blocks?.find((b: any) => b?.type === 'hero')?.content?.subheadline;
    const heroAfter = afterCopy?.pages?.[0]?.content_blocks?.find((b: any) => b?.type === 'hero')?.content?.subheadline;
    if (heroBefore && heroBefore !== heroAfter) {
      console.log(`       hero: "${heroBefore}"`);
      console.log(`          → "${heroAfter}"`);
    }

    if (!APPLY) continue;

    const err = await commitTemplatePatch(r.id, r.rev ?? 0, { data: afterCopy }, null);
    if (err) console.error(`       ✗ ${err}`);
  }

  console.log(`\n${changed} site(s) ${APPLY ? 'rewritten' : 'would be rewritten'}.`);
  if (!APPLY && changed) console.log('Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
