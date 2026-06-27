'use client';

// Clears the cart once the order is confirmed.
import * as React from 'react';
import { useCartStore } from '@/components/cart/cart-store';

export default function ClearCart() {
  const clearCart = useCartStore((s) => s.clearCart);
  React.useEffect(() => {
    clearCart();
  }, [clearCart]);
  return null;
}
