import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { summarizePlatformRevenue, reconcileStripeFees, type StripeFeeObject } from '@/lib/commerce/revenue';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Platform revenue reconciliation (Model A, A5).
// The real "QuickSites earned $X" number: GMV, gross platform fees, refunds, and
// the net take after partner residuals (see lib/commerce/revenue.ts). Admin-gated.
// The DB is the source of truth; pass `?stripe=1` for an opt-in cross-check that
// sums the live Stripe application_fee objects for the window and flags drift.

const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

  // Partner residuals against those fees. Scope to the fee subject (not other
  // ledger subjects) and to the same window as the orders so the totals reconcile.
  let cq = db
    .from('commission_ledger')
    .select('amount_cents, status')
    .eq('subject', 'order_platform_fee');
  if (since) cq = cq.gte('created_at', since);
  const { data: comm } = await cq;

  const summary = summarizePlatformRevenue({ orders: orders ?? [], commissions: comm ?? [] });

  // Opt-in Stripe cross-check: sum the window's application_fee objects and
  // compare to our recorded gross. Slower (paginated live API), so gated.
  let stripeReconciliation: ReturnType<typeof reconcileStripeFees> | { error: string } | null = null;
  if (new URL(req.url).searchParams.get('stripe') === '1') {
    try {
      // Bound the window: since (if given) else last 90 days.
      const gte = Math.floor((since ? new Date(since).getTime() : Date.now() - 90 * 86_400_000) / 1000);
      const fees: StripeFeeObject[] = [];
      // Cap pagination so a huge history can't hang the request.
      for await (const fee of stripe.applicationFees.list({ created: { gte }, limit: 100 })) {
        fees.push({ amount: fee.amount, amount_refunded: fee.amount_refunded });
        if (fees.length >= 1000) break;
      }
      stripeReconciliation = reconcileStripeFees(fees, summary.platform_fee_cents);
    } catch (e: any) {
      stripeReconciliation = { error: String(e?.message || e).slice(0, 200) };
    }
  }

  return NextResponse.json({
    since: since || null,
    ...summary,
    net_platform_cents: summary.qs_net_cents, // back-compat alias (was gross; now correctly net)
    stripe_reconciliation: stripeReconciliation,
  });
}
