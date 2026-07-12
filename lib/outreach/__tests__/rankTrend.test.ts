/**
 * @jest-environment node
 */
// lib/outreach/__tests__/rankTrend.test.ts

import { computeRankTrend } from '@/lib/outreach/rankTrend';
import { buildRankingRecommendations, type RankingInput } from '@/lib/outreach/recommendations';

describe('computeRankTrend', () => {
  it('positive positionDelta when position improves (lower is better)', () => {
    const t = computeRankTrend({ position: 12, impressions: 100, clicks: 2, ctr: 0.02 }, { position: 8, impressions: 160, clicks: 4, ctr: 0.025 });
    expect(t.positionDelta).toBe(4);
    expect(t.direction).toBe('up');
    expect(t.impressionsDelta).toBe(60);
  });
  it('down when position worsens', () => {
    const t = computeRankTrend({ position: 6, impressions: 100, clicks: 5, ctr: 0.05 }, { position: 11, impressions: 90, clicks: 3, ctr: 0.03 });
    expect(t.positionDelta).toBe(-5);
    expect(t.direction).toBe('down');
  });
  it('no delta without a prior snapshot', () => {
    const t = computeRankTrend(null, { position: 9, impressions: 50, clicks: 1, ctr: 0.02 });
    expect(t.positionDelta).toBeNull();
    expect(t.direction).toBe('flat');
  });
});

describe('trend recommendations', () => {
  const base: RankingInput = {
    industryKey: 'plumbing', rankStatus: 'ranking', rankPosition: 8, impressions: 200,
    callCount: 2, hasTrackingNumber: true, reviewCount: 40, rating: 4.7, competitorTopReviewAvg: 30,
    onPage: { pageCount: 3, hasLocalBusinessSchema: true, hasCityServicePage: true, hasNap: true, hasClickToCall: true, hasHours: true, titleLen: 40 },
    pricingModel: 'flat', subscriptionStatus: 'active',
  };
  it('flags slipping rank', () => {
    const recs = buildRankingRecommendations({ ...base, trend: { positionDelta: -5, impressionsDelta: -10, ctr: 0.03, position: 13, impressions: 200, direction: 'down' } });
    expect(recs.map((r) => r.id)).toContain('trend-slipping');
  });
  it('flags high-impressions / low-CTR', () => {
    const recs = buildRankingRecommendations({ ...base, trend: { positionDelta: 0, impressionsDelta: 0, ctr: 0.008, position: 8, impressions: 400, direction: 'flat' } });
    expect(recs.map((r) => r.id)).toContain('low-ctr');
  });
});
