// lib/outreach/competitionKinds.ts
//
// The geo-domain "competition" kinds — a premium <city>-<word>.com apex is the PRIZE for a
// cohort of no-website businesses that each already got their own claimable site; first to
// claim wins the apex (which fronts a public directory that features the winner). Distinct
// from the legacy 'geo_services' rent model. One place so the shared claim-award hook
// (awardCompetitionOnClaim) works for every competition vertical, not just restaurants.

export const RESTAURANT_COMPETITION_KIND = 'restaurant_competition';
export const AUTO_SHOP_COMPETITION_KIND = 'auto_shop_competition';

/** Every first-to-claim competition kind (excludes the 'geo_services' rent model). */
export const COMPETITION_KINDS = [RESTAURANT_COMPETITION_KIND, AUTO_SHOP_COMPETITION_KIND] as const;

export type CompetitionKind = (typeof COMPETITION_KINDS)[number];

export function isCompetitionKind(kind: string | null | undefined): kind is CompetitionKind {
  return kind === RESTAURANT_COMPETITION_KIND || kind === AUTO_SHOP_COMPETITION_KIND;
}
