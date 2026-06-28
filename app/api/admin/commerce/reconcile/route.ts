// app/api/admin/commerce/reconcile/route.ts
//
// Take-rate settlement reconciliation (Path A, 2B). Read-only report that
// cross-checks, per order in a window:
//   orders.platform_fee_cents  ⇄  payments  ⇄  commission_ledger (partner residual)
// and surfaces mismatches an operator should investigate. Optionally cross-checks
// the live Stripe application_fee with `?stripe=1` (slower; one API call/order).
//
// Auth: admin cookie OR cron secret. GET only; never mutates.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { isCronAuthorized } from '@/lib/cron/auth';
import { partnerCommissionCents } from '@/lib/commerce/partner-terms';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );
  const { data: auth } = await (supa as any).auth.getUser();
  if (!auth?.user) return false;
  const { data: admin } = await (supa as any)
    .from('admin_users')
    .select('user_id')
    .eq('user_id', auth.user.id)
    .limit(1);
  return !!admin?.[0];
}

type Mismatch = {
  order_id: string;
  kind: string;
  detail: Record<string, any>;
};

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req) && !(await isAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') || 30)));
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') || 500)));
  const checkStripe = url.searchParams.get('stripe') === '1';

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const db = admin as any;

  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: orders, error } = await db
    .from('orders')
    .select('id, status, total_cents, platform_fee_cents, currency, provider, provider_payment_id, created_at')
    .gte('created_at', sinceIso)
    .in('status', ['paid', 'refunded'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderIds = (orders || []).map((o: any) => o.id);
  if (!orderIds.length) {
    return NextResponse.json({ ok: true, window_days: days, orders: 0, mismatches: [] });
  }

  // Pull related payments + ledger rows in bulk.
  const { data: payments } = await db
    .from('payments')
    .select('order_id, state, amount_cents')
    .in('order_id', orderIds);
  const { data: ledger } = await db
    .from('commission_ledger')
    .select('subject_id, amount_cents, status')
    .eq('subject', 'order_platform_fee')
    .in('subject_id', orderIds);

  const paymentsByOrder = new Map<string, any[]>();
  for (const p of payments || []) {
    const arr = paymentsByOrder.get(p.order_id) || [];
    arr.push(p);
    paymentsByOrder.set(p.order_id, arr);
  }
  const ledgerByOrder = new Map<string, any[]>();
  for (const l of ledger || []) {
    const arr = ledgerByOrder.get(l.subject_id) || [];
    arr.push(l);
    ledgerByOrder.set(l.subject_id, arr);
  }

  const mismatches: Mismatch[] = [];

  for (const o of orders || []) {
    const pays = paymentsByOrder.get(o.id) || [];
    const ledg = ledgerByOrder.get(o.id) || [];
    const fee = Number(o.platform_fee_cents || 0);

    // 1) A paid order must have a succeeded payment row.
    if (o.status === 'paid' && !pays.some((p) => p.state === 'succeeded')) {
      mismatches.push({ order_id: o.id, kind: 'paid_without_payment', detail: { total_cents: o.total_cents } });
    }

    // 2) Commission residual (when present) should equal the partner share of the fee.
    if (fee > 0 && ledg.length) {
      const expected = partnerCommissionCents(fee);
      for (const l of ledg) {
        if (Number(l.amount_cents) !== expected) {
          mismatches.push({
            order_id: o.id,
            kind: 'ledger_amount_mismatch',
            detail: { expected, actual: l.amount_cents, fee_cents: fee, status: l.status },
          });
        }
      }
    }

    // 3) Refunded orders should not retain a live (pending/approved) residual.
    if (o.status === 'refunded') {
      const live = ledg.filter((l) => l.status === 'pending' || l.status === 'approved');
      if (live.length) {
        mismatches.push({
          order_id: o.id,
          kind: 'refunded_with_live_ledger',
          detail: { statuses: live.map((l) => l.status) },
        });
      }
    }

    // 4) Optional: cross-check the live Stripe application fee.
    if (checkStripe && o.provider === 'stripe' && o.provider_payment_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(o.provider_payment_id, {
          expand: ['payment_intent.latest_charge'],
        });
        const pi: any = (session as any).payment_intent;
        const charge: any = pi?.latest_charge;
        const stripeFee = Number(charge?.application_fee_amount ?? 0);
        if (o.status === 'paid' && stripeFee !== fee) {
          mismatches.push({
            order_id: o.id,
            kind: 'stripe_fee_mismatch',
            detail: { stripe_application_fee: stripeFee, order_fee_cents: fee },
          });
        }
      } catch (e: any) {
        mismatches.push({
          order_id: o.id,
          kind: 'stripe_lookup_failed',
          detail: { error: String(e?.message || e).slice(0, 200) },
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    window_days: days,
    orders: orderIds.length,
    stripe_checked: checkStripe,
    mismatch_count: mismatches.length,
    mismatches,
  });
}
