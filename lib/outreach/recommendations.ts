// lib/outreach/recommendations.ts
//
// Pure "grow the ranking" recommendation engine. Deterministic rules over local-SEO
// signals (reviews, organic position, on-page, conversion, commercial) → a prioritized
// list. See docs/GEO_RECOMMENDATIONS_PLAN.md.

import type { OnPageSignals } from '@/lib/outreach/onPage';

export type RecCategory = 'reviews' | 'organic' | 'onpage' | 'conversion' | 'commercial';

export type Recommendation = {
  id: string;
  category: RecCategory;
  priority: number; // higher = act sooner
  title: string;
  detail: string;
};

export type RankingInput = {
  industryKey: string;
  rankStatus: string | null; // 'unranked' | 'ranking' | 'page1'
  rankPosition: number | null;
  impressions?: number | null;
  callCount: number;
  hasTrackingNumber: boolean;
  reviewCount: number | null; // the winner's / the site's business
  rating: number | null;
  competitorTopReviewAvg: number | null; // avg review count of the top competitors
  onPage: OnPageSignals;
  pricingModel: string | null;
  subscriptionStatus: string | null;
};

/** Build a prioritized list of ranking recommendations. Pure + deterministic. */
export function buildRankingRecommendations(i: RankingInput): Recommendation[] {
  const recs: Recommendation[] = [];
  const pos = i.rankPosition ?? 0;

  // ---- Reviews / GBP prominence (usually the #1 local lever) ----
  if (i.reviewCount != null && i.competitorTopReviewAvg != null && i.reviewCount < i.competitorTopReviewAvg) {
    const target = Math.ceil(i.competitorTopReviewAvg);
    recs.push({
      id: 'reviews-gap',
      category: 'reviews',
      priority: 95,
      title: `Get to ~${target} Google reviews`,
      detail: `You have ${i.reviewCount}; the top competitors average ~${target}. Review count is the strongest local-pack lever — ask recent customers.`,
    });
  }
  if (i.rating != null && i.rating < 4.2) {
    recs.push({
      id: 'rating-low',
      category: 'reviews',
      priority: 80,
      title: `Lift the rating (currently ${i.rating.toFixed(1)}★)`,
      detail: 'Ratings under ~4.2 suppress local-pack placement. Prioritize service recovery + fresh 5★ reviews.',
    });
  }

  // ---- Organic position ----
  if (i.rankStatus === 'ranking' && pos > 10 && pos <= 20) {
    recs.push({
      id: 'page2-push',
      category: 'organic',
      priority: 90,
      title: 'One push from page 1',
      detail: `Position ~${pos.toFixed(0)}. Add 1–2 city/service landing pages + LocalBusiness schema and build a few local citations to cross onto page 1.`,
    });
  } else if (i.rankStatus === 'unranked' && (i.impressions ?? 0) === 0) {
    recs.push({
      id: 'not-indexed',
      category: 'organic',
      priority: 60,
      title: 'Not yet ranking',
      detail: 'Newly built. Add content + a few local backlinks/citations, and give Google 2–4 weeks to index and rank.',
    });
  }

  // ---- On-page ----
  if (!i.onPage.hasLocalBusinessSchema) {
    recs.push({ id: 'add-schema', category: 'onpage', priority: 70, title: 'Add LocalBusiness schema', detail: 'Structured data helps Google understand the business and its service area.' });
  }
  if (!i.onPage.hasCityServicePage) {
    recs.push({ id: 'add-city-page', category: 'onpage', priority: 65, title: 'Add a city + service landing page', detail: 'A dedicated page targeting "<city> <service>" is one of the highest-ROI content additions for local rank.' });
  }
  if (!i.onPage.hasNap || !i.onPage.hasClickToCall) {
    recs.push({ id: 'add-nap', category: 'onpage', priority: 55, title: 'Add NAP + tap-to-call', detail: 'Show a consistent name/address/phone and a click-to-call button so mobile searchers can convert instantly.' });
  }

  // ---- Conversion ----
  if (i.hasTrackingNumber && (i.impressions ?? 0) > 20 && i.callCount === 0) {
    recs.push({ id: 'no-calls', category: 'conversion', priority: 75, title: 'Getting seen but no calls', detail: 'Impressions with zero tracked calls — strengthen the hero CTA / make the phone number more prominent.' });
  }

  // ---- Commercial (ties to the rental model) ----
  if (i.rankStatus === 'page1' && i.pricingModel === 'flat' && i.subscriptionStatus !== 'active') {
    recs.push({ id: 'sell-now', category: 'commercial', priority: 88, title: "It's on page 1 — sell it", detail: 'Ranked + unrented. Pitch the rental at the full rate now, with the rank + call proof.' });
  }
  if (i.subscriptionStatus === 'active' && i.callCount >= 10 && i.rankStatus !== 'page1') {
    recs.push({ id: 'upsell', category: 'commercial', priority: 60, title: 'Strong call volume — upsell', detail: `${i.callCount} tracked calls. Good moment to move them to the full plan or a pay-per-lead tier.` });
  }

  return recs.sort((a, b) => b.priority - a.priority);
}
