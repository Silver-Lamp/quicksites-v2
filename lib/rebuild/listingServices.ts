// lib/rebuild/listingServices.ts
//
// What a listing-built draft shows under "Our Services".
//
// ⚠️ 26 auto-built trade drafts rendered this, under real businesses' names:
//
//     Our Services
//     01  Car repair
//     02  Point of interest
//     03  Service
//     04  Establishment
//
// Those are Google Places taxonomy tags, not services. The Details-fetch import path filters
// them (`mapTypes` in importListing.ts), and a 2026-07 backfill note said "THE CODE IS ALREADY
// CORRECT" — true for that path. The nightly trade cron builds its Listing from the sweep's raw
// `outreach_prospects.categories`, which never pass through `mapTypes`, and `buildSpecFromListing`
// only title-cased them. A guard on one of two entry paths is a guard on neither.
//
// Two sources, stamped on the data so the renderer can say which it is:
//   • `listing`          — the business's own declared categories (after the filter above).
//   • `industry_default` — the trade's standard list from the industry scaffold, used when the
//                          listing declares nothing usable (a towing listing tagged only
//                          point_of_interest / service / establishment).
// ⚠️ OWNER DECISION 2026-09-08: the default list is shown, with a "call to confirm" line under it
// (rendered from `meta.services_source`, components/admin/templates/render-blocks/services.tsx).
// The first cut removed the block instead — "a service they don't offer" was judged low-risk, and
// a page with no services section reads half-built. The disclaimer is what makes the default an
// honest list of what such a shop *typically* does rather than a claim about this one.
import { GENERIC_PLACE_TYPES } from '@/lib/places/typeToIndustry';
import { generateServices } from '@/lib/generateServices';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import type { IndustryKey } from '@/lib/industries';

/** Places plumbing that names no trade. `service` is not a documented type but the sweep returns it. */
export const GENERIC_LISTING_TYPES: ReadonlySet<string> = new Set([...GENERIC_PLACE_TYPES, 'service']);

export type ServicesSource = 'listing' | 'industry_default';

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** True for "point_of_interest", "Point of interest", "POINT-OF-INTEREST", "Service", … */
export function isGenericListingCategory(label: unknown): boolean {
  const n = norm(label);
  return !n || GENERIC_LISTING_TYPES.has(n);
}

/** Drop the generic tags, dedupe case-insensitively, keep the listing's order. Labels are untouched. */
export function cleanListingCategories(cats: unknown): string[] {
  if (!Array.isArray(cats)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cats) {
    const s = String(c ?? '').trim();
    if (!s || isGenericListingCategory(s)) continue;
    const k = norm(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** The trade's standard service names — the same list the industry scaffold seeds. */
export function industryDefaultServices(industryKey: string | null | undefined): string[] {
  if (!industryKey) return [];
  return generateServices({ industryKey: industryKey as IndustryKey }).map((s) => s.name).filter(Boolean);
}

type AnyBlock = { type?: string } & Record<string, unknown>;

/** Every `services` block in the tree (both arrays), for reporting. */
export function countServicesBlocks(data: any): number {
  let n = 0;
  for (const page of Array.isArray(data?.pages) ? data.pages : []) {
    for (const key of ['content_blocks', 'blocks'] as const) {
      if (Array.isArray(page?.[key])) n += page[key].filter((b: AnyBlock) => b?.type === 'services').length;
    }
  }
  return n;
}

/**
 * Make sure the first page carries a services block in BOTH block arrays, seeded with `names`.
 * Inserted right after the hero (the scaffold's own position). Existing blocks are left alone.
 * ⚠️ Never edit template data by path — the same block lives in `pages[].content_blocks` and
 * `pages[].blocks` (CLAUDE.md §8); a block in one array only is a block the renderer may not see.
 */
export function ensureServicesBlock(data: any, names: string[]): number {
  const page = Array.isArray(data?.pages) ? data.pages[0] : null;
  if (!page || !names.length) return 0;
  let inserted = 0;
  const make = () => {
    const b: any = createDefaultBlock('services');
    b.content = { ...(b.content ?? {}), items: names.map((name) => ({ name })), title: 'Our Services' };
    return b;
  };
  for (const key of ['content_blocks', 'blocks'] as const) {
    const arr = page[key];
    if (!Array.isArray(arr)) continue;
    if (arr.some((b: AnyBlock) => b?.type === 'services')) continue;
    const heroIdx = arr.findIndex((b: AnyBlock) => b?.type === 'hero');
    arr.splice(heroIdx >= 0 ? heroIdx + 1 : 0, 0, make());
    inserted++;
  }
  return inserted;
}

/**
 * Decide the services for a listing draft and write them into the two template-level copies the
 * renderer prefers (`data.services`, `data.meta.services`), stamping `meta.services_source`.
 * Declared categories win; otherwise the industry default (and a block to hold it, if missing).
 * Mutates `data`; returns what it did so a script can print it.
 */
export function applyListingServices(
  data: any,
  categories: unknown,
  industryKey: string | null | undefined,
): { services: string[]; source: ServicesSource; insertedBlocks: number } {
  const declared = cleanListingCategories(categories);
  const source: ServicesSource = declared.length ? 'listing' : 'industry_default';
  const services = declared.length ? declared : industryDefaultServices(industryKey);
  data.services = services;
  data.meta = { ...(data.meta ?? {}), services, services_source: source };
  const insertedBlocks = source === 'industry_default' ? ensureServicesBlock(data, services) : 0;
  return { services, source, insertedBlocks };
}
