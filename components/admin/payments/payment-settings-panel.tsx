'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Separator } from '@/components/ui';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import toast from 'react-hot-toast';

type Props = {
  siteId?: string | null;             // optional per-site override
  merchantId: string;                 // required
  initialPlatformFeeBps?: number;     // show current value (site or merchant)
};

export default function PaymentSettingsPanel({ siteId, merchantId, initialPlatformFeeBps = 75 }: Props) {
  const [fee, setFee] = useState<number>(initialPlatformFeeBps);
  const [hasAccount, setHasAccount] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // quick check: do we have an Express account?
    fetch(`/api/admin/payments/status?merchantId=${merchantId}`).then(r => r.json()).then(d => {
      setHasAccount(!!d?.stripeAccountId);
      if (d?.platformFeeBps != null) setFee(d.platformFeeBps);
    }).catch(()=>{});
  }, [merchantId]);

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
        <Label>Platform fee</Label>
        <div className="flex items-center gap-3">
          <Slider min={0} max={100} step={5} value={[fee]} onValueChange={(v:any)=>setFee(v[0])} className="flex-1" />
          <div className="w-24 text-right text-sm">{(fee/100).toFixed(2)}%</div>
        </div>
        <p className="text-xs text-muted-foreground">Applied to orders via your sites. 100 bps = 1.00%.</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              setLoading(true);
              const res = await fetch('/api/admin/payments/save-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, merchantId, platformFeeBps: fee })
              });
              setLoading(false);
              if (!res.ok) return toast.error('Save failed');
              toast.success('Payment settings saved');
            }}
            disabled={loading}
          >
            Save
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {!hasAccount ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setLoading(true);
                const r = await fetch('/api/connect/onboard', { method: 'POST', body: JSON.stringify({ merchantId }), headers: {'Content-Type':'application/json'} });
                setLoading(false);
                const { url } = await r.json();
                if (url) window.location.href = url;
                else toast.error('Onboarding failed');
              }}
            >Enable payouts</Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const r = await fetch('/api/connect/login-link', { method: 'POST', body: JSON.stringify({ merchantId }), headers: {'Content-Type':'application/json'} });
                const { url } = await r.json();
                if (url) window.location.href = url;
                else toast.error('Could not open dashboard');
              }}
            >Manage payouts</Button>
          )}
        </div>
      </div>
    </div>

    </Collapsible>
  );
}
