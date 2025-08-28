import { NextRequest, NextResponse } from 'next/server';
import { adapterFor } from '@/lib/commerce/paymentRouter';
import { markOrderPaid } from '@/lib/commerce/orders';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  const adapter = adapterFor('stripe')!;
  try {
    const e = await adapter.parseWebhook(raw, Object.fromEntries(req.headers.entries()));
    if (e.type === 'payment_succeeded' && e.orderId && typeof e.amountCents === 'number') {
      await markOrderPaid(e.orderId, e.amountCents, 'stripe', e.raw.data.object.id, e.raw);
    }
    return new NextResponse('ok', { status: 200 });
  } catch (err: any) {
    console.error('Stripe webhook error', err?.message);
    return new NextResponse('bad', { status: 400 });
  }
}
