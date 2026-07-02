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

export type OrderRow = { status?: string | null; total_cents?: number | null; platform_fee_cents?: number | null };
export type CommissionRow = { status?: string | null; amount_cents?: number | null };

export type RevenueSummary = {
  orders: { paid: number; refunded: number };
  gmv_cents: number;
  platform_fee_cents: number; // gross fees on paid orders
  refunded_gmv_cents: number;
  refunded_fee_cents: number;
  qs_net_cents: number; // gross fees minus the partner share owed/paid against them
  partner_residual_cents: { owed: number; paid: number; void: number };
  commission_ledger_cents: Record<string, number>; // per-status breakdown
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
export function reconcileStripeFees(fees: StripeFeeObject[], dbGrossFeeCents: number): StripeFeeReconciliation {
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
 * Callers should pass only commission_ledger rows with subject 'order_platform_fee'
 * (residuals against fees), scoped to the same time window as `orders`.
 */
export function summarizePlatformRevenue(input: {
  orders: OrderRow[];
  commissions: CommissionRow[];
}): RevenueSummary {
  const orders = input.orders ?? [];
  const paid = orders.filter((o) => o.status === 'paid');
  const refunded = orders.filter((o) => o.status === 'refunded');

  const commissionByStatus: Record<string, number> = {};
  for (const c of input.commissions ?? []) {
    const k = c.status || 'unknown';
    commissionByStatus[k] = (commissionByStatus[k] || 0) + cents(c.amount_cents);
  }

  const owed = (commissionByStatus.pending || 0) + (commissionByStatus.approved || 0);
  const paidResidual = commissionByStatus.paid || 0;
  const voidResidual = commissionByStatus.void || 0;
  const liveResidual = owed + paidResidual; // non-void

  const platformFeeCents = paid.reduce((s, o) => s + cents(o.platform_fee_cents), 0);

  return {
    orders: { paid: paid.length, refunded: refunded.length },
    gmv_cents: paid.reduce((s, o) => s + cents(o.total_cents), 0),
    platform_fee_cents: platformFeeCents,
    refunded_gmv_cents: refunded.reduce((s, o) => s + cents(o.total_cents), 0),
    refunded_fee_cents: refunded.reduce((s, o) => s + cents(o.platform_fee_cents), 0),
    qs_net_cents: platformFeeCents - liveResidual,
    partner_residual_cents: { owed, paid: paidResidual, void: voidResidual },
    commission_ledger_cents: commissionByStatus,
  };
}
