'use client';

// app/checkout/page.tsx
// Customer checkout: posts the cart to /api/commerce/checkout, then redirects to
// the returned checkoutUrl (Stripe Checkout, or the test-mode success page when
// Stripe isn't configured). The cart's "Checkout" button routes here.
import * as React from 'react';
import Link from 'next/link';
import { useCartStore } from '@/components/cart/cart-store';

const fmt = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const merchantId = useCartStore((s) => s.merchantId);
  const subtotalCents = useCartStore((s) => s.subtotalCents);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const placeOrder = React.useCallback(async () => {
    setError(null);
    if (!merchantId) return setError('This cart has no merchant set.');
    if (!items.length) return setError('Your cart is empty.');
    setBusy(true);
    try {
      const res = await fetch('/api/commerce/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          items: items.map((it) => ({
            catalogItemId: it.catalog_item_id ?? it.id,
            variantId: it.variant_id ?? undefined,
            title: it.title,
            quantity: it.qty,
            unitAmount: it.price_cents,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Checkout failed (${res.status})`);
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (e: any) {
      setError(e?.message || 'Checkout failed');
      setBusy(false);
    }
  }, [merchantId, items]);

  if (!items.length) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link href="/cart" className="mt-3 inline-block text-sm underline underline-offset-4">
          Back to cart
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>

      <ul className="mb-4 divide-y rounded-xl border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between p-3 text-sm">
            <span className="truncate">
              {it.title}
              {it.variant_label && <span className="text-muted-foreground"> ({it.variant_label})</span>}{' '}
              <span className="text-muted-foreground">× {it.qty}</span>
            </span>
            <span>{fmt((it.price_cents || 0) * (it.qty || 0))}</span>
          </li>
        ))}
      </ul>

      <div className="mb-6 flex justify-between text-base font-semibold">
        <span>Total</span>
        <span>{fmt(subtotalCents)}</span>
      </div>

      {error && <div className="mb-3 text-sm text-red-500">{error}</div>}

      <button
        onClick={placeOrder}
        disabled={busy}
        className="w-full rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Processing…' : 'Place order'}
      </button>

      <div className="mt-3 text-center">
        <Link href="/cart" className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
          Back to cart
        </Link>
      </div>
    </main>
  );
}
