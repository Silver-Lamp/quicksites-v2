import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireUser';
import {
  isRevenueDetailKind,
  shapeOrderDetailRows,
  shapeCommissionDetailRows,
  type RawOrderDetailRow,
  type RawCommissionDetailRow,
} from '@/lib/commerce/revenueDetail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Drill-down rows behind the /admin/revenue stat cards. Same window semantics as
// the summary endpoint (?since=ISO date); ?kind picks the slice:
//   paid_orders     -> orders with status='paid'   (GMV / gross fees / paid count)
//   refunded_orders -> orders with status='refunded' (refund cards)
//   commissions     -> commission_ledger fee rows, residuals + hub overrides
//                      (partners owed / residual paid / override cards; the
//                       client filters by status/subject per card)
// Admin-gated; newest-first; capped so a huge history can't blow up the response.

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LIMIT = 200;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const since = url.searchParams.get('since'); // ISO date, optional
  if (!isRevenueDetailKind(kind)) {
    return NextResponse.json({ error: 'kind must be paid_orders | refunded_orders | commissions' }, { status: 400 });
  }

  if (kind === 'commissions') {
    let q = db
      .from('commission_ledger')
      .select('id, referral_code, subject, subject_id, amount_cents, currency, status, created_at', { count: 'exact' })
      .in('subject', ['order_platform_fee', 'order_platform_fee_override'])
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (since) q = q.gte('created_at', since);
    const { data, error, count } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = shapeCommissionDetailRows((data ?? []) as RawCommissionDetailRow[]);
    return NextResponse.json({ kind, since: since || null, rows, total: count ?? rows.length, truncated: (count ?? 0) > rows.length });
  }

  const status = kind === 'paid_orders' ? 'paid' : 'refunded';
  let q = db
    .from('orders')
    .select('id, site_slug, status, provider, subtotal_cents, tax_cents, total_cents, platform_fee_cents, created_at, merchants(display_name)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (since) q = q.gte('created_at', since);
  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = shapeOrderDetailRows((data ?? []) as RawOrderDetailRow[]);
  return NextResponse.json({ kind, since: since || null, rows, total: count ?? rows.length, truncated: (count ?? 0) > rows.length });
}
