// lib/prospects/sweepCategories.ts
//
// The one list of sweepable business categories, shared by the operator UI (the chips on
// /admin/growth) and the nightly pipeline (a queue row names a category by label). Pure data.
//
// A category is EITHER a set of Google Places types (precise) OR a free-text query for trades that
// have no Places type (towing, HVAC, …). Text categories carry the industry key the query stands
// for, so a keyword-found business is classified correctly — without it the fallback guess
// defaults to 'restaurant', which has put menus on real tow companies twice.

export type SweepCategory = { label: string; types?: string[]; textQuery?: string; industry?: string };

export const SWEEP_CATEGORIES: SweepCategory[] = [
  { label: 'Restaurants', types: ['restaurant', 'cafe', 'bar'], industry: 'restaurant' },
  // Typed categories carry their industry too, so the queue planner can go from a campaign's
  // industry_key ("plumbing", from plumbing-town.com) back to the category that sweeps it.
  { label: 'Plumbing', types: ['plumber'], industry: 'plumbing' },
  { label: 'Electrical', types: ['electrician'], industry: 'electrical' },
  { label: 'HVAC', textQuery: 'HVAC contractor', industry: 'hvac' },
  { label: 'Painting', types: ['painter'], industry: 'painting' },
  { label: 'Roofing', types: ['roofing_contractor'], industry: 'roofing' },
  { label: 'Contractor', types: ['general_contractor'], industry: 'general_contractor' },
  // Two industries we own campaign domains for (11 + 5 of 100) had no sweepable category at all.
  { label: 'Roof cleaning', textQuery: 'roof cleaning service', industry: 'roof_cleaning' },
  { label: 'Windshield repair', textQuery: 'windshield repair', industry: 'windshield_repair' },
  // Instant-estimator trades — each auto-builds a quote_estimator site + a
  // <city>-<trade>.com geo-vertical (all 9 trades live on the DeckSketch endpoint).
  { label: 'Deck builder', textQuery: 'deck builder', industry: 'deck_builder' },
  { label: 'Fencing', textQuery: 'fence contractor', industry: 'fencing' },
  { label: 'Concrete', textQuery: 'concrete contractor', industry: 'concrete' },
  { label: 'Artificial turf', textQuery: 'artificial turf installer', industry: 'turf' },
  { label: 'Epoxy flooring', textQuery: 'epoxy flooring contractor', industry: 'epoxy_flooring' },
  { label: 'Paving', textQuery: 'paving contractor', industry: 'paving' },
  { label: 'Siding', textQuery: 'siding contractor', industry: 'siding' },
  { label: 'Retaining walls', textQuery: 'retaining wall contractor', industry: 'retaining_walls' },
  { label: 'Handyman', textQuery: 'handyman service', industry: 'general_contractor' },
  { label: 'Landscaping', textQuery: 'landscaping service', industry: 'landscaping' },
  { label: 'Tree service', textQuery: 'tree service', industry: 'landscaping' },
  { label: 'Pest control', textQuery: 'pest control', industry: 'pest_control' },
  { label: 'Cleaning', textQuery: 'house cleaning service', industry: 'other' },
  { label: 'Junk removal', textQuery: 'junk removal', industry: 'junk_removal' },
  { label: 'Garage door', textQuery: 'garage door repair', industry: 'general_contractor' },
  { label: 'Appliance repair', textQuery: 'appliance repair', industry: 'other' },
  { label: 'Locksmith', types: ['locksmith'] },
  { label: 'Moving', types: ['moving_company'], industry: 'moving' },
  { label: 'Storage', types: ['storage'] },
  { label: 'Towing', textQuery: 'towing service', industry: 'towing' },
  { label: 'Auto repair', types: ['car_repair'], industry: 'auto_repair' },
  { label: 'Car wash', types: ['car_wash'] },
  { label: 'Auto detailing', textQuery: 'auto detailing', industry: 'auto_repair' },
  { label: 'Dental', types: ['dentist'] },
  { label: 'Veterinary', types: ['veterinary_care'] },
  { label: 'Salon / Spa', types: ['hair_care', 'beauty_salon', 'nail_salon', 'spa'] },
  { label: 'Fitness', types: ['gym'] },
  { label: 'Real estate', types: ['real_estate_agency'] },
  { label: 'Insurance', types: ['insurance_agency'] },
  { label: 'Accounting', types: ['accounting'] },
  { label: 'Legal', types: ['lawyer'] },
];

/** Find a category by its label (case-insensitive) or by the industry key it stands for. */
export function resolveSweepCategory(labelOrIndustry: string): SweepCategory | null {
  const k = String(labelOrIndustry ?? '').trim().toLowerCase();
  if (!k) return null;
  return (
    SWEEP_CATEGORIES.find((c) => c.label.toLowerCase() === k) ??
    SWEEP_CATEGORIES.find((c) => c.industry === k) ??
    null
  );
}

/** The request shape the sweep takes, from a list of categories. */
export function sweepArgsFor(cats: SweepCategory[]): {
  includedTypes: string[];
  textCategories: { query: string; industry?: string }[];
} {
  const includedTypes = Array.from(new Set(cats.flatMap((c) => c.types ?? [])));
  const textCategories = cats
    .filter((c) => c.textQuery)
    .map((c) => ({ query: c.textQuery!, industry: c.industry }));
  return { includedTypes, textCategories };
}
