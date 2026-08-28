// lib/commerce/revenue.ts
//
// Pure aggregation for the platform-revenue reconciliation surface (Model A, A5 /
// competitive gap punch-list #2). Turns raw orders + commission_ledger rows into
// the headline money story: what QuickSites keeps vs what it owes partners.
//
// The take-rate model: QuickSites charges a platform fee on paid orders. When an
// order is attributed to a referral, 80% of that fee accrues to the partner as a
// residual in commission_ledger (subject 'order_platform_fee'); QuickSites keeps
// the other 20%. Unattributed orders have no residual, so QuickSites keeps 100%.
//
//   pending / approved  -> owed  (accrued, not yet paid out)
//   paid                -> paid  (transferred to the partner)
//   void                -> reversed on refund (excluded from what QS owes/keeps)

export type OrderRow = {
  status?: string | null;
  total_cents?: number | null;
  platform_fee_cents?: number | null;
};
// `subject` distinguishes a partner residual ('order_platform_fee') from a hub
// override ('order_platform_fee_override'). Absent = treated as a partner residual.
export type CommissionRow = {
  status?: string | null;
  amount_cents?: number | null;
  subject?: string | null;
};

const OVERRIDE_SUBJECT = 'order_platform_fee_override';

export type RevenueSummary = {
  orders: { paid: number; refunded: number };
  gmv_cents: number;
  platform_fee_cents: number; // gross fees on paid orders
  refunded_gmv_cents: number;
  refunded_fee_cents: number;
  qs_net_cents: number; // gross fees minus BOTH the partner residual and hub overrides owed/paid against them
  partner_residual_cents: { owed: number; paid: number; void: number };
  hub_override_cents: { owed: number; paid: number; void: number }; // second-tier hub cut, also out of QS's share
  commission_ledger_cents: Record<string, number>; // partner-residual per-status breakdown
};

const cents = (v: unknown) => Number(v) || 0;

export type StripeFeeObject = { amount?: number | null; amount_refunded?: number | null };

export type StripeFeeReconciliation = {
  stripe_fee_gross_cents: number; // sum of application_fee.amount
  stripe_fee_refunded_cents: number; // sum of application_fee.amount_refunded
  stripe_fee_net_cents: number; // gross − refunded (what Stripe says QS actually kept in fees)
  db_fee_gross_cents: number; // our recorded platform_fee_cents on paid orders
  delta_cents: number; // stripe_net − db_gross (0 = perfectly reconciled)
  matched: boolean;
  fee_count: number;
};

/**
 * Cross-check the platform fees Stripe actually collected against what we recorded.
 * Pure: the caller lists the window's application_fee objects and passes them in
 * with the DB gross (platform_fee_cents on paid orders).
 *
 * Expected to reconcile: a refunded order leaves the DB paid-gross AND has its
 * application fee reversed on Stripe (amount_refunded), so Stripe *net* ≈ DB gross.
 * A small nonzero delta can come from proportional refund-reversal flooring; a
 * large one means real drift worth investigating.
 */
export function reconcileStripeFees(
  fees: StripeFeeObject[],
  dbGrossFeeCents: number
): StripeFeeReconciliation {
  let gross = 0;
  let refunded = 0;
  for (const f of fees ?? []) {
    gross += cents(f?.amount);
    refunded += cents(f?.amount_refunded);
  }
  const net = gross - refunded;
  const dbGross = cents(dbGrossFeeCents);
  return {
    stripe_fee_gross_cents: gross,
    stripe_fee_refunded_cents: refunded,
    stripe_fee_net_cents: net,
    db_fee_gross_cents: dbGross,
    delta_cents: net - dbGross,
    matched: net - dbGross === 0,
    fee_count: (fees ?? []).length,
  };
}

/**
 * Reduce orders + fee-subject commission rows to the reconciliation summary.
 * Pass commission_ledger rows for BOTH fee subjects — 'order_platform_fee' (partner
 * residual) and 'order_platform_fee_override' (hub override) — scoped to the same
 * time window as `orders`. Both come out of QuickSites' share, so both are deducted
 * from qs_net; the function splits them by `subject`.
 */
export function summarizePlatformRevenue(input: {
  orders: OrderRow[];
  commissions: CommissionRow[];
}): RevenueSummary {
  const orders = input.orders ?? [];
  const paid = orders.filter((o) => o.status === 'paid');
  const refunded = orders.filter((o) => o.status === 'refunded');

  const byStatus = (rows: CommissionRow[]): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const c of rows) {
      const k = c.status || 'unknown';
      m[k] = (m[k] || 0) + cents(c.amount_cents);
    }
    return m;
  };
  const all = input.commissions ?? [];
  const partnerByStatus = byStatus(all.filter((c) => c.subject !== OVERRIDE_SUBJECT));
  const overrideByStatus = byStatus(all.filter((c) => c.subject === OVERRIDE_SUBJECT));

  const owed = (partnerByStatus.pending || 0) + (partnerByStatus.approved || 0);
  const paidResidual = partnerByStatus.paid || 0;
  const voidResidual = partnerByStatus.void || 0;
  const liveResidual = owed + paidResidual; // non-void

  const ovOwed = (overrideByStatus.pending || 0) + (overrideByStatus.approved || 0);
  const ovPaid = overrideByStatus.paid || 0;
  const ovVoid = overrideByStatus.void || 0;
  const liveOverride = ovOwed + ovPaid; // non-void

  const platformFeeCents = paid.reduce((s, o) => s + cents(o.platform_fee_cents), 0);

  return {
    orders: { paid: paid.length, refunded: refunded.length },
    gmv_cents: paid.reduce((s, o) => s + cents(o.total_cents), 0),
    platform_fee_cents: platformFeeCents,
    refunded_gmv_cents: refunded.reduce((s, o) => s + cents(o.total_cents), 0),
    refunded_fee_cents: refunded.reduce((s, o) => s + cents(o.platform_fee_cents), 0),
    qs_net_cents: platformFeeCents - liveResidual - liveOverride, // both come out of QS's share
    partner_residual_cents: { owed, paid: paidResidual, void: voidResidual },
    hub_override_cents: { owed: ovOwed, paid: ovPaid, void: ovVoid },
    commission_ledger_cents: partnerByStatus,
  };
}
