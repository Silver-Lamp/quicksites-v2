// Partner residual stats for the /partners/dashboard view. Aggregates a
// partner's commission_ledger (their referral codes only), attributed merchants,
// and payout history into a single shape the dashboard renders. Pure data access
// — no auth here; the caller must have already resolved the partner's own codes.
//
// commission_ledger has no merchant_id, so per-merchant earnings are derived by
// mapping each ledger row's subject_id (order id) → orders.merchant_id.
//
// Tables are loosely typed (types/supabase.ts is stale for commerce — CLAUDE.md §8),
// so the Supabase client is passed as `any`.

export type PartnerTotals = { pending: number; approved: number; paid: number };

export type PartnerMerchantRow = {
  merchantId: string;
  name: string;
  orderCount: number;
  earned: number; // pending + approved + paid
  pending: number;
  approved: number;
  owed: number; // pending + approved — accrued but not yet paid out
  paid: number;
};

type LedgerRow = { amount_cents?: number | null; status?: string | null; currency?: string | null; subject_id?: string | null };

/**
 * Pure reducer: fold a partner's commission_ledger rows into totals + per-merchant
 * earnings. Kept separate from the DB fetch so the money math is unit-testable.
 *
 * "owed" = pending + approved (accrued but not yet paid out). This is the number
 * the dashboard surfaces as "pending payout" — crucially it includes `approved`,
 * which the auto-approval cron moves rows into before a payout run; counting only
 * `pending` would make a partner's balance appear to shrink the moment their
 * commissions are approved.
 */
export function aggregatePartnerLedger(input: {
  ledgerRows: LedgerRow[];
  orderToMerchant: Map<string, string>;
  attributedMerchantIds: string[];
  nameFor?: (merchantId: string) => string;
}): { currency: string; totals: PartnerTotals; perMerchant: PartnerMerchantRow[] } {
  const { ledgerRows, orderToMerchant, attributedMerchantIds } = input;
  const nameFor = input.nameFor ?? ((id: string) => id.slice(0, 8));

  const rows = new Map<string, PartnerMerchantRow>();
  const seed = (id: string) => {
    if (!rows.has(id)) {
      rows.set(id, { merchantId: id, name: nameFor(id), orderCount: 0, earned: 0, pending: 0, approved: 0, owed: 0, paid: 0 });
    }
    return rows.get(id)!;
  };
  // Seed every attributed merchant so zero-earning referrals still show.
  for (const id of new Set<string>(attributedMerchantIds)) seed(id);

  const totals: PartnerTotals = { pending: 0, approved: 0, paid: 0 };
  let currency = 'USD';
  for (const r of ledgerRows) {
    currency = r.currency || currency;
    const amt = Number(r.amount_cents) || 0;
    if (r.status === 'pending') totals.pending += amt;
    else if (r.status === 'approved') totals.approved += amt;
    else if (r.status === 'paid') totals.paid += amt;

    const merchantId = r.subject_id ? orderToMerchant.get(r.subject_id) : undefined;
    if (!merchantId) continue;
    const row = seed(merchantId);
    row.orderCount += 1;
    row.earned += amt;
    if (r.status === 'pending') { row.pending += amt; row.owed += amt; }
    else if (r.status === 'approved') { row.approved += amt; row.owed += amt; }
    else if (r.status === 'paid') row.paid += amt;
  }

  const perMerchant = Array.from(rows.values()).sort((a, b) => b.earned - a.earned);
  return { currency, totals, perMerchant };
}

export type PartnerPayoutRow = {
  paidAt: string | null;
  amountCents: number;
  currency: string;
  method: string | null;
  status: string | null;
  txRef: string | null;
};

export type PartnerStats = {
  currency: string;
  totals: PartnerTotals;
  lifetime: number; // pending + approved + paid
  owed: number; // pending + approved — the "pending payout" headline
  referredCount: number;
  perMerchant: PartnerMerchantRow[];
  payouts: PartnerPayoutRow[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPartnerStats(db: any, codes: string[], userId: string): Promise<PartnerStats> {
  if (!codes.length) {
    return { currency: 'USD', totals: { pending: 0, approved: 0, paid: 0 }, lifetime: 0, owed: 0, referredCount: 0, perMerchant: [], payouts: [] };
  }

  const [{ data: attrs }, { data: ledger }, { data: payouts }] = await Promise.all([
    db.from('attributions').select('merchant_id').in('referral_code', codes),
    db.from('commission_ledger').select('amount_cents, status, currency, subject_id').in('referral_code', codes),
    db
      .from('affiliate_payouts')
      .select('paid_at, amount_cents, currency, method, status, tx_ref')
      .eq('affiliate_user_id', userId)
      .order('paid_at', { ascending: false })
      .limit(20),
  ]);

  const ledgerRows: any[] = ledger ?? [];

  // order_id -> merchant_id for every order that produced a commission
  const orderIds = Array.from(new Set(ledgerRows.map((r) => r.subject_id).filter(Boolean)));
  const orderToMerchant = new Map<string, string>();
  if (orderIds.length) {
    const { data: orders } = await db.from('orders').select('id, merchant_id').in('id', orderIds);
    for (const o of orders ?? []) if (o?.merchant_id) orderToMerchant.set(o.id, o.merchant_id);
  }

  // Names for every attributed or earning merchant
  const attrMerchantIds = (attrs ?? []).map((a: any) => a.merchant_id).filter(Boolean);
  const merchantIds = Array.from(new Set([...attrMerchantIds, ...orderToMerchant.values()]));
  const nameById = new Map<string, string>();
  if (merchantIds.length) {
    const { data: merchants } = await db.from('merchants').select('id, name, display_name, site_slug').in('id', merchantIds);
    for (const m of merchants ?? []) {
      nameById.set(m.id, m.display_name || m.name || m.site_slug || m.id.slice(0, 8));
    }
  }

  const { currency, totals, perMerchant } = aggregatePartnerLedger({
    ledgerRows,
    orderToMerchant,
    attributedMerchantIds: attrMerchantIds,
    nameFor: (id) => nameById.get(id) || id.slice(0, 8),
  });

  const payoutRows: PartnerPayoutRow[] = (payouts ?? []).map((p: any) => ({
    paidAt: p.paid_at ?? null,
    amountCents: Number(p.amount_cents) || 0,
    currency: p.currency || currency,
    method: p.method ?? null,
    status: p.status ?? null,
    txRef: p.tx_ref ?? null,
  }));

  return {
    currency,
    totals,
    lifetime: totals.pending + totals.approved + totals.paid,
    owed: totals.pending + totals.approved,
    referredCount: new Set<string>(attrMerchantIds).size,
    perMerchant,
    payouts: payoutRows,
  };
}
