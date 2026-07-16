// app/api/admin/templates/seed-crafts/route.ts
//
// Seed the "templates per industry" layer with e-commerce CRAFTS starters: three
// distinct maker stores (candles / pottery / jewelry), each a real working shop —
// its own merchant, 6 priced catalog items with images, a products_grid wired to
// them, and meta.is_starter so the data-driven starters registry (the "Duplicate a
// template" picker) surfaces them with no code change. Duplicating one clones the
// catalog into the NEW owner's merchant (lib/commerce/starterCatalog.ts), so every
// variation sells for the person who starts from it.
//
// Admin-only; idempotent by slug (re-running skips existing). No AI spend — copy is
// hand-curated, images are deterministic picsum seeds (swap via the editor/library).
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import type { IndustryKey } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ItemSpec = { title: string; priceUsd: number; description: string };
type StoreSpec = {
  slug: string;
  businessName: string;
  industryKey: IndustryKey;
  tagline: string;
  gridTitle: string;
  items: ItemSpec[];
};

const STORES: StoreSpec[] = [
  {
    slug: 'starter-wildflower-candle-co',
    businessName: 'Wildflower Candle Co.',
    industryKey: 'crafts',
    tagline: 'Small-batch soy candles, hand-poured in reusable vessels.',
    gridTitle: 'The Collection',
    items: [
      { title: 'Lavender Fields — 8oz Soy Candle', priceUsd: 24, description: 'French lavender + bergamot. 45-hour burn, cotton wick, reusable amber jar.' },
      { title: 'Cedar & Sage — 8oz Soy Candle', priceUsd: 26, description: 'Campfire cedar, white sage, a whisper of smoke. Our best seller.' },
      { title: 'Vanilla Bean — 8oz Soy Candle', priceUsd: 22, description: 'Madagascar vanilla and warm sugar. The one everyone gifts.' },
      { title: 'Citrus Grove — 8oz Soy Candle', priceUsd: 24, description: 'Blood orange, grapefruit zest, and neroli. Sunshine in a jar.' },
      { title: 'Seasonal Trio Gift Set', priceUsd: 58, description: 'Three 4oz candles in this season’s scents, boxed and ribboned.' },
      { title: 'Wick Trimmer', priceUsd: 12, description: 'Matte-black steel trimmer for a clean burn, every time.' },
    ],
  },
  {
    slug: 'starter-clay-and-kiln-pottery',
    businessName: 'Clay & Kiln Studio',
    industryKey: 'handmade',
    tagline: 'Functional stoneware, thrown by hand and fired to last.',
    gridTitle: 'From the Kiln',
    items: [
      { title: 'Speckled Stoneware Mug', priceUsd: 32, description: '12oz, dishwasher-safe, satin glaze over speckled buff clay. No two alike.' },
      { title: 'Large Serving Bowl', priceUsd: 68, description: 'Generous 10" bowl in midnight glaze — salads, pasta, or the centerpiece.' },
      { title: 'Bud Vase', priceUsd: 38, description: 'A quiet little vase for a single stem. Matte white over toasted clay.' },
      { title: 'Dinner Plate Set (4)', priceUsd: 120, description: 'Four hand-thrown 10.5" plates. Stack beautifully, chip stubbornly.' },
      { title: 'Espresso Cup Pair', priceUsd: 44, description: 'Two 3oz cups with pulled handles. Morning ritual, upgraded.' },
      { title: 'Glaze Sample Tile', priceUsd: 8, description: 'Take a glaze home before committing to a full set.' },
    ],
  },
  {
    slug: 'starter-golden-thread-jewelry',
    businessName: 'Golden Thread Jewelry',
    industryKey: 'artisan_goods',
    tagline: 'Heirloom-quality pieces, made one at a time at the bench.',
    gridTitle: 'The Bench Collection',
    items: [
      { title: 'Hammered Gold Hoops', priceUsd: 45, description: '14k gold-filled hoops, hand-hammered for shimmer. Everyday weight.' },
      { title: 'Birthstone Necklace', priceUsd: 78, description: 'A genuine stone on a delicate 18" chain — tell us the month at checkout.' },
      { title: 'Stacking Rings — Set of 3', priceUsd: 95, description: 'Smooth, twist, and hammered bands in mixed metals. Made to mingle.' },
      { title: 'Wide Cuff Bracelet', priceUsd: 85, description: 'Brushed sterling cuff, formed and finished by hand.' },
      { title: 'Initial Pendant', priceUsd: 60, description: 'Hand-stamped brass initial on a gold-filled chain.' },
      { title: 'Jewelry Care Kit', priceUsd: 18, description: 'Polishing cloth, cleaning solution, and storage pouch.' },
    ],
  },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 56) || 'item';

/** Deterministic, hotlinkable product photo (the .jpg suffix keeps URL sniffers happy). */
const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800.jpg`;

export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const results: Array<{ slug: string; status: 'created' | 'exists' | 'failed'; templateId?: string; error?: string }> = [];

  for (const store of STORES) {
    // Idempotent: a starter already at this slug is left alone.
    const { data: existing } = await supabaseAdmin
      .from('templates')
      .select('id')
      .eq('slug', store.slug)
      .maybeSingle();
    if (existing?.id) {
      results.push({ slug: store.slug, status: 'exists', templateId: existing.id });
      continue;
    }

    try {
      // 1) A dedicated merchant per starter (NOT ensureMerchantForOwner — that would
      //    reuse the operator's real store and pollute it with seed products).
      const { data: merchant, error: mErr } = await supabaseAdmin
        .from('merchants')
        .insert({
          owner_id: gate.user.id,
          user_id: gate.user.id,
          display_name: store.businessName,
          site_slug: store.slug,
          default_currency: 'USD',
        })
        .select('id')
        .single();
      if (mErr || !merchant?.id) throw new Error(`merchant insert failed: ${mErr?.message}`);

      // 2) The catalog: 6 priced items with deterministic images.
      const itemIds: string[] = [];
      for (const item of store.items) {
        const { data: created, error: iErr } = await supabaseAdmin
          .from('catalog_items')
          .insert({
            merchant_id: merchant.id,
            type: 'product',
            title: item.title,
            slug: `${slugify(item.title)}-${Math.random().toString(36).slice(2, 6)}`,
            description: item.description,
            price_cents: Math.round(item.priceUsd * 100),
            images: [img(`${store.slug}-${slugify(item.title)}`)],
            status: 'active',
            metadata: { site_slug: store.slug, seeded_starter: store.slug },
          })
          .select('id')
          .single();
        if (iErr || !created?.id) throw new Error(`item insert failed: ${iErr?.message}`);
        itemIds.push(created.id as string);
      }

      // 3) The template: industry storefront scaffold, grid wired to the items,
      //    stamped as a starter for the data-driven registry.
      const tpl: any = buildIndustryStarter({ businessName: store.businessName, industryKey: store.industryKey });
      tpl.slug = store.slug;
      const page0 = tpl.data?.pages?.[0];
      const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];
      const hero = blocks.find((b) => b?.type === 'hero');
      if (hero?.content) {
        hero.content.headline = store.businessName;
        hero.content.subheadline = store.tagline;
        if ('cta_text' in hero.content) hero.content.cta_text = 'Shop the collection';
      }
      const grid = blocks.find((b) => b?.type === 'products_grid');
      if (grid) {
        grid.content = {
          ...(grid.content ?? {}),
          title: store.gridTitle,
          section_title: store.gridTitle,
          columns: 3,
          product_ids: itemIds,
          productIds: itemIds,
        };
      }
      tpl.data.meta = {
        ...(tpl.data.meta ?? {}),
        is_starter: true,
        starter_kind: 'crafts',
        ecom: { ...(tpl.data.meta?.ecom ?? {}), merchant_id: merchant.id },
      };

      const { data: inserted, error: tErr } = await supabaseAdmin
        .from('templates')
        .insert({
          template_name: store.businessName,
          slug: store.slug,
          data: tpl.data,
          color_mode: tpl.color_mode ?? 'dark',
          header_block: tpl.header_block ?? null,
          footer_block: tpl.footer_block ?? null,
          is_site: true,
          industry: store.industryKey,
          business_name: store.businessName,
          owner_id: gate.user.id,
        })
        .select('id')
        .single();
      if (tErr || !inserted?.id) throw new Error(`template insert failed: ${tErr?.message}`);

      // 4) Publish (snapshot + published=true) — the starters registry only lists
      //    published templates, and the picker's preview needs a rendered site.
      const { error: pubErr } = await (supabaseAdmin as any).rpc('publish_template_demo', {
        p_template_id: inserted.id,
      });
      if (pubErr) console.error(`[seed-crafts] publish failed for ${store.slug}:`, pubErr.message);

      results.push({ slug: store.slug, status: 'created', templateId: inserted.id });
    } catch (e: any) {
      results.push({ slug: store.slug, status: 'failed', error: e?.message || String(e) });
    }
  }

  // The admin list reads the materialized view — refresh so the starters show up.
  try {
    await (supabaseAdmin as any).rpc('refresh_template_bases');
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: results.every((r) => r.status !== 'failed'),
    results,
    created: results.filter((r) => r.status === 'created').length,
    exists: results.filter((r) => r.status === 'exists').length,
  });
}
