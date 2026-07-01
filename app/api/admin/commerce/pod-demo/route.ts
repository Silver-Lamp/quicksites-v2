import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';
import { computePlatformFeeCents, computeSubtotalCents } from '@/lib/commerce/fees';
import { isPodEnabled } from '@/lib/commerce/pod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Flagship POD/author money-path proof (Competitive punch-list Tier 3.10).
 *
 * This is the category neither Duda (no print-on-demand) nor GoHighLevel (no
 * real ecommerce) can answer: an author sells a print-on-demand book (Lulu) +
 * merch (Gelato), QuickSites takes its cut **on the merchant's margin only**
 * (the printer's base cost is carved out), a print job is queued, and the
 * referring partner accrues a lifetime residual.
 *
 * Proves the full chain in-app without real Stripe (same lib/commerce code the
 * public checkout uses):
 *   seed author merchant + active payment_account (take-rate on)
 *   + two POD catalog_items (book/lulu + poster/gelato, each with a base print cost)
 *   + optional referral attribution
 *   -> createDraftOrder  (fee basis = subtotal − POD base cost)
 *   -> markOrderPaid in test mode with a shipping address on the event
 *      (records payment, flips order to paid, logs the partner residual, and —
 *       when POD_ENABLED — queues print_orders rows via fulfillOrderPodItems)
 *   -> read everything back and assert the numbers + the print jobs.
 *
 * The headline assertion is the differentiator: the platform fee is computed on
 * margin, NOT the full price — so we show both the margin fee and what a naive
 * full-price fee would have been.
 *
 * Admin-gated. Idempotent seed; each run creates a fresh order. POST
 * {"cleanup":true} removes the demo merchant and all its rows. Tables are loosely
 * typed on purpose — types/supabase.ts is stale for commerce (CLAUDE.md §8).
 */

const DEMO_SLUG = 'pod-author-demo';
const DEMO_REFERRAL = 'POD-DEMO';

// The two flagship POD line items. Price is what the reader pays; base_cost_cents
// is the printer's cost (Lulu/Gelato) that we deliberately exclude from our fee.
const BOOK = { slug: 'pod-demo-paperback', title: 'Signed Paperback', provider: 'lulu' as const, priceCents: 2400, baseCostCents: 650 };
const POSTER = { slug: 'pod-demo-poster', title: 'Fan-Art Poster (18×24)', provider: 'gelato' as const, priceCents: 3000, baseCostCents: 900 };

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = await getServerSupabase({ serviceRole: true });

  const body = await req.json().catch(() => ({}));
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
      await db.from('print_orders').delete().in('order_id', ids);
      await db.from('payments').delete().in('order_id', ids);
      await db.from('order_items').delete().in('order_id', ids);
      await db.from('commission_ledger').delete().in('subject_id', ids);
    }
    await db.from('orders').delete().eq('merchant_id', merchantId);
    await db.from('attributions').delete().eq('merchant_id', merchantId);
    await db.from('payment_accounts').delete().eq('merchant_id', merchantId);
    await db.from('catalog_items').delete().eq('merchant_id', merchantId);
    await db.from('referral_codes').delete().eq('code', DEMO_REFERRAL);
    await db.from('merchants').delete().eq('id', merchantId);
    return NextResponse.json({ cleaned: true, merchantId });
  }

  if (!merchantId) {
    const { data: m, error } = await db
      .from('merchants')
      .insert({
        user_id: admin.id, // merchants.user_id is NOT NULL; tie the demo to the admin
        name: 'Indie Author Demo',
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
    account_ref: 'pod-demo', // account_ref is NOT NULL; sentinel (no real Stripe)
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

  // --- Ensure the two POD catalog items exist (book via Lulu, poster via Gelato) ---
  // The base print cost lives on metadata.pod_spec.base_cost_cents; createDraftOrder
  // reads it back to carve it out of the fee basis. fulfillment_provider makes the
  // item POD, so markOrderPaid queues a print job for it.
  const catalogIds: Record<string, string> = {};
  for (const p of [BOOK, POSTER]) {
    const metadata = {
      site_slug: DEMO_SLUG,
      fulfillment_provider: p.provider,
      pod_spec: { base_cost_cents: p.baseCostCents, title: p.title },
    };
    const { data: ci } = await db.from('catalog_items').select('id').eq('merchant_id', merchantId).eq('slug', p.slug).maybeSingle();
    if (ci?.id) {
      await db.from('catalog_items').update({ price_cents: p.priceCents, metadata, status: 'active' }).eq('id', ci.id);
      catalogIds[p.slug] = ci.id;
    } else {
      const { data: created, error } = await db
        .from('catalog_items')
        .insert({ merchant_id: merchantId, type: 'product', title: p.title, slug: p.slug, price_cents: p.priceCents, status: 'active', metadata })
        .select('id')
        .single();
      if (error) return NextResponse.json({ step: 'catalog_item', slug: p.slug, error: error.message }, { status: 500 });
      catalogIds[p.slug] = created.id;
    }
  }

  // --- Optional referral attribution so the partner residual is logged ---
  if (withReferral) {
    const { data: rc } = await db.from('referral_codes').select('code').eq('code', DEMO_REFERRAL).maybeSingle();
    if (!rc) {
      await db.from('referral_codes').insert({
        code: DEMO_REFERRAL,
        owner_type: 'qs_affiliate',
        owner_id: admin.id,
        plan: { type: 'order_platform_fee', note: 'POD demo partner', partner_share: PARTNER_FEE_SHARE },
      });
    }
    const { data: at } = await db.from('attributions').select('merchant_id').eq('merchant_id', merchantId).maybeSingle();
    if (!at) {
      await db.from('attributions').insert({ merchant_id: merchantId, referral_code: DEMO_REFERRAL });
    }
  }

  // --- Run the real money path with the two POD items ---
  const items = [
    { catalogItemId: catalogIds[BOOK.slug], title: BOOK.title, quantity: 1, unitAmount: BOOK.priceCents, metadata: { fulfillment_provider: BOOK.provider, pod_spec: { base_cost_cents: BOOK.baseCostCents } } },
    { catalogItemId: catalogIds[POSTER.slug], title: POSTER.title, quantity: 1, unitAmount: POSTER.priceCents, metadata: { fulfillment_provider: POSTER.provider, pod_spec: { base_cost_cents: POSTER.baseCostCents } } },
  ];
  const { orderId, totalCents, platformFeeCents, shippingCents } = await createDraftOrder({
    merchantId,
    siteSlug: DEMO_SLUG,
    currency: 'USD',
    items,
  });

  // A shipping address on the payment event lets fulfillOrderPodItems progress to
  // an 'awaiting_fulfillment' print_orders row even without live Lulu/Gelato creds.
  const raw = {
    test: true,
    source: 'pod-demo',
    data: {
      object: {
        shipping_details: {
          name: 'Demo Reader',
          phone: '5555550100',
          address: { line1: '123 Test St', city: 'Portland', state: 'OR', postal_code: '97201', country: 'US' },
        },
        customer_details: { email: 'reader@example.com' },
      },
    },
  };
  await markOrderPaid(orderId, totalCents, 'test', `test_${orderId}`, raw);

  // --- Read everything back ---
  const { data: order } = await db
    .from('orders')
    .select('status, subtotal_cents, shipping_cents, total_cents, platform_fee_cents')
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
  const { data: printOrders } = await db
    .from('print_orders')
    .select('provider, status')
    .eq('order_id', orderId);

  // --- Expected numbers, computed with the same pure helpers as the money path ---
  const subtotal = computeSubtotalCents(items);
  const podBaseCents = BOOK.baseCostCents + POSTER.baseCostCents;
  const expectedFee = computePlatformFeeCents({ totalCents: subtotal, podBaseCents, collectFee: true, feePercent });
  // What a naive builder that taxes the full price (Duda-style, if it took a cut
  // at all) would have charged — the number we deliberately DON'T take.
  const naiveFullPriceFee = computePlatformFeeCents({ totalCents: subtotal, podBaseCents: 0, collectFee: true, feePercent });
  const expectedCommission = withReferral ? Math.floor(expectedFee * PARTNER_FEE_SHARE) : 0;
  const qsNet = expectedFee - expectedCommission; // QuickSites' net (the 20% share)
  const podActive = isPodEnabled();
  const expectedPrintJobs = podActive ? 2 : 0;

  const checks = [
    { name: 'order marked paid', ok: order?.status === 'paid', got: order?.status },
    { name: 'payment recorded (succeeded)', ok: payment?.state === 'succeeded', got: payment?.state ?? null },
    { name: 'platform fee taken on MARGIN (POD base cost excluded)', ok: order?.platform_fee_cents === expectedFee, got: order?.platform_fee_cents, expected: expectedFee },
    { name: 'margin fee is less than a naive full-price fee', ok: expectedFee < naiveFullPriceFee, got: expectedFee, naiveFullPriceFee },
  ];
  if (withReferral) {
    checks.push({
      name: 'partner residual logged (80% of fee)',
      ok: commission?.amount_cents === expectedCommission,
      got: commission?.amount_cents ?? null,
      expected: expectedCommission,
    });
  }
  checks.push({
    name: podActive
      ? 'POD print jobs queued (POD_ENABLED)'
      : 'POD fulfillment gated off (POD_ENABLED unset) — no print jobs expected',
    ok: (printOrders?.length ?? 0) === expectedPrintJobs,
    got: printOrders?.length ?? 0,
    expected: expectedPrintJobs,
  });
  const ok = checks.every((c) => c.ok);

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const summary =
    `Author sells a ${fmt(BOOK.priceCents)} paperback + a ${fmt(POSTER.priceCents)} poster ` +
    `(${fmt(podBaseCents)} of that is the printer's cost). At ${(feePercent * 100).toFixed(1)}%, ` +
    `QuickSites takes ${fmt(expectedFee)} on the ${fmt(subtotal - podBaseCents)} margin — not ${fmt(naiveFullPriceFee)} on the full price. ` +
    (withReferral ? `The referring partner earns ${fmt(expectedCommission)} (lifetime residual); QuickSites nets ${fmt(qsNet)}. ` : '') +
    (podActive ? `${printOrders?.length ?? 0} print job(s) queued.` : `Print fulfillment is gated off (set POD_ENABLED=true + provider creds to fire real jobs).`);

  return NextResponse.json({
    ok,
    summary,
    wedge: 'Duda takes 0% and has no print-on-demand; GoHighLevel has no real ecommerce. This is the author/POD funnel neither can run.',
    merchantId,
    orderId,
    feePercent,
    subtotal_cents: order?.subtotal_cents ?? subtotal,
    pod_base_cost_cents: podBaseCents,
    shipping_cents: order?.shipping_cents ?? shippingCents,
    total_cents: order?.total_cents ?? totalCents,
    platform_fee_cents: order?.platform_fee_cents ?? platformFeeCents,
    naive_full_price_fee_cents: naiveFullPriceFee,
    partner_commission_cents: commission?.amount_cents ?? 0,
    qs_net_cents: qsNet,
    print_orders: printOrders ?? [],
    pod_enabled: podActive,
    checks,
    cleanupHint: 'POST {"cleanup":true} to remove the demo merchant and its rows.',
  });
}
