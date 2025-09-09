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

export default function CartEventsWire() {
  React.useEffect(() => {
    const onAdd = (e: Event) => {
      const d = (e as CustomEvent<CartAddPayload>).detail;
      if (!d || !d.id || !Number.isFinite(d.price_cents)) return;
      // push into zustand
      useCartStore.getState().addItem({
        id: d.id,
        title: d.title,
        price_cents: d.price_cents,
        qty: d.qty ?? 1,
        image_url: d.image_url ?? null,
        product_type: d.product_type ?? null,
        merchantId: d.merchantId ?? (window as any).__QS_ECOM__?.merchantId ?? null,
      });
    };

    window.addEventListener('qs:cart:add', onAdd as EventListener);
    return () => window.removeEventListener('qs:cart:add', onAdd as EventListener);
  }, []);

  return null;
}
