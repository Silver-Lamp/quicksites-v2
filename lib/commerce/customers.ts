// lib/commerce/customers.ts
//
// Customer identity spine (CRM_PLAN.md Phase 0). Extracts the buyer from a paid
// Stripe order and upserts a per-merchant customer record (deduped by normalized
// email), so orders roll up into order history + lifetime value. Best-effort: a
// failure here never blocks marking the order paid.

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
  } catch (e: any) {
    console.warn('[customers] recordCustomerForPaidOrder threw:', e?.message || e);
  }
}
