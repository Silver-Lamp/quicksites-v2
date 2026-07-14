/**
 * @jest-environment node
 */
// lib/ops/__tests__/nextSteps.test.ts

import { computeOpsNextSteps, buildOpsSignals, pageOneOrphans, type OpsSignals } from '@/lib/ops/nextSteps';

function emptySignals(over: Partial<OpsSignals> = {}): OpsSignals {
  return {
    inventory: { total: 0, idleCount: 0, unknownCostCount: 0, netMonthlyCents: 0, upcomingRenewals: [] },
    markets: {
      rankedNotCapitalized: [],
      campaignsNeedingRefine: [],
      readyToMail: [],
      openCompetitionGroups: 0,
      noWebsiteProspects: 0,
      prospectCount: 0,
      channels: { mail: true, sms: true },
    },
    clients: { activeSubscribers: 0, mrrCents: 0, customers: 0, repeatBuyers: 0, lapsedCustomers: 0, unrentedRankingRentCents: 0 },
    nowMs: Date.UTC(2026, 6, 14),
    ...over,
  };
}

describe('pageOneOrphans', () => {
  it('returns page-1 GSC domains not already known', () => {
    const gsc = {
      'graftontowing.com': { clicks: 12, impressions: 300, position: 4 }, // page 1, orphan
      'renton-plumbing.com': { clicks: 2, impressions: 40, position: 6 }, // page 1 but known
      'somewhere.com': { clicks: 0, impressions: 5, position: 22 }, // not page 1
    };
    const known = new Set(['renton-plumbing.com']);
    const out = pageOneOrphans(gsc, known);
    expect(out.map((o) => o.domain)).toEqual(['graftontowing.com']);
  });

  it('handles undefined map', () => {
    expect(pageOneOrphans(undefined, new Set())).toEqual([]);
  });
});

describe('computeOpsNextSteps', () => {
  it('surfaces a ranked-but-uncapitalized domain as a high-priority top step (the grafton case)', () => {
    const s = emptySignals({
      markets: {
        ...emptySignals().markets,
        rankedNotCapitalized: [
          { domain: 'graftontowing.com', position: 3, clicks: 12, impressions: 300, campaignId: null, templateId: null, city: 'grafton', industryKey: null, competitors: 0, rented: false, monthlyRentCents: 0 },
        ],
      },
    });
    const res = computeOpsNextSteps(s);
    const grafton = res.top.find((t) => t.id === 'mkt-rank-graftontowing.com');
    expect(grafton).toBeTruthy();
    expect(grafton!.severity).toBe('high');
    expect(grafton!.title).toContain('graftontowing.com');
    expect(res.byCategory.markets[0].id).toBe('mkt-rank-graftontowing.com');
  });

  it('ranks a better-positioned, higher-rent domain above a worse one', () => {
    const s = emptySignals({
      markets: {
        ...emptySignals().markets,
        rankedNotCapitalized: [
          { domain: 'weak.com', position: 9, clicks: 1, impressions: 10, campaignId: 'c2', templateId: 't2', city: 'x', industryKey: 'plumber', competitors: 1, rented: false, monthlyRentCents: 9900 },
          { domain: 'strong.com', position: 1, clicks: 50, impressions: 900, campaignId: 'c1', templateId: 't1', city: 'y', industryKey: 'towing', competitors: 4, rented: false, monthlyRentCents: 39900 },
        ],
      },
    });
    const res = computeOpsNextSteps(s);
    expect(res.byCategory.markets[0].id).toBe('mkt-rank-strong.com');
  });

  it('caps top at 5 and each category at 5', () => {
    const s = emptySignals({
      inventory: { total: 20, idleCount: 10, unknownCostCount: 6, netMonthlyCents: 8000, upcomingRenewals: [{ domain: 'a.com', expiresAt: '2026-07-20', renewalCents: 1500, rented: false }] },
      markets: {
        ...emptySignals().markets,
        rankedNotCapitalized: Array.from({ length: 8 }, (_, i) => ({ domain: `d${i}.com`, position: i + 1, clicks: 0, impressions: 50, campaignId: `c${i}`, templateId: `t${i}`, city: 'c', industryKey: 'x', competitors: 2, rented: false, monthlyRentCents: 10000 })),
        readyToMail: [{ campaignId: 'c1', domain: 'd1.com' }],
        campaignsNeedingRefine: [{ campaignId: 'c2', domain: 'd2.com', templateId: 't2', hardBlockers: 2 }],
        openCompetitionGroups: 3,
        noWebsiteProspects: 12,
      },
      clients: { activeSubscribers: 0, mrrCents: 0, customers: 5, repeatBuyers: 2, lapsedCustomers: 3, unrentedRankingRentCents: 80000 },
    });
    const res = computeOpsNextSteps(s);
    expect(res.top.length).toBe(5);
    expect(res.byCategory.inventory.length).toBeLessThanOrEqual(5);
    expect(res.byCategory.markets.length).toBe(5);
    expect(res.byCategory.clients.length).toBeLessThanOrEqual(5);
  });

  it('emits inventory hygiene steps (unknown cost, net burn, renewals)', () => {
    const s = emptySignals({
      inventory: {
        total: 10,
        idleCount: 4,
        unknownCostCount: 3,
        netMonthlyCents: 6000,
        upcomingRenewals: [{ domain: 'x.com', expiresAt: '2026-07-25', renewalCents: 2000, rented: false }],
      },
    });
    const ids = computeOpsNextSteps(s).byCategory.inventory.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['inv-unknown-cost', 'inv-net-burn', 'inv-renewals']));
  });

  it('empty signals → empty worklist', () => {
    const res = computeOpsNextSteps(emptySignals());
    expect(res.top).toEqual([]);
    expect(res.byCategory.markets).toEqual([]);
  });
});

describe('buildOpsSignals', () => {
  const nowMs = Date.UTC(2026, 6, 14);
  const rollup = {
    count: 2, withKnownCost: 1, withUnknownCost: 1, yearlyCents: 1500, monthlyCents: 125,
    rentedCount: 0, rentedMonthlyRentCents: 0, rankingCount: 1, idleCount: 1, netMonthlyCents: 125,
  };

  it('pulls an orphan page-1 GSC domain into rankedNotCapitalized', () => {
    const sig = buildOpsSignals({
      inventory: { domains: [], rollup: rollup as any },
      gscByDomain: { 'graftontowing.com': { clicks: 12, impressions: 300, position: 4 } },
      campaigns: [],
      prospects: [],
      rankedOpportunities: [],
      clients: { activeSubscribers: 0, mrrCents: 0, customers: 0, repeatBuyers: 0, lapsedCustomers: 0 },
      channels: { mail: true, sms: true },
      openCompetitionGroups: 0,
      nowMs,
    });
    expect(sig.markets.rankedNotCapitalized).toHaveLength(1);
    expect(sig.markets.rankedNotCapitalized[0].domain).toBe('graftontowing.com');
    expect(sig.markets.rankedNotCapitalized[0].campaignId).toBeNull();
    expect(sig.inventory.unknownCostCount).toBe(1);
  });

  it('excludes rented campaign domains from rankedNotCapitalized', () => {
    const campaigns = [{ id: 'c1', domain: 'rented.com', subscription_status: 'active', status: 'active', template_id: 't1', outreach_blockers: [], outreach_ready_at: null } as any];
    const ranked = [{ campaignId: 'c1', domain: 'rented.com', city: 'x', region: null, industryKey: 'towing', templateId: 't1', gsc: { clicks: 1, impressions: 9, position: 2 }, connected: true, rankStatus: 'page1', rankQuality: 1, monthlyRentCents: 39900, competitors: 3, score: 1 } as any];
    const sig = buildOpsSignals({
      inventory: { domains: [], rollup: rollup as any },
      gscByDomain: { 'rented.com': { clicks: 1, impressions: 9, position: 2 } },
      campaigns,
      prospects: [],
      rankedOpportunities: ranked,
      clients: { activeSubscribers: 1, mrrCents: 5000, customers: 3, repeatBuyers: 1, lapsedCustomers: 0 },
      channels: { mail: true, sms: true },
      openCompetitionGroups: 0,
      nowMs,
    });
    expect(sig.markets.rankedNotCapitalized).toHaveLength(0);
  });
});
