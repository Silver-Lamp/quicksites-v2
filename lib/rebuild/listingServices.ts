// lib/rebuild/listingServices.ts
//
// What a listing-built draft may show under "Our Services": the business's OWN declared
// categories, and nothing else.
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
// The second half is the honesty rule. When the filter leaves NOTHING (a towing listing tagged
// only point_of_interest / service / establishment), the template-level list goes empty and the
// renderer falls through to the block's own items — which the industry scaffold seeded ("Oil
// Change", "AC Recharge"…). Those are services WE invented for a business we never spoke to: the
// invented-menu class (CLAUDE.md §5b, #738). So a listing draft with no declared categories gets
// NO services block at all. The owner adds their own after claiming.
import { GENERIC_PLACE_TYPES } from '@/lib/places/typeToIndustry';

/** Places plumbing that names no trade. `service` is not a documented type but the sweep returns it. */
export const GENERIC_LISTING_TYPES: ReadonlySet<string> = new Set([...GENERIC_PLACE_TYPES, 'service']);

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

type AnyBlock = { type?: string } & Record<string, unknown>;

/**
 * Remove every `services` block from every page, in BOTH block arrays. Returns how many went.
 * ⚠️ Never edit template data by path — the same block lives in `pages[].content_blocks` and
 * `pages[].blocks` (CLAUDE.md §8); a fix to one leaves the renderer free to read the other.
 */
export function stripServicesBlocks(data: any): number {
  let removed = 0;
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const page of pages) {
    for (const key of ['content_blocks', 'blocks'] as const) {
      const arr = page?.[key];
      if (!Array.isArray(arr)) continue;
      const kept = arr.filter((b: AnyBlock) => b?.type !== 'services');
      removed += arr.length - kept.length;
      page[key] = kept;
    }
  }
  return removed;
}

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
 * Write the cleaned list into the two template-level copies the renderer prefers, and when the
 * list is empty remove the services blocks so the scaffold's invented items cannot surface.
 * Mutates `data`; returns what it did so a script can print it.
 */
export function applyListingServices(data: any, categories: unknown): { services: string[]; removedBlocks: number } {
  const services = cleanListingCategories(categories);
  data.services = services;
  data.meta = { ...(data.meta ?? {}), services };
  const removedBlocks = services.length ? 0 : stripServicesBlocks(data);
  return { services, removedBlocks };
}
