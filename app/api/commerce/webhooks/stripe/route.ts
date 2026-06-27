import { NextRequest, NextResponse } from 'next/server';
import { adapterFor } from '@/lib/commerce/paymentRouter';
import { markOrderPaid, markOrderRefunded } from '@/lib/commerce/orders';
import { claimWebhookEvent, releaseWebhookEvent } from '@/lib/commerce/webhookDedup';

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
    if (e.type === 'payment_succeeded' && e.orderId && typeof e.amountCents === 'number') {
      await markOrderPaid(e.orderId, e.amountCents, 'stripe', e.raw.data.object.id, e.raw);
    } else if (e.type === 'refund_succeeded' && e.orderId) {
      await markOrderRefunded(e.orderId, e.amountCents, 'stripe', e.raw.data.object.id, e.raw);
    }
    return new NextResponse('ok', { status: 200 });
  } catch (err: any) {
    await releaseWebhookEvent('stripe', e.id);
    console.error('Stripe webhook processing error', err?.message);
    return new NextResponse('bad', { status: 400 });
  }
}
