'use client';
// app/merchant/orders/fulfillment-buttons.tsx
//
// The kitchen controls. One primary action, the rest secondary.
//
// ⚠️ OPTIMISTIC, BECAUSE THE ALTERNATIVE IS A DOUBLE-TAP. On a tablet on a counter with bad wifi, a
// button that does nothing visible for 800ms gets pressed again. The state moves immediately and
// rolls back on failure with the reason shown — a lie for 800ms is better than an untracked second
// transition, and the rollback makes the lie self-correcting.
import { useState, useTransition } from 'react';
import {
  nextActions,
  FULFILLMENT_LABEL,
  type FulfillmentStatus,
} from '@/lib/commerce/fulfillment';

const TONE: Record<FulfillmentStatus, string> = {
  new: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  preparing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  ready: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  completed: 'bg-neutral-700/40 text-neutral-300 border-neutral-600/40',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export default function FulfillmentButtons({
  orderId,
  initial,
}: {
  orderId: string;
  initial: FulfillmentStatus;
}) {
  const [status, setStatus] = useState<FulfillmentStatus>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function move(to: FulfillmentStatus) {
    const prev = status;
    setStatus(to); // optimistic
    setError(null);
    start(async () => {
      try {
        const res = await fetch(`/api/merchant/orders/${orderId}/fulfillment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: to }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setStatus(prev); // roll back — the screen must match the database
          setError(j?.error || `Couldn’t save (${res.status})`);
        }
      } catch {
        setStatus(prev);
        setError('Couldn’t reach the server — try again.');
      }
    });
  }

  const actions = nextActions(status);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[status]}`}>
        {FULFILLMENT_LABEL[status]}
      </span>
      <div className="flex flex-wrap justify-end gap-1.5">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            disabled={pending}
            onClick={() => void move(a.to)}
            className={
              a.primary
                ? 'rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50'
                : 'rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50'
            }
          >
            {a.label}
          </button>
        ))}
      </div>
      {/* The failure is shown next to the control that failed, not as a toast that scrolls away
          from a screen nobody is watching. */}
      {error && <span className="max-w-[14rem] text-right text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
