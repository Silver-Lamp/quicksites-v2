// lib/delivered/listing.ts
//
// Which sites the delivered.menu apex lists, and as what (owner, 2026-10-14: "add the restaurant
// sites next to Renton Lemonade, tag the lemonade one claimed vs the others unclaimed; don't yet
// say how many are taking orders").
//
// Two kinds of card, never merged into one sorted list:
//   claimed   — a published site somebody owns (`is_site && published`, not a demo/starter/directory,
//               a real menu). "Order online".
//   unclaimed — an operator-built draft from the restaurant's own public listing / post / site
//               (`claim_source` listing_import|operator_draft, owner = a platform operator), with
//               a real menu. Shown because withholding a real dinner option protects nobody, and
//               chipped UNCLAIMED because nobody has confirmed those prices: the card says "View
//               menu", never "Order online". Same predicate as the menu host's pre-claim render.
//
// ⚠️ A placeholder-only menu (the scaffold's invented dishes under a real name, #738) is excluded
// by `isPlaceholderOnly` for both kinds — the same helper that keeps invented menus off real
// restaurants everywhere else.
import { readMenuSections, isPlaceholderOnly } from '@/lib/menu/menuBlocks';
import { needsMenu } from '@/lib/outreach/candidates';

/**
 * Post-built drafts carry `meta.post_kind`; only the food ones belong on a restaurant directory.
 * `event` is a dinner with a menu (Lil Mamas' six courses); `goods` (a decor sale) and `services`
 * (an alterations price list) have menu-shaped blocks and are not kitchens.
 */
const FOOD_POST_KINDS = new Set(['food', 'event']);
const FOOD_INDUSTRIES_EXTRA = new Set(['lemonade_stand']);

export function isFoodListing(r: ListingRow): boolean {
  if (needsMenu(r.industry ?? 'restaurant') || FOOD_INDUSTRIES_EXTRA.has(String(r.industry ?? ''))) return true;
  const kind = String(safeParse(r.data)?.meta?.post_kind ?? '');
  return FOOD_POST_KINDS.has(kind);
}

export type ListingRow = {
  slug: string | null;
  business_name: string | null;
  industry: string | null;
  industry_label: string | null;
  hero_url: string | null;
  logo_url: string | null;
  data: any;
  claim_source?: string | null;
  owner_id?: string | null;
  published?: boolean | null;
  is_site?: boolean | null;
};

export type ListingKind = 'claimed' | 'unclaimed';
export type Provenance = 'post' | 'site' | 'listing';

/** An unclaimed draft needs this many dishes to be worth a card. */
export const MIN_UNCLAIMED_ITEMS = 5;
/** Unclaimed cards shown before the "show more" tap. */
export const UNCLAIMED_INITIAL = 11;

export function safeParse(x: any) {
  if (typeof x !== 'string') return x ?? {};
  try {
    return JSON.parse(x);
  } catch {
    return {};
  }
}

/** Blocks from whichever shape this row uses — the fleet carries both. */
export function blocksOf(data: any): any[] {
  const page = safeParse(data)?.pages?.[0] ?? {};
  return [...(page.content_blocks ?? []), ...(page.blocks ?? [])];
}

const blockTypes = (data: any) => new Set(blocksOf(data).map((b) => b?.type));

export function hoursOf(data: any): any | null {
  for (const b of blocksOf(data)) if (b?.type === 'hours') return b.content ?? b.props ?? null;
  return null;
}

/** A city cohort page — real and useful, but listed as a city, never as a restaurant. */
export function isCityPortal(r: ListingRow): boolean {
  return blockTypes(r.data).has('restaurants_directory');
}

function realMenuItems(r: ListingRow): number {
  const meta = safeParse(r.data)?.meta ?? {};
  if (meta.is_starter || meta.is_demo) return 0; // a demo is not a restaurant
  if (meta.is_simulation === true) return 0; // nor is a restaurant AI personas run for a day (lib/booking/simulation.ts)
  const types = blockTypes(r.data);
  if (types.has('restaurants_directory')) return 0; // a directory is not a restaurant
  if (!types.has('menu')) return 0;
  const sections = readMenuSections(safeParse(r.data));
  if (!sections.length || isPlaceholderOnly(sections)) return 0;
  return sections.reduce((n, s: any) => n + (s.items?.length ?? 0), 0);
}

/** Can a diner actually order here? Positive evidence only. */
export function isOrderableRestaurant(r: ListingRow): boolean {
  return realMenuItems(r) > 0;
}

const PRE_CLAIM_SOURCES = new Set(['listing_import', 'operator_draft']);

/** Where the draft's words came from — the restaurant's own post/site outranks a photo-read listing. */
export function provenanceOf(data: any): Provenance {
  const meta = safeParse(data)?.meta ?? {};
  if (meta.built_from_post || meta.post_kind) return 'post';
  if (meta.rebuilt_from || meta.rebuild_source || meta.ordering_companion) return 'site';
  return 'listing';
}

/**
 * claimed / unclaimed / null (not listed). `operatorIds` = platform operators: a draft owned by
 * anyone else is somebody's private work-in-progress and stays off the page.
 */
export function classifyListing(r: ListingRow, operatorIds: Set<string>): ListingKind | null {
  if (!r.slug) return null;
  if (r.is_site && r.published) return isOrderableRestaurant(r) ? 'claimed' : null;
  if (!PRE_CLAIM_SOURCES.has(String(r.claim_source ?? ''))) return null;
  if (r.owner_id && !operatorIds.has(r.owner_id)) return null;
  if (!isFoodListing(r)) return null; // a price list or a sale page is not a kitchen
  return realMenuItems(r) >= MIN_UNCLAIMED_ITEMS ? 'unclaimed' : null;
}

const PROVENANCE_RANK: Record<Provenance, number> = { post: 0, site: 1, listing: 2 };

/** Unclaimed drafts: their own words first, then the fuller menu, then the name. */
export function rankUnclaimed<T extends ListingRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const p = PROVENANCE_RANK[provenanceOf(a.data)] - PROVENANCE_RANK[provenanceOf(b.data)];
    if (p) return p;
    const n = realMenuItems(b) - realMenuItems(a);
    if (n) return n;
    return String(a.business_name ?? a.slug).localeCompare(String(b.business_name ?? b.slug));
  });
}
