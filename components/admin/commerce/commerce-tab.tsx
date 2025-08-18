// components/admin/commerce/commerce-tab.tsx
'use client';

import { useMemo, useState } from 'react';
import PaymentSettingsPanel from '../payments/payment-settings-panel';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OrdersTable from './orders-table';
import toast from 'react-hot-toast';

type Props = {
  merchantId: string;
  siteId?: string | null;
};

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include', // ensure Supabase cookies go along
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || data?.message || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data as T;
}

// keep only digits; helpful if someone pastes "$19.99" etc.
const digitsOnly = (s: string) => (s || '').replace(/\D+/g, '');

export default function CommerceTab({ merchantId, siteId = null }: Props) {
  const [amount, setAmount] = useState<string>('1999'); // cents, default $19.99
  const [busy, setBusy] = useState(false);

  const amountNum = useMemo(() => {
    const n = Number(digitsOnly(amount));
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const amountValid = amountNum >= 50; // e.g. minimum $0.50 to avoid Stripe errors

  async function createTestCheckout() {
    if (!amountValid) {
      toast.error('Enter a valid amount in cents (min 50).');
      return;
    }
    setBusy(true);
    try {
      const data = await jsonFetch<{ url?: string }>('/api/admin/orders/create-test', {
        method: 'POST',
        body: JSON.stringify({
          merchantId,
          siteId,
          amountCents: amountNum,
          currency: 'usd',
        }),
      });
      if (data.url) {
        // try to open in a new tab; fallback to same-tab if blocked
        const win = window.open(data.url, '_blank');
        if (!win) window.location.href = data.url;
        else toast.success('Opening Stripe Checkout…');
      } else {
        toast.error('No checkout URL returned');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error creating checkout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Payments / Payouts */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h2 className="mb-2 text-base font-semibold">Payments & Payouts</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Connect a payout account and set your platform fee (applied via Stripe Connect).
        </p>
        <PaymentSettingsPanel
          siteId={siteId ?? undefined}
          merchantId={merchantId}
          initialPlatformFeeBps={75}
        />
      </div>

      {/* Quick test checkout */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h2 className="mb-2 text-base font-semibold">Create Test Checkout</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Generates an order row and opens a Stripe Checkout link (uses test keys in dev).
        </p>
        <div className="flex max-w-md items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="amountCents">Amount (cents)</Label>
            <Input
              id="amountCents"
              value={amount}
              onChange={(e) => setAmount(digitsOnly(e.target.value))}
              inputMode="numeric"
              placeholder="e.g., 1999 for $19.99"
              aria-invalid={!amountValid}
            />
            {!amountValid && (
              <p className="mt-1 text-xs text-amber-500">Minimum 50 cents.</p>
            )}
          </div>
          <Button onClick={createTestCheckout} disabled={busy || !amountValid} aria-busy={busy ? 'true' : 'false'}>
            {busy ? 'Creating…' : 'Create & Open'}
          </Button>
        </div>
      </div>

      {/* Orders */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h2 className="mb-2 text-base font-semibold">Recent Orders</h2>
        <OrdersTable merchantId={merchantId} siteId={siteId ?? undefined} />
      </div>
    </div>
  );
}
