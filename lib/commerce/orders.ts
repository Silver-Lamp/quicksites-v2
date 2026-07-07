import { getServerSupabase } from '@/lib/supabase/server';
import type { LineItemInput } from './types';
import { getMerchantPaymentConfigSafe } from './paymentRouter';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { partnerCommissionCents, PARTNER_FEE_SHARE, hubOverrideCents } from './partner-terms';
import { isAgencyPlanMerchant } from '@/lib/billing/plans';
import { computeSubtotalCents, computePlatformFeeCents, flatShippingCents, computePhysicalShippingCents, parseStripeTaxTotals } from './fees';
import { recordAdjustment } from './inventoryLedger';
import { recordCustomerForPaidOrder } from './customers';

/** Create a pending order and its line items. Returns order id and totals. */
export async function createDraftOrder(opts: {
  merchantId: string;
  siteSlug: string;
  currency: string;
  items: LineItemInput[];
  /** Optional: surface the chosen provider for visibility on the order row */
  provider?: string;
  /** Optional buyer special instructions ("no cilantro", "leave at door"). */
  customerNote?: string;
}) {
  if (!opts.items?.length) throw new Error('Order must contain at least one line item.');

  const currency = (opts.currency || 'USD').toUpperCase();

  const subtotal = computeSubtotalCents(opts.items);

  const supabase = await getServerSupabase({ serviceRole: true });

  const cfg = await getMerchantPaymentConfigSafe(opts.merchantId);
  // Agency-plan merchants pay a flat subscription instead of a per-order fee, so
  // their orders are exempt from the take-rate (Path B). Derive from the plan at
  // order time so it's a single source of truth regardless of payment_accounts.
  const feeExempt = await isAgencyPlanMerchant(opts.merchantId);

  // Don't take the platform fee on a print-on-demand item's base print cost — we
  // only take our cut of the merchant's margin. base_cost_cents lives on the
  // catalog item's pod_spec; subtract (base × qty) for POD line items.
  let podBaseCents = 0;
  let hasShippable = false;
  const shippingByItem = new Map<string, { requires_shipping?: boolean; grams?: number }>();
  const catIds = opts.items.map((li) => li.catalogItemId).filter(Boolean) as string[];
  if (catIds.length) {
    try {
      const { data: cis } = await (supabase as any)
        .from('catalog_items').select('id, metadata').in('id', catIds);
      const baseById = new Map<string, number>(
        (cis ?? []).map((c: any) => [c.id, Number(c?.metadata?.pod_spec?.base_cost_cents) || 0])
      );
      hasShippable = (cis ?? []).some((c: any) => ['lulu', 'gelato'].includes(c?.metadata?.fulfillment_provider));
      for (const c of cis ?? []) {
        const s = c?.metadata?.shipping;
        if (s?.requires_shipping) {
          shippingByItem.set(c.id, { requires_shipping: true, grams: Number(s.grams) || undefined });
        }
      }
      for (const li of opts.items) {
        const base = li.catalogItemId ? baseById.get(li.catalogItemId) || 0 : 0;
        podBaseCents += base * Math.max(1, Number(li.quantity || 1));
      }
    } catch { /* fee falls back to full total */ }
  }

  // The platform fee is computed on the product subtotal (excluding shipping, and
  // excluding POD base cost). Shipping is added to the order total afterwards.
  const platformFeeCents = computePlatformFeeCents({
    totalCents: subtotal,
    podBaseCents,
    collectFee: cfg.collect_platform_fee,
    feeExempt,
    feePercent: cfg.platform_fee_percent || 0,
    feeMinCents: cfg.platform_fee_min_cents || 0,
  });

  // POD flat shipping (unchanged) + physical-goods shipping (Shopify-imported items;
  // env-gated, 0 by default). The two paths are mutually exclusive per item, so they
  // never double-count. Shipping is added after the fee is computed (fee excludes it).
  const shippingCents =
    flatShippingCents(hasShippable) + computePhysicalShippingCents(opts.items, shippingByItem);
  const total = subtotal + shippingCents;

  // Create order
  const orderRow: Record<string, any> = {
    merchant_id: opts.merchantId,
    site_slug: opts.siteSlug,
    currency,
    amount_cents: total, // legacy column back-compat
    subtotal_cents: subtotal,
    shipping_cents: shippingCents,
    total_cents: total,
    platform_fee_cents: platformFeeCents,
    status: 'pending',
    provider: opts.provider ?? null,
  };
  const customerNote = (opts.customerNote ?? '').trim().slice(0, 500);
  if (customerNote) orderRow.customer_note = customerNote;

  let { data: order, error } = await supabase.from('orders').insert(orderRow).select('id').single();
  // Forward-safe: if the customer_note column isn't present yet (migration not
  // applied), drop it and retry — an order is never lost over an optional note.
  if (error && customerNote && (error.code === '42703' || /customer_note/i.test(error.message || ''))) {
    delete orderRow.customer_note;
    ({ data: order, error } = await supabase.from('orders').insert(orderRow).select('id').single());
  }
  if (error) throw error;
  if (!order) throw new Error('Order could not be created.');

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

  return { orderId: order.id, totalCents: total, platformFeeCents, shippingCents };
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

  // 2b) Record any sales tax Stripe computed at checkout (automatic_tax). Tax is
  //     charged on top of our subtotal and is NOT part of the platform-fee basis
  //     (the fee was already locked at draft on the pre-tax subtotal). We just
  //     store it + reconcile total_cents to what the buyer actually paid so the
  //     receipt and reconciliation are truthful. Best-effort; never blocks payment.
  try {
    const { taxCents, totalCents: chargedTotal } = parseStripeTaxTotals(raw);
    if (taxCents && taxCents > 0) {
      await supabase
        .from('orders')
        .update({ tax_cents: taxCents, ...(chargedTotal ? { total_cents: chargedTotal } : {}) })
        .eq('id', orderId);
    }
  } catch (e) {
    console.warn('Tax record step failed:', (e as any)?.message || e);
  }

  // 2c) Settle inventory for this order (once — guarded by the paid transition).
  //     If the order reserved stock at checkout (reserve-then-confirm), the units
  //     are already decremented — just consume the holds. Otherwise (demo/test/
  //     non-reserved paths) fall back to the atomic per-line decrement, which also
  //     surfaces any oversell. Best-effort: never block a completed payment.
  try {
    const { data: heldRes } = await (supabase as any)
      .from('stock_reservations')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'held')
      .limit(1);

    if (heldRes && heldRes.length) {
      await (supabase as any).rpc('consume_order_reservations', { p_order: orderId });
    } else {
    const { data: lines } = await supabase
      .from('order_items')
      .select('catalog_item_id, title, quantity, metadata')
      .eq('order_id', orderId);
    const oversold: Array<{ title: string; variant_label: string | null; requested: number; remaining: number | null }> = [];
    for (const li of lines ?? []) {
      if (!li.catalog_item_id) continue;
      const qty = Number(li.quantity) || 0;
      if (qty <= 0) continue;
      const variantId = (li.metadata as any)?.variant_id ?? null;
      const { data: res, error } = await (supabase as any).rpc('decrement_catalog_stock', {
        p_item: li.catalog_item_id,
        p_variant: variantId,
        p_qty: qty,
      });
      if (error) { console.warn('decrement_catalog_stock failed:', error.message); continue; }
      // History: record the sale draw-down (only when the line was actually tracked —
      // remaining is null for untracked/unlimited items).
      if (res && (res as any).ok !== false && (res as any).remaining !== null && (res as any).remaining !== undefined) {
        await recordAdjustment(supabase, {
          catalogItemId: li.catalog_item_id, variantId, delta: -qty,
          newOnHand: (res as any).remaining, reason: 'sale', orderId,
        });
      }
      if (res && (res as any).ok === false && (res as any).reason === 'insufficient') {
        oversold.push({
          title: li.title ?? 'Item',
          variant_label: (li.metadata as any)?.variant_label ?? null,
          requested: qty,
          remaining: (res as any).remaining ?? null,
        });
      }
    }
    if (oversold.length) {
      // Paid but couldn't be fully fulfilled from stock (a race won by another
      // order). Record it on the order + log so the merchant can reconcile.
      console.warn(`Order ${orderId} oversold — paid beyond available stock:`, JSON.stringify(oversold));
      await supabase.from('orders').update({ oversold_lines: oversold } as any).eq('id', orderId);
    }
    }
  } catch (e) {
    console.warn('Stock settle step failed:', (e as any)?.message || e);
  }

  // 3) Fetch order context once
  const { data: orderRow, error: ordErr } = await supabase
    .from('orders')
    .select('merchant_id, platform_fee_cents, currency')
    .eq('id', orderId)
    .single();
  if (ordErr) throw ordErr;

  // 3b) Customer identity spine (CRM): upsert the buyer from the Stripe event into
  //     the per-merchant customers table + link the order. Best-effort — never blocks
  //     the paid transition. (No-op when the event carries no buyer email.)
  if (orderRow.merchant_id) {
    await recordCustomerForPaidOrder(supabase, {
      orderId,
      merchantId: orderRow.merchant_id,
      totalCents: amountCents,
      raw,
      occurredAtIso: new Date().toISOString(),
    });
  }

  // 4) Lock attribution on first revenue
  if (orderRow.merchant_id) {
    await supabase
      .from('attributions')
      .update({ locked_at: new Date().toISOString() })
      .eq('merchant_id', orderRow.merchant_id)
      .is('locked_at', null);
  }

  // 5) Auto-log platform-fee commission for reps (optional, idempotent)
  try {
    if (orderRow.platform_fee_cents && orderRow.platform_fee_cents > 0) {
      const { data: attr } = await supabase
        .from('attributions')
        .select('referral_code')
        .eq('merchant_id', orderRow.merchant_id ?? '')
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
        } else {
          // Funnel (Model B): partner residual accrued. This block only runs once
          // per order (guarded by the pending→paid transition above).
          await captureServer(
            EVENTS.COMMISSION_ACCRUED,
            {
              order_id: orderId,
              merchant_id: orderRow.merchant_id,
              referral_code: attr.referral_code,
              amount_cents: partnerCents,
              platform_fee_cents: orderRow.platform_fee_cents,
            },
            orderRow.merchant_id
          );
        }

        // 5b) Hub override: if this reseller was recruited by an upline (parent_code),
        //     pay the hub a configurable cut — funded OUT OF QuickSites' share
        //     (clamped to QS_FEE_SHARE), so the reseller residual above is untouched.
        const { data: codeRow } = await supabase
          .from('referral_codes')
          .select('parent_code, override_share')
          .eq('code', attr.referral_code)
          .maybeSingle();
        if ((codeRow as any)?.parent_code && Number((codeRow as any).override_share) > 0) {
          const overrideCents = hubOverrideCents(orderRow.platform_fee_cents, Number((codeRow as any).override_share));
          if (overrideCents > 0) {
            const ov = await supabase.from('commission_ledger').upsert(
              {
                referral_code: (codeRow as any).parent_code,
                subject: 'order_platform_fee_override',
                subject_id: orderId,
                amount_cents: overrideCents,
                currency: orderRow.currency || 'USD',
                status: 'pending',
                adjustments: {
                  note: 'hub override',
                  downline_code: attr.referral_code,
                  override_share: Number((codeRow as any).override_share),
                  platform_fee_cents: orderRow.platform_fee_cents,
                },
              },
              { onConflict: 'referral_code,subject,subject_id' }
            );
            if (ov.error && `${ov.error.code}` !== '23505') {
              console.warn('hub override upsert error:', ov.error.message);
            } else {
              await captureServer(
                EVENTS.COMMISSION_ACCRUED,
                {
                  order_id: orderId,
                  referral_code: (codeRow as any).parent_code,
                  amount_cents: overrideCents,
                  kind: 'hub_override',
                  downline_code: attr.referral_code,
                },
                orderRow.merchant_id
              );
            }
          }
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

  // Print-on-demand fulfillment (Lulu/Gelato). Fully gated by POD_ENABLED and
  // best-effort — never let it affect the payment path.
  if (process.env.POD_ENABLED === 'true') {
    try {
      const { fulfillOrderPodItems } = await import('@/lib/commerce/pod/fulfillment');
      await fulfillOrderPodItems(orderId, raw);
    } catch (e: any) {
      console.warn('POD fulfillment step failed:', e?.message || e);
    }
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

  // 2b) Restock the refunded line items (opt-in via QS_RESTOCK_ON_REFUND; default off
  //     to preserve existing behavior). Runs inside the once-only flip guard so a
  //     duplicate refund event can't double-restock. Best-effort + atomic per line;
  //     the increment RPC no-ops untracked items so this never starts tracking.
  if (/^(1|true|yes)$/i.test(String(process.env.QS_RESTOCK_ON_REFUND ?? ''))) {
    try {
      const { data: lines } = await supabase
        .from('order_items')
        .select('catalog_item_id, quantity, metadata')
        .eq('order_id', orderId);
      for (const li of lines ?? []) {
        if (!li.catalog_item_id) continue;
        const qty = Number(li.quantity) || 0;
        if (qty <= 0) continue;
        const variantId = (li.metadata as any)?.variant_id ?? null;
        const { data: res, error } = await (supabase as any).rpc('increment_catalog_stock', {
          p_item: li.catalog_item_id,
          p_variant: variantId,
          p_qty: qty,
        });
        if (error) { console.warn('increment_catalog_stock (restock) failed:', error.message); continue; }
        if (res && (res as any).remaining !== null && (res as any).remaining !== undefined) {
          await recordAdjustment(supabase, {
            catalogItemId: li.catalog_item_id, variantId, delta: qty,
            newOnHand: (res as any).remaining, reason: 'refund', orderId,
          });
        }
      }
    } catch (e) {
      console.warn('Restock-on-refund step failed:', (e as any)?.message || e);
    }
  }

  // 3) Void the platform-fee commission for this order — but only the rows that
  //    haven't been paid out yet (pending/approved). A paid row already left the
  //    building, so it can't simply be voided.
  const { error: cErr } = await supabase
    .from('commission_ledger')
    .update({ status: 'void', adjustments: { note: 'voided on refund' } })
    .in('subject', ['order_platform_fee', 'order_platform_fee_override'])
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
      .in('subject', ['order_platform_fee', 'order_platform_fee_override'])
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

  // Cancel any cancelable print-on-demand jobs for this order (gated, best-effort).
  if (process.env.POD_ENABLED === 'true') {
    try {
      const { cancelOrderPodItems } = await import('@/lib/commerce/pod/fulfillment');
      await cancelOrderPodItems(orderId);
    } catch (e: any) {
      console.warn('POD cancel-on-refund failed:', e?.message || e);
    }
  }
}
