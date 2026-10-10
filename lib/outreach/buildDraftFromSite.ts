// lib/outreach/buildDraftFromSite.ts
//
// "Their site → a claimable ORDERING draft" — the sibling of buildDraftFromListing for the
// restaurant that already has a website and takes no online orders. The listing builder OCRs a
// menu from photos because there is nothing else; this one reads the menu the restaurant
// already published (homepage + menu subpages, the same path /api/rebuild walks), so the draft
// carries THEIR menu in THEIR words — never an invented one (#738).
//
// The draft is operator-owned and stamped claim_source='listing_import' so it rides the same
// claim flow, delivered.menu watermark and demand capture as a listing draft. It is marked
// meta.ordering_companion = true with the source site, because the honest pitch is "link this
// from the site you already have", not "replace the site you paid for"; the rep copy and the
// claim page read that flag. No products import, no generated hero (a restaurant has no
// catalog to provision and a generated photo asserts a kitchen that may not exist).

import { supabaseAdmin } from '@/lib/supabase/admin';
import { scrapeSite, scrapeMenuPages, ScrapeError } from '@/lib/rebuild/scrapeSite';
import { inferSiteSpec } from '@/lib/rebuild/inferSiteSpec';
import { buildRebuildTemplate } from '@/lib/rebuild/assembleDraft';
import { filterMenuToEvidence, evidenceCorpus } from '@/lib/rebuild/menuEvidence';

/** Every copy of every menu block (blocks + content_blocks, content + props) — CLAUDE.md §8. */
export function stampMenuSourcedAt(data: any, iso: string): number {
  let n = 0;
  for (const pg of data?.pages ?? []) {
    for (const b of [...(pg?.blocks ?? []), ...(pg?.content_blocks ?? [])]) {
      if (b?.type !== 'menu') continue;
      for (const copy of [b.content, b.props]) {
        if (copy && typeof copy === 'object') {
          copy.sourced_at = iso;
          n += 1;
        }
      }
    }
  }
  return n;
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export type BuildFromSiteInput = {
  website: string;
  /** The uid that owns the draft until the business claims it. */
  operatorId: string;
  /** Google's name for the business — used only when the site yields none. */
  fallbackName?: string | null;
  fallbackPhone?: string | null;
};

export type BuildFromSiteResult = {
  id: string;
  slug: string;
  summary: {
    businessName: string;
    phone: string | null;
    menuItems: number;
    menuSections: string[];
    sourceUrl: string;
    /** Dishes the model proposed that the site never mentions — left out, named here. */
    droppedItems: string[];
    /** Confirmed dishes whose price was not on the site — kept, price removed. */
    droppedPrices: string[];
  };
};

export class BuildFromSiteError extends Error {
  code: 'scrape_failed' | 'ai_failed' | 'insert_failed';
  constructor(code: BuildFromSiteError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'BuildFromSiteError';
  }
}

export async function buildDraftFromSite(input: BuildFromSiteInput): Promise<BuildFromSiteResult> {
  let scraped;
  try {
    scraped = await scrapeSite(input.website);
  } catch (e) {
    const msg = e instanceof ScrapeError ? e.message : 'Could not read that site.';
    throw new BuildFromSiteError('scrape_failed', msg);
  }
  const menuPages = await scrapeMenuPages(scraped).catch(() => []);

  let spec;
  try {
    spec = await inferSiteSpec(scraped, input.operatorId, menuPages);
  } catch (e: any) {
    throw new BuildFromSiteError('ai_failed', e?.name === 'LLMBudgetExceededError' ? 'AI is busy right now — try again shortly.' : 'Could not read the menu.');
  }
  if (!spec.businessName?.trim() && input.fallbackName) spec.businessName = input.fallbackName;
  if (!spec.contact?.phone && input.fallbackPhone) spec.contact = { ...(spec.contact ?? {}), phone: input.fallbackPhone };

  // ⚠️ A dish survives only if the site says it exists (lib/rebuild/menuEvidence.ts). The first
  // real build put "Lasagna $16.65" on Rock Island Pizza, which sells no lasagna. Applied BEFORE
  // assembly so the invented item never reaches the template data.
  const evidence = filterMenuToEvidence(spec.menu, evidenceCorpus(scraped, menuPages));
  spec.menu = evidence.menu;

  const tpl = buildRebuildTemplate({
    spec,
    heroImage: scraped.heroImage,
    sourceUrl: scraped.finalUrl,
    galleryImages: scraped.images,
    colorMode: scraped.colorMode,
  });
  // ⚠️ A price read from the restaurant's LIVE site today is a dated price. The freshness rule
  // (lib/menu/menuFreshness.ts) hides any price it cannot date — right for a photo of unknown
  // age, wrong here: the exhibit said "call to confirm" beside dishes whose prices the owner had
  // published that morning, while the preview drawer totalled them (2026-10-10). `sourced_at` is
  // the spelling that rule accepts for "read from the source on this date"; only prices the
  // evidence guard confirmed survive to carry it.
  stampMenuSourcedAt(tpl.data, new Date().toISOString());
  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    ordering_companion: true,
    source_site: scraped.finalUrl,
    // What the evidence guard did, on the record — so a reviewer can see why a dish is missing.
    menu_evidence: { kept: evidence.kept, dropped_items: evidence.droppedItems, dropped_prices: evidence.droppedPrices },
  };

  let insertedId: string | null = null;
  let slug = tpl.slug;
  for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
    const row: any = {
      id: uuid(),
      template_name: attempt === 0 ? tpl.template_name : `${tpl.template_name} ${attempt + 1}`,
      slug,
      data: tpl.data,
      color_mode: tpl.color_mode,
      header_block: tpl.header_block,
      footer_block: tpl.footer_block,
      is_site: false,
      industry: tpl.industry,
      business_name: tpl.business_name,
      owner_id: input.operatorId,
      claim_source: 'listing_import',
    };
    const { data, error } = await supabaseAdmin.from('templates').insert(row).select('id, slug').single();
    if (!error && data) {
      insertedId = data.id;
      slug = data.slug;
      break;
    }
    if (error && `${error.code}` === '23505') {
      slug = `${tpl.slug}-${Math.random().toString(36).slice(2, 5)}`;
      continue;
    }
    throw new BuildFromSiteError('insert_failed', error?.message || 'Could not save the draft.');
  }
  if (!insertedId) throw new BuildFromSiteError('insert_failed', 'Could not allocate a unique draft.');

  const sections = spec.menu?.sections ?? [];
  return {
    id: insertedId,
    slug,
    summary: {
      businessName: spec.businessName,
      phone: spec.contact?.phone ?? null,
      menuItems: sections.reduce((n: number, s: any) => n + (s.items?.length ?? 0), 0),
      menuSections: sections.map((s: any) => `${s.name} (${s.items?.length ?? 0})`),
      sourceUrl: scraped.finalUrl,
      droppedItems: evidence.droppedItems,
      droppedPrices: evidence.droppedPrices,
    },
  };
}
