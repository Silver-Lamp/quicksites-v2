// scripts/strip-placeholder-menus.ts
//
// Remove invented menus from auto-built sites for real businesses.
//
// A listing-import draft is a site we built for a real, named business from their public
// listing, without asking them. When the menu OCR finds nothing, the food scaffold's
// PLACEHOLDER menu is what ships — so burnett-s-pub-2bvmo.delivered.menu, presenting as
// Burnett's Pub of Renton WA, publicly advertised:
//
//     Signature Entrée — $19 — "Describe your best seller here."
//     Two Eggs Any Style · Buttermilk Pancakes · House Burger · Garden Salad
//
// Four of the five restaurants on renton-restaurant.com were in that state: real name, real
// address, real phone number, invented menu. That is fabricated specifics presented as a real
// business's own — the same class as generated people on a real business's site
// (lib/images/noPeople.ts, network rule 9).
//
// WHY NOT JUST GET THE REAL MENU: we tried. scripts/backfill-listing-menus.ts ran the OCR
// pipeline against all four; each has 10 Google listing photos and ZERO of them are menus
// (they're food plates, interiors and storefronts). All four are also `(no website)` — which
// is precisely why they were listing-import prospects — so there is no page to scrape either.
// There is no honest menu available today.
//
// So the page keeps everything true (name, address, phone, hours) and stops asserting a menu.
// A real owner adds their own once they claim it, which is the funnel working as designed.
//
// Also blanks the order bar's "View Menu" CTA, which would otherwise scroll to a section that
// no longer exists. The Call button stays — with no menu, calling IS the working action.
//
//   npx tsx scripts/strip-placeholder-menus.ts            # dry run
//   npx tsx scripts/strip-placeholder-menus.ts --apply
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

const PLACEHOLDER_NAMES = new Set([
  'Signature Entrée',
  'Two Eggs Any Style',
  'Buttermilk Pancakes',
  'House Burger',
  'Garden Salad',
]);

/**
 * Menu sections from EITHER block shape. `pages[0].blocks[]` uses `props`,
 * `content_blocks[]` uses `content`; reading only one misreports real menus as empty.
 */
function readMenuSections(data: any): any[] {
  const page = data?.pages?.[0] ?? {};
  for (const b of [...(page.content_blocks ?? []), ...(page.blocks ?? [])]) {
    if (b?.type !== 'menu') continue;
    const c = b.content ?? b.props ?? {};
    if (Array.isArray(c.sections) && c.sections.length) return c.sections;
  }
  return [];
}

/** True only when EVERY item is a known scaffold placeholder — never strip a real menu. */
function isPlaceholderOnly(sections: any[]): boolean {
  const names = sections.flatMap((s: any) => (s.items ?? []).map((i: any) => String(i?.name ?? '')));
  if (!names.length) return false; // an empty menu block is a different problem; leave it
  return names.every((n) => PLACEHOLDER_NAMES.has(n));
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

  const targets = (rows ?? []).filter((r: any) => isPlaceholderOnly(readMenuSections(r.data)));
  if (!targets.length) {
    console.log('No placeholder-only menus found.');
    return;
  }

  console.log(`${targets.length} site(s) publishing an invented menu under a real business name:\n`);

  const { commitTemplatePatch } = APPLY
    ? await import('../lib/templates/commitTemplatePatch')
    : { commitTemplatePatch: null as any };

  for (const r of targets as any[]) {
    const items = readMenuSections(r.data).flatMap((s: any) => s.items ?? []).length;
    console.log(`  ${APPLY ? 'FIX ' : 'DRY '} ${r.slug.padEnd(46)} removing ${items} fake item(s)`);
    if (!APPLY) continue;

    const next = JSON.parse(JSON.stringify(r.data));
    const page = next?.pages?.[0];
    if (!page) continue;

    for (const key of ['content_blocks', 'blocks'] as const) {
      if (!Array.isArray(page[key])) continue;
      page[key] = page[key]
        .filter((b: any) => b?.type !== 'menu')
        .map((b: any) => {
          if (b?.type !== 'order_bar') return b;
          // Explicit '' — the renderer now treats that as "no menu CTA" (it used to fall back
          // to '#menu' via ||, rendering a button that scrolled nowhere).
          const c = b.content ?? b.props ?? {};
          const patched = { ...c, cta_href: '', cta_label: '' };
          return b.content ? { ...b, content: patched } : { ...b, props: patched };
        });
    }

    const err = await commitTemplatePatch(r.id, r.rev ?? 0, { data: next }, null);
    if (err) console.error(`    ✗ ${r.slug}: ${err}`);
    else console.log(`    ✓ menu removed; Call button retained`);
  }

  if (!APPLY) console.log('\nDry run. Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
