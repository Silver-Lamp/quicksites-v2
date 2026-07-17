// lib/places/typeToIndustry.ts
//
// Map a Google Places `types[]` array → our canonical IndustryKey, so a business
// discovered by a geographic sweep gets the right starter scaffold (buildIndustryStarter)
// when its draft site is built. Google's place types are their own vocabulary (e.g.
// `hair_care`, `meal_takeaway`), so we alias the common ones, then fall back to the
// generic label→key resolver in lib/industries for anything not covered.

import { toIndustryKey, type IndustryKey } from '@/lib/industries';

// Google Places type → IndustryKey, for the types whose names don't already resolve
// through toIndustryKey()'s heuristics. Ordered by specificity where it matters.
const PLACES_TYPE_ALIASES: Record<string, IndustryKey> = {
  // food
  restaurant: 'restaurant',
  cafe: 'restaurant',
  coffee_shop: 'restaurant',
  bakery: 'restaurant',
  bar: 'restaurant',
  meal_takeaway: 'restaurant',
  meal_delivery: 'restaurant',
  food: 'restaurant',
  // beauty / personal care
  hair_care: 'salon_spa',
  hair_salon: 'salon_spa',
  beauty_salon: 'salon_spa',
  nail_salon: 'salon_spa',
  spa: 'salon_spa',
  // trades / home services
  plumber: 'plumbing',
  electrician: 'electrical',
  painter: 'painting',
  roofing_contractor: 'roofing', // install/replace (roof_cleaning is exterior cleaning)
  general_contractor: 'general_contractor',
  moving_company: 'moving',
  // auto
  car_repair: 'auto_repair',
  // health
  dentist: 'medical_dental',
  doctor: 'medical_dental',
  physiotherapist: 'medical_dental',
  // professional
  lawyer: 'legal',
  real_estate_agency: 'real_estate',
  // fitness
  gym: 'fitness',
  // retail / maker
  clothing_store: 'retail_boutique',
  home_goods_store: 'retail_home_goods',
  electronics_store: 'retail_electronics',
  furniture_store: 'retail_home_goods',
  book_store: 'author',
  pet_store: 'pet_boutique',
};

// Generic Google types that carry no industry signal — never let them win.
const GENERIC_PLACE_TYPES = new Set([
  'point_of_interest',
  'establishment',
  'store',
  'food', // note: aliased to restaurant above, but only used if nothing more specific hits
]);

/**
 * Resolve a Google Places `types[]` (or our own titlecased category labels) to a
 * canonical IndustryKey + label. Prefers the most specific alias; falls back to the
 * loose text resolver; defaults to 'restaurant' when nothing resolves (the CedarSites
 * pipeline's historical default, so restaurant menu-OCR still fires for food listings
 * whose only type is generic).
 */
export function typeToIndustryKey(
  types: readonly string[] | null | undefined,
  fallback: IndustryKey = 'restaurant',
): IndustryKey {
  if (!Array.isArray(types) || types.length === 0) return fallback;

  // 1) Exact alias match on a non-generic type wins (scan in order for specificity).
  for (const raw of types) {
    const t = String(raw).toLowerCase().trim();
    if (!t || GENERIC_PLACE_TYPES.has(t)) continue;
    if (PLACES_TYPE_ALIASES[t]) return PLACES_TYPE_ALIASES[t];
  }

  // 2) Loose text resolution against each type/label (handles our titlecased
  //    categories like "Hair Care" and Google types like "beauty_salon").
  for (const raw of types) {
    const t = String(raw).toLowerCase().replace(/_/g, ' ').trim();
    if (!t || GENERIC_PLACE_TYPES.has(t.replace(/ /g, '_'))) continue;
    const key = toIndustryKey(t);
    if (key !== 'other') return key;
  }

  return fallback;
}
