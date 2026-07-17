// lib/prospects/ownedDomains.ts
//
// Dedupe the domain buy-list against inventory the operator already owns (e.g. a Namecheap
// export they paste in). Matches two ways:
//   - exact:   same normalized domain (gallatin-towing.com == gallatin-towing.com)
//   - similar: same label ignoring hyphens / TLD (gallatin-towing.com ≈ gallatintowing.com
//              ≈ gallatintowing.net) — because a geo-domain owned without the dash is the
//              same asset, no need to re-buy.
// Pure + no I/O (matching is against the pasted list, not a registrar). See
// docs/DOMAIN_ACQUISITION_PLAN.md.

import type { IndustryKey } from '@/lib/industries';
import { industryDomainWord } from '@/lib/outreach/geoDomain';

export type OwnedMatch = 'exact' | 'similar' | 'alias' | null;

/** Strip protocol / www / path / trailing dots and lowercase. '' if not domain-ish. */
export function normalizeDomain(input: string): string {
  let s = (input || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0].split('?')[0].split('#')[0]; // drop any path/query
  s = s.replace(/\.+$/, '').trim();
  // must contain at least one letter (avoid capturing stray tokens like prices)
  if (!/[a-z]/.test(s)) return '';
  return s;
}

/**
 * Hyphen/TLD-insensitive key for the registrable label. Takes the first label (SLD),
 * removes every non-alphanumeric char. gallatin-towing.com → "gallatintowing";
 * gallatintowing → "gallatintowing".
 */
export function domainLabelKey(input: string): string {
  const norm = normalizeDomain(input);
  if (!norm) return '';
  const label = norm.includes('.') ? norm.split('.')[0] : norm;
  return label.replace(/[^a-z0-9]/g, '');
}

/** Parse a pasted blob (newlines / commas / whitespace separated) into unique domains. */
export function parseOwnedDomains(text: string): string[] {
  const seen = new Set<string>();
  for (const tok of (text || '').split(/[\s,;]+/)) {
    const d = normalizeDomain(tok);
    if (d) seen.add(d);
  }
  return [...seen];
}

export type OwnedIndex = {
  /** Normalized full domains (for exact match). */
  full: Set<string>;
  /** Hyphen/TLD-insensitive label keys (for similar match). */
  labels: Set<string>;
  count: number;
};

/** Build a lookup index from a list (or pasted blob) of owned domains. */
export function buildOwnedIndex(owned: string[] | string): OwnedIndex {
  const list = Array.isArray(owned) ? owned : parseOwnedDomains(owned);
  const full = new Set<string>();
  const labels = new Set<string>();
  for (const d of list) {
    const norm = normalizeDomain(d);
    if (!norm) continue;
    full.add(norm);
    const key = domainLabelKey(norm);
    if (key) labels.add(key);
  }
  return { full, labels, count: full.size };
}

/** Classify a candidate domain against the owned index (exact / similar, no aliases). */
export function matchOwned(candidateDomain: string, index: OwnedIndex): OwnedMatch {
  const norm = normalizeDomain(candidateDomain);
  if (!norm) return null;
  if (index.full.has(norm)) return 'exact';
  const key = domainLabelKey(norm);
  if (key && index.labels.has(key)) return 'similar';
  return null;
}

// Common abbreviations/synonyms for the service word, per industry — so an owned domain
// that abbreviates the trade (gallatintow.com for gallatin-towing.com) still counts as owned.
// Each list is a superset that INCLUDES the canonical dashless word. Keyed by IndustryKey.
const SERVICE_ALIASES: Partial<Record<IndustryKey, string[]>> = {
  towing: ['towing', 'tow', 'towtruck', 'towservice', 'towingservice', '247towing'],
  plumbing: ['plumbing', 'plumber', 'plumbers', 'plumb'],
  hvac: ['hvac', 'heatingandcooling', 'heatingcooling', 'acrepair', 'airconditioning', 'heatingair'],
  roof_cleaning: ['roofing', 'roof', 'roofer', 'roofers', 'roofrepair', 'roofcleaning', 'roofclean'],
  windshield_repair: ['autoglass', 'windshield', 'windshieldrepair', 'glass'],
  general_contractor: ['contractor', 'contractors', 'generalcontractor', 'construction', 'gc'],
  deck_builder: ['decks', 'deck', 'deckbuilder', 'deckbuilders', 'deckbuilding', 'deckcontractor', 'deckco'],
  electrical: ['electrical', 'electric', 'electrician', 'electricians'],
  landscaping: ['landscaping', 'landscape', 'landscaper', 'landscapers', 'lawncare', 'lawn'],
  auto_repair: ['autorepair', 'auto', 'mechanic', 'autoshop', 'autoservice'],
  moving: ['moving', 'movers', 'mover'],
  pest_control: ['pestcontrol', 'pest', 'exterminator', 'extermination'],
  carpet_cleaning: ['carpetcleaning', 'carpet', 'carpetcleaner', 'carpetcleaners'],
  pressure_washing: ['pressurewashing', 'pressurewash', 'powerwashing', 'powerwash'],
  window_washing: ['windowcleaning', 'windowwashing', 'windowcleaner', 'windows', 'windowwash', 'windowclean'],
  junk_removal: ['junkremoval', 'junk', 'junkhauling', 'hauling'],
  painting: ['painting', 'painter', 'painters', 'paint'],
  medical_dental: ['dental', 'dentist', 'dentalcare', 'dentistry'],
  legal: ['legal', 'law', 'lawyer', 'attorney', 'lawfirm'],
  real_estate: ['realestate', 'realtor', 'realty', 'homes'],
};

function serviceAliasesFor(industryKey: string): string[] {
  const canonical = industryDomainWord(industryKey as IndustryKey).replace(/[^a-z0-9]/g, '');
  const list = SERVICE_ALIASES[industryKey as IndustryKey] ?? [];
  return Array.from(new Set([canonical, ...list].filter(Boolean)));
}

/**
 * Classify a candidate against owned inventory using its structured city + industry, so
 * we can catch abbreviated/reordered variants precisely (no risky substring matching):
 *   - exact   — same normalized domain
 *   - similar — same dashless label / different TLD
 *   - alias   — city + a known service abbreviation, in either word order
 *               (gallatintow, towgallatin, gallatinplumber, …)
 */
export function candidateOwnedMatch(
  candidate: { domain: string; city: string; industryKey: string },
  index: OwnedIndex,
): OwnedMatch {
  const base = matchOwned(candidate.domain, index);
  if (base) return base;
  if (!index.count) return null;

  const cityKey = (candidate.city || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cityKey) return null;

  for (const alias of serviceAliasesFor(candidate.industryKey)) {
    if (index.labels.has(cityKey + alias)) return 'alias';
    if (index.labels.has(alias + cityKey)) return 'alias';
  }
  return null;
}
