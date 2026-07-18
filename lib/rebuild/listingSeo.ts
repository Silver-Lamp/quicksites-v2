// lib/rebuild/listingSeo.ts
//
// Pure, import-free copy/SEO helpers for the listing-import path. Kept in their own
// module (NO runtime imports) so tests + value-import callers can use them WITHOUT
// dragging in enrichListingCopy's heavy transitive deps (AI meter → supabase client),
// which otherwise breaks jest module loading — the same reason parseAddress.ts is split out.

import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec'; // type-only; erased at runtime

export type ListingCopyContext = {
  /** City/state for locale-grounded copy; usually read from spec.contact. Optional overrides. */
  city?: string | null;
  state?: string | null;
  /** Reconstructed menu (restaurants) — dish/section names are strong SEO keyword signal. */
  menu?: { sections: { name: string; items?: { name?: string }[] }[] } | undefined;
  /** Owner uid for cost attribution on the metered call. */
  operatorId?: string | null;
};

/** Remove code-y tokens (snake_case, double spaces) that leak from raw Places types. */
export function clean(s: string): string {
  return String(s ?? '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clean + hard-cap a display string. */
export function cap(s: string, n: number): string {
  const t = clean(s);
  return t.length > n ? t.slice(0, n).trim() : t;
}

/**
 * Strip invented placeholder locales the LLM sometimes emits when it has no real place
 * ("… in Your City", ", ST", "… in Your Area") so a location-less site never ships a fake
 * one. The seo_title/description already fall back to the (locale-less) deterministic copy
 * when no place is known; this defends the free-text headline/subheadline too.
 */
export function stripPlaceholderLocale(s: string): string {
  return String(s ?? '')
    .replace(/\s*[—-]?\s*\bin\s+Your\s+(City|Area)\b/gi, '')
    .replace(/,\s*ST\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic name + locale SEO title/description from what we already know — no LLM.
 * Applied unconditionally so the auto-built page title always leads with the business name.
 *   title  → "Rogue Ales — Brewpub in Portland, OR"
 *   desc   → "Rogue Ales — brewpub in Portland, OR. Order online for pickup, or stop by."
 */
export function buildDeterministicSeo(
  spec: RebuildSpec,
  ctx: ListingCopyContext = {},
): { seoTitle: string; seoDescription: string } {
  const name = clean(spec.businessName) || spec.industryLabel || 'Local Business';
  const category = clean(spec.services?.[0] || spec.industryLabel || '');
  const city = clean(ctx.city ?? spec.contact?.city ?? '');
  const state = clean(ctx.state ?? spec.contact?.state ?? '');
  const place = [city, state].filter(Boolean).join(', ');

  const inPlace = place ? ` in ${place}` : '';
  const titleTail = [category, inPlace].filter(Boolean).join('').replace(/^ /, '');
  const seoTitle = cap(titleTail ? `${name} — ${titleTail}` : name, 70);

  const isRestaurant = spec.industryKey === 'restaurant';
  const descLead = category ? `${name} — ${category.toLowerCase()}${inPlace}.` : `${name}${inPlace}.`;
  const descTail = isRestaurant
    ? ' Order online for pickup, or stop by.'
    : ' Get in touch to learn more.';
  const seoDescription = cap(descLead + descTail, 160);

  return { seoTitle, seoDescription };
}
