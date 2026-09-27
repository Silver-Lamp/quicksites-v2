// lib/ppl/marketRadius.ts
//
// HOW FAR FROM THE CAMPAIGN'S TOWN COUNTS AS "IN THIS MARKET".
//
// `outreach_prospects.city` records where a business was FIRST swept, not which markets it
// serves, so a city-name equality is the wrong matcher for a service business. Maple Valley
// found 13 tow companies within 8 km and qualified ONE — the other twelve were parked under
// Renton or Covington by earlier sweeps and excluded by name.
//
// ⚠️ THE RADIUS IS NOT ONE NUMBER, BECAUSE "NEARBY" MEANS TWO DIFFERENT THINGS. A tow truck,
// electrician or plumber DRIVES TO THE CUSTOMER, so a shop 20 km away serves the town perfectly
// well and excluding it strands a market. A restaurant is the opposite: the customer travels,
// and a taqueria 20 km away is not in the market at all — routing a "kent restaurant" caller to
// one is simply the wrong answer. Collapsing both into a single radius has to be wrong for one
// of them, so the trades are split.
//
// ⚠️ These are deliberately conservative. The cost of too wide is a caller sent to a business
// that will not come; the cost of too narrow is a thin pool, which the pool verdict already
// reports and a person can act on. Prefer the failure that announces itself.

/** Trades where the business travels to the customer — a wider radius is honest. */
const DISPATCH_RADIUS_KM: Record<string, number> = {
  towing: 25,
  auto_repair: 20,
  plumbing: 25,
  electrical: 25,
  hvac: 25,
  roofing: 30,
  landscaping: 20,
  pest_control: 25,
  junk_removal: 25,
  general_contractor: 25,
  concrete: 30,
  fencing: 30,
  paving: 30,
  siding: 30,
  deck_builder: 30,
  roof_cleaning: 25,
  windshield_repair: 25,
  epoxy_flooring: 30,
  retaining_walls: 30,
  turf: 30,
};

/**
 * Trades where the CUSTOMER travels — the radius is small on purpose.
 *
 * ⚠️ A restaurant twenty minutes away is not in the market, however good it is. This is the
 * case a single global radius would silently get wrong.
 */
const PREMISES_RADIUS_KM: Record<string, number> = {
  restaurant: 8,
  food: 8,
  cafe: 8,
  bakery: 8,
  bar: 8,
  salon: 10,
  barber: 10,
  gym: 10,
  dentist: 15,
  veterinarian: 15,
};

/** Used when the industry is unknown — mid-way, and narrow enough to fail loudly. */
export const DEFAULT_MARKET_RADIUS_KM = 15;

export function marketRadiusKm(industryKey: string | null | undefined): number {
  const k = (industryKey ?? '').trim().toLowerCase();
  if (!k) return DEFAULT_MARKET_RADIUS_KM;
  return DISPATCH_RADIUS_KM[k] ?? PREMISES_RADIUS_KM[k] ?? DEFAULT_MARKET_RADIUS_KM;
}

/** True when the trade is one where the business travels to the customer. */
export function isDispatchTrade(industryKey: string | null | undefined): boolean {
  // `Object.hasOwn` needs es2022 lib; this repo targets lower.
  return Object.prototype.hasOwnProperty.call(
    DISPATCH_RADIUS_KM,
    (industryKey ?? '').trim().toLowerCase(),
  );
}
