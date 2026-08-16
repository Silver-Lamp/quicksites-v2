// components/cart/CartPageClient.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AutoApplyFromQuery from '@/components/cart/auto-apply-from-query';
import CartSummary from '@/app/cart/checkout/page';
import { useCartStore } from '@/components/cart/cart-store';
import { Button } from '@/components/ui/button';
import VenmoPay from '@/components/sites/venmo-pay';
import type { MenuIconSet } from '@/lib/menu/foodIcons';

export default function CartPageClient({ venmoHandle, iconSet = 'none' }: { venmoHandle?: string | null; iconSet?: MenuIconSet } = {}) {
  // ✅ SSR-safe: select primitives/arrays directly (no wrapped object)
  const merchantId = useCartStore((s) => s.merchantId || '');
  const subtotalCents = useCartStore((s) => s.subtotalCents || 0);
  const items = useCartStore((s) => s.items);

  const [msg, setMsg] = React.useState<string | null>(null);
  const isEmpty = !items.length || subtotalCents <= 0;

  const router = useRouter();

  const handleKeepShopping = React.useCallback(() => {
    // Try to go back; if there's no meaningful history, fall back to site root or home
    try {
      router.back();
      // In SPAs, back may no-op—fallback in a tick
      setTimeout(() => {
        // If we didn't navigate, push to a safe default
        if (document.referrer === '' || window.history.length <= 1) {
          const path = window.location.pathname;
          const m = path.match(/^\/sites\/([^/]+)/);
          if (m) router.push(`/sites/${m[1]}`);
          else router.push('/');
        }
      }, 10);
    } catch {
      const path = window.location.pathname;
      const m = path.match(/^\/sites\/([^/]+)/);
      if (m) router.push(`/sites/${m[1]}`);
      else router.push('/');
    }
  }, [router]);

  const handleCheckout = React.useCallback(() => {
    // Signal start of checkout for any listeners/integrations
    try {
      window.dispatchEvent(
        new CustomEvent('qs:checkout:start', {
          detail: { merchantId, subtotalCents, items },
        }),
      );
    } catch {}

    // Route to a sensible checkout URL for either host style
    const path = window.location.pathname;
    const m = path.match(/^\/sites\/([^/]+)/);
    if (m) router.push(`/sites/${m[1]}/checkout`);
    else router.push('/checkout');
  }, [router, merchantId, subtotalCents, items]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleKeepShopping}
          className="gap-2"
          aria-label="Keep shopping"
        >
          <ArrowLeft className="h-4 w-4" />
          Keep shopping
        </Button>

        <h1 className="text-xl font-semibold">Your Cart</h1>

        <Button
          onClick={handleCheckout}
          disabled={isEmpty}
          aria-disabled={isEmpty}
          title={isEmpty ? 'Add an item to checkout' : 'Proceed to checkout'}
        >
          Checkout
        </Button>
      </div>

      {/* Auto-apply coupon from URL params (kept mounted so a ?coupon= is
          captured even before items are added). */}
      <AutoApplyFromQuery
        merchantId={merchantId}
        subtotalCents={subtotalCents}
        onNotice={(m) => setMsg(m)}
      />

      {isEmpty ? (
        <div className="rounded-xl border p-10 text-center">
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Button onClick={handleKeepShopping} className="mt-4">
            Keep shopping
          </Button>
        </div>
      ) : (
        <>
          {msg && (
            <div role="status" className="rounded-md border px-3 py-2 text-xs">
              {msg}
            </div>
          )}

          {/* Main summary (items, steppers, totals, coupon chip) */}
          <CartSummary merchantId={merchantId} subtotalCents={subtotalCents} iconSet={iconSet} />

          {/* Pay the seller directly. Sits BELOW the summary deliberately: the cart's job is
              still to total the order, and this is one of two ways to settle it — not a
              competing checkout. It carries the total because the Venmo link cannot. */}
          {venmoHandle && (
            <VenmoPay handle={venmoHandle} amountCents={subtotalCents} context="cart" />
          )}
        </>
      )}
    </div>
  );
}
