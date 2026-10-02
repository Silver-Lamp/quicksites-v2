// lib/theme/industryFontMood.ts
//
// Which typeface pairing suits which trade.
//
// ⚠️ THE CATEGORY AXIS ALREADY EXISTED. Every pairing in `fontPairings.ts` carries a `mood`
// (`editorial | modern | friendly | technical | elegant | bold`). Nothing mapped an INDUSTRY to
// one, so 2,452 of 3,231 templates (76%) had no `fontPair` at all and rendered in
// `ui-sans-serif` — the system stack, i.e. no typographic choice whatsoever. The pairing
// system, its loader and eleven curated pairs were all built and unreachable.
//
// ⚠️ THIS IS TASTE, AND TASTE IS REVISABLE. The moods below are a defensible first pass, not a
// finding. They are in one table precisely so changing one is a one-line edit rather than an
// archaeology exercise. What is NOT taste: every industry resolving to *something*, because the
// alternative is the system font.
//
// The reasoning in one line per mood:
//   technical  — trust comes from competence: machinery, diagnostics, code, engineering
//   bold       — trust comes from scale and force: heavy work, hauling, big equipment
//   friendly   — trust comes from warmth: homes, pets, children, food, makers
//   elegant    — trust comes from restraint: health, law, money, ceremony, beauty
//   editorial  — the person IS the product: writers, photographers, portfolios
//   modern     — default when none of the above dominates

import type { IndustryKey } from '@/lib/industries';
import { FONT_PAIRINGS, type FontPairing } from '@/lib/theme/fontPairings';

export type FontMood = FontPairing['mood'];

/**
 * Industry → mood. Absent keys fall through to `modern`, which is deliberate: a new industry
 * gets a reasonable typeface the day it is added, rather than silently reverting to the
 * system stack because nobody updated a table.
 */
export const INDUSTRY_FONT_MOOD: Partial<Record<IndustryKey, FontMood>> = {
  // ── technical: competence is the pitch
  hvac: 'technical',
  plumbing: 'technical',
  electrical: 'technical',
  auto_repair: 'technical',
  windshield_repair: 'technical',
  auto_dealer: 'technical',
  pest_control: 'technical',

  // ── bold: weight, equipment, scale
  towing: 'bold',
  junk_removal: 'bold',
  moving: 'bold',
  concrete: 'bold',
  paving: 'bold',
  roofing: 'bold',
  siding: 'bold',
  retaining_walls: 'bold',
  general_contractor: 'bold',
  dome_builder: 'bold',

  // ── friendly: someone's home, pet, child or dinner
  restaurant: 'friendly',
  lemonade_stand: 'friendly',
  pet_boutique: 'friendly',
  landscaping: 'friendly',
  turf: 'friendly',
  carpet_cleaning: 'friendly',
  window_washing: 'friendly',
  pressure_washing: 'friendly',
  roof_cleaning: 'friendly',
  painting: 'friendly',
  fencing: 'friendly',
  deck_builder: 'friendly',
  treehouse_builder: 'friendly',
  epoxy_flooring: 'friendly',
  crafts: 'friendly',
  handmade: 'friendly',
  etsy_style: 'friendly',
  gifts_stationery: 'friendly',
  art_supplies: 'friendly',
  pop_up_shop: 'friendly',
  farmers_market_vendor: 'friendly',
  custom_apparel: 'friendly',
  print_on_demand: 'friendly',

  // ── elegant: restraint signals seriousness
  legal: 'elegant',
  medical_dental: 'elegant',
  real_estate: 'elegant',
  real_estate_agency: 'elegant',
  salon_spa: 'elegant',
  faith: 'elegant',
  antiques_vintage: 'elegant',
  collectibles: 'elegant',
  artisan_goods: 'elegant',
  retail_home_goods: 'elegant',

  // ── editorial: the person is the product (the owner's named verticals)
  author: 'editorial',
  photography: 'editorial',
  personal: 'editorial',

  // ── modern
  fitness: 'modern',
  retail_boutique: 'modern',
  retail_electronics: 'modern',
  retail_thrift: 'modern',
  online_reseller: 'modern',
  other: 'modern',
};

export const DEFAULT_FONT_MOOD: FontMood = 'modern';

/**
 * Pairings available for a mood, in declaration order.
 *
 * ⚠️ Derived from `FONT_PAIRINGS`, never a second hand-kept list — a mood with no pairings
 * would otherwise return nothing and the caller would fall back to no font at all.
 */
export function pairingsForMood(mood: FontMood): FontPairing[] {
  return Object.values(FONT_PAIRINGS).filter((p) => p.mood === mood);
}

/**
 * The pairing id for an industry.
 *
 * ⚠️ DETERMINISTIC, not random. `seed` (a template id or slug) spreads sites across the
 * pairings a mood offers, so two towing sites in one town do not look like the same template —
 * but the SAME site always resolves to the SAME face. A random pick would re-theme a published
 * site on every rebuild, which is a visual change nobody asked for.
 *
 * Returns null only if a mood somehow has no pairings, so the caller can leave the field unset
 * rather than write a broken id.
 */
export function fontPairForIndustry(industry: string | null | undefined, seed?: string): string | null {
  const mood = INDUSTRY_FONT_MOOD[(industry ?? '') as IndustryKey] ?? DEFAULT_FONT_MOOD;
  const options = pairingsForMood(mood);
  if (!options.length) return null;
  if (options.length === 1 || !seed) return options[0].id;

  // Cheap stable hash — the value only needs to be uniform and repeatable.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length].id;
}
