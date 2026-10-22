// scripts/guide/build-tried-and-graded.mts — build (or rebuild the content of) the evidence guide
// site from lib/guide/triedAndGraded.ts. Operator-owned, UNPUBLISHED: only an admin sees it until
// the owner picks a domain and publishes (publishing health content is the owner's call). LIVE since
// 2026-10-21: after --apply, run scripts/guide/publish-tried-and-graded.mts — this commits the DRAFT only,
// and visitors are served the published snapshots.
//
// ⚠️ Run only after the `evidence_claims` block is DEPLOYED — a draft holding a block type the
// running code doesn't know throws `Invalid block` when the editor or renderer normalises it.
//
//   npx tsx --env-file=.env.local scripts/guide/build-tried-and-graded.mts          # dry: prints pages
//   npx tsx --env-file=.env.local scripts/guide/build-tried-and-graded.mts --apply  # insert, or commit over the existing draft
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { GUIDE_NAME, GUIDE_PAGES, type GuideBlock } from '@/lib/guide/triedAndGraded';

const APPLY = process.argv.includes('--apply');
// ⚠️ A custom domain is served from /sites/<domain label> (middleware.ts, 'Arbitrary custom domain → slug
// from apex label'), so the slug MUST equal the domain's label: triedandgraded.com → 'triedandgraded'.
// Published first as 'tried-and-graded' and every page 404'd on the domain until renamed (2026-10-21).
const SLUG = 'triedandgraded';
const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';

function block(b: GuideBlock): any {
  if (b.kind === 'hero') {
    const x: any = createDefaultBlock('hero' as any);
    x.content = { ...(x.content ?? {}), headline: b.headline, subheadline: b.subheadline, hide_cta: true, cta_text: '', layout_mode: 'inline', image_url: '' };
    return x;
  }
  if (b.kind === 'text') {
    const x: any = createDefaultBlock('text' as any);
    x.content = { ...(x.content ?? {}), html: b.html };
    return x;
  }
  const x: any = createDefaultBlock('evidence_claims' as any);
  x.content = { ...(x.content ?? {}), topic: b.topic, claim_ids: b.claimIds, ...(b.title ? { title: b.title } : {}), show_studies: true };
  return x;
}

function buildData() {
  const pages = GUIDE_PAGES.map((p, i) => {
    const blocks = p.blocks.map(block);
    return {
      id: globalThis.crypto.randomUUID(),
      slug: p.slug,
      title: p.navLabel ?? (i === 0 ? 'Home' : p.title),
      path: i === 0 ? '/' : `/${p.slug}`,
      meta: { title: p.title, description: p.description },
      show_header: true,
      show_footer: true,
      blocks,
      content_blocks: structuredClone(blocks),
    };
  });
  const nav = GUIDE_PAGES.filter((p) => p.navLabel).map((p) => ({ href: `/${p.slug}`, label: p.navLabel!, appearance: 'default' }));
  const header: any = createDefaultBlock('header' as any);
  header.content = { ...(header.content ?? {}), logo_url: '', nav_items: nav };
  const footer: any = createDefaultBlock('footer' as any);
  footer.content = { ...(footer.content ?? {}), logo_url: '', links: nav, show_find_us: false, show_map: false };
  const home = GUIDE_PAGES[0];
  return {
    data: {
      meta: { siteTitle: GUIDE_NAME, business_name: GUIDE_NAME, title: home.title, description: home.description, guide: { source: 'lib/guide/triedAndGraded.ts' } },
      pages,
      services: [],
      color_mode: 'dark',
      headerBlock: header,
      footerBlock: footer,
    },
    header,
    footer,
  };
}

async function main() {
  const { data, header, footer } = buildData();
  for (const p of data.pages) console.log(`${p.path.padEnd(40)} ${p.blocks.map((b: any) => b.type).join(' → ')}  | ${p.meta.title}`);
  if (!APPLY) return;
  const { data: existing } = await supabaseAdmin.from('templates').select('id, rev').eq('slug', SLUG).maybeSingle();
  if (existing) {
    const err = await commitTemplatePatch((existing as any).id, (existing as any).rev ?? 0, { data }, OPERATOR_ID);
    if (err) throw new Error(`commit: ${err}`);
    console.log(`updated ${SLUG} (${(existing as any).id})`);
    return;
  }
  const row = {
    id: globalThis.crypto.randomUUID(),
    template_name: GUIDE_NAME,
    slug: SLUG,
    data,
    color_mode: 'dark',
    header_block: header,
    footer_block: footer,
    is_site: false,
    industry: 'other',
    business_name: GUIDE_NAME,
    owner_id: OPERATOR_ID,
  };
  const { data: ins, error } = await supabaseAdmin.from('templates').insert(row).select('id, slug').single();
  if (error) throw new Error(`insert: ${error.message}`);
  console.log(`inserted ${ins.slug} (${ins.id}) — unpublished; admin preview https://www.quicksites.ai/sites/${ins.slug}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
