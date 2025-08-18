// components/admin/payments/payment-settings-panel.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button, Badge, Separator } from '@/components/ui';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import toast from 'react-hot-toast';

type Props = {
  siteId?: string | null;          // optional per-site override
  merchantId: string;              // required
  initialPlatformFeeBps?: number;  // show current value (site or merchant)
};

type StatusResp = {
  stripeAccountId?: string | null;
  platformFeeBps?: number | null;
};

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include', // <- ensure Supabase cookies go with the request
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* noop */ }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      res.statusText ||
      'Request failed';
    throw new Error(msg);
  }
  return data as T;
}

export default function PaymentSettingsPanel({
  siteId,
  merchantId,
  initialPlatformFeeBps = 75,
}: Props) {
  const [fee, setFee] = useState<number>(initialPlatformFeeBps);
  const [initialFee, setInitialFee] = useState<number>(initialPlatformFeeBps);
  const [hasAccount, setHasAccount] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  // clamp helper (0..100 bps)
  const clampBps = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await jsonFetch<StatusResp>(`/api/admin/payments/status?merchantId=${encodeURIComponent(merchantId)}`);
        if (!alive) return;
        setHasAccount(Boolean(d?.stripeAccountId));
        if (d?.platformFeeBps != null) {
          const next = clampBps(d.platformFeeBps);
          setFee(next);
          setInitialFee(next);
        }
      } catch {
        // silent: panel should still render even if status fails
      }
    })();
    return () => { alive = false; };
  }, [merchantId]);

  const percentLabel = useMemo(() => `${(fee / 100).toFixed(2)}%`, [fee]);
  const isDirty = fee !== initialFee;

  const handleSave = async () => {
    setLoading(true);
    try {
      await jsonFetch('/api/admin/payments/save-settings', {
        method: 'POST',
        body: JSON.stringify({ siteId: siteId ?? undefined, merchantId, platformFeeBps: fee }),
      });
      setInitialFee(fee);
      toast.success('Payment settings saved');
    } catch (err: any) {
      toast.error(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboard = async () => {
    setLoading(true);
    try {
      const { url } = await jsonFetch<{ url?: string }>('/api/connect/onboard', {
        method: 'POST',
        body: JSON.stringify({ merchantId }),
      });
      if (url) window.location.href = url;
      else toast.error('Onboarding failed');
    } catch (err: any) {
      toast.error(`Onboarding failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDashboard = async () => {
    try {
      const { url } = await jsonFetch<{ url?: string }>('/api/connect/login-link', {
        method: 'POST',
        body: JSON.stringify({ merchantId }),
      });
      if (url) window.location.href = url;
      else toast.error('Could not open dashboard');
    } catch (err: any) {
      toast.error(`Open dashboard failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <Collapsible title="Payments" id="payments" defaultOpen={false}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Payments</h3>
          <Badge variant={hasAccount ? 'default' : 'secondary'}>
            {hasAccount ? 'Connected' : 'Not connected'}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label htmlFor="platform-fee-slider">Platform fee</Label>
          <div className="flex items-center gap-3">
            <Slider
              id="platform-fee-slider"
              min={0}
              max={100}
              step={5}
              value={[fee]}
              onValueChange={(v: number[]) => setFee(clampBps(v?.[0] ?? fee))}
              className="flex-1"
              aria-label="Platform fee (in basis points)"
            />
            <div className="w-24 text-right text-sm tabular-nums">{percentLabel}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            Applied to orders via your sites. 100 bps = 1.00%.
          </p>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading || !isDirty}
              aria-busy={loading ? 'true' : 'false'}
            >
              {loading ? 'Saving…' : 'Save'}
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {!hasAccount ? (
              <Button size="sm" variant="outline" onClick={handleOnboard} disabled={loading}>
                Enable payouts
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handleDashboard}>
                Manage payouts
              </Button>
            )}
          </div>
        </div>
      </div>
    </Collapsible>
  );
}
