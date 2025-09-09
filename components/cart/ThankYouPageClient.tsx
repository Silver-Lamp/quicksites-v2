// components/cart/ThankYouPageClient.tsx
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/components/cart/cart-store';

function fmtUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ThankYouPageClient() {
  // We snapshot & clear cart; show details from sessionStorage
  const clearCart = useCartStore((s) => s.clearCart);

  const router = useRouter();
  const params = useSearchParams();
  const orderIdFromQuery = params?.get('order') || null;

  const [order, setOrder] = React.useState<{
    id: string;
    merchantId?: string | null;
    subtotalCents: number;
    items: Array<{ id: string; title: string; qty: number; price_cents: number; image_url?: string | null }>;
    email?: string | null;
    provider?: string | null;
    ts?: number;
    name?: string;
    last4?: string;
  } | null>(null);

  React.useEffect(() => {
    // Load snapshot
    try {
      const raw = sessionStorage.getItem('qs_last_order');
      if (raw) {
        const parsed = JSON.parse(raw);
        // If query has order, prefer matching snapshot; else accept any
        if (!orderIdFromQuery || parsed?.id === orderIdFromQuery) {
          setOrder(parsed);
        } else {
          // Different id than query—still show the stored one
          setOrder(parsed);
        }
      }
    } catch {}
    // Clear the cart once (in case user navigated directly)
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueShopping = React.useCallback(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/sites\/([^/]+)/);
    if (m) router.push(`/sites/${m[1]}`);
    else router.push('/');
  }, [router]);

  const copyId = React.useCallback(async () => {
    if (!order?.id) return;
    try { await navigator.clipboard.writeText(order.id); } catch {}
  }, [order?.id]);

  const lineTotal = (p: { price_cents: number; qty: number }) =>
    (Number(p.price_cents) || 0) * (Number(p.qty) || 0);

  const when = order?.ts ? new Date(order.ts) : new Date();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="text-sm text-muted-foreground">
          Your order was received{order?.email ? <>. A receipt was sent to <b>{order.email}</b>.</> : '.'}
        </p>
      </div>

      {/* Order header */}
      <div className="rounded-xl border p-4 text-sm flex flex-wrap items-center gap-3 justify-between">
        <div className="space-y-0.5">
          <div>
            <span className="text-muted-foreground">Order ID:&nbsp;</span>
            <span className="font-mono">{order?.id || '—'}</span>
          </div>
          <div className="text-muted-foreground">
            {when.toLocaleString()}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyId}>Copy ID</Button>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {/* Items recap */}
      {order?.items?.length ? (
        <div className="rounded-xl border p-4">
          <div className="mb-2 text-sm font-medium">Items</div>
          <ul className="divide-y">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-2">
                <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{it.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtUSD(it.price_cents)} × {it.qty}
                  </div>
                </div>
                <div className="w-24 text-right text-sm font-medium tabular-nums">
                  {fmtUSD(lineTotal(it))}
                </div>
              </li>
            ))}
          </ul>

          {/* Totals */}
          <div className="mt-3 border-t pt-2 text-sm flex justify-between font-medium">
            <span>Total paid</span>
            <span>{fmtUSD(order.subtotalCents || 0)}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          No line items found for this order.
        </div>
      )}

      <div className="text-center pt-2">
        <Button onClick={continueShopping}>Continue shopping</Button>
      </div>
    </div>
  );
}
