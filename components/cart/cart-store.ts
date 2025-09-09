'use client';
import { create } from 'zustand';

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
  merchantId?: string | null;          // which merchant this cart belongs to (first add decides)
  couponCode?: string | null;
  discountPreviewCents?: number;
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
};

/* ---------- helpers ---------- */
const recomputeSubtotal = (items: CartItem[]) =>
  items.reduce((sum, it) => sum + it.price_cents * it.qty, 0);

/* ---------- store ---------- */
export const useCartStore = create<State & Actions>((set, get) => ({
  items: [],
  subtotalCents: 0,
  merchantId: null,
  couponCode: null,
  discountPreviewCents: 0,

  addItem: (p) =>
    set((state) => {
      const qty = Math.max(1, p.qty ?? 1);
      const idx = state.items.findIndex((i) => i.id === p.id);
      const nextItems =
        idx >= 0
          ? state.items.map((i, k) => (k === idx ? { ...i, qty: i.qty + qty } : i))
          : [
              ...state.items,
              {
                id: p.id,
                title: p.title,
                price_cents: p.price_cents,
                qty,
                image_url: p.image_url ?? null,
                product_type: p.product_type ?? null,
              },
            ];

      // if merchant changes, nuke coupon preview (different merchant)
      const nextMerchant =
        p.merchantId ?? state.merchantId ?? null;
      const merchantChanged =
        state.merchantId && nextMerchant && state.merchantId !== nextMerchant;

      return {
        items: nextItems,
        subtotalCents: recomputeSubtotal(nextItems),
        merchantId: nextMerchant,
        ...(merchantChanged
          ? { couponCode: null, discountPreviewCents: 0 }
          : null),
      };
    }),

  setQty: (id, qty) =>
    set((state) => {
      const q = Math.max(0, Math.floor(qty));
      const nextItems = state.items
        .map((i) => (i.id === id ? { ...i, qty: q } : i))
        .filter((i) => i.qty > 0);
      return {
        items: nextItems,
        subtotalCents: recomputeSubtotal(nextItems),
      };
    }),

  removeItem: (id) =>
    set((state) => {
      const nextItems = state.items.filter((i) => i.id !== id);
      return {
        items: nextItems,
        subtotalCents: recomputeSubtotal(nextItems),
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
}));
