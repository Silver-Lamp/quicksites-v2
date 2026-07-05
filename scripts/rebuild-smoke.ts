// scripts/rebuild-smoke.ts
//
// Smoke-test the AI site-conversion (rebuild) pipeline against a real URL WITHOUT
// the UI or a DB write. Runs the exact three stages the /api/rebuild route uses —
// scrape → infer spec (AI) → assemble draft — and prints what each produced, so you
// can eyeball conversion quality fast before clicking through the three UI surfaces.
//
//   npm run smoke:rebuild -- https://some-business-site.com
//
// Needs NEXT_PUBLIC_SUPABASE_URL + anon key (the meter chain constructs a client at
// import) and OPENAI_API_KEY (for the infer stage) from .env.local. No rows written.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Node 20 has no native WebSocket, but @supabase/supabase-js constructs a Realtime
// client at build (which the meter chain imports). Next's runtime provides one; a
// plain tsx process doesn't — so polyfill from `ws` before any supabase import runs.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* if ws isn't installed, scrape-only smoke still works */
  }
}

import { scrapeSite, ScrapeError } from '@/lib/rebuild/scrapeSite';
// NOTE: inferSiteSpec + assembleDraft are imported *dynamically* below — their
// module chain (meterLLMCall) constructs a Supabase client at import time, so we
// only pull them in when OPENAI_API_KEY is set (i.e. when we'll actually use them).
// This keeps scrape-only smoke runnable with zero env.

function hr(label: string) {
  console.log(`\n${'─'.repeat(4)} ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npm run smoke:rebuild -- <url>');
    console.error('Example: npm run smoke:rebuild -- https://www.example-plumber.com');
    process.exit(1);
  }

  hr('1) SCRAPE');
  let scraped;
  try {
    scraped = await scrapeSite(url);
  } catch (e) {
    if (e instanceof ScrapeError) {
      console.error(`❌ scrape blocked/failed [${e.code}]: ${e.message}`);
    } else {
      console.error('❌ scrape failed:', (e as any)?.message || e);
    }
    process.exit(1);
  }
  console.log({
    finalUrl: scraped.finalUrl,
    businessName: scraped.businessName,
    title: scraped.title,
    description: scraped.description,
    accentColor: scraped.accentColor,
    heroImage: scraped.heroImage,
    headings: scraped.headings,
    navLabels: scraped.navLabels,
    images: scraped.images.length,
    bodyPreview: scraped.bodyText.slice(0, 240) + (scraped.bodyText.length > 240 ? '…' : ''),
  });

  if (!process.env.OPENAI_API_KEY) {
    console.log('\n⚠ OPENAI_API_KEY not set — stopping after scrape (scrape-only smoke).');
    console.log('   Set it in .env.local to exercise the AI inference + assembly stages.');
    return;
  }

  const { inferSiteSpec } = await import('@/lib/rebuild/inferSiteSpec');
  const { buildRebuildTemplate } = await import('@/lib/rebuild/assembleDraft');

  hr('2) INFER SPEC (AI)');
  const spec = await inferSiteSpec(scraped, null);
  console.log({
    businessName: spec.businessName,
    industry: `${spec.industryLabel} (${spec.industryKey})`,
    headline: spec.headline,
    subheadline: spec.subheadline,
    about: spec.about,
    services: spec.services,
    faqs: spec.faqs,
  });

  hr('3) ASSEMBLE DRAFT (no DB write)');
  const tpl = buildRebuildTemplate({ spec, heroImage: scraped.heroImage, sourceUrl: scraped.finalUrl });
  const blocks: any[] = tpl.data?.pages?.[0]?.blocks ?? [];
  console.log({
    template_name: tpl.template_name,
    slug: tpl.slug,
    color_mode: tpl.color_mode,
    industry: tpl.industry,
    blockTypes: blocks.map((b) => b?.type),
    heroHeadline: blocks[0]?.content?.headline ?? null,
    heroImage: blocks[0]?.content?.image_url ?? null,
    services: tpl.data?.services,
  });

  console.log('\n✅ Smoke complete — pipeline ran end-to-end, no rows written.');
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
