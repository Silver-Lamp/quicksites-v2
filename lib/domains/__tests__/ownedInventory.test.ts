/**
 * @jest-environment node
 */
// lib/domains/__tests__/ownedInventory.test.ts

import { rollupDomains, projectDomainSpend, projectFromRollup, projectDomainSpendByExpiry, type InventoryDomain } from '@/lib/domains/ownedInventory';

function dom(over: Partial<InventoryDomain> = {}): InventoryDomain {
  return {
    domain: 'x.com',
    source: 'campaign',
    registrar: 'vercel',
    renewalCents: 2000,
    expiresAt: null,
    autoRenew: true,
    campaignId: null,
    city: null,
    industryKey: null,
    monthlyRentCents: 0,
    rented: false,
    ranking: false,
    notes: null,
    ...over,
  };
}

describe('rollupDomains', () => {
  it('sums known costs, counts unknowns, and amortizes to monthly', () => {
    const r = rollupDomains([
      dom({ domain: 'a.com', renewalCents: 1200 }),
      dom({ domain: 'b.com', renewalCents: 2400 }),
      dom({ domain: 'c.com', renewalCents: null }), // unknown → needs cost
    ]);
    expect(r.count).toBe(3);
    expect(r.withKnownCost).toBe(2);
    expect(r.withUnknownCost).toBe(1);
    expect(r.yearlyCents).toBe(3600);
    expect(r.monthlyCents).toBe(300); // 3600/12
  });

  it('classifies rented / ranking / idle and offsets rent', () => {
    const r = rollupDomains([
      dom({ domain: 'a.com', renewalCents: 1200, rented: true, monthlyRentCents: 9900 }),
      dom({ domain: 'b.com', renewalCents: 1200, ranking: true }),
      dom({ domain: 'c.com', renewalCents: 1200 }), // idle
    ]);
    expect(r.rentedCount).toBe(1);
    expect(r.rentedMonthlyRentCents).toBe(9900);
    expect(r.rankingCount).toBe(1);
    expect(r.idleCount).toBe(1);
    // monthly cost = 3600/12 = 300; net = 300 - 9900 = -9600 (profit)
    expect(r.monthlyCents).toBe(300);
    expect(r.netMonthlyCents).toBe(-9600);
  });

  it('rented takes precedence over ranking in classification', () => {
    const r = rollupDomains([dom({ rented: true, ranking: true, monthlyRentCents: 5000 })]);
    expect(r.rentedCount).toBe(1);
    expect(r.rankingCount).toBe(0);
    expect(r.idleCount).toBe(0);
  });

  it('empty inventory → all zeros', () => {
    const r = rollupDomains([]);
    expect(r).toMatchObject({ count: 0, yearlyCents: 0, monthlyCents: 0, netMonthlyCents: 0 });
  });
});

describe('projectDomainSpend', () => {
  it('accumulates gross monthly burn over N months', () => {
    const pts = projectDomainSpend({ monthlyCents: 100 }, 3);
    expect(pts).toEqual([
      { month: 1, grossCents: 100, netCents: 100 },
      { month: 2, grossCents: 200, netCents: 200 },
      { month: 3, grossCents: 300, netCents: 300 },
    ]);
  });

  it('net line subtracts rent and can go negative (profit)', () => {
    const pts = projectDomainSpend({ monthlyCents: 100, monthlyRentCents: 400 }, 2);
    expect(pts[0]).toEqual({ month: 1, grossCents: 100, netCents: -300 });
    expect(pts[1]).toEqual({ month: 2, grossCents: 200, netCents: -600 });
  });

  it('defaults to 12 months', () => {
    expect(projectDomainSpend({ monthlyCents: 10 }).length).toBe(12);
  });

  it('projectFromRollup wires monthly cost + rent through', () => {
    const r = rollupDomains([dom({ renewalCents: 1200, rented: true, monthlyRentCents: 500 })]);
    const pts = projectFromRollup(r, 1);
    expect(pts[0]).toEqual({ month: 1, grossCents: 100, netCents: -400 });
  });
});

describe('projectDomainSpendByExpiry', () => {
  // Mid-month, mid-day dates so no local-TZ offset can cross a month boundary.
  const nowMs = Date.UTC(2026, 0, 15, 12); // Jan 2026

  it('lands each renewal in its expiry month and clusters spikes', () => {
    const pts = projectDomainSpendByExpiry(
      [
        dom({ renewalCents: 1200, expiresAt: '2026-03-15T12:00:00Z' }), // → month 3
        dom({ renewalCents: 1200, expiresAt: '2026-03-15T12:00:00Z' }), // → month 3 (clusters)
      ],
      { months: 12, nowMs },
    );
    expect(pts[0].grossCents).toBe(0); // month 1
    expect(pts[1].grossCents).toBe(0); // month 2
    expect(pts[2].grossCents).toBe(2400); // month 3 — both renewals hit
    expect(pts[11].grossCents).toBe(2400); // stays flat after
  });

  it('overdue expiry hits the soonest month; beyond-window expiry never hits', () => {
    const pts = projectDomainSpendByExpiry(
      [
        dom({ renewalCents: 1000, expiresAt: '2025-12-15T12:00:00Z' }), // overdue → month 1
        dom({ renewalCents: 9999, expiresAt: '2027-06-15T12:00:00Z' }), // >12mo out → no hit
      ],
      { months: 12, nowMs },
    );
    expect(pts[0].grossCents).toBe(1000);
    expect(pts[11].grossCents).toBe(1000); // the 2027 renewal never enters the window
  });

  it('unknown expiry is amortized across the window', () => {
    const pts = projectDomainSpendByExpiry([dom({ renewalCents: 1200, expiresAt: null })], { months: 12, nowMs });
    expect(pts[0].grossCents).toBe(100); // 1200/12
    expect(pts[11].grossCents).toBe(1200);
  });

  it('unknown cost contributes nothing', () => {
    const pts = projectDomainSpendByExpiry([dom({ renewalCents: null, expiresAt: '2026-03-15T12:00:00Z' })], { months: 12, nowMs });
    expect(pts[11].grossCents).toBe(0);
  });

  it('net line subtracts recurring rent linearly', () => {
    const pts = projectDomainSpendByExpiry(
      [dom({ renewalCents: 1200, expiresAt: '2026-03-15T12:00:00Z', rented: true, monthlyRentCents: 300 })],
      { months: 12, nowMs },
    );
    expect(pts[0].netCents).toBe(-300); // month 1: no cost yet, −1×300 rent
    expect(pts[2].grossCents).toBe(1200); // month 3: renewal hits
    expect(pts[2].netCents).toBe(1200 - 900); // minus 3×300 rent
  });
});
