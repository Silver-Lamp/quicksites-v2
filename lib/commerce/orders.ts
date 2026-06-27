import { getServerSupabase } from '@/lib/supabase/server';
import type { LineItemInput } from './types';
import { getMerchantPaymentConfigSafe } from './paymentRouter';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { partnerCommissionCents, PARTNER_FEE_SHARE } from './partner-terms';

/** Create a pending order and its line items. Returns order id and totals. */
export async function createDraftOrder(opts: {
  merchantId: string;
  siteSlug: string;
  currency: string;
  items: LineItemInput[];
  /** Optional: surface the chosen provider for visibility on the order row */
  provider?: string;
}) {
  if (!opts.items?.length) throw new Error('Order must contain at least one line item.');

  const currency = (opts.currency || 'USD').toUpperCase();

  const subtotal = opts.items.reduce((s, li) => {
    const qty = Math.max(1, Number(li.quantity || 1));
    const unit = Math.max(0, Number(li.unitAmount || 0));
    return s + unit * qty;
  }, 0);
  const total = subtotal; // tax/shipping can be added later

  const cfg = await getMerchantPaymentConfigSafe(opts.merchantId);
  const platformFeeCents = cfg.collect_platform_fee
    ? Math.max(Math.floor(total * (cfg.platform_fee_percent || 0)), cfg.platform_fee_min_cents || 0)
    : 0;

  const supabase = await getServerSupabase({ serviceRole: true });

  // Create order
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      merchant_id: opts.merchantId,
      site_slug: opts.siteSlug,
      currency,
      amount_cents: total, // legacy column back-compat
      subtotal_cents: subtotal,
      total_cents: total,
      platform_fee_cents: platformFeeCents,
      status: 'pending',
      provider: opts.provider ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  // Create items (best-effort cleanup on failure)
  const orderItems = opts.items.map((li) => {
    const qty = Math.max(1, Number(li.quantity || 1));
    const unit = Math.max(0, Number(li.unitAmount || 0));
    return {
      order_id: order.id,
      merchant_id: opts.merchantId, // live order_items requires merchant_id (NOT NULL)
      catalog_item_id: li.catalogItemId ?? null,
      title: li.title,
      quantity: qty,
      unit_price_cents: unit,
      total_cents: unit * qty,
      metadata: (li as any).metadata ?? {},
    };
  });

  const { error: oiErr } = await supabase.from('order_items').insert(orderItems);
  if (oiErr) {
    // Avoid leaving a dangling order if items failed
    await supabase.from('orders').delete().eq('id', order.id);
    throw oiErr;
  }

  await captureServer(
    EVENTS.ORDER_CREATED,
    { merchant_id: opts.merchantId, order_id: order.id, total_cents: total, platform_fee_cents: platformFeeCents },
    opts.merchantId
  );

  return { orderId: order.id, totalCents: total, platformFeeCents };
}

/** Mark an order paid; record payment; lock attribution; log platform-fee commission if applicable. */
export async function markOrderPaid(
  orderId: string,
  amountCents: number,
  provider: string,
  providerPaymentId: string,
  raw: any
) {
  const supabase = await getServerSupabase({ serviceRole: true });

  // 1) Record payment (unique on (provider, provider_payment_id))
  const { error: pErr } = await supabase.from('payments').insert({
    order_id: orderId,
    provider,
    provider_payment_id: providerPaymentId,
    amount_cents: amountCents,
    state: 'succeeded',
    raw,
  });
  // Ignore unique violation if webhook retried
  if (pErr && `${pErr.code}` !== '23505') throw pErr;

  // 2) Transition the order pending -> paid, guarded so a duplicate or a
  //    payment/refund race can't flip an order that isn't pending. If nothing
  //    transitioned, the order was already paid (duplicate) or refunded/cancelled
  //    — stop here without (re)locking attribution or (re)logging the commission.
  const { data: transitioned, error: oErr } = await supabase
    .from('orders')
    .update({ status: 'paid', provider_payment_id: providerPaymentId, provider })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id');
  if (oErr) throw oErr;
  if (!transitioned || transitioned.length === 0) return;

  // 3) Fetch order context once
  const { data: orderRow, error: ordErr } = await supabase
    .from('orders')
    .select('merchant_id, platform_fee_cents, currency')
    .eq('id', orderId)
    .single();
  if (ordErr) throw ordErr;

  // 4) Lock attribution on first revenue
  await supabase
    .from('attributions')
    .update({ locked_at: new Date().toISOString() })
    .eq('merchant_id', orderRow.merchant_id)
    .is('locked_at', null);

  // 5) Auto-log platform-fee commission for reps (optional, idempotent)
  try {
    if (orderRow.platform_fee_cents && orderRow.platform_fee_cents > 0) {
      const { data: attr } = await supabase
        .from('attributions')
        .select('referral_code')
        .eq('merchant_id', orderRow.merchant_id)
        .maybeSingle();

      if (attr?.referral_code) {
        // Partner residual = their share of the order's platform fee (QuickSites
        // keeps the rest). See lib/commerce/partner-terms.ts + /partners.
        const partnerCents = partnerCommissionCents(orderRow.platform_fee_cents);
        const up = await supabase.from('commission_ledger').upsert(
          {
            referral_code: attr.referral_code,
            subject: 'order_platform_fee',
            subject_id: orderId,
            amount_cents: partnerCents,
            currency: orderRow.currency || 'USD',
            status: 'pending',
            adjustments: {
              note: 'partner residual',
              platform_fee_cents: orderRow.platform_fee_cents,
              partner_share: PARTNER_FEE_SHARE,
            },
          },
          { onConflict: 'referral_code,subject,subject_id' }
        );
        // Ignore idempotent/duplicate errors; warn on others
        if (up.error && `${up.error.code}` !== '23505') {
          console.warn('commission_ledger upsert error:', up.error.message);
        }
      }
    }
  } catch (e) {
    console.warn('Platform-fee commission step failed:', (e as any)?.message || e);
  }

  await captureServer(
    EVENTS.ORDER_PAID,
    { merchant_id: orderRow.merchant_id, order_id: orderId, amount_cents: amountCents, provider },
    orderRow.merchant_id
  );
  if (orderRow.platform_fee_cents && orderRow.platform_fee_cents > 0) {
    await captureServer(
      EVENTS.PLATFORM_FEE_COLLECTED,
      { merchant_id: orderRow.merchant_id, order_id: orderId, platform_fee_cents: orderRow.platform_fee_cents },
      orderRow.merchant_id
    );
  }
}

/**
 * Mark an order refunded: record the refund, flip the order, and void the
 * platform-fee commission (unless it was already paid out to the rep — that's a
 * clawback, handled separately). The actual money/fee reversal happens on the
 * provider (Stripe refund with reverse_transfer + refund_application_fee); this
 * keeps our ledger consistent. Idempotent on the refund id.
 */
export async function markOrderRefunded(
  orderId: string,
  refundedCents: number | undefined,
  provider: string,
  providerRefundId: string,
  raw: any
) {
  const supabase = await getServerSupabase({ serviceRole: true });

  // 1) Record the refund as a payment row (state='refunded'), idempotent
  if (providerRefundId) {
    const { error: pErr } = await supabase.from('payments').insert({
      order_id: orderId,
      provider,
      provider_payment_id: providerRefundId,
      amount_cents: Math.abs(Number(refundedCents ?? 0)),
      state: 'refunded',
      raw,
    });
    if (pErr && `${pErr.code}` !== '23505') throw pErr;
  }

  // 2) Flip the order -> refunded, guarded so a duplicate refund event doesn't
  //    re-void the commission or re-fire analytics. The refund payment row above
  //    is recorded regardless (idempotent on the refund id).
  const { data: flipped, error: oErr } = await supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', orderId)
    .neq('status', 'refunded')
    .select('id');
  if (oErr) throw oErr;
  if (!flipped || flipped.length === 0) return;

  // 3) Void the platform-fee commission for this order — but only the rows that
  //    haven't been paid out yet (pending/approved). A paid row already left the
  //    building, so it can't simply be voided.
  const { error: cErr } = await supabase
    .from('commission_ledger')
    .update({ status: 'void', adjustments: { note: 'voided on refund' } })
    .eq('subject', 'order_platform_fee')
    .eq('subject_id', orderId)
    .neq('status', 'paid');
  if (cErr) console.warn('commission void on refund failed:', cErr.message);

  // 3b) For commissions ALREADY paid out, record a clawback so the residual can
  //     be reversed/deducted out of band (admin-resolved). Idempotent per
  //     commission via the unique (commission_ledger_id) constraint.
  try {
    const { data: paidComms } = await supabase
      .from('commission_ledger')
      .select('id, amount_cents, payout_id')
      .eq('subject', 'order_platform_fee')
      .eq('subject_id', orderId)
      .eq('status', 'paid');
    if (paidComms?.length) {
      const rows = (paidComms as any[]).map((c) => ({
        commission_ledger_id: c.id,
        affiliate_payout_id: c.payout_id ?? null,
        order_id: orderId,
        amount_cents: c.amount_cents,
        reason: 'order_refund',
        status: 'pending',
      }));
      const { error: clawErr } = await supabase
        .from('commission_clawbacks')
        .upsert(rows, { onConflict: 'commission_ledger_id' });
      if (clawErr) console.warn('clawback record failed:', clawErr.message);
    }
  } catch (e: any) {
    console.warn('clawback step failed:', e?.message || e);
  }

  await captureServer(EVENTS.ORDER_REFUNDED, { order_id: orderId, amount_cents: refundedCents, provider });
  await captureServer(EVENTS.PLATFORM_FEE_REVERSED, { order_id: orderId });
}
