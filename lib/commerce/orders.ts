import { getServerSupabase } from '@/lib/supabase/server';
import type { LineItemInput } from './types';
import { getMerchantPaymentConfig } from './paymentRouter';

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

  const cfg = await getMerchantPaymentConfig(opts.merchantId);
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

  // 2) Update order status + provider refs
  const { error: oErr } = await supabase
    .from('orders')
    .update({ status: 'paid', provider_payment_id: providerPaymentId, provider })
    .eq('id', orderId);
  if (oErr) throw oErr;

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
        const up = await supabase.from('commission_ledger').upsert(
          {
            referral_code: attr.referral_code,
            subject: 'order_platform_fee',
            subject_id: orderId,
            amount_cents: orderRow.platform_fee_cents,
            currency: orderRow.currency || 'USD',
            status: 'pending',
            adjustments: { note: 'auto from platform fee' },
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
}
