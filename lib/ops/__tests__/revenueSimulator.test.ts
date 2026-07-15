/**
 * @jest-environment node
 */
// lib/ops/__tests__/revenueSimulator.test.ts

import {
  simulateRevenue,
  deriveSimSeed,
  SIM_SCENARIOS,
  PARTNER_RESIDUAL_SHARE,
  SIM_DEFAULTS,
  type SimInputs,
  type SimSeedSource,
} from '@/lib/ops/revenueSimulator';

const baseInputs: SimInputs = {
  rentedDomains: 5,
  avgRentCents: 10_000, // $100
  subscribers: 4,
  avgPlanCents: 5_000, // $50
  merchants: 10,
  ordersPerMerchant: 20,
  avgOrderCents: 5_000, // $50
  platformFeePct: 10,
  attributedPct: 0,
  monthlyBurnCents: 30_000, // $300
};

describe('simulateRevenue', () => {
  it('composes the three streams net of burn', () => {
    const out = simulateRevenue(baseInputs);
    // GMV = 10 × 20 × $50 = $10,000
    expect(out.gmvCents).toBe(10 * 20 * 5_000);
    // fee = 10% of $10,000 = $1,000; no attribution → no residual
    expect(out.grossFeeCents).toBe(100_000);
    expect(out.partnerResidualCents).toBe(0);
    expect(out.netCommerceCents).toBe(100_000);
    expect(out.domainRentCents).toBe(50_000); // 5 × $100
    expect(out.mrrCents).toBe(20_000); // 4 × $50
    expect(out.grossRevenueCents).toBe(170_000);
    expect(out.netMonthlyCents).toBe(170_000 - 30_000);
    expect(out.annualNetCents).toBe(out.netMonthlyCents * 12);
  });

  it('carves the 80% partner residual out of attributed fee', () => {
    const out = simulateRevenue({ ...baseInputs, attributedPct: 50 });
    // half the $1,000 fee is attributed → residual = $500 × 0.8 = $400
    expect(out.partnerResidualCents).toBe(Math.round((100_000 * 0.5) * PARTNER_RESIDUAL_SHARE));
    expect(out.netCommerceCents).toBe(100_000 - out.partnerResidualCents);
  });

  it('floors negative/NaN inputs and lets net go negative', () => {
    const out = simulateRevenue({ ...baseInputs, merchants: -5, subscribers: NaN, rentedDomains: 0, monthlyBurnCents: 50_000 });
    expect(out.gmvCents).toBe(0);
    expect(out.mrrCents).toBe(0);
    expect(out.domainRentCents).toBe(0);
    expect(out.netMonthlyCents).toBe(-50_000);
  });

  it('clamps the fee percent to 0–100', () => {
    expect(simulateRevenue({ ...baseInputs, platformFeePct: 999 }).grossFeeCents).toBe(simulateRevenue({ ...baseInputs, platformFeePct: 100 }).grossFeeCents);
    expect(simulateRevenue({ ...baseInputs, platformFeePct: -5 }).grossFeeCents).toBe(0);
  });
});

describe('deriveSimSeed', () => {
  const src: SimSeedSource = {
    rollup: { count: 20, rentedCount: 4, rankingCount: 6, idleCount: 10, rentedMonthlyRentCents: 40_000, monthlyCents: 25_000 },
    revenue: { gmv_cents: 200_000, platform_fee_cents: 20_000, orders: { paid: 8 } },
    clients: { mrrCents: 30_000, activeSubscribers: 3 },
  };

  it('back-derives rent, fee, order value and plan from live data', () => {
    const { seed, bounds } = deriveSimSeed(src);
    expect(seed.rentedDomains).toBe(4);
    expect(seed.avgRentCents).toBe(10_000); // $400 / 4
    expect(seed.platformFeePct).toBe(10); // 20k / 200k
    expect(seed.avgOrderCents).toBe(25_000); // 200k / 8
    expect(seed.avgPlanCents).toBe(10_000); // 30k / 3
    expect(seed.merchants).toBe(3); // max(subscribers, 1)
    expect(seed.monthlyBurnCents).toBe(25_000);
    expect(bounds.maxRentedDomains).toBe(20);
  });

  it('falls back to defaults when live signal is absent', () => {
    const empty: SimSeedSource = {
      rollup: { count: 0, rentedCount: 0, rankingCount: 0, idleCount: 0, rentedMonthlyRentCents: 0, monthlyCents: 0 },
      revenue: { gmv_cents: 0, platform_fee_cents: 0, orders: { paid: 0 } },
      clients: { mrrCents: 0, activeSubscribers: 0 },
    };
    const { seed, bounds } = deriveSimSeed(empty);
    expect(seed.avgRentCents).toBe(SIM_DEFAULTS.avgRentCents);
    expect(seed.platformFeePct).toBe(SIM_DEFAULTS.platformFeePct);
    expect(seed.avgOrderCents).toBe(SIM_DEFAULTS.avgOrderCents);
    expect(seed.merchants).toBe(1);
    expect(bounds.maxRentedDomains).toBe(0);
  });
});

describe('SIM_SCENARIOS', () => {
  const src: SimSeedSource = {
    rollup: { count: 20, rentedCount: 4, rankingCount: 6, idleCount: 10, rentedMonthlyRentCents: 40_000, monthlyCents: 25_000 },
    revenue: { gmv_cents: 200_000, platform_fee_cents: 20_000, orders: { paid: 8 } },
    clients: { mrrCents: 30_000, activeSubscribers: 3 },
  };

  it('"current" is a no-op reference', () => {
    const { seed, bounds } = deriveSimSeed(src);
    const current = SIM_SCENARIOS.find((s) => s.id === 'current')!;
    expect(current.apply(seed, bounds)).toEqual(seed);
  });

  it('"rent-idle" rents the full inventory and always beats current', () => {
    const { seed, bounds } = deriveSimSeed(src);
    const scenario = SIM_SCENARIOS.find((s) => s.id === 'rent-idle')!;
    const applied = scenario.apply(seed, bounds);
    expect(applied.rentedDomains).toBe(bounds.maxRentedDomains);
    expect(simulateRevenue(applied).netMonthlyCents).toBeGreaterThan(simulateRevenue(seed).netMonthlyCents);
  });

  it('"land-grab" scales merchants and volume', () => {
    const { seed, bounds } = deriveSimSeed(src);
    const scenario = SIM_SCENARIOS.find((s) => s.id === 'land-grab')!;
    const applied = scenario.apply(seed, bounds);
    expect(applied.merchants).toBe(seed.merchants * 3);
    expect(applied.rentedDomains).toBe(bounds.maxRentedDomains);
    expect(simulateRevenue(applied).netMonthlyCents).toBeGreaterThan(simulateRevenue(seed).netMonthlyCents);
  });
});
