// lib/outreach/geoPricing.ts
//
// Pure pricing + rank logic for renting geo-domains (see docs/GEO_DOMAIN_MONETIZATION.md).
// Flat monthly rent tiered by industry lead-value, with a pre-rank "founder rate" that
// steps up to the full rate once the domain reaches page 1.

import type { IndustryKey } from '@/lib/industries';

export type RankStatus = 'unranked' | 'ranking' | 'page1';
export type PricingModel = 'none' | 'flat' | 'ppl';

export type PriceTier = { fullCents: number; lockedCents: number };

// Monthly rent by lead value. `locked` = the pre-rank founder rate (paid until page 1).
const TIER_PREMIUM: PriceTier = { fullCents: 39900, lockedCents: 9900 };
const TIER_MID: PriceTier = { fullCents: 19900, lockedCents: 7900 };
const TIER_LOW: PriceTier = { fullCents: 9900, lockedCents: 4900 };

// High-ticket / emergency trades → premium; everyday trades → mid; rest → low.
// Exported so the buy-list planner defaults its industry picker to the premium set
// (highest unlockable rent) without re-listing the keys and risking drift.
export const PREMIUM_INDUSTRIES: readonly IndustryKey[] = [
  'towing', 'plumbing', 'hvac', 'roof_cleaning', 'windshield_repair', 'general_contractor', 'electrical',
  'deck_builder', // a deck is a $5k–$30k job — premium unlockable rent
];
export const MID_INDUSTRIES: readonly IndustryKey[] = [
  'landscaping', 'auto_repair', 'moving', 'pest_control', 'carpet_cleaning',
  'pressure_washing', 'window_washing', 'junk_removal', 'painting', 'medical_dental', 'legal', 'real_estate',
];
const PREMIUM = new Set<IndustryKey>(PREMIUM_INDUSTRIES);
const MID = new Set<IndustryKey>(MID_INDUSTRIES);

export function priceTier(key: IndustryKey): PriceTier {
  if (PREMIUM.has(key)) return TIER_PREMIUM;
  if (MID.has(key)) return TIER_MID;
  return TIER_LOW;
}

/** Suggested flat plan for a campaign's industry. */
export function suggestPricing(key: IndustryKey) {
  const t = priceTier(key);
  return {
    pricing_model: 'flat' as PricingModel,
    price_cents: t.fullCents,
    locked_rate_cents: t.lockedCents,
    billing_interval: 'month' as const,
  };
}

/** GSC avg position (+ impressions) → rank bucket. */
export function deriveRankStatus(position?: number | null, impressions?: number | null): RankStatus {
  const p = position ?? 0;
  if (p > 0 && p <= 10) return 'page1';
  if (p > 0 || (impressions ?? 0) > 0) return 'ranking';
  return 'unranked';
}

/**
 * What the renter should be charged NOW: the locked founder rate until the domain hits
 * page 1, then the full rate. Null when there's no flat plan configured.
 */
export function effectivePriceCents(c: {
  pricing_model?: string | null;
  price_cents?: number | null;
  locked_rate_cents?: number | null;
  rank_status?: string | null;
}): number | null {
  if (c.pricing_model !== 'flat') return null;
  if (c.rank_status === 'page1') return c.price_cents ?? c.locked_rate_cents ?? null;
  return c.locked_rate_cents ?? c.price_cents ?? null;
}

export function formatCents(cents?: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
