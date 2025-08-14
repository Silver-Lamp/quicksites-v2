// /components/cart/cart-store.ts
'use client';
import { create } from 'zustand';

type State = {
  couponCode?: string | null;
  discountPreviewCents?: number;
};
type Actions = {
  setCoupon: (code: string | null, preview?: number) => void;
  clearCoupon: () => void;
};

export const useCartStore = create<State & Actions>((set) => ({
  couponCode: null,
  discountPreviewCents: 0,
  setCoupon: (code, preview) => set({ couponCode: code || null, discountPreviewCents: preview || 0 }),
  clearCoupon: () => set({ couponCode: null, discountPreviewCents: 0 }),
}));
