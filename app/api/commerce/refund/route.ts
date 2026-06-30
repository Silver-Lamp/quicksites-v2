import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { markOrderRefunded } from '@/lib/commerce/orders';
import { stripe } from '@/lib/stripe/server';
import { parseJsonBody } from '@/lib/api/parseJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RefundSchema = z.object({ orderId: z.string().min(1) });

/**
 * POST /api/commerce/refund { orderId }
 * Refund a paid order. For Stripe orders this creates a refund with
 * reverse_transfer + refund_application_fee (so the PLATFORM fee is returned too),
 * and the charge.refunded webhook reconciles our DB. For test/unconfigured orders
 * it updates the DB directly (order → refunded, commission voided).
 */
export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req, RefundSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { orderId } = parsedBody.data;

  const supabase = await getServerSupabase({ serviceRole: true });
  const { data: order } = await supabase
    .from('orders')
    .select('id, provider, provider_payment_id, status, total_cents')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 });
  if (order.status !== 'paid') {
    return NextResponse.json({ error: `order is '${order.status}', not 'paid'` }, { status: 400 });
  }

  // Real Stripe refund (reverses the application fee + transfer)
  if (order.provider === 'stripe' && process.env.STRIPE_SECRET_KEY) {
    try {
      let paymentIntentId = order.provider_payment_id as string | null;
      if (paymentIntentId && paymentIntentId.startsWith('cs_')) {
        const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
        paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
      }
      if (!paymentIntentId) {
        return NextResponse.json({ error: 'could not resolve payment_intent' }, { status: 400 });
      }
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
      });
      // The charge.refunded webhook will flip the order + void commission.
      return NextResponse.json({ ok: true, refundId: refund.id, viaWebhook: true });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'stripe refund failed' }, { status: 502 });
    }
  }

  // Test / unconfigured order — reconcile DB directly.
  await markOrderRefunded(orderId, order.total_cents ?? undefined, order.provider || 'test', `refund_${orderId}`, {
    test: true,
  });
  return NextResponse.json({ ok: true, test: true });
}
