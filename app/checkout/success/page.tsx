// app/checkout/success/page.tsx
// Order receipt after a successful checkout (Stripe or test mode). Fetches the
// order + items and shows totals incl. the platform fee.
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import ClearCart from './clear-cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const fmt = (c: number | null | undefined, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((Number(c) || 0) / 100);

export default async function Success({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; test?: string }>;
}) {
  const { order: orderId, test } = await searchParams;

  let order: any = null;
  let items: any[] = [];
  if (orderId) {
    const { data: o } = await db
      .from('orders')
      .select('id,status,currency,subtotal_cents,platform_fee_cents,total_cents')
      .eq('id', orderId)
      .maybeSingle();
    order = o;
    if (o) {
      const { data: oi } = await db
        .from('order_items')
        .select('title,quantity,unit_price_cents,total_cents')
        .eq('order_id', orderId);
      items = oi ?? [];
    }
  }

  const cur = order?.currency || 'USD';

  return (
    <main className="mx-auto max-w-lg px-4 py-14">
      <ClearCart />
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Payment received 🎉</h1>
        {test === '1' && <p className="mt-1 text-xs text-amber-600">test mode — no real charge</p>}
      </div>

      {order ? (
        <div className="mt-8 rounded-xl border">
          <ul className="divide-y">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between p-3 text-sm">
                <span className="truncate">
                  {it.title} <span className="text-muted-foreground">× {it.quantity}</span>
                </span>
                <span>{fmt(it.total_cents ?? it.unit_price_cents * it.quantity, cur)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t p-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{fmt(order.subtotal_cents, cur)}</span>
            </div>
            {Number(order.platform_fee_cents) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Platform fee</span>
                <span>{fmt(order.platform_fee_cents, cur)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{fmt(order.total_cents, cur)}</span>
            </div>
          </div>
          <div className="border-t p-3 text-center text-xs text-muted-foreground">
            Order <code className="font-mono">{order.id}</code> · {order.status}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Order <code className="font-mono">{orderId || '(unknown)'}</code>
        </p>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-muted">
          Back home
        </Link>
      </div>
    </main>
  );
}
