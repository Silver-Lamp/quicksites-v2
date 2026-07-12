/**
 * @jest-environment node
 */
// lib/outreach/__tests__/recommendations.test.ts

import { buildRankingRecommendations, type RankingInput } from '@/lib/outreach/recommendations';
import { analyzeOnPage } from '@/lib/outreach/onPage';
import { nextOutreachAction, type NextActionInput } from '@/lib/outreach/nextAction';

const goodOnPage = {
  pageCount: 3,
  hasLocalBusinessSchema: true,
  hasCityServicePage: true,
  hasNap: true,
  hasClickToCall: true,
  hasHours: true,
  titleLen: 40,
};

const baseRanking: RankingInput = {
  industryKey: 'plumbing',
  rankStatus: 'page1',
  rankPosition: 4,
  impressions: 300,
  callCount: 3,
  hasTrackingNumber: true,
  reviewCount: 50,
  rating: 4.8,
  competitorTopReviewAvg: 40,
  onPage: goodOnPage,
  pricingModel: 'flat',
  subscriptionStatus: 'active',
};

describe('buildRankingRecommendations', () => {
  it('a healthy ranked+rented site yields few/no recs', () => {
    expect(buildRankingRecommendations(baseRanking).length).toBe(0);
  });

  it('flags a review gap as the top priority', () => {
    const recs = buildRankingRecommendations({ ...baseRanking, reviewCount: 8, competitorTopReviewAvg: 45 });
    expect(recs[0].category).toBe('reviews');
    expect(recs[0].title).toContain('45');
  });

  it('flags a page-2 site and missing on-page basics', () => {
    const recs = buildRankingRecommendations({
      ...baseRanking,
      rankStatus: 'ranking',
      rankPosition: 14,
      onPage: { ...goodOnPage, hasLocalBusinessSchema: false, hasCityServicePage: false },
    });
    const ids = recs.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['page2-push', 'add-schema', 'add-city-page']));
  });

  it('recommends selling a ranked but unrented domain', () => {
    const recs = buildRankingRecommendations({ ...baseRanking, subscriptionStatus: null });
    expect(recs.map((r) => r.id)).toContain('sell-now');
  });
});

describe('analyzeOnPage', () => {
  it('detects pages, NAP and click-to-call from blocks', () => {
    const data = {
      meta: { contact: { phone: '555' } },
      pages: [
        { blocks: [{ type: 'hero', content: { cta_action: 'call_phone' } }, { type: 'contact', content: { phone: '555' } }] },
        { blocks: [] },
      ],
    };
    const s = analyzeOnPage(data);
    expect(s.pageCount).toBe(2);
    expect(s.hasNap).toBe(true);
    expect(s.hasClickToCall).toBe(true);
    expect(s.hasCityServicePage).toBe(true);
  });
});

describe('nextOutreachAction', () => {
  const NOW = new Date('2026-07-11T00:00:00Z').getTime();
  const base: NextActionInput = {
    now: NOW,
    draftBuiltAt: '2026-07-01T00:00:00Z',
    lastPostcardAt: null,
    lastSmsAt: null,
    claimed: false,
    subscriptionStatus: null,
    callCount: 0,
    claimVisits: 0,
    rankStatus: 'unranked',
    channels: { mail: true, sms: true },
    hasPhone: true,
    hasAddress: true,
    hasEmail: false,
  };

  it('first touch → postcard', () => {
    expect(nextOutreachAction(base).action).toBe('send_postcard');
  });
  it('recent postcard → wait', () => {
    const r = nextOutreachAction({ ...base, lastPostcardAt: '2026-07-09T00:00:00Z' });
    expect(r.action).toBe('wait');
    expect(r.waitUntil).toBeTruthy();
  });
  it('aged postcard, silent → SMS follow-up', () => {
    expect(nextOutreachAction({ ...base, lastPostcardAt: '2026-07-01T00:00:00Z' }).action).toBe('send_sms');
  });
  it('hot lead (calls) → reach out now', () => {
    expect(nextOutreachAction({ ...base, callCount: 5 }).action).toBe('send_sms');
    expect(nextOutreachAction({ ...base, callCount: 5 }).reason).toContain('call');
  });
  it('both touches, long silent → cold', () => {
    expect(
      nextOutreachAction({ ...base, lastPostcardAt: '2026-06-01T00:00:00Z', lastSmsAt: '2026-06-05T00:00:00Z' }).action,
    ).toBe('cold');
  });
  it('rented → nurture', () => {
    expect(nextOutreachAction({ ...base, subscriptionStatus: 'active' }).action).toBe('nurture');
  });
  it('claimed, no email → call the rental pitch', () => {
    expect(nextOutreachAction({ ...base, claimed: true }).action).toBe('call');
  });
});
