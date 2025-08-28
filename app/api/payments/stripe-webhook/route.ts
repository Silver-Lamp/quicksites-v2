// app/api/stripe-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { StripeProvider } from '@/lib/payments/stripe';
import { createClient } from '@supabase/supabase-js';
import { makeToken } from '@/lib/review-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Service-role Supabase client for trusted server-side writes.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ------------------------- helpers ------------------------- */

async function ensureOrderReviewToken(orderId: string): Promise<string> {
  const { data: o } = await supabase
    .from('orders')
    .select('id, review_token')
    .eq('id', orderId)
    .maybeSingle();

  if (o?.review_token) return o.review_token;

  // Generate a short unique token with a few collision retries
  let token = makeToken();
  for (let i = 0; i < 6; i++) {
    const { data: clash } = await supabase
      .from('orders')
      .select('id')
      .eq('review_token', token)
      .maybeSingle();
    if (!clash) break;
    token = makeToken();
  }

  const exp = new Date(Date.now() + 60 * 24 * 3600e3).toISOString(); // +60 days
  await supabase
    .from('orders')
    .update({
      review_token: token,
      review_token_issued_at: new Date().toISOString(),
      review_token_expires: exp,
    })
    .eq('id', orderId);
  return token;
}

/** Decrement meal inventories once per order (guarded by `inventory_applied`). */
async function applyInventoryDecrements(orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, inventory_applied')
    .eq('id', orderId)
    .single();

  if (!order) return;
  if (order.inventory_applied) return; // already applied
  if (order.status !== 'paid') return; // only apply for paid orders

  const { data: items } = await supabase
    .from('order_items')
    .select('meal_id, quantity')
    .eq('order_id', orderId);

  if (items?.length) {
    // Use RPC to atomically decrement per item (defensive floor at 0 inside RPC)
    for (const it of items) {
      if (!it.meal_id || !it.quantity) continue;
      await supabase.rpc('dec_meal_qty', { _meal: it.meal_id, _by: it.quantity });
    }
  }

  // Mark applied regardless (prevents retry loops even when there were no items)
  await supabase.from('orders').update({ inventory_applied: true }).eq('id', orderId);
}

/* --------------------------- route --------------------------- */

type ProviderResult = {
  orderId?: string;
  newStatus?: 'paid' | 'failed' | 'canceled' | 'refunded' | string;
  providerPaymentId?: string;
  raw?: any; // Stripe event or object the provider returned
};

export async function POST(req: NextRequest) {
  try {
    // Read raw body for signature verification inside StripeProvider
    const raw = Buffer.from(await req.arrayBuffer());
    const headers = Object.fromEntries(req.headers.entries());

    const results: ProviderResult[] = await StripeProvider.handleWebhook(raw, headers);

    for (const r of results) {
      if (!r.orderId) continue;

      // 1) Update order status & provider refs (idempotent-friendly)
      if (r.newStatus) {
        const compactRaw =
          r.raw?.id ? { provider_event_id: r.raw.id, type: r.raw.type } : undefined;

        await supabase
          .from('orders')
          .update({
            status: r.newStatus,
            provider_payment_id: r.providerPaymentId ?? null,
            raw: compactRaw ?? null,
          })
          .eq('id', r.orderId);
      }

      // 2) If paid: ensure review token & apply inventory exactly once
      if (r.newStatus === 'paid') {
        await ensureOrderReviewToken(r.orderId);
        await applyInventoryDecrements(r.orderId);
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (e: any) {
    console.error('Stripe webhook error:', e?.message || e);
    return new NextResponse(`Webhook error: ${e?.message || 'unknown'}`, { status: 400 });
  }
}
