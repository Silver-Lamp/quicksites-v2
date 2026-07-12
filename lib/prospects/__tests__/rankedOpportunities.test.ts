/**
 * @jest-environment node
 */
// lib/prospects/__tests__/rankedOpportunities.test.ts

import {
  buildRankedOpportunities,
  rankQualityFor,
  type OpportunityCampaign,
  type OpportunityProspect,
  type GscStat,
} from '@/lib/prospects/rankedOpportunities';

const camp = (over: Partial<OpportunityCampaign> & { id: string; domain: string }): OpportunityCampaign => ({
  city: over.city ?? 'Boston',
  region: over.region ?? 'MA',
  industry_key: over.industry_key ?? 'plumbing', // PREMIUM tier → 39900
  template_id: over.template_id ?? 't1',
  status: over.status ?? 'live',
  ...over,
});

const prospect = (campaignId: string, over: Partial<OpportunityProspect> = {}): OpportunityProspect => ({
  geo_campaign_id: campaignId,
  status: over.status ?? 'discovered',
  lead_tier: over.lead_tier ?? 'no_website',
});

describe('rankQualityFor', () => {
  it('buckets by rank status/position', () => {
    expect(rankQualityFor('page1', 6)).toBe(1.0);
    expect(rankQualityFor('ranking', 14)).toBe(0.6);
    expect(rankQualityFor('ranking', 0)).toBe(0.35); // impressions-only
    expect(rankQualityFor('unranked', 0)).toBe(0.1);
  });
});

describe('buildRankedOpportunities', () => {
  it('sorts a page-1 campaign above an unranked one of the same tier', () => {
    const campaigns = [camp({ id: 'a', domain: 'boston-plumbing.com' }), camp({ id: 'b', domain: 'quincy-plumbing.com' })];
    const gsc: Record<string, GscStat> = {
      'boston-plumbing.com': { clicks: 3, impressions: 100, position: 6 }, // page1
      // quincy has no GSC entry → not connected / unranked
    };
    const out = buildRankedOpportunities(campaigns, [], gsc);
    expect(out.map((o) => o.campaignId)).toEqual(['a', 'b']);
    expect(out[0].rankStatus).toBe('page1');
    expect(out[0].connected).toBe(true);
    expect(out[1].connected).toBe(false);
    expect(out[1].rankStatus).toBe('unranked');
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it('counts only linked, non-dismissed, no-website prospects as competitors', () => {
    const campaigns = [camp({ id: 'a', domain: 'x.com' })];
    const prospects = [
      prospect('a'),
      prospect('a'),
      prospect('a', { status: 'dismissed' }), // excluded
      prospect('a', { lead_tier: 'dated' }), // excluded
      prospect('b'), // other campaign
      { geo_campaign_id: null, status: 'discovered', lead_tier: 'no_website' }, // unlinked
    ];
    const out = buildRankedOpportunities(campaigns, prospects, {});
    expect(out[0].competitors).toBe(2);
  });

  it('applies a capped sub-linear demand boost', () => {
    const base = buildRankedOpportunities([camp({ id: 'a', domain: 'x.com' })], [], {})[0];
    const many = Array.from({ length: 20 }, () => prospect('a'));
    const boosted = buildRankedOpportunities([camp({ id: 'a', domain: 'x.com' })], many, {})[0];
    // 0 competitors → factor 1; capped at 10 → factor 2.0
    expect(boosted.score).toBeCloseTo(base.score * 2.0);
  });

  it('uses the industry tier for monthly rent', () => {
    const premium = buildRankedOpportunities([camp({ id: 'a', domain: 'x.com', industry_key: 'plumbing' })], [], {})[0];
    const low = buildRankedOpportunities([camp({ id: 'b', domain: 'y.com', industry_key: 'salon_spa' })], [], {})[0];
    expect(premium.monthlyRentCents).toBe(39900);
    expect(low.monthlyRentCents).toBe(9900);
  });

  it('drops archived campaigns', () => {
    const out = buildRankedOpportunities([camp({ id: 'a', domain: 'x.com', status: 'archived' })], [], {});
    expect(out).toHaveLength(0);
  });
});
