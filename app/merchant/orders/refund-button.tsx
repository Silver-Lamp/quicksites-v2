'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Refund action for a paid order. Calls POST /api/commerce/refund, which for a
 * real Stripe order reverses the charge + application fee (the platform fee is
 * returned too) and lets the webhook reconcile; for a test order it flips the DB
 * directly. Only rendered for paid orders.
 */
export default function RefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  const refund = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/commerce/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Refund failed');
      // Stripe path reconciles via webhook (status flips shortly after); test
      // path flips immediately. Refresh to reflect the new status.
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Refund failed');
      setBusy(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
      >
        Refund
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        onClick={refund}
        disabled={busy}
        className="rounded bg-red-600/90 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
      >
        {busy ? 'Refunding…' : 'Confirm'}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
