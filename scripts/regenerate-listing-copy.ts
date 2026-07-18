// scripts/regenerate-listing-copy.ts
//
// Backfill: re-run the new LLM copy cleanup (lib/rebuild/enrichListingCopy) over the
// restaurant sites that were auto-built from listings BEFORE #549 — they still carry the
// templated "Bar · Brunch Restaurant — order online or stop by." copy and the "Home"
// <title>. Reconstructs a spec from each template's current data, regenerates clean
// name+locale copy + SEO, and commits it through the sanctioned commit_template RPC.
//
//   npm run regenerate:listing-copy            # DRY RUN — prints before → after, writes nothing
//   npm run regenerate:listing-copy -- --apply # actually commit the changes
//   npm run regenerate:listing-copy -- --apply --id <templateId>   # one site only
//
// Needs OPENAI_API_KEY (copy) + SUPABASE service-role env (in .env.local). Idempotent-ish:
// re-running just regenerates again (backs up the pre-regen copy under meta.copy_backup once).

import dotenv from 'dotenv';
// Load env BEFORE any lib import (supabaseAdmin reads env at construction) — hence the
// dynamic imports below, mirroring scripts/import-listings-batch.ts.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../../../.env.local' }); // when run from a worktree
dotenv.config();

const APPLY = process.argv.includes('--apply');
const ONLY_ID = (() => {
  const i = process.argv.indexOf('--id');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const ONLY_SLUG = (() => {
  const i = process.argv.indexOf('--slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();

function short(s: string, n = 72): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const { enrichListingCopy } = await import('@/lib/rebuild/enrichListingCopy');
  const { commitTemplatePatch } = await import('@/lib/templates/commitTemplatePatch');
  const { KEY_TO_LABEL } = await import('@/lib/industries');

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );

  // RESTAURANTS ONLY (unless --all): the other listing_import rows are geo-campaign pitch
  // sites (towing/plumbing/…) with purpose-built "Serving <city>… get a free quote" copy —
  // and no real city/state, so the LLM would invent a wrong location. Restaurants have real
  // addresses (accurate locale) and are the sites this cleanup was built for.
  const ALL = process.argv.includes('--all');
  let q = db
    .from('templates')
    .select('id, slug, template_name, business_name, industry, owner_id, rev, data, claim_source')
    .eq('claim_source', 'listing_import');
  if (ONLY_ID) q = q.eq('id', ONLY_ID);
  else if (ONLY_SLUG) q = q.eq('slug', ONLY_SLUG);
  else if (!ALL) q = q.eq('industry', 'restaurant');

  const { data: rows, error } = await q;
  if (error) {
    console.error('❌ query failed:', error.message);
    process.exit(1);
  }
  const templates = rows ?? [];
  console.log(
    `\n${APPLY ? '✍️  APPLY' : '🔎 DRY RUN'} — ${templates.length} listing_import site(s)${ONLY_ID ? ` (id=${ONLY_ID})` : ''}\n`,
  );

  let changed = 0;
  let failed = 0;

  for (const t of templates as any[]) {
    const data = t.data ?? {};
    const meta = data.meta ?? {};
    const page = data.pages?.[0] ?? {};
    const blocks: any[] = page.blocks ?? [];
    const heroBlock = blocks.find((b) => b?.type === 'hero');
    const menuBlock = blocks.find((b) => b?.type === 'menu');
    const contact = meta.contact ?? {};

    const industryKey = String(t.industry || meta.industry || 'restaurant');
    const businessName = t.business_name || meta.business_name || t.template_name || 'Restaurant';

    const spec: any = {
      businessName,
      industryKey,
      industryLabel: meta.industry_label || (KEY_TO_LABEL as any)[industryKey] || 'Restaurant',
      headline: heroBlock?.content?.headline || businessName,
      subheadline: heroBlock?.content?.subheadline || '',
      about: meta.about || '',
      services: Array.isArray(meta.services) ? meta.services : [],
      faqs: Array.isArray(meta.faqs) ? meta.faqs : [],
      contact: {
        ...(contact.city ? { city: contact.city } : {}),
        ...(contact.state ? { state: contact.state } : {}),
      },
    };

    const menu = menuBlock?.content?.sections?.length
      ? {
          sections: menuBlock.content.sections.map((s: any) => ({
            name: s?.name ?? '',
            items: Array.isArray(s?.items) ? s.items.map((i: any) => ({ name: i?.name ?? '' })) : [],
          })),
        }
      : undefined;

    let enriched: any;
    try {
      enriched = await enrichListingCopy(spec, { menu, operatorId: t.owner_id ?? null });
    } catch (e: any) {
      console.error(`  ❌ ${businessName} — enrich failed: ${e?.message || e}`);
      failed++;
      continue;
    }

    console.log(`• ${businessName}  (${t.slug})`);
    console.log(`    headline    : ${short(spec.headline)}  →  ${short(enriched.headline)}`);
    console.log(`    subheadline : ${short(spec.subheadline)}  →  ${short(enriched.subheadline)}`);
    console.log(`    seo title   : ${short(meta.siteTitle || page?.meta?.title || '(unset)')}  →  ${short(enriched.seoTitle || '')}`);
    console.log(`    seo desc    : ${short(meta.description || page?.meta?.description || '(unset)')}  →  ${short(enriched.seoDescription || '')}`);

    if (!APPLY) {
      console.log('');
      continue;
    }

    // Build the patched data blob.
    const nextData = JSON.parse(JSON.stringify(data));
    const nMeta = (nextData.meta = nextData.meta ?? {});
    const nPage = (nextData.pages ??= [{}])[0];
    const nBlocks: any[] = nPage.blocks ?? [];
    const nHero = nBlocks.find((b) => b?.type === 'hero');

    // One-time backup of the pre-regen copy so this is reversible.
    if (!nMeta.copy_backup) {
      nMeta.copy_backup = {
        at: new Date().toISOString(),
        headline: spec.headline,
        subheadline: spec.subheadline,
        about: spec.about,
        siteTitle: meta.siteTitle ?? null,
        description: meta.description ?? null,
      };
    }

    if (nHero?.content) {
      nHero.content.headline = enriched.headline || nHero.content.headline;
      nHero.content.subheadline = enriched.subheadline || nHero.content.subheadline;
    }
    if (enriched.about) nMeta.about = enriched.about;
    if (Array.isArray(enriched.faqs) && enriched.faqs.length) nMeta.faqs = enriched.faqs;
    if (enriched.seoTitle) {
      nMeta.siteTitle = enriched.seoTitle;
      nMeta.title = enriched.seoTitle;
    }
    if (enriched.seoDescription) nMeta.description = enriched.seoDescription;
    if (nPage) {
      nPage.meta = {
        ...(nPage.meta ?? {}),
        ...(enriched.seoTitle ? { title: enriched.seoTitle } : {}),
        ...(enriched.seoDescription ? { description: enriched.seoDescription } : {}),
      };
    }

    const err = await commitTemplatePatch(t.id, t.rev ?? 0, { data: nextData }, t.owner_id ?? null);
    if (err) {
      console.error(`    ❌ commit failed: ${err}\n`);
      failed++;
      continue;
    }
    console.log('    ✅ committed\n');
    changed++;
  }

  console.log(
    `\n${APPLY ? `Done — ${changed} committed, ${failed} failed.` : `Dry run — ${templates.length} would be regenerated. Re-run with --apply to commit.`}\n`,
  );

  if (APPLY) {
    console.log(
      'ℹ️  These are drafts/published sites; a published site needs a re-publish to push the new\n' +
        '   copy live. Claimed/published owners see it on their next publish, or republish from admin.\n',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
