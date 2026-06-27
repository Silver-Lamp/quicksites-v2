import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Platform revenue reconciliation (Model A, A5).
// "QS earned $X": GMV, platform fees collected, refunds, and rep-commission
// obligations against those fees. Admin-gated. Stripe-side cross-check (compare
// to application_fee objects) is a future add — this is the DB source of truth.

const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sum = (rows: any[], col: string) => rows.reduce((s, r) => s + (Number(r[col]) || 0), 0);

export async function GET(req: NextRequest) {
  // Admin gate (mirrors the codebase's ADMIN_EMAILS + role check)
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const email = (user?.email || '').toLowerCase();
  const role = String(
    (user?.app_metadata as any)?.role || (user?.user_metadata as any)?.role || ''
  ).toLowerCase();
  const isAdmin = !!user && (ADMIN_EMAILS.includes(email) || role === 'admin' || role === 'superadmin');
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const since = new URL(req.url).searchParams.get('since'); // ISO date, optional

  let q = db.from('orders').select('total_cents, platform_fee_cents, status, created_at');
  if (since) q = q.gte('created_at', since);
  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paid = (orders ?? []).filter((o) => o.status === 'paid');
  const refunded = (orders ?? []).filter((o) => o.status === 'refunded');

  const { data: comm } = await db.from('commission_ledger').select('amount_cents, status');
  const commissionByStatus: Record<string, number> = {};
  for (const c of comm ?? []) {
    commissionByStatus[c.status] = (commissionByStatus[c.status] || 0) + (Number(c.amount_cents) || 0);
  }

  const platformFeeCents = sum(paid, 'platform_fee_cents');

  return NextResponse.json({
    since: since || null,
    orders: { paid: paid.length, refunded: refunded.length },
    gmv_cents: sum(paid, 'total_cents'),
    platform_fee_cents: platformFeeCents, // QS gross revenue from order fees
    refunded_gmv_cents: sum(refunded, 'total_cents'),
    refunded_fee_cents: sum(refunded, 'platform_fee_cents'),
    net_platform_cents: platformFeeCents, // refunded orders already excluded from paid
    commission_ledger_cents: commissionByStatus, // rep payouts owed/paid against fees
  });
}
