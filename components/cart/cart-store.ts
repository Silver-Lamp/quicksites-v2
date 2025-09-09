// components/cart/cart-store.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/* ---------- types ---------- */
export type CartItem = {
  id: string;
  title: string;
  price_cents: number;
  qty: number;
  image_url?: string | null;
  product_type?: string | null;
};

type State = {
  items: CartItem[];
  subtotalCents: number;
  merchantId: string | null;            // single-merchant cart
  couponCode: string | null;
  discountPreviewCents: number;
  rehydrated: boolean;
};

type Actions = {
  addItem: (p: {
    id: string;
    title: string;
    price_cents: number;
    qty?: number;
    image_url?: string | null;
    product_type?: string | null;
    merchantId?: string | null;
  }) => void;

  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;

  setCoupon: (code: string | null, preview?: number) => void;
  clearCoupon: () => void;

  /** internal: recompute totals after rehydrate or bulk ops */
  __recompute: () => void;
};

/* ---------- helpers ---------- */
const subtotal = (items: CartItem[]) =>
  items.reduce((sum, it) => sum + (Number(it.price_cents) || 0) * (Number(it.qty) || 0), 0);

/* ---------- store ---------- */
export const useCartStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      items: [],
      subtotalCents: 0,
      merchantId: null,
      couponCode: null,
      discountPreviewCents: 0,
      rehydrated: false,

      addItem: (p) =>
        set((state) => {
          const incomingMerchant = p.merchantId ?? state.merchantId ?? null;

          // STRICT one-merchant policy:
          // If cart already has a different merchant, we clear and switch.
          let items = state.items;
          let merchantId = state.merchantId ?? incomingMerchant ?? null;
          let resetCoupon = false;

          if (state.merchantId && p.merchantId && p.merchantId !== state.merchantId) {
            items = [];
            merchantId = p.merchantId;
            resetCoupon = true;
          }

          const qty = Math.max(1, Math.floor(p.qty ?? 1));
          const idx = items.findIndex((i) => i.id === p.id);

          const nextItems =
            idx >= 0
              ? items.map((i, k) => (k === idx ? { ...i, qty: i.qty + qty } : i))
              : [
                  ...items,
                  {
                    id: p.id,
                    title: p.title,
                    price_cents: p.price_cents,
                    qty,
                    image_url: p.image_url ?? null,
                    product_type: p.product_type ?? null,
                  },
                ];

          return {
            items: nextItems,
            subtotalCents: subtotal(nextItems),
            merchantId,
            ...(resetCoupon ? { couponCode: null, discountPreviewCents: 0 } : null),
          };
        }),

      setQty: (id, q) =>
        set((state) => {
          const qty = Math.max(0, Math.floor(q));
          const nextItems = state.items
            .map((i) => (i.id === id ? { ...i, qty } : i))
            .filter((i) => i.qty > 0);
          return {
            items: nextItems,
            subtotalCents: subtotal(nextItems),
          };
        }),

      removeItem: (id) =>
        set((state) => {
          const nextItems = state.items.filter((i) => i.id !== id);
          return {
            items: nextItems,
            subtotalCents: subtotal(nextItems),
            // If the cart becomes empty, also clear merchant & coupon
            ...(nextItems.length === 0
              ? { merchantId: null, couponCode: null, discountPreviewCents: 0 }
              : null),
          };
        }),

      clearCart: () =>
        set({
          items: [],
          subtotalCents: 0,
          merchantId: null,
          couponCode: null,
          discountPreviewCents: 0,
        }),

      setCoupon: (code, preview) =>
        set({
          couponCode: code || null,
          discountPreviewCents: preview ?? 0,
        }),

      clearCoupon: () =>
        set({ couponCode: null, discountPreviewCents: 0 }),

      __recompute: () =>
        set((state) => ({
          subtotalCents: subtotal(state.items),
          rehydrated: true,
        })),
    }),
    {
      name: 'qs_cart_v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // store only what we need; subtotal is recomputed
      partialize: (s) => ({
        items: s.items,
        merchantId: s.merchantId,
        couponCode: s.couponCode,
        discountPreviewCents: s.discountPreviewCents,
      }),
      onRehydrateStorage: () => (state, err) => {
        if (err) {
          // failed to rehydrate; start fresh
          return;
        }
        // after hydration, recompute totals and flag ready
        queueMicrotask(() => {
          try {
            useCartStore.getState().__recompute();
          } catch {}
        });
      },
    },
  ),
);
