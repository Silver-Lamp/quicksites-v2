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
