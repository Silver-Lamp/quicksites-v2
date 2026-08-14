// lib/outreach/geoDomain.ts
//
// Pure domain-derivation for the geo land-grab: city + industry → exact-match domain +
// pitch-site slug. Extracted from geoCampaigns.ts (which pulls in Supabase/registrar
// server deps) so pure consumers — the buy-list planner, unit tests, the client bundle —
// can derive a domain without loading server code. geoCampaigns.ts re-exports these for
// back-compat.

import type { IndustryKey } from '@/lib/industries';

// Clean single-word (or hyphenated) domain fragment per industry — the compound keys
// (salon_spa, medical_dental) get a nicer domain word than the raw key.
export const INDUSTRY_DOMAIN_WORD: Partial<Record<IndustryKey, string>> = {
  salon_spa: 'salon',
  medical_dental: 'dental',
  general_contractor: 'contractor',
  deck_builder: 'decks',
  fencing: 'fence',
  concrete: 'concrete',
  turf: 'turf',
  epoxy_flooring: 'epoxy',
  paving: 'paving',
  roofing: 'roofing', // install/replace (roof_cleaning now uses 'roof-cleaning')
  siding: 'siding',
  retaining_walls: 'retaining-walls',
  auto_repair: 'auto-repair',
  real_estate: 'real-estate',
  carpet_cleaning: 'carpet-cleaning',
  window_washing: 'window-cleaning',
  pressure_washing: 'pressure-washing',
  junk_removal: 'junk-removal',
  roof_cleaning: 'roof-cleaning', // freed 'roofing' for the roofing install vertical
  windshield_repair: 'auto-glass',
  pest_control: 'pest-control',
};

export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 63);
}

export function industryDomainWord(key: IndustryKey): string {
  return INDUSTRY_DOMAIN_WORD[key] ?? key.replace(/_/g, '-');
}

/**
 * Derive the exact-match domain + pitch-site slug for a city + industry.
 * slug == the apex label so middleware host→/sites/<slug> rewrite serves the pitch
 * site with no extra mapping. e.g. ('Boston','towing') → { domain:'boston-towing.com',
 * slug:'boston-towing' }.
 */
export function geoDomainFor(
  city: string,
  industryKey: IndustryKey,
  tld = 'com',
): { domain: string; slug: string } {
  const slug = slugify(`${city}-${industryDomainWord(industryKey)}`);
  return { domain: `${slug}.${tld}`, slug };
}

/**
 * The apex label for a domain — `kent-restaurants.com` → `kent-restaurants`.
 *
 * ⚠️ THE SLUG MUST BE DERIVED FROM THE DOMAIN WE ACTUALLY BOUGHT, never re-derived from the city.
 * The host→`/sites/<slug>` rewrite has no mapping table: the apex label IS the lookup. A campaign
 * launched on `kent-restaurants.com` while carrying the slug `kent-restaurant` points a real,
 * paid-for domain at a site that does not exist.
 */
export function apexSlugForDomain(domain: string): string {
  return slugify((domain || '').trim().toLowerCase().replace(/\.[a-z.]+$/, ''));
}

/**
 * Apex-domain candidates for a city + industry, **best first**.
 *
 * ⚠️ PLURALISING IS PER-INDUSTRY, NOT A RULE. For food the plural IS the exact match — a hungry
 * person types "kent restaurants" — so it leads. For most trades the plural is wrong or absurd:
 * nobody searches "paterson auto repairs" or "renton roofings". Offering a bad alternate is worse
 * than offering one candidate, because the operator has to judge which is real at the moment of
 * spending money.
 *
 * ⚠️ EVERY FORM WE MIGHT ALREADY OWN MUST STAY IN THE LIST. A city we own must never look buyable —
 * that is how a second Renton domain nearly got bought while the first sat parked at Namecheap.
 */
const APEX_ALTERNATES: Partial<Record<string, (slug: string) => string[]>> = {
  // Food is the one where the plural is the natural search term, so it leads.
  restaurant: (slug) => [`${slug}s`],
};

export function apexCandidatesFor(
  city: string,
  industryKey: IndustryKey,
  tld = 'com',
): Array<{ domain: string; slug: string }> {
  const canonical = geoDomainFor(city, industryKey, tld);
  const alts = (APEX_ALTERNATES[industryKey]?.(canonical.slug) ?? []).map((slug) => ({
    domain: `${slug}.${tld}`,
    slug,
  }));
  // Alternates first when they exist — for food the plural is the better buy.
  return [...alts, canonical];
}

/**
 * @deprecated Use `apexCandidatesFor(city, 'restaurant')`. Kept so existing callers are unchanged.
 */
export function restaurantApexCandidates(
  city: string,
  tld = 'com',
): Array<{ domain: string; slug: string }> {
  return apexCandidatesFor(city, 'restaurant' as IndustryKey, tld);
}
