// lib/site/industryNav.ts
//
// THE ONE LIST OF INDUSTRIES THE PUBLIC SITE NAMES — the homepage pills and the nav's
// "Industries" dropdown both render it, so they cannot drift (owner, 2026-10-03: the dropdown
// showed six verticals while the hero showed twelve pills, and only one of them had "+47 more").
//
// Each entry links to the vertical's own landing page when it has one, else to the gallery
// filtered to that industry. The list ends, on both surfaces, with "+N more" → /gallery, where N
// is DERIVED from lib/industries so adding an industry cannot leave either surface claiming a
// stale number.
import { INDUSTRIES, type IndustryKey } from '@/lib/industries';

export const GALLERY_HREF = '/gallery';

export type IndustryNavEntry = {
  label: string;
  href: string;
  /** The lib/industries key, when the entry IS an industry (counts against "+N more"). */
  key?: IndustryKey;
};

/** `/gallery?industry=<key>` — the gallery filtered to one industry. */
export function galleryHrefFor(key: IndustryKey): string {
  return `${GALLERY_HREF}?industry=${encodeURIComponent(key)}`;
}

export const INDUSTRY_NAV: ReadonlyArray<IndustryNavEntry> = [
  { key: 'restaurant', label: 'Restaurants', href: '/restaurants' },
  { key: 'real_estate', label: 'Real Estate', href: '/realtors' },
  { key: 'auto_repair', label: 'Auto Repair', href: '/secondset' },
  { key: 'plumbing', label: 'Plumbing', href: galleryHrefFor('plumbing') },
  { key: 'hvac', label: 'HVAC', href: galleryHrefFor('hvac') },
  { key: 'salon_spa', label: 'Salon & Spa', href: galleryHrefFor('salon_spa') },
  { key: 'deck_builder', label: 'Deck Builder', href: galleryHrefFor('deck_builder') },
  { key: 'roofing', label: 'Roofing', href: galleryHrefFor('roofing') },
  { key: 'photography', label: 'Photography', href: galleryHrefFor('photography') },
  { key: 'author', label: 'Author', href: galleryHrefFor('author') },
  { key: 'fitness', label: 'Fitness', href: galleryHrefFor('fitness') },
  { key: 'landscaping', label: 'Landscaping', href: galleryHrefFor('landscaping') },
  { key: 'lemonade_stand', label: 'Lemonade Stands', href: '/lemonade-stands' },
  // Two verticals with their own pages that are not lib/industries keys. They stay in the list
  // because each earns its page and its door: Verbatim was once reachable from NOWHERE on this
  // site, and its usage was being read as weak demand when it measured discovery.
  { label: 'Supplements', href: '/supplements' },
  { label: 'Job Seekers', href: '/verbatim' },
];

/** Industries we offer beyond the ones named above. Derived, never typed. */
export function moreIndustriesCount(): number {
  const named = new Set(INDUSTRY_NAV.map((e) => e.key).filter(Boolean));
  return Math.max(0, INDUSTRIES.length - named.size);
}

export function moreIndustriesLabel(): string {
  return `+${moreIndustriesCount()} more`;
}
