// lib/outreach/buildDraftFromListing.ts
//
// The shared "listing → claimable draft site" builder, extracted from the
// /api/import-listing route so both it AND the prospects/build route call one code
// path (the CLAUDE.md "logic in lib/, thin route on top" convention).
//
// Given a business Listing: augment with Yelp photos, read the menu from photos with
// vision (RESTAURANTS ONLY — no AI spend on other industries), map → RebuildSpec →
// assemble a draft template, and insert it as an operator-owned, claimable draft
// (claim_source='listing_import'). Non-restaurant listings flow through the generic
// industry scaffold with no menu block.

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  buildSpecFromListing,
  type Listing,
} from '@/lib/rebuild/importListing';
import { typeToIndustryKey } from '@/lib/places/typeToIndustry';
import { augmentListingWithYelp } from '@/lib/rebuild/importListingYelp';
import { menuFromPhotos, pickMenuPhotos } from '@/lib/rebuild/menuFromPhotos';
import { buildRebuildTemplate } from '@/lib/rebuild/assembleDraft';
import type { IndustryKey } from '@/lib/industries';

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export type BuildDraftInput = {
  listing: Listing;
  /** Operator-supplied menu photo URLs; when present, skips Yelp/auto photo detection. */
  photoUrls?: string[];
  /** The uid that will own the draft until the business claims it. */
  operatorId: string;
  /** Force an industry; otherwise derived from the listing categories. */
  industryKey?: IndustryKey;
};

export type BuildDraftResult = {
  id: string;
  slug: string;
  industryKey: IndustryKey;
  summary: {
    businessName: string;
    phone: string | null;
    address: string | null;
    hoursDays: number;
    menuSections: string[];
    menuItems: number;
    heroImage: string | null;
  };
};

export class BuildDraftError extends Error {
  code: 'insert_failed';
  constructor(message: string) {
    super(message);
    this.code = 'insert_failed';
    this.name = 'BuildDraftError';
  }
}

/**
 * Build + persist a claimable draft site from a listing. Menu OCR runs only for
 * restaurants. Throws BuildDraftError if a unique slug can't be allocated.
 */
export async function buildDraftFromListing(input: BuildDraftInput): Promise<BuildDraftResult> {
  let listing = input.listing;
  const industryKey = input.industryKey ?? typeToIndustryKey(listing.categories);
  const isRestaurant = industryKey === 'restaurant';
  const explicit = Array.isArray(input.photoUrls) && input.photoUrls.length > 0;

  // Augment with Yelp photos (its top shots skew toward menus) + fill gaps — only
  // useful for the restaurant menu path; skip it for other industries.
  if (isRestaurant && !explicit) {
    listing = await augmentListingWithYelp(listing).catch(() => listing);
  }

  // Read the menu from photos — RESTAURANTS ONLY (the only industry with a menu block).
  let menu: { sections: any[] } | undefined;
  if (isRestaurant) {
    let photoUrls: string[] = explicit ? input.photoUrls!.map(String) : (listing.photos ?? []);
    try {
      if (!explicit && photoUrls.length > 1) {
        const picked = await pickMenuPhotos(photoUrls, input.operatorId).catch(() => []);
        if (picked.length) photoUrls = picked;
      }
      menu = photoUrls.length ? await menuFromPhotos(photoUrls, input.operatorId) : undefined;
    } catch {
      menu = undefined; // best-effort; a vision failure never blocks assembly
    }
  }

  // Map → spec → assemble the draft (same blocks as URL conversion).
  const spec = buildSpecFromListing(listing, menu, industryKey);
  const heroImage = listing.photos?.[0] ?? null;
  const tpl = buildRebuildTemplate({ spec, heroImage, sourceUrl: listing.website ?? null });

  // Insert a claimable draft (operator-owned until the business claims it), retrying
  // slug collisions.
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
    throw new BuildDraftError(error?.message || 'Could not save the draft.');
  }
  if (!insertedId) throw new BuildDraftError('Could not allocate a unique draft.');

  const menuItems = (menu?.sections ?? []).reduce((n: number, s: any) => n + (s.items?.length ?? 0), 0);
  return {
    id: insertedId,
    slug,
    industryKey,
    summary: {
      businessName: spec.businessName,
      phone: spec.contact?.phone ?? null,
      address: spec.contact?.address ?? null,
      hoursDays: spec.hours?.length ?? 0,
      menuSections: menu?.sections?.map((s: any) => `${s.name} (${s.items?.length ?? 0})`) ?? [],
      menuItems,
      heroImage,
    },
  };
}
