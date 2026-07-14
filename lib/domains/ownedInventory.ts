// lib/domains/ownedInventory.ts
//
// Pure aggregation for the owned-domain recurring-cost surface. Turns a merged list of
// owned domains (see ownedInventoryServer.ts for how the list is assembled from geo
// campaigns + the Vercel account + the owned_domains table) into the headline story:
//   • what we're paying to KEEP these domains (yearly / monthly run-rate)
//   • how much of that is offset by domains we already rent out
//   • a forward-looking projection of cumulative spend if we DON'T rank + rent them
// Kept framework-free + I/O-free so it's unit-testable and reusable server- or
// client-side.

export type DomainSource = 'vercel' | 'campaign' | 'external' | 'manual';

export type InventoryDomain = {
  domain: string;
  source: DomainSource;
  registrar: string | null;
  /** YEARLY renewal cost in cents. null = unknown (surfaced as a "needs cost" follow-up). */
  renewalCents: number | null;
  expiresAt: string | null; // ISO
  autoRenew: boolean | null;
  // Joined from the geo campaign (if this domain backs one):
  campaignId: string | null;
  city: string | null;
  industryKey: string | null;
  /** Monthly rent we collect for this domain right now, in cents (0 if not rented). */
  monthlyRentCents: number;
  rented: boolean;
  /** The pitch page already ranks (page 1 / ranking) — a rent candidate. */
  ranking: boolean;
  notes: string | null;
};

export type DomainRollup = {
  count: number;
  withKnownCost: number;
  withUnknownCost: number;
  /** Annual run-rate of known renewals, in cents. */
  yearlyCents: number;
  /** yearlyCents / 12, rounded. */
  monthlyCents: number;
  rentedCount: number;
  /** Monthly rent income across rented domains, in cents. */
  rentedMonthlyRentCents: number;
  rankingCount: number;
  /** Not rented and not ranking — pure liability. */
  idleCount: number;
  /** monthlyCents − rentedMonthlyRentCents (can be negative = net profit). */
  netMonthlyCents: number;
};

const cents = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

/** Roll a merged inventory list up into the headline cost numbers. */
export function rollupDomains(domains: InventoryDomain[]): DomainRollup {
  let withKnownCost = 0;
  let withUnknownCost = 0;
  let yearlyCents = 0;
  let rentedCount = 0;
  let rentedMonthlyRentCents = 0;
  let rankingCount = 0;
  let idleCount = 0;

  for (const d of domains) {
    if (d.renewalCents == null) withUnknownCost++;
    else {
      withKnownCost++;
      yearlyCents += cents(d.renewalCents);
    }
    if (d.rented) {
      rentedCount++;
      rentedMonthlyRentCents += cents(d.monthlyRentCents);
    } else if (d.ranking) {
      rankingCount++;
    } else {
      idleCount++;
    }
  }

  const monthlyCents = Math.round(yearlyCents / 12);
  return {
    count: domains.length,
    withKnownCost,
    withUnknownCost,
    yearlyCents,
    monthlyCents,
    rentedCount,
    rentedMonthlyRentCents,
    rankingCount,
    idleCount,
    netMonthlyCents: monthlyCents - rentedMonthlyRentCents,
  };
}

export type SpendProjectionPoint = {
  /** 1-based month offset from now. */
  month: number;
  /** Cumulative renewal spend if nothing is rented, in cents. */
  grossCents: number;
  /** Cumulative spend net of current rental income (can go negative = profit). */
  netCents: number;
};

/**
 * Forward-looking cumulative-spend projection over `months` (default 12). Models the
 * annual run-rate as a level monthly burn (renewals amortized), which is the honest
 * "if you keep buying and don't rent, here's the bleed" line. `grossCents` ignores
 * rent; `netCents` subtracts current monthly rental income so the operator can see how
 * far ranking + renting closes the gap.
 */
export function projectDomainSpend(
  input: { monthlyCents: number; monthlyRentCents?: number },
  months = 12,
): SpendProjectionPoint[] {
  const burn = cents(input.monthlyCents);
  const rent = cents(input.monthlyRentCents);
  const net = burn - rent;
  const out: SpendProjectionPoint[] = [];
  for (let m = 1; m <= Math.max(1, months); m++) {
    out.push({ month: m, grossCents: burn * m, netCents: net * m });
  }
  return out;
}

/** Convenience: project straight from a rollup. */
export function projectFromRollup(rollup: DomainRollup, months = 12): SpendProjectionPoint[] {
  return projectDomainSpend({ monthlyCents: rollup.monthlyCents, monthlyRentCents: rollup.rentedMonthlyRentCents }, months);
}

/**
 * The lumpy-truth projection: each domain's renewal lands in the calendar month it
 * actually expires (cost spikes there, not smoothed), so a cluster of renewals in one
 * month shows up as a step instead of hiding in an average. Rules:
 *   • known expiry in-window → full renewal cost in that month; overdue → soonest month;
 *     expiry beyond the window → no hit (it renews later).
 *   • unknown expiry → spread evenly across the window, so the total still reflects the
 *     run-rate (we place what we know, amortize what we don't).
 * Rent is monthly recurring, so the net line still subtracts it linearly. `nowMs` is
 * passed in (not read) so the function stays pure + testable.
 */
export function projectDomainSpendByExpiry(
  domains: Array<Pick<InventoryDomain, 'renewalCents' | 'expiresAt' | 'monthlyRentCents'>>,
  opts: { months?: number; nowMs: number },
): SpendProjectionPoint[] {
  const months = Math.max(1, opts.months ?? 12);
  const now = new Date(opts.nowMs);
  const monthlyCost = new Array<number>(months).fill(0);
  let monthlyRent = 0;

  for (const d of domains) {
    monthlyRent += cents(d.monthlyRentCents);
    const cost = d.renewalCents;
    if (cost == null) continue; // unknown cost contributes nothing until entered
    if (!d.expiresAt) {
      const per = cost / months; // unknown renewal date → amortize across the window
      for (let i = 0; i < months; i++) monthlyCost[i] += per;
      continue;
    }
    const exp = new Date(d.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      const per = cost / months;
      for (let i = 0; i < months; i++) monthlyCost[i] += per;
      continue;
    }
    let mi = (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
    if (mi < 0) mi = 0; // overdue / auto-renew imminent → soonest month
    if (mi >= months) continue; // renews beyond the window → no hit inside it
    monthlyCost[mi] += cost;
  }

  const out: SpendProjectionPoint[] = [];
  let cumCost = 0;
  for (let i = 0; i < months; i++) {
    cumCost += monthlyCost[i];
    const cumRent = monthlyRent * (i + 1);
    out.push({ month: i + 1, grossCents: Math.round(cumCost), netCents: Math.round(cumCost - cumRent) });
  }
  return out;
}

/** Whole-dollar USD from cents, for compact labels ($184, not $184.00). */
export function dollarsWhole(c: number): string {
  return `$${Math.round((Number(c) || 0) / 100).toLocaleString()}`;
}
