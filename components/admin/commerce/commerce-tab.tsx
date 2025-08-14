'use client';

import { useState } from 'react';
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

export default function CommerceTab({ merchantId, siteId = null }: Props) {
  const [amount, setAmount] = useState<string>('1999'); // cents, default $19.99
  const [busy, setBusy] = useState(false);

  async function createTestCheckout() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/orders/create-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          siteId,
          amountCents: parseInt(amount || '0', 10),
          currency: 'usd'
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Failed to create test order');
      if (data.url) window.open(data.url, '_blank');
      else toast.error('No checkout URL returned');
    } catch (e:any) {
      toast.error(e.message || 'Error creating checkout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Payments / Payouts */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Payments & Payouts</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect a payout account and set your platform fee (applied via Stripe Connect).
        </p>
        <PaymentSettingsPanel
          siteId={siteId ?? undefined}
          merchantId={merchantId}
          initialPlatformFeeBps={75}
        />
      </div>

      {/* Quick test checkout */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Create Test Checkout</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Generates an order row and opens a Stripe Checkout link (uses test keys in dev).
        </p>
        <div className="flex items-end gap-3 max-w-md">
          <div className="flex-1">
            <Label htmlFor="amountCents">Amount (cents)</Label>
            <Input
              id="amountCents"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="e.g., 1999 for $19.99"
            />
          </div>
          <Button onClick={createTestCheckout} disabled={busy}>
            {busy ? 'Creating…' : 'Create & Open'}
          </Button>
        </div>
      </div>

      {/* Orders */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Recent Orders</h2>
        <OrdersTable merchantId={merchantId} siteId={siteId ?? undefined} />
      </div>
    </div>
  );
}
