import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Green-path E2E money-path proof (Model A, Tier 0.1).
 *
 * Proves the full chain end-to-end without real Stripe:
 *   seed demo merchant + active payment_account (take-rate on)
 *   + optional referral attribution
 *   -> createDraftOrder (computes platform_fee_cents)
 *   -> markOrderPaid in test mode (records payment, flips order to paid,
 *      logs the partner residual to commission_ledger)
 *   -> read everything back and assert the numbers match.
 *
 * Runs in-app (request context) so it exercises the real lib/commerce code the
 * public checkout uses. Admin-gated. Idempotent seed; each run creates a fresh
 * order. POST {cleanup:true} removes the demo merchant and all its rows.
 *
 * Tables are loosely typed here on purpose — types/supabase.ts is stale for the
 * commerce surface (see CLAUDE.md §8); we verify columns against the live DB.
 */

const DEMO_SLUG = 'e2e-demo-merchant';
const DEMO_REFERRAL = 'E2E-DEMO';

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = await getServerSupabase({ serviceRole: true });

  const body = await req.json().catch(() => ({}));
  const amountCents = Number.isFinite(body.amountCents) ? Math.max(50, Math.floor(body.amountCents)) : 1999;
  const feePercent = Number.isFinite(body.feePercent) ? Math.max(0, Math.min(0.1, body.feePercent)) : 0.08;
  const withReferral = body.withReferral !== false; // default true
  const cleanup = body.cleanup === true;

  // --- Resolve the demo merchant (stable by site_slug) ---
  const { data: existing } = await db.from('merchants').select('id').eq('site_slug', DEMO_SLUG).maybeSingle();
  let merchantId: string | undefined = existing?.id;

  if (cleanup) {
    if (!merchantId) return NextResponse.json({ cleaned: true, note: 'no demo merchant existed' });
    const { data: orderIds } = await db.from('orders').select('id').eq('merchant_id', merchantId);
    const ids = (orderIds ?? []).map((o: any) => o.id);
    if (ids.length) {
      await db.from('payments').delete().in('order_id', ids);
      await db.from('order_items').delete().in('order_id', ids);
      await db.from('commission_ledger').delete().in('subject_id', ids);
    }
    await db.from('orders').delete().eq('merchant_id', merchantId);
    await db.from('attributions').delete().eq('merchant_id', merchantId);
    await db.from('payment_accounts').delete().eq('merchant_id', merchantId);
    await db.from('referral_codes').delete().eq('code', DEMO_REFERRAL);
    await db.from('merchants').delete().eq('id', merchantId);
    return NextResponse.json({ cleaned: true, merchantId });
  }

  if (!merchantId) {
    const { data: m, error } = await db
      .from('merchants')
      .insert({
        user_id: admin.id, // merchants.user_id is NOT NULL; tie the demo to the admin
        name: 'E2E Demo Merchant',
        site_slug: DEMO_SLUG,
        provider: 'custom',
        default_currency: 'USD',
        is_public: false,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ step: 'create_merchant', error: error.message }, { status: 500 });
    merchantId = m.id;
  }
  if (!merchantId) return NextResponse.json({ step: 'resolve_merchant', error: 'no merchant id' }, { status: 500 });

  // --- Ensure an active payment account with the take-rate switched on ---
  const acctFields = {
    provider: 'custom',
    account_ref: 'e2e-demo', // account_ref is NOT NULL; sentinel (no real Stripe)
    status: 'active',
    collect_platform_fee: true,
    platform_fee_percent: feePercent,
    platform_fee_min_cents: 0,
  };
  const { data: acct } = await db.from('payment_accounts').select('id').eq('merchant_id', merchantId).maybeSingle();
  if (acct?.id) {
    await db.from('payment_accounts').update(acctFields).eq('id', acct.id);
  } else {
    const { error } = await db.from('payment_accounts').insert({ merchant_id: merchantId, ...acctFields });
    if (error) return NextResponse.json({ step: 'payment_account', error: error.message }, { status: 500 });
  }

  // --- Optional referral attribution so the partner residual is logged ---
  if (withReferral) {
    const { data: rc } = await db.from('referral_codes').select('code').eq('code', DEMO_REFERRAL).maybeSingle();
    if (!rc) {
      await db.from('referral_codes').insert({
        code: DEMO_REFERRAL,
        owner_type: 'qs_affiliate',
        owner_id: admin.id,
        plan: { type: 'order_platform_fee', note: 'E2E demo partner', partner_share: PARTNER_FEE_SHARE },
      });
    }
    const { data: at } = await db.from('attributions').select('merchant_id').eq('merchant_id', merchantId).maybeSingle();
    if (!at) {
      await db.from('attributions').insert({ merchant_id: merchantId, referral_code: DEMO_REFERRAL });
    }
  }

  // --- Run the real money path ---
  const { orderId, totalCents, platformFeeCents } = await createDraftOrder({
    merchantId,
    siteSlug: DEMO_SLUG,
    currency: 'USD',
    items: [{ title: 'E2E Demo Item', quantity: 1, unitAmount: amountCents }],
  });
  await markOrderPaid(orderId, totalCents, 'test', `test_${orderId}`, { test: true, source: 'e2e-demo' });

  // --- Read everything back ---
  const { data: order } = await db
    .from('orders')
    .select('status, total_cents, platform_fee_cents')
    .eq('id', orderId)
    .single();
  const { data: payment } = await db
    .from('payments')
    .select('state, amount_cents, provider')
    .eq('order_id', orderId)
    .maybeSingle();
  const { data: commission } = await db
    .from('commission_ledger')
    .select('amount_cents, status, referral_code')
    .eq('subject_id', orderId)
    .maybeSingle();

  // --- Assertions: do the numbers match what the money model promises? ---
  const expectedFee = Math.floor(amountCents * feePercent);
  const expectedCommission = withReferral ? Math.floor(expectedFee * PARTNER_FEE_SHARE) : 0;
  const qsNet = expectedFee - expectedCommission; // QuickSites' net (the 20% share)

  const checks = [
    { name: 'order marked paid', ok: order?.status === 'paid', got: order?.status },
    { name: 'payment recorded (succeeded)', ok: payment?.state === 'succeeded', got: payment?.state ?? null },
    { name: 'platform fee correct', ok: order?.platform_fee_cents === expectedFee, got: order?.platform_fee_cents, expected: expectedFee },
  ];
  if (withReferral) {
    checks.push({
      name: 'partner residual logged (80% of fee)',
      ok: commission?.amount_cents === expectedCommission,
      got: commission?.amount_cents ?? null,
      expected: expectedCommission,
    });
  }
  const ok = checks.every((c) => c.ok);

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const summary = withReferral
    ? `On a ${fmt(amountCents)} order at ${(feePercent * 100).toFixed(1)}%: platform fee ${fmt(expectedFee)} → partner residual ${fmt(expectedCommission)}, QuickSites net ${fmt(qsNet)}.`
    : `On a ${fmt(amountCents)} order at ${(feePercent * 100).toFixed(1)}%: platform fee ${fmt(expectedFee)} (no referral → QuickSites keeps all).`;

  return NextResponse.json({
    ok,
    summary,
    merchantId,
    orderId,
    amountCents,
    feePercent,
    platform_fee_cents: order?.platform_fee_cents ?? platformFeeCents,
    partner_commission_cents: commission?.amount_cents ?? 0,
    qs_net_cents: qsNet,
    checks,
    cleanupHint: 'POST {"cleanup":true} to remove the demo merchant and its rows.',
  });
}
