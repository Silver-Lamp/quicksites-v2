// lib/ops/revenueSimulator.ts
//
// Pure forward-looking revenue model for the ops "what-if" simulator. Turns the five
// levers the operator can actually move — domains rented, subscription seats, commerce
// volume, the take-rate, and the domain burn — into a monthly + annual net profit, plus
// a per-stream breakdown. Framework-free + I/O-free so it's unit-testable and can drive
// both the slider UI and any server-side projection.
//
// The three revenue streams (see docs/MONETIZATION.md):
//   1. Geo-domain RENT      — rentedDomains × avgRent (idle inventory → ranked → rented)
//   2. Subscription MRR      — subscribers × avgPlan
//   3. Commerce TAKE-RATE    — GMV × feePct, minus the partner residual on attributed GMV
// Net = (rent + MRR + net take) − domain renewal burn.

/** The 20% of an attributed order's platform fee QuickSites keeps is the inverse of
 *  the 80% residual owed to the referring partner (see lib/commerce/revenue.ts). */
export const PARTNER_RESIDUAL_SHARE = 0.8;

/** Sensible defaults when the live snapshot has no signal to seed a lever from. */
export const SIM_DEFAULTS = {
  avgRentCents: 9_900, // $99/mo per rented geo-domain
  avgPlanCents: 4_900, // $49/mo plan
  avgOrderCents: 4_500, // $45 order
  ordersPerMerchant: 20, // per merchant per month
  platformFeePct: 10, // 10% take-rate
  attributedPct: 30, // 30% of GMV rides a referral
} as const;

export type SimInputs = {
  /** Geo-domains actively rented out. */
  rentedDomains: number;
  /** Monthly rent collected per rented domain, in cents. */
  avgRentCents: number;
  /** Paying subscription seats. */
  subscribers: number;
  /** Monthly plan price per seat, in cents. */
  avgPlanCents: number;
  /** Active selling merchants driving commerce GMV. */
  merchants: number;
  /** Paid orders per merchant per month. */
  ordersPerMerchant: number;
  /** Average order value, in cents. */
  avgOrderCents: number;
  /** Platform take-rate on GMV, as a percent (0–100). */
  platformFeePct: number;
  /** Share of GMV that rides a referral (owes an 80% residual), as a percent (0–100). */
  attributedPct: number;
  /** Monthly domain renewal run-rate (the burn to keep inventory), in cents. */
  monthlyBurnCents: number;
};

export type SimOutputs = {
  gmvCents: number;
  grossFeeCents: number;
  partnerResidualCents: number;
  netCommerceCents: number;
  domainRentCents: number;
  mrrCents: number;
  grossRevenueCents: number; // net take + rent + MRR (before burn)
  monthlyBurnCents: number;
  netMonthlyCents: number; // gross − burn (can be negative)
  annualNetCents: number;
};

const nn = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

/** Run the model. Every stream is floored at zero; net can go negative (burn > income). */
export function simulateRevenue(i: SimInputs): SimOutputs {
  const gmv = Math.round(nn(i.merchants) * nn(i.ordersPerMerchant) * nn(i.avgOrderCents));
  const grossFee = Math.round((gmv * clampPct(i.platformFeePct)) / 100);
  const partnerResidual = Math.round(((grossFee * clampPct(i.attributedPct)) / 100) * PARTNER_RESIDUAL_SHARE);
  const netCommerce = grossFee - partnerResidual;
  const domainRent = Math.round(nn(i.rentedDomains) * nn(i.avgRentCents));
  const mrr = Math.round(nn(i.subscribers) * nn(i.avgPlanCents));
  const grossRevenue = netCommerce + domainRent + mrr;
  const burn = nn(i.monthlyBurnCents);
  const net = grossRevenue - burn;
  return {
    gmvCents: gmv,
    grossFeeCents: grossFee,
    partnerResidualCents: partnerResidual,
    netCommerceCents: netCommerce,
    domainRentCents: domainRent,
    mrrCents: mrr,
    grossRevenueCents: grossRevenue,
    monthlyBurnCents: burn,
    netMonthlyCents: net,
    annualNetCents: net * 12,
  };
}

/** The live-state shape the seed reads (a subset of OpsSnapshot). */
export type SimSeedSource = {
  rollup: { count: number; rentedCount: number; rankingCount: number; idleCount: number; rentedMonthlyRentCents: number; monthlyCents: number };
  revenue: { gmv_cents: number; platform_fee_cents: number; orders: { paid: number } };
  clients: { mrrCents: number; activeSubscribers: number };
};

/** Bounds the sliders clamp to — derived so "rent everything" can't exceed inventory. */
export type SimBounds = { maxRentedDomains: number };

/**
 * Seed the levers from the live snapshot so the simulator opens on *today's* numbers —
 * effective take-rate and average order value are back-derived from real orders where
 * they exist, and everything else falls back to SIM_DEFAULTS. At-rest, the sim reflects
 * current reality; the operator then drags levers to see the upside of each next move.
 */
export function deriveSimSeed(src: SimSeedSource): { seed: SimInputs; bounds: SimBounds } {
  const { rollup, revenue, clients } = src;
  const rented = nn(rollup.rentedCount);
  const avgRent = rented > 0 ? Math.round(rollup.rentedMonthlyRentCents / rented) : SIM_DEFAULTS.avgRentCents;
  const feePct = revenue.gmv_cents > 0 ? Math.round((revenue.platform_fee_cents / revenue.gmv_cents) * 1000) / 10 : SIM_DEFAULTS.platformFeePct;
  const avgOrder = revenue.orders.paid > 0 ? Math.round(revenue.gmv_cents / revenue.orders.paid) : SIM_DEFAULTS.avgOrderCents;
  const subscribers = nn(clients.activeSubscribers);
  const avgPlan = subscribers > 0 ? Math.round(clients.mrrCents / subscribers) : SIM_DEFAULTS.avgPlanCents;

  const seed: SimInputs = {
    rentedDomains: rented,
    avgRentCents: avgRent,
    subscribers,
    avgPlanCents: avgPlan,
    merchants: Math.max(subscribers, 1),
    ordersPerMerchant: SIM_DEFAULTS.ordersPerMerchant,
    avgOrderCents: avgOrder,
    platformFeePct: feePct,
    attributedPct: SIM_DEFAULTS.attributedPct,
    monthlyBurnCents: nn(rollup.monthlyCents),
  };
  return { seed, bounds: { maxRentedDomains: Math.max(nn(rollup.count), rented) } };
}

export type SimScenario = { id: string; label: string; blurb: string; apply: (seed: SimInputs, bounds: SimBounds) => SimInputs };

/**
 * Action-oriented presets. Each is a concrete move the operator could make this week;
 * the delta the sim shows is the reward for making it. Kept as pure transforms of the
 * live seed so "current" is always the honest reference point.
 */
export const SIM_SCENARIOS: SimScenario[] = [
  {
    id: 'current',
    label: 'Current',
    blurb: "Today's numbers — the baseline every scenario is measured against.",
    apply: (seed) => ({ ...seed }),
  },
  {
    id: 'rent-idle',
    label: 'Rent your idle domains',
    blurb: 'Rank + rent every domain you already own. Pure upside — the burn is already sunk.',
    apply: (seed, bounds) => ({ ...seed, rentedDomains: bounds.maxRentedDomains }),
  },
  {
    id: 'double-merchants',
    label: 'Double your merchants',
    blurb: 'Twice the active sellers at the same order economics — the take-rate compounds.',
    apply: (seed) => ({ ...seed, merchants: Math.max(2, seed.merchants * 2) }),
  },
  {
    id: 'land-grab',
    label: 'Land-grab',
    blurb: 'Rent all inventory, triple merchants, +50% order volume. The aggressive growth case.',
    apply: (seed, bounds) => ({
      ...seed,
      rentedDomains: bounds.maxRentedDomains,
      merchants: Math.max(3, seed.merchants * 3),
      ordersPerMerchant: Math.round(seed.ordersPerMerchant * 1.5),
    }),
  },
];
