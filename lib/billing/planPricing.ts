// lib/billing/planPricing.ts
//
// The published Agency plan prices, in one place.
//
// ⚠️ WHY THIS FILE EXISTS. These numbers lived as local consts inside app/pricing/page.tsx, which
// was fine while one page said them. A second surface now quotes them — the Gemini case study,
// whose whole point is reconciling a third party's assumptions against our real pricing — and two
// copies of a price is how a marketing page and a proposal end up disagreeing in front of a
// customer. Import from here; never retype.
//
// These are DISPLAY prices. What Stripe actually charges comes from the price ids in
// lib/billing/plans.ts (STRIPE_PRICE_AGENCY_*), which are a separate source of truth and, as of
// 2026-09-17, not set in production — so the plan is advertised but not self-serve billable.

export type AgencyPlanPrice = {
  /** Per user, per month, in whole USD. */
  platform: number;
  /** Per site, per month, in whole USD. */
  perSite: number;
};

/** Beta tier, grandfathered 12 months. */
export const AGENCY_FOUNDER: AgencyPlanPrice = { platform: 15, perSite: 5 };
/** The published rate a new agency pays today. */
export const AGENCY_PUBLIC: AgencyPlanPrice = { platform: 19, perSite: 6 };

/** "Have it built for me" — the done-for-you build + care plans on /pricing (USD, whole dollars). */
export const DONE_FOR_YOU = { buildFrom: 1995, careSelfService: 49, careManaged: 149 } as const;

/** What an agency pays us for `sites` client sites on a tier, per month. Pure. */
export function agencyMonthlyCost(sites: number, plan: AgencyPlanPrice = AGENCY_PUBLIC): number {
  const n = Math.max(0, Math.floor(sites));
  return plan.platform + n * plan.perSite;
}
