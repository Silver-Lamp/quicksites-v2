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
      {/* Three items on one row — "Keep shopping", the title, and "Checkout" — is roughly 330px
          of content on a ~320px phone. It fits by squeezing whichever piece yields first, which
          is the title. So on a phone the title takes its own line above and the two actions sit
          beneath it, one at each edge; from `sm` it is the single centred row again. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="order-first w-full text-xl font-semibold sm:order-none sm:w-auto">Your Cart</h1>

        <Button
          variant="outline"
          onClick={handleKeepShopping}
          className="order-2 gap-2 sm:order-first"
          aria-label="Keep shopping"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Keep shopping</span>
          <span className="sm:hidden">Back</span>
        </Button>

        <Button
          onClick={handleCheckout}
          disabled={isEmpty}
          aria-disabled={isEmpty}
          className="order-3"
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
