// components/cart/cart-events-wire.tsx
'use client';

import * as React from 'react';
import { useCartStore } from './cart-store';

type CartAddPayload = {
  id: string;
  qty: number;
  price_cents: number;
  title: string;
  image_url?: string | null;
  product_type?: string | null;
  merchantId?: string | null;
};

type ConflictState = {
  open: boolean;
  currentMerchantId: string | null;
  incomingMerchantId: string | null;
  pending?: CartAddPayload | null;
};

export default function CartEventsWire() {
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const items = useCartStore((s) => s.items);
  const currentMerchantId = useCartStore((s) => s.merchantId);

  const [conflict, setConflict] = React.useState<ConflictState>({
    open: false,
    currentMerchantId: null,
    incomingMerchantId: null,
    pending: null,
  });

  // Handle add-to-cart events
  React.useEffect(() => {
    const onAdd = (ev: Event) => {
      const d = (ev as CustomEvent<CartAddPayload>).detail;
      if (!d || !d.id || !Number.isFinite(d.price_cents)) return;

      // Find incoming merchant (payload → snapshot → null)
      const snapMerchantId: string | null =
        (window as any).__QS_ECOM__?.merchantId ?? null;
      const incomingMerchantId = d.merchantId ?? snapMerchantId ?? null;

      const hasItems = items.length > 0;
      const hasCurrent = !!currentMerchantId;

      // Conflict if cart already has items from a different merchant
      if (
        hasItems &&
        hasCurrent &&
        incomingMerchantId &&
        currentMerchantId &&
        incomingMerchantId !== currentMerchantId
      ) {
        // announce conflict for any other listeners (optional analytics)
        try {
          window.dispatchEvent(
            new CustomEvent('qs:cart:conflict', {
              detail: {
                currentMerchantId,
                incomingMerchantId,
                pending: d,
              },
            }),
          );
        } catch {}

        setConflict({
          open: true,
          currentMerchantId,
          incomingMerchantId,
          pending: d,
        });
        return; // wait for user to confirm/cancel
      }

      // No conflict → add immediately
      addItem({
        id: d.id,
        title: d.title,
        price_cents: d.price_cents,
        qty: Math.max(1, d.qty ?? 1),
        image_url: d.image_url ?? null,
        product_type: d.product_type ?? null,
        merchantId: incomingMerchantId ?? null,
      });

      // Optional: let the rest of the UI know an item was added
      try {
        window.dispatchEvent(new CustomEvent('qs:cart:added', { detail: d }));
      } catch {}
    };

    window.addEventListener('qs:cart:add', onAdd as EventListener);
    return () => window.removeEventListener('qs:cart:add', onAdd as EventListener);
  }, [items, currentMerchantId, addItem]);

  const confirmSwitch = React.useCallback(() => {
    const pending = conflict.pending;
    if (!pending) {
      setConflict({ open: false, currentMerchantId: null, incomingMerchantId: null, pending: null });
      return;
    }

    // Clear and add with incoming merchant
    clearCart();
    addItem({
      id: pending.id,
      title: pending.title,
      price_cents: pending.price_cents,
      qty: Math.max(1, pending.qty ?? 1),
      image_url: pending.image_url ?? null,
      product_type: pending.product_type ?? null,
      merchantId: pending.merchantId ?? (window as any).__QS_ECOM__?.merchantId ?? null,
    });

    try {
      window.dispatchEvent(new CustomEvent('qs:cart:added', { detail: pending }));
    } catch {}

    setConflict({ open: false, currentMerchantId: null, incomingMerchantId: null, pending: null });
  }, [conflict.pending, clearCart, addItem]);

  const cancelSwitch = React.useCallback(() => {
    setConflict({ open: false, currentMerchantId: null, incomingMerchantId: null, pending: null });
  }, []);

  return (
    <>
      {/* invisible wiring component */}
      <span hidden aria-hidden="true" />

      {/* Minimal, dependency-free confirm modal */}
      {conflict.open && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/50" onClick={cancelSwitch} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-4 shadow-xl">
            <div className="text-sm font-medium mb-2">Switch merchant?</div>
            <p className="text-xs text-muted-foreground mb-4">
              Your cart has items from a different merchant. To add this item, we’ll clear the current cart and switch merchants.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border px-3 py-1.5 text-xs"
                onClick={cancelSwitch}
              >
                Cancel
              </button>
              <button
                className="rounded-md border px-3 py-1.5 text-xs bg-primary text-primary-foreground"
                onClick={confirmSwitch}
              >
                Switch &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
