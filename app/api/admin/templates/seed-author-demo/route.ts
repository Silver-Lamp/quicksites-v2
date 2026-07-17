// app/api/admin/templates/seed-author-demo/route.ts
//
// The Arlo V. demo storefront — the FIRST real import through the author-commerce
// bridge (crosstalk/contracts/sellable-artifacts-export.md), seeded from HJ's
// prod-validated payload (lib/authorSites/arloDemo.ts, verbatim). This is the site
// both products show real authors at HJ Author Sites launch (crosstalk ideas.md §1):
// a persona author with a REAL Lulu-printable paperback + a REAL 75MB audiobook.
//
// Honesty rules enforced here: HJ's fictional-author labeling line renders on the
// site verbatim; the storefront is stamped is_starter (duplication clones the
// catalog into the duplicator's own merchant — #464's invariant) + fictional_author.
// Admin-only; idempotent by slug.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { mapArtifactsToCatalogItems } from '@/lib/authorSites/importArtifacts';
import { ARLO_PAYLOAD, ARLO_PERSONA, ARLO_LABELING_LINE } from '@/lib/authorSites/arloDemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SLUG = 'arlo-v-books';

export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { data: existing } = await supabaseAdmin
    .from('templates')
    .select('id')
    .eq('slug', SLUG)
    .maybeSingle();
  if (existing?.id) {
    return NextResponse.json({ ok: true, status: 'exists', templateId: existing.id });
  }

  try {
    // 1) Dedicated merchant (never the operator's real store — same rule as the
    //    starter seeder).
    const { data: merchant, error: mErr } = await supabaseAdmin
      .from('merchants')
      .insert({
        owner_id: gate.user.id,
        user_id: gate.user.id,
        display_name: `${ARLO_PERSONA.display_name} — Author`,
        site_slug: SLUG,
        default_currency: 'USD',
      })
      .select('id')
      .single();
    if (mErr || !merchant?.id) throw new Error(`merchant insert failed: ${mErr?.message}`);

    // 2) THE REAL IMPORT — the exact mapper the contract test proves, run for real.
    const mapped = mapArtifactsToCatalogItems(ARLO_PAYLOAD, { merchantId: merchant.id, siteSlug: SLUG });
    const itemIds: string[] = [];
    for (const row of mapped.rows) {
      const { data: created, error: iErr } = await supabaseAdmin
        .from('catalog_items')
        .insert(row)
        .select('id')
        .single();
      if (iErr || !created?.id) throw new Error(`item insert failed: ${iErr?.message}`);
      itemIds.push(created.id as string);
    }
    if (!itemIds.length) throw new Error('no ready artifacts mapped — nothing to sell');

    // 3) The author site: author-industry storefront scaffold, grid wired to the
    //    imported items, persona bio + THE VERBATIM LABELING LINE on the page.
    const tpl: any = buildIndustryStarter({ businessName: ARLO_PERSONA.display_name, industryKey: 'author' });
    tpl.slug = SLUG;
    const page0 = tpl.data?.pages?.[0];
    const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];

    const hero = blocks.find((b) => b?.type === 'hero');
    if (hero?.content) {
      hero.content.headline = `${ARLO_PERSONA.display_name} — author of ${ARLO_PAYLOAD.work.title}`;
      hero.content.subheadline =
        'A dystopian novel about a society that broadcasts everything — in paperback and machine-narrated audiobook.';
      if ('cta_text' in hero.content) hero.content.cta_text = 'Get the book';
      if ('cta_link' in hero.content) hero.content.cta_link = '#products';
    }
    const grid = blocks.find((b) => b?.type === 'products_grid');
    if (grid) {
      grid.content = {
        ...(grid.content ?? {}),
        title: 'The Book & Audiobook',
        section_title: 'The Book & Audiobook',
        columns: 2,
        product_ids: itemIds,
        productIds: itemIds,
      };
    }

    // About-the-author story block: persona bio + the labeling line, verbatim.
    const story: any = createDefaultBlock('story');
    story.content = {
      ...story.content,
      title: `About ${ARLO_PERSONA.display_name}`,
      sections: [
        {
          heading: `About ${ARLO_PERSONA.display_name}`,
          body: `${ARLO_PERSONA.bio}\n\n${ARLO_LABELING_LINE}`,
          image_url: '',
          cta_text: '',
          cta_link: '',
        },
      ],
    };
    const gridIdx = blocks.findIndex((b) => b?.type === 'products_grid');
    blocks.splice(gridIdx >= 0 ? gridIdx + 1 : blocks.length, 0, story);

    tpl.data.meta = {
      ...(tpl.data.meta ?? {}),
      is_starter: true, // duplication clones the catalog to the new owner (#464)
      starter_kind: 'author_demo',
      fictional_author: true, // the honesty stamp; labeling line also renders on-page
      hj_work_id: ARLO_PAYLOAD.work.id,
      ecom: { ...(tpl.data.meta?.ecom ?? {}), merchant_id: merchant.id },
    };

    const { data: inserted, error: tErr } = await supabaseAdmin
      .from('templates')
      .insert({
        template_name: `${ARLO_PERSONA.display_name} — Author`,
        slug: SLUG,
        data: tpl.data,
        color_mode: tpl.color_mode ?? 'dark',
        header_block: tpl.header_block ?? null,
        footer_block: tpl.footer_block ?? null,
        is_site: true,
        industry: 'author',
        business_name: ARLO_PERSONA.display_name,
        owner_id: gate.user.id,
      })
      .select('id')
      .single();
    if (tErr || !inserted?.id) throw new Error(`template insert failed: ${tErr?.message}`);

    // 4) Publish so the storefront is demoable at its public URL.
    const { error: pubErr } = await (supabaseAdmin as any).rpc('publish_template_demo', {
      p_template_id: inserted.id,
    });
    if (pubErr) console.error('[seed-author-demo] publish failed:', pubErr.message);

    try {
      await (supabaseAdmin as any).rpc('refresh_template_bases');
    } catch { /* best-effort */ }

    return NextResponse.json({
      ok: true,
      status: 'created',
      templateId: inserted.id,
      merchantId: merchant.id,
      items: itemIds.length,
      priceReview: mapped.rows.filter((r) => r.metadata.price_needs_review).length,
      publicPath: `/sites/${SLUG}`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
