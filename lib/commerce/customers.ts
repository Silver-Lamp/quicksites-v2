// lib/commerce/customers.ts
//
// Customer identity spine (CRM_PLAN.md Phase 0). Extracts the buyer from a paid
// Stripe order and upserts a per-merchant customer record (deduped by normalized
// email), so orders roll up into order history + lifetime value. Best-effort: a
// failure here never blocks marking the order paid.

import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { ATTRIBUTION_WINDOW_DAYS } from '@/lib/crm/attribution';

/** Lowercased/trimmed email if it looks valid, else null. */
export function normalizeEmail(email: unknown): string | null {
  const s = String(email ?? '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
}

export type Buyer = { email: string; name?: string; phone?: string; stripeCustomerId?: string };

/**
 * Pull the buyer's contact info from a Stripe event (or a bare session/object).
 * Reads `customer_details.{email,name,phone}` with `customer_email` as a fallback,
 * and the connected `customer` id. Returns null when there's no usable email.
 */
export function extractBuyerFromStripeEvent(raw: any): Buyer | null {
  const obj = raw?.data?.object ?? raw ?? {};
  const cd = obj?.customer_details ?? {};
  const email = normalizeEmail(cd.email ?? obj?.customer_email);
  if (!email) return null;
  const name = String(cd.name ?? '').trim();
  const phone = String(cd.phone ?? '').trim();
  const stripeCustomerId = typeof obj?.customer === 'string' ? obj.customer : undefined;
  return {
    email,
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
  };
}

/**
 * Record the buyer of a paid order: upsert the customer (atomic RPC) and link the
 * order to it + denormalize the email. `supabase` is a service-role client. Never
 * throws — customer recording must not fail the order.
 */
export async function recordCustomerForPaidOrder(
  supabase: any,
  opts: { orderId: string; merchantId: string; totalCents: number; raw: any; occurredAtIso: string },
): Promise<void> {
  const buyer = extractBuyerFromStripeEvent(opts.raw);
  if (!buyer || !opts.merchantId) return;
  try {
    const { data: customerId, error } = await supabase.rpc('upsert_customer_from_order', {
      p_merchant: opts.merchantId,
      p_email: buyer.email,
      p_name: buyer.name ?? null,
      p_phone: buyer.phone ?? null,
      p_stripe: buyer.stripeCustomerId ?? null,
      p_total: Math.max(0, Math.trunc(opts.totalCents || 0)),
      p_at: opts.occurredAtIso,
    });
    if (error) { console.warn('[customers] upsert failed:', error.message); return; }
    await supabase.from('orders').update({ customer_id: customerId ?? null, customer_email: buyer.email }).eq('id', opts.orderId);

    // Buyer-level analytics (best-effort; distinctId = customer, so events stitch to
    // the buyer rather than the merchant). Never let instrumentation break the path.
    if (customerId) {
      await emitBuyerEvents(supabase, {
        customerId,
        merchantId: opts.merchantId,
        totalCents: opts.totalCents,
      }).catch(() => {});
    }
  } catch (e: any) {
    console.warn('[customers] recordCustomerForPaidOrder threw:', e?.message || e);
  }
}

/**
 * After a paid order rolls into a customer, emit the buyer-level PostHog events:
 * `customer_created` (their first order) or `repeat_purchase` (a returning buyer),
 * and `campaign_order_attributed` when a campaign reached them within the attribution
 * window before this order (last-touch). Read-only + best-effort.
 */
async function emitBuyerEvents(
  supabase: any,
  opts: { customerId: string; merchantId: string; totalCents: number },
): Promise<void> {
  const { data: cust } = await supabase
    .from('customers')
    .select('orders_count, lifetime_cents')
    .eq('id', opts.customerId)
    .maybeSingle();
  const ordersCount = Number(cust?.orders_count ?? 0);

  if (ordersCount <= 1) {
    await captureServer(EVENTS.CUSTOMER_CREATED, { merchant_id: opts.merchantId, customer_id: opts.customerId, first_order_cents: opts.totalCents }, opts.customerId);
  } else {
    await captureServer(EVENTS.REPEAT_PURCHASE, { merchant_id: opts.merchantId, customer_id: opts.customerId, orders_count: ordersCount, lifetime_cents: Number(cust?.lifetime_cents ?? 0) }, opts.customerId);
  }

  // Last-touch attribution: the most recent campaign that reached this customer
  // within the window before now. Matches lib/crm/attribution's read-time logic.
  const sinceIso = new Date(Date.now() - ATTRIBUTION_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: sends } = await supabase
    .from('crm_campaign_sends')
    .select('campaign_id, created_at')
    .eq('customer_id', opts.customerId)
    .eq('status', 'sent')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1);
  const send = (sends ?? [])[0];
  if (send?.campaign_id) {
    await captureServer(
      EVENTS.CAMPAIGN_ORDER_ATTRIBUTED,
      { merchant_id: opts.merchantId, customer_id: opts.customerId, campaign_id: send.campaign_id, order_cents: opts.totalCents },
      opts.customerId,
    );
  }
}
