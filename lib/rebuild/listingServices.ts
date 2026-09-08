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

/**
 * A service name may not be a promise. The scaffold's concrete list ends in "Free Estimates" — a
 * pricing claim about a business we never spoke to, the class `scripts/audit-live-claims.mjs`
 * exists to find. On a listing draft's DEFAULT list it is dropped; the owner can add it back.
 */
export const PROMISE_IN_SERVICE_NAME = /\bfree\b|24\s*\/\s*7|24[- ]hours?|guarantee|licen[sc]ed|insured|same[- ]day|within \d+ (minutes?|hours?)|no[- ]obligation/i;

/** The trade's standard service names — the same list the industry scaffold seeds, minus promises. */
export function industryDefaultServices(industryKey: string | null | undefined): string[] {
  if (!industryKey) return [];
  return generateServices({ industryKey: industryKey as IndustryKey })
    .map((s) => s.name)
    .filter((n) => n && !PROMISE_IN_SERVICE_NAME.test(n));
}

/** "shipping_service" → "Shipping service". Already-nice labels pass through untouched. */
export function prettyServiceLabel(label: string): string {
  const s = String(label ?? '').trim();
  if (!/_/.test(s)) return s;
  const t = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Trade terms a business puts in its OWN NAME → the service that names. "Ferry Street Towing &
 * Roadside Assistance" declared `car_repair` to Google and rendered "What we do — Car repair" under
 * a title that says towing twice. The name is the most honest source on the page: the owner chose
 * those words. Ordered; the first pattern to match a term wins, and one name can yield several.
 * Labels are the trade's everyday words, never a promise (no "24/7", no "licensed").
 */
export const NAME_SERVICE_TERMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\broadside\b/i, 'Roadside Assistance'],
  [/\b(wrecker|recovery)\b/i, 'Towing & Recovery'],
  [/\btow(ing)?\b/i, 'Towing'],
  [/\bmuffler|exhaust\b/i, 'Muffler & Exhaust'],
  [/\btransmissions?\b/i, 'Transmission Repair'],
  [/\b(auto|collision) ?body\b/i, 'Auto Body & Collision'],
  [/\btires?\b/i, 'Tires'],
  [/\b(auto|automotive|car) (repair|service|care|mechanic)s?\b/i, 'Auto Repair'],
  [/\bwindshields?\b|\bauto ?glass\b/i, 'Windshield Repair'],
  [/\bglass\b/i, 'Glass Repair'],
  [/\broof(ing)? clean/i, 'Roof Cleaning'],
  [/\broof(ing|er|ers)?\b(?!\s*clean)/i, 'Roofing'],
  [/\bgutters?\b/i, 'Gutters'],
  [/\bplumb(ing|er|ers)\b/i, 'Plumbing'],
  [/\b(heating|hvac|furnace)\b/i, 'Heating'],
  [/\b(cooling|air conditioning|a\/c|ac)\b/i, 'Air Conditioning'],
  [/\belectric(al|ian|ians)?\b/i, 'Electrical'],
  [/\bconcrete\b/i, 'Concrete'],
  [/\bcutting\b|\bcoring\b/i, 'Concrete Cutting & Coring'],
  [/\b(paving|asphalt)\b/i, 'Paving'],
  [/\bmasonry\b/i, 'Masonry'],
  [/\bfenc(e|es|ing)\b/i, 'Fencing'],
  [/\b(landscap(e|ing)|lawn)\b/i, 'Landscaping'],
  [/\btree\b/i, 'Tree Service'],
  [/\bpressure wash|power wash/i, 'Pressure Washing'],
  [/\bpaint(ing|ers?)\b/i, 'Painting'],
  [/\b(remodel(ing)?|renovations?)\b/i, 'Remodeling'],
  [/\b(construction|builders?|contract(or|ors|ing))\b/i, 'General Contracting'],
  [/\bhandyman\b/i, 'Handyman Services'],
  [/\blocksmiths?\b/i, 'Locksmith'],
  [/\bmoving|movers?\b/i, 'Moving'],
  [/\bjunk\b|\bhauling\b/i, 'Junk Removal & Hauling'],
  [/\bpest\b|\bexterminat/i, 'Pest Control'],
  [/\bclean(ing|ers)\b/i, 'Cleaning'],
  [/\bsalvage\b/i, 'Salvage'],
];

/**
 * Industries whose names are not service menus: "Glass House Bistro" does not repair glass, and a
 * person is not a trade. The name layer is skipped for these.
 */
export const NAME_LAYER_EXCLUDED: ReadonlySet<string> = new Set(['restaurant', 'personal', 'author', 'realtor', 'church', 'nonprofit']);

/** Services the business named itself after. Empty for "Ferry Street Garage" or "Joe's". */
export function servicesFromName(name: unknown, industryKey?: string | null): string[] {
  const s = String(name ?? '').trim();
  if (!s) return [];
  const ik = String(industryKey ?? '');
  if (NAME_LAYER_EXCLUDED.has(ik) || ik.startsWith('food') || ik.startsWith('retail')) return [];
  const out: string[] = [];
  for (const [re, label] of NAME_SERVICE_TERMS) {
    if (re.test(s) && !out.includes(label)) out.push(label);
  }
  // "Medrano's Roof Cleaning" matches roof-cleaning, roofing AND cleaning; keep the specific one.
  return mergeServiceLists(out);
}

/** Google's category wording → the everyday label, so "Car repair" and "Auto Repair" do not both show. */
const CANONICAL: Record<string, string> = {
  car_repair: 'Auto Repair',
  auto_repair_shop: 'Auto Repair',
  towing_service: 'Towing',
  roofing_contractor: 'Roofing',
  general_contractor: 'General Contracting',
  electrician: 'Electrical',
  plumber: 'Plumbing',
  locksmith: 'Locksmith',
  moving_company: 'Moving',
  glass_repair_service: 'Glass Repair',
};
export function canonicalService(label: string): string {
  return CANONICAL[norm(label)] ?? prettyServiceLabel(label);
}

/**
 * Merge in priority order, dropping exact duplicates and any item another item already contains
 * ("Towing" beside "Towing & Recovery" says the same thing twice; the longer one stays).
 */
export function mergeServiceLists(...lists: string[][]): string[] {
  const flat = lists.flat().map((s) => canonicalService(String(s ?? '').trim())).filter(Boolean);
  const keys = flat.map(norm);
  const out: string[] = [];
  flat.forEach((label, i) => {
    const k = keys[i];
    if (out.some((o) => norm(o) === k)) return;
    const containedElsewhere = keys.some((other, j) => j !== i && other !== k && other.includes(k));
    if (containedElsewhere) return;
    out.push(label);
  });
  return out;
}

/** Below this many declared-or-named services, the trade's standard list is added (with its disclaimer). */
export const MIN_OWN_SERVICES = 3;

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

export type ListingServicesInput = {
  /** Google categories as stored (raw or prettified). */
  categories: unknown;
  industryKey: string | null | undefined;
  /** The business's own name — trade words in it become services first. */
  businessName?: unknown;
};

/**
 * The list itself, pure. Three layers, in priority order:
 *   1. services the business NAMED itself after (`servicesFromName`);
 *   2. the categories it declared to Google (generic plumbing removed);
 *   3. when 1 + 2 still give fewer than MIN_OWN_SERVICES, the trade's standard list is added and
 *      the whole thing is stamped `industry_default` so the page says "call to confirm".
 * A list that is entirely the business's own words is stamped `listing` and carries no disclaimer.
 */
export function decideListingServices(input: ListingServicesInput): { services: string[]; source: ServicesSource } {
  const own = mergeServiceLists(servicesFromName(input.businessName, input.industryKey), cleanListingCategories(input.categories));
  if (own.length >= MIN_OWN_SERVICES) return { services: own, source: 'listing' };
  const std = industryDefaultServices(input.industryKey);
  if (!std.length) return { services: own, source: own.length ? 'listing' : 'industry_default' };
  return { services: mergeServiceLists(own, std), source: 'industry_default' };
}

/**
 * Decide the services for a listing draft and write them into the two template-level copies the
 * renderer prefers (`data.services`, `data.meta.services`), stamping `meta.services_source`, and
 * restore a block to hold them if an earlier pass removed it. Mutates `data`; returns what it did.
 */
export function applyListingServices(
  data: any,
  input: ListingServicesInput,
): { services: string[]; source: ServicesSource; insertedBlocks: number } {
  const businessName = input.businessName ?? data?.meta?.business_name;
  const { services, source } = decideListingServices({ ...input, businessName });
  data.services = services;
  data.meta = { ...(data.meta ?? {}), services, services_source: source };
  const insertedBlocks = ensureServicesBlock(data, services);
  return { services, source, insertedBlocks };
}
