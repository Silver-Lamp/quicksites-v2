import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { clampPlatformFeePercent } from '@/lib/commerce/partner-terms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Persist a merchant's platform fee to the canonical `payment_accounts` row
 * (System 2 / open_commerce) — the same place createDraftOrder and GET
 * /api/admin/payments/status read it. Replaces the deprecated write to
 * `merchants.default_platform_fee_bps` / `sites.platform_fee_bps`, which nothing
 * reads anymore (the read side already moved to payment_accounts, so the old
 * write silently no-op'd — a split brain this closes).
 *
 * The UI still speaks basis points; we convert bps → a 0..1 percent and clamp to
 * the platform cap (MAX_PLATFORM_FEE_PERCENT, 10%). Fee config lives on the
 * payment account, which is created at Stripe onboarding — so if the merchant has
 * no account yet, we tell them to enable payouts first rather than inventing a row
 * (account_ref is NOT NULL).
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { merchantId, platformFeeBps } = await req.json().catch(() => ({}));

  if (!merchantId) {
    return NextResponse.json({ error: 'merchantId is required' }, { status: 400 });
  }

  const bps = Number(platformFeeBps);
  if (!Number.isFinite(bps) || bps < 0) {
    return NextResponse.json({ error: 'platformFeeBps must be a non-negative number' }, { status: 400 });
  }

  // bps → 0..1 percent, clamped to the platform cap (shared with the money path).
  const percent = clampPlatformFeePercent(bps / 10000);
  const clampedBps = Math.round(percent * 10000);

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  );

  const { data, error } = await db
    .from('payment_accounts')
    .update({
      platform_fee_percent: percent,
      collect_platform_fee: percent > 0,
      updated_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchantId)
    .eq('provider', 'stripe')
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No Stripe payment account for this merchant yet — enable payouts first.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, platformFeeBps: clampedBps });
}
