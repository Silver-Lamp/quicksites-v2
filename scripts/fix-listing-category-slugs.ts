// scripts/fix-listing-category-slugs.ts
//
// Clean raw Google Places type slugs out of user-facing copy on auto-built sites.
//
//     hero.subheadline → "bar · brunch_restaurant — call ahead or stop by."
//     services         → ["bar","brunch_restaurant","food","point_of_interest","establishment"]
//
// Two problems in one: the underscores are obviously machine output on a page presenting as a
// real business's own site, and half the list isn't a category at all — "point_of_interest"
// and "establishment" are Places taxonomy plumbing that no diner has ever wanted to read.
//
// THE CODE IS ALREADY CORRECT. `mapTypes` filters GENERIC_TYPES and title-cases, and
// `prettyCategory` guards the copy path; both run on every import today. This is stale data
// written before those guards, so it's a backfill with no source change.
//
// ⚠️ MUST BE FIELD-TARGETED, NOT A BLOB REGEX. A naive snake_case sweep over the JSON would
// also rewrite `"type": "order_bar"` → `"Order bar"`, silently destroying the sticky order bar
// on every restaurant page. `order_bar` genuinely appears in the same scan as the category
// slugs. So this walks named fields and never touches structural keys.
//
//   npx tsx scripts/fix-listing-category-slugs.ts            # dry run
//   npx tsx scripts/fix-listing-category-slugs.ts --apply
import { createClient } from '@supabase/supabase-js';
import { mapTypes } from '../lib/rebuild/importListing';

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

const looksRaw = (s: string) => /_/.test(String(s ?? ''));

/** Hero subheadline in the shape the fixed generator now produces. */
function subheadlineFor(cats: string[]): string {
  return cats.length
    ? `${cats.slice(0, 2).join(' · ')} — call ahead or stop by.`
    : 'Fresh food, made daily — call ahead or stop by.';
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
    const data = JSON.parse(JSON.stringify(r.data ?? {}));
    const notes: string[] = [];

    // 1. services arrays — mapTypes both filters Places plumbing and title-cases.
    for (const holder of [data, data.meta]) {
      if (!holder || !Array.isArray(holder.services)) continue;
      if (!holder.services.some((s: any) => looksRaw(s))) continue;
      const before = holder.services.length;
      holder.services = mapTypes(holder.services);
      notes.push(`services ${before} → ${holder.services.length} cleaned`);
    }

    // 2. hero subheadline — rebuilt from the cleaned categories so it matches what a fresh
    //    import would produce, rather than patched string-wise.
    const cleanCats: string[] = Array.isArray(data?.meta?.services)
      ? data.meta.services
      : Array.isArray(data?.services)
        ? data.services
        : [];

    const page = data?.pages?.[0];
    if (page) {
      for (const key of ['content_blocks', 'blocks'] as const) {
        if (!Array.isArray(page[key])) continue;
        page[key] = page[key].map((b: any) => {
          // NEVER touch b.type — that's what would have eaten `order_bar`.
          if (b?.type !== 'hero') return b;
          const c = b.content ?? b.props ?? {};
          // BOTH spellings. The two block shapes don't agree on the key either:
          // `content.subheadline` and `props.subheading` both exist in the wild, on the same
          // hero. Fixing only `subheadline` left "bar · brunch_restaurant" sitting in the
          // page payload — visible in the HTML, and one render-path change from being on
          // screen. Same lesson as content_blocks vs blocks, one level down.
          const patched = { ...c };
          let touched = false;
          for (const key of ['subheadline', 'subheading'] as const) {
            const sub = String(c[key] ?? '');
            if (!sub || !looksRaw(sub)) continue;
            patched[key] = subheadlineFor(cleanCats);
            notes.push(`hero.${key}: "${sub}" → "${patched[key]}"`);
            touched = true;
          }
          if (!touched) return b;
          return b.content ? { ...b, content: patched } : { ...b, props: patched };
        });
      }
    }

    if (!notes.length) continue;
    changed += 1;
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${r.slug}`);
    for (const n of notes) console.log(`       ${n}`);

    if (!APPLY) continue;
    const err = await commitTemplatePatch(r.id, r.rev ?? 0, { data }, null);
    if (err) console.error(`       ✗ ${err}`);
  }

  console.log(`\n${changed} site(s) ${APPLY ? 'rewritten' : 'would be rewritten'}.`);
  if (!APPLY && changed) console.log('Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
