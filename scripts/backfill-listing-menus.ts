// scripts/backfill-listing-menus.ts
//
// Replace scaffold-placeholder menus with the restaurant's REAL menu, OCR'd from their Google
// listing photos.
//
// THE PROBLEM. A listing-import draft is a site we auto-built for a real, named business. When
// the menu OCR finds nothing, the food scaffold's placeholder menu is what ships — so
// burnett-s-pub-2bvmo.delivered.menu, presenting as Burnett's Pub of Renton WA, publicly
// advertised "Signature Entrée — $19 — Describe your best seller here." Four of the five
// restaurants on renton-restaurant.com were in that state: a real business's name, real
// address, real phone number, and an invented menu.
//
// That is the same class of dishonesty as putting generated people on a real business's site
// (lib/images/noPeople.ts): fabricated specifics presented as that business's own.
//
// ⚠️ THIS SPENDS MONEY. Per restaurant: one Places Details call, then two metered OpenAI
// vision calls (pickMenuPhotos at low detail to find which photos are menus, then
// menuFromPhotos at high detail to read them). Both go through meterLLMCall, so the budget
// guard and cost log apply. Roughly a few cents each. Run it deliberately, not in a loop.
//
// ⚠️ NEVER WRITES A WORSE MENU THAN IT FOUND. If OCR returns nothing, the template is left
// untouched and reported as a failure — a blank menu and a fake menu are both wrong, and
// choosing between them is a judgement call for a human, not this script.
//
//   npx tsx scripts/backfill-listing-menus.ts            # dry run: shows what OCR found
//   npx tsx scripts/backfill-listing-menus.ts --apply
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

/** The scaffold's placeholder dishes. Presence of these = no real menu was ever found. */
const PLACEHOLDER_NAMES = new Set([
  'Signature Entrée',
  'Two Eggs Any Style',
  'Buttermilk Pancakes',
  'House Burger',
  'Garden Salad',
]);

type Item = { name?: string; description?: string; price?: string };
type Section = { name?: string; items?: Item[] };

/**
 * Read a template's menu sections from EITHER block shape.
 *
 * The fleet carries two coexisting schemas: `pages[0].blocks[]` uses `props`, while
 * `pages[0].content_blocks[]` uses `content`. Eyman's real 32-item menu lives only in
 * `blocks[].props.sections`; reading just `content.sections` reports it as having ZERO menu
 * items, which is exactly how this backfill nearly targeted the wrong restaurants.
 */
function readMenuSections(data: any): Section[] {
  const page = data?.pages?.[0] ?? {};
  const all = [...(page.content_blocks ?? []), ...(page.blocks ?? [])];
  for (const b of all) {
    if (b?.type !== 'menu') continue;
    const c = b.content ?? b.props ?? {};
    const sections = Array.isArray(c.sections) ? c.sections : [];
    if (sections.length) return sections;
  }
  return [];
}

function isPlaceholderMenu(sections: Section[]): boolean {
  const names = sections.flatMap((s) => (s.items ?? []).map((i) => String(i?.name ?? '')));
  if (!names.length) return true; // no menu at all counts as "needs a real one"
  return names.every((n) => PLACEHOLDER_NAMES.has(n));
}

/** Write sections into every menu block, in whichever shape that block uses. */
function writeMenuSections(data: any, sections: Section[]): any {
  const next = JSON.parse(JSON.stringify(data));
  const page = next?.pages?.[0];
  if (!page) return next;
  for (const key of ['content_blocks', 'blocks'] as const) {
    if (!Array.isArray(page[key])) continue;
    page[key] = page[key].map((b: any) => {
      if (b?.type !== 'menu') return b;
      // Preserve the shape this block already uses — flipping props↔content would make it
      // invisible to whichever renderer path reads the other one.
      if (b.content) return { ...b, content: { ...b.content, sections } };
      if (b.props) return { ...b, props: { ...b.props, sections } };
      return { ...b, content: { sections } };
    });
  }
  return next;
}

async function main() {
  const { data: prospects } = await db
    .from('outreach_prospects')
    .select('business_name, place_id, template_id')
    .eq('geo_campaign_id', '638c48bc-330b-4556-a571-b1b1ac39fecc')
    .not('template_id', 'is', null)
    .not('place_id', 'is', null);

  if (!prospects?.length) {
    console.log('No prospects with a place_id. Nothing to do.');
    return;
  }

  const { fetchGooglePlace } = await import('../lib/rebuild/importListing');
  const { pickMenuPhotos, menuFromPhotos } = await import('../lib/rebuild/menuFromPhotos');
  const { commitTemplatePatch } = await import('../lib/templates/commitTemplatePatch');

  const results: string[] = [];

  for (const p of prospects as any[]) {
    const { data: tpl } = await db
      .from('templates')
      .select('id, slug, rev, data')
      .eq('id', p.template_id)
      .maybeSingle();
    if (!tpl) continue;

    const current = readMenuSections(tpl.data);
    if (!isPlaceholderMenu(current)) {
      const n = current.flatMap((s) => s.items ?? []).length;
      console.log(`SKIP  ${tpl.slug.padEnd(46)} already has a real menu (${n} items)`);
      results.push(`${p.business_name}: skipped (real menu already)`);
      continue;
    }

    console.log(`\n▶ ${p.business_name} (${tpl.slug})`);

    // Fresh from Places: these URLs are KEYED and short-lived-in-memory. They must be, because
    // OpenAI fetches them from its own servers — the keyless proxy form we persist is
    // unfetchable there. See lib/rebuild/importListing.ts.
    let photos: string[] = [];
    try {
      const place = await fetchGooglePlace(p.place_id);
      photos = place?.photos ?? [];
    } catch (e: any) {
      console.log(`  ✗ Places fetch failed: ${e?.message || e}`);
      results.push(`${p.business_name}: FAILED (places)`);
      continue;
    }
    console.log(`  ${photos.length} listing photo(s)`);
    if (!photos.length) {
      results.push(`${p.business_name}: FAILED (no photos)`);
      continue;
    }

    const menuPhotos = await pickMenuPhotos(photos, null);
    console.log(`  ${menuPhotos.length} look like menus`);
    if (!menuPhotos.length) {
      console.log('  ✗ no menu photos — leaving the template untouched');
      results.push(`${p.business_name}: FAILED (no menu photo in listing)`);
      continue;
    }

    const extracted = await menuFromPhotos(menuPhotos, null);
    const sections = extracted?.sections ?? [];
    const itemCount = sections.flatMap((s: any) => s.items ?? []).length;
    console.log(`  OCR → ${sections.length} section(s), ${itemCount} item(s)`);

    if (!itemCount) {
      console.log('  ✗ nothing legible — leaving the placeholder rather than blanking it');
      results.push(`${p.business_name}: FAILED (illegible)`);
      continue;
    }

    for (const s of sections.slice(0, 3)) {
      const names = (s.items ?? []).slice(0, 3).map((i: any) => i.name).join(', ');
      console.log(`    ${s.name}: ${names}${(s.items?.length ?? 0) > 3 ? ', …' : ''}`);
    }

    if (!APPLY) {
      results.push(`${p.business_name}: would write ${itemCount} items`);
      continue;
    }

    const nextData = writeMenuSections(tpl.data, sections);
    const err = await commitTemplatePatch(tpl.id, tpl.rev ?? 0, { data: nextData }, null);
    if (err) {
      console.log(`  ✗ commit failed: ${err}`);
      results.push(`${p.business_name}: FAILED (commit)`);
    } else {
      console.log(`  ✓ wrote ${itemCount} real items`);
      results.push(`${p.business_name}: ${itemCount} items written`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  for (const r of results) console.log('  ' + r);
  if (!APPLY) console.log('\nDry run. Re-run with --apply to write.');
  else {
    console.log('\n⚠️ Any restaurant still marked FAILED is STILL SHOWING A PLACEHOLDER MENU');
    console.log('   on a live page under its real name. That needs a human decision:');
    console.log('   source the menu another way, or remove the menu block entirely.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
