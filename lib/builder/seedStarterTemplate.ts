// lib/builder/seedStarterTemplate.ts
//
// The ENGINE of the per-industry starter tool: turn one StarterSpec into a real,
// published starter — industry scaffold, (for storefront packs) a dedicated merchant
// + priced catalog wired into the products grid, the is_starter stamp the data-driven
// registry reads, and a publish so the picker can preview it. Idempotent by slug.
// Specs live in lib/builder/starterSeeds.ts; the admin route fans this out.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { starterSpecFor, type StarterSpec } from '@/lib/builder/starterSeeds';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';

export type SeedStarterResult = {
  slug: string;
  industryKey: IndustryKey;
  status: 'created' | 'exists' | 'failed';
  templateId?: string;
  items?: number;
  error?: string;
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 56) || 'item';

/** Deterministic, hotlinkable placeholder photo (.jpg suffix keeps URL sniffers happy). */
const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800.jpg`;

export async function seedStarterTemplate(opts: {
  industryKey: IndustryKey;
  ownerId: string;
}): Promise<SeedStarterResult> {
  const label = KEY_TO_LABEL[opts.industryKey] ?? opts.industryKey;
  const spec: StarterSpec = starterSpecFor(opts.industryKey, label);
  const base = { slug: spec.slug, industryKey: opts.industryKey };

  // Idempotent: an existing starter at this slug is left alone.
  const { data: existing } = await supabaseAdmin
    .from('templates')
    .select('id')
    .eq('slug', spec.slug)
    .maybeSingle();
  if (existing?.id) return { ...base, status: 'exists', templateId: existing.id };

  try {
    // 1) Product pack → a DEDICATED merchant + catalog (never ensureMerchantForOwner
    //    here: that reuses the operator's earliest merchant and would pollute their
    //    real store with seed products).
    let merchantId: string | null = null;
    const itemIds: string[] = [];
    if (spec.pack) {
      const { data: merchant, error: mErr } = await supabaseAdmin
        .from('merchants')
        .insert({
          owner_id: opts.ownerId,
          user_id: opts.ownerId,
          display_name: spec.businessName,
          site_slug: spec.slug,
          default_currency: 'USD',
        })
        .select('id')
        .single();
      if (mErr || !merchant?.id) throw new Error(`merchant insert failed: ${mErr?.message}`);
      merchantId = merchant.id as string;

      for (const item of spec.pack.items) {
        const { data: created, error: iErr } = await supabaseAdmin
          .from('catalog_items')
          .insert({
            merchant_id: merchantId,
            type: 'product',
            title: item.title,
            slug: `${slugify(item.title)}-${Math.random().toString(36).slice(2, 6)}`,
            description: item.description,
            price_cents: Math.round(item.priceUsd * 100),
            images: [img(`${spec.slug}-${slugify(item.title)}`)],
            status: 'active',
            metadata: { site_slug: spec.slug, seeded_starter: spec.slug },
          })
          .select('id')
          .single();
        if (iErr || !created?.id) throw new Error(`item insert failed: ${iErr?.message}`);
        itemIds.push(created.id as string);
      }
    }

    // 2) The template: industry scaffold (services/menu/storefront layout + theme all
    //    come from buildIndustryStarter), grid wired when a pack exists, starter stamp.
    const tpl: any = buildIndustryStarter({ businessName: spec.businessName, industryKey: opts.industryKey });
    tpl.slug = spec.slug;
    const page0 = tpl.data?.pages?.[0];
    const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];
    if (spec.pack) {
      const hero = blocks.find((b) => b?.type === 'hero');
      if (hero?.content) {
        hero.content.headline = spec.businessName;
        hero.content.subheadline = spec.pack.tagline;
        if ('cta_text' in hero.content) hero.content.cta_text = 'Shop the collection';
      }
      const grid = blocks.find((b) => b?.type === 'products_grid');
      if (grid) {
        grid.content = {
          ...(grid.content ?? {}),
          title: spec.pack.gridTitle,
          section_title: spec.pack.gridTitle,
          columns: 3,
          product_ids: itemIds,
          productIds: itemIds,
        };
      }
    }
    tpl.data.meta = {
      ...(tpl.data.meta ?? {}),
      is_starter: true,
      starter_kind: opts.industryKey,
      ...(merchantId ? { ecom: { ...(tpl.data.meta?.ecom ?? {}), merchant_id: merchantId } } : {}),
    };

    const { data: inserted, error: tErr } = await supabaseAdmin
      .from('templates')
      .insert({
        template_name: spec.businessName,
        slug: spec.slug,
        data: tpl.data,
        color_mode: tpl.color_mode ?? 'dark',
        header_block: tpl.header_block ?? null,
        footer_block: tpl.footer_block ?? null,
        is_site: true,
        industry: opts.industryKey,
        business_name: spec.businessName,
        owner_id: opts.ownerId,
      })
      .select('id')
      .single();
    if (tErr || !inserted?.id) throw new Error(`template insert failed: ${tErr?.message}`);

    // 3) Publish (snapshot + published=true) — the starters registry lists only
    //    published templates and the picker preview needs a rendered site.
    const { error: pubErr } = await (supabaseAdmin as any).rpc('publish_template_demo', {
      p_template_id: inserted.id,
    });
    if (pubErr) console.error(`[seed-starters] publish failed for ${spec.slug}:`, pubErr.message);

    return { ...base, status: 'created', templateId: inserted.id, items: itemIds.length };
  } catch (e: any) {
    return { ...base, status: 'failed', error: e?.message || String(e) };
  }
}
