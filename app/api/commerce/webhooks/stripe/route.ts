import { NextRequest, NextResponse } from 'next/server';
import { adapterFor } from '@/lib/commerce/paymentRouter';
import { markOrderPaid, markOrderRefunded } from '@/lib/commerce/orders';
import { claimWebhookEvent, releaseWebhookEvent } from '@/lib/commerce/webhookDedup';
import { reverseApplicationFeeForCharge } from '@/lib/commerce/refunds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  const adapter = adapterFor('stripe')!;

  // 1) Verify the signature (parseWebhook throws on a bad/absent signature).
  let e;
  try {
    e = await adapter.parseWebhook(raw, Object.fromEntries(req.headers.entries()));
  } catch (err: any) {
    console.error('Stripe webhook verify error', err?.message);
    return new NextResponse('bad', { status: 400 });
  }

  // 2) Idempotency: claim the event id. A retried/duplicate event short-circuits
  //    so we never double-write payments/commissions or double-fire analytics.
  const claimed = await claimWebhookEvent('stripe', e.id, (e.raw as any)?.type);
  if (!claimed) return new NextResponse('ok (duplicate)', { status: 200 });

  // 3) Process. If it fails, release the claim so Stripe's retry can reprocess.
  try {
    // ⚠️ KEY THE LEDGER ON THE PAYMENT, NOT ON THE EVENT'S OWN OBJECT.
    //
    // This used to pass `e.raw.data.object.id`, which is `cs_…` for a session event and
    // `pi_…` for a payment_intent event — two keys for ONE payment. Stripe sends both for a
    // single Checkout payment, so the `payments` unique constraint on
    // `(provider, provider_payment_id)` never collapsed them and the first live order
    // recorded two rows for one $4 charge. `paymentId` is the payment_intent id, which both
    // events agree on: the second arrival now trips the uniqueness violation that
    // `markOrderPaid` already tolerates, while still being free to contribute the buyer
    // identity only the session event carries.
    //
    // Merge for facts, collapse for money.
    if (e.type === 'payment_succeeded' && e.orderId && typeof e.amountCents === 'number') {
      await markOrderPaid(e.orderId, e.amountCents, 'stripe', e.paymentId ?? e.raw.data.object.id, e.raw);
    } else if (e.type === 'refund_succeeded' && e.orderId) {
      // Reverse the platform application fee proportionally on Stripe (idempotent),
      // then keep our ledger consistent (void/clawback). Fee reversal is
      // best-effort so it can't block the ledger update.
      await reverseApplicationFeeForCharge(e.raw);
      await markOrderRefunded(e.orderId, e.amountCents, 'stripe', e.raw.data.object.id, e.raw);
    }
    return new NextResponse('ok', { status: 200 });
  } catch (err: any) {
    await releaseWebhookEvent('stripe', e.id);
    console.error('Stripe webhook processing error', err?.message);
    return new NextResponse('bad', { status: 400 });
  }
}
