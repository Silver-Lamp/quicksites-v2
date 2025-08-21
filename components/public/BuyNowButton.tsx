'use client';

import { useState } from 'react';
import { useCartStore } from '@/components/cart/cart-store';

export default function BuyNowButton({ mealId, slug }: { mealId: string; slug?: string | null }) {
  const [busy, setBusy] = useState(false);
  const couponCode = useCartStore.getState().couponCode || undefined;

  async function handleBuyNow(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/public/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId, quantity: 1, couponCode }),
      });
      const d = await r.json();
      if (d?.url) window.location.href = d.url;
      else alert(d?.error || 'Could not start checkout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleBuyNow}>
      <button
        type="submit"
        className="rounded-md border px-4 py-2 text-sm font-medium"
        disabled={busy}
      >
        {busy ? 'Starting…' : 'Buy Now'}
      </button>
    </form>
  );
}
