// components/cart/ThankYouPageClient.tsx
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/components/cart/cart-store';
import ItemThumb from '@/components/cart/item-thumb';
import type { MenuIconSet } from '@/lib/menu/foodIcons';

function fmtUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ThankYouPageClient({ iconSet = 'none' }: { iconSet?: MenuIconSet } = {}) {
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
    /** Set only by a real server-side order. Its ABSENCE is what marks a demo run. */
    serverOrderId?: string | null;
    ts?: number;
    name?: string;
    last4?: string;
  } | null>(null);
  const [loaded, setLoaded] = React.useState(false);

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
    setLoaded(true);
    // Clear the cart once (in case user navigated directly)
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Was this the demo checkout?
   *
   * The receipt is rebuilt entirely from a sessionStorage snapshot that the CLIENT wrote — no
   * server round-trip happens on this page at all. A real order would carry a provider set by
   * the payment path; the demo card form writes provider:'card' with no charge behind it and
   * the express buttons write 'apple'/'google' the same way.
   *
   * A real checkout writes the SERVER's order id into the snapshot before redirecting to
   * Stripe, and Stripe returns to a success URL carrying that same id. Requiring BOTH — and
   * requiring them to match — means a receipt claims payment only for a buyer who actually
   * came back through Stripe's success redirect. Landing on this page directly, or via the
   * demo path, satisfies neither.
   *
   * ⚠️ Treat UNKNOWN as demo. Getting this backwards means telling someone they paid when they
   * did not, which is the failure that matters here — the opposite mistake merely under-claims
   * on a real order, and a real order has a server record to correct it from.
   */
  const isDemo = !(order?.serverOrderId && orderIdFromQuery && orderIdFromQuery === order.serverOrderId);

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

  // Avoid a flash of the "no order" state while the snapshot is read on mount.
  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center text-sm text-muted-foreground">
        Loading your receipt…
      </div>
    );
  }

  // Direct navigation / expired session → don't fake a confirmation.
  if (!order) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-semibold">No recent order found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn’t find a recent order in this browser. If you just checked out, check your email for a receipt.
        </p>
        <Button onClick={continueShopping}>Continue shopping</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        {/* ⚠️ THIS PAGE MUST NOT ASSERT THINGS THE DEMO CHECKOUT DID NOT DO.
            CheckoutPageClient's card form makes no API call: it waits 1200ms, mints a
            client-side id, and routes here. No order row, no charge, no email. This copy
            previously read "Your order was received. A receipt was sent to you." — three
            claims, all false, on a live site that had just accepted a card number.
            The checkout page does disclose it is a demo; the receipt dropped that and spoke
            with full confidence, which is the worst possible place to lose the caveat. */}
        <p className="text-sm text-muted-foreground">
          {isDemo
            ? 'This was a demo checkout — no payment was taken and no order was sent to the seller.'
            : <>Your order was received{order?.email ? <>. A receipt was sent to <b>{order.email}</b>.</> : '.'}</>}
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
                <ItemThumb imageUrl={it.image_url} title={it.title} iconSet={iconSet} />
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
            <span>{isDemo ? 'Order total (not charged)' : 'Total paid'}</span>
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
