// lib/commerce/revenueDetail.ts
//
// Pure row-shaping for the platform-revenue drill-downs (/admin/revenue card
// click-throughs). The route queries orders / commission_ledger and passes raw
// rows here; these functions normalize them into the stable wire shape the
// detail panel renders. Keeping the shaping pure keeps it testable and out of
// the route handler (see CLAUDE.md §7).

export type RevenueDetailKind = 'paid_orders' | 'refunded_orders' | 'commissions';

export const REVENUE_DETAIL_KINDS: RevenueDetailKind[] = ['paid_orders', 'refunded_orders', 'commissions'];

export function isRevenueDetailKind(v: string | null | undefined): v is RevenueDetailKind {
  return !!v && (REVENUE_DETAIL_KINDS as string[]).includes(v);
}

const cents = (v: unknown) => Number(v) || 0;

// ---- Orders (paid / refunded) ------------------------------------------------

export type RawOrderDetailRow = {
  id?: string | null;
  site_slug?: string | null;
  status?: string | null;
  provider?: string | null;
  subtotal_cents?: number | null;
  tax_cents?: number | null;
  total_cents?: number | null;
  platform_fee_cents?: number | null;
  created_at?: string | null;
  // Supabase embeds the joined merchant as an object (or array on ambiguous FKs).
  merchants?: { display_name?: string | null } | { display_name?: string | null }[] | null;
};

export type OrderDetailRow = {
  id: string;
  merchant: string;
  site_slug: string;
  status: string;
  provider: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  platform_fee_cents: number;
  created_at: string | null;
};

function merchantName(m: RawOrderDetailRow['merchants']): string {
  const one = Array.isArray(m) ? m[0] : m;
  return one?.display_name || '—';
}

export function shapeOrderDetailRows(rows: RawOrderDetailRow[]): OrderDetailRow[] {
  return (rows ?? []).map((r) => ({
    id: String(r.id || ''),
    merchant: merchantName(r.merchants),
    site_slug: r.site_slug || '—',
    status: r.status || 'unknown',
    provider: r.provider || null,
    subtotal_cents: cents(r.subtotal_cents),
    tax_cents: cents(r.tax_cents),
    total_cents: cents(r.total_cents),
    platform_fee_cents: cents(r.platform_fee_cents),
    created_at: r.created_at || null,
  }));
}

// ---- Commission ledger -------------------------------------------------------

export type RawCommissionDetailRow = {
  id?: string | null;
  referral_code?: string | null;
  subject?: string | null;
  subject_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type CommissionDetailRow = {
  id: string;
  referral_code: string;
  /** 'residual' (partner cut) or 'override' (second-tier hub cut) */
  kind: 'residual' | 'override';
  /** The order id the fee was accrued against. */
  subject_id: string;
  amount_cents: number;
  status: string;
  created_at: string | null;
};

const OVERRIDE_SUBJECT = 'order_platform_fee_override';

export function shapeCommissionDetailRows(rows: RawCommissionDetailRow[]): CommissionDetailRow[] {
  return (rows ?? []).map((r) => ({
    id: String(r.id || ''),
    referral_code: r.referral_code || '—',
    kind: r.subject === OVERRIDE_SUBJECT ? 'override' : 'residual',
    subject_id: r.subject_id || '—',
    amount_cents: cents(r.amount_cents),
    status: r.status || 'unknown',
    created_at: r.created_at || null,
  }));
}
