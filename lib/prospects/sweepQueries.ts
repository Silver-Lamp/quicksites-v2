// lib/prospects/sweepQueries.ts
//
// What to type into Places to find a city's independents, per industry.
//
// ⚠️ THE QUERY SET IS THE COHORT DEFINITION, NOT A CONVENIENCE. `find-no-website-leads` used one
// hardcoded restaurant list, and its own header records why the list matters: an earlier lead file
// held Canlis and The Pink Door — famous Seattle restaurants that mostly HAVE websites — so the
// menu hit-rate measured something true about the wrong population. The queries decide who is in
// the experiment before any filter runs.
//
// ⚠️ BROAD ON PURPOSE, AND SKEWED TOWARD WHAT AN OWNER CALLS THEMSELVES. Google files a one-person
// deck outfit under "General contractor" as often as "Deck builder", and the businesses most likely
// to have no website are exactly the ones filed under a category they did not choose. Searching
// only the tidy category name finds the companies that already have marketing.
import type { IndustryKey } from '@/lib/industries';

export const SWEEP_QUERIES: Partial<Record<IndustryKey, string[]>> = {
  restaurant: [
    'restaurant', 'taqueria', 'pizza', 'chinese restaurant', 'thai restaurant',
    'mexican restaurant', 'vietnamese restaurant', 'indian restaurant', 'teriyaki',
    'deli', 'diner', 'bbq', 'sandwich shop', 'bakery',
  ],
  // ⚠️ Deck work hides under carpentry and general contracting. "deck repair" and "deck staining"
  // are included because the smallest operators — the ones with no website — often lead with the
  // maintenance work that pays the bills between builds.
  deck_builder: [
    'deck builder', 'deck contractor', 'deck installation', 'deck repair',
    'deck staining', 'patio builder', 'pergola builder', 'carpenter',
    'general contractor', 'outdoor living contractor',
  ],
  fencing: [
    'fence company', 'fence installation', 'fence contractor', 'fence repair',
    'vinyl fence', 'chain link fence', 'gate installation',
  ],
  concrete: [
    'concrete contractor', 'concrete patio', 'driveway contractor', 'stamped concrete',
    'concrete repair', 'foundation repair', 'sidewalk contractor',
  ],
  roofing: [
    'roofing contractor', 'roof replacement', 'roof repair', 'roofer',
    'gutter installation', 'siding and roofing',
  ],
  siding: ['siding contractor', 'siding installation', 'vinyl siding', 'exterior remodeling'],
  paving: ['paving contractor', 'asphalt paving', 'driveway paving', 'sealcoating', 'blacktop'],
  turf: ['artificial turf', 'turf installation', 'synthetic grass', 'putting green installation'],
  epoxy_flooring: ['epoxy flooring', 'garage floor coating', 'concrete coating', 'epoxy garage floor'],
  retaining_walls: ['retaining wall contractor', 'retaining wall builder', 'hardscape contractor', 'landscaping wall'],
  auto_repair: ['auto repair', 'mechanic', 'brake repair', 'transmission shop', 'oil change', 'tire shop'],
  pressure_washing: ['pressure washing', 'power washing', 'exterior cleaning', 'house washing'],
  junk_removal: ['junk removal', 'hauling service', 'debris removal', 'dumpster rental'],
  carpet_cleaning: ['carpet cleaning', 'upholstery cleaning', 'rug cleaning'],
  window_washing: ['window cleaning', 'window washing', 'gutter cleaning'],
  pest_control: ['pest control', 'exterminator', 'termite control', 'rodent control'],
};

export function queriesFor(industry: IndustryKey): string[] {
  const q = SWEEP_QUERIES[industry];
  if (!q?.length) {
    // ⚠️ Loudly, not silently. Falling back to a generic term would sweep the wrong cohort and the
    // resulting hit-rate would look like an answer. See the Canlis note above.
    throw new Error(
      `No sweep queries for industry "${industry}". Add a set to lib/prospects/sweepQueries.ts — ` +
        `a generic fallback would silently measure the wrong population.`,
    );
  }
  return q;
}

export function sweepableIndustries(): IndustryKey[] {
  return Object.keys(SWEEP_QUERIES) as IndustryKey[];
}
