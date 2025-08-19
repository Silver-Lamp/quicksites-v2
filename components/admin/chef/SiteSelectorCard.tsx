// components/admin/chef/SiteSelectorCard.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';

// Keep this minimal — just what we render
export type MeResp = {
  merchant: { id: string; name: string; default_platform_fee_bps: number } | null;
  stripeAccountId: string | null;
  sites: { site_id: string; status: string; role: string }[];
} | null;

export default function SiteSelectorCard({
  me,
  siteId,
  setSiteId,
}: {
  me: MeResp;
  siteId: string;
  setSiteId: (v: string) => void;
}) {
  const [busyOnboard, setBusyOnboard] = useState(false);
  const [busyManage, setBusyManage] = useState(false);

  async function startOnboarding() {
    if (!siteId) return toast.error('Enter Site ID first');
    setBusyOnboard(true);
    try {
      const r = await fetch('/api/chef/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Onboarding failed');
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || 'Failed to start onboarding');
    } finally {
      setBusyOnboard(false);
    }
  }

  async function managePayouts() {
    if (!me?.merchant?.id) return;
    setBusyManage(true);
    try {
      const r = await fetch('/api/connect/login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: me.merchant.id }),
      });
      const data = await r.json();
      if (data?.url) window.location.href = data.url;
      else toast.error('Could not open dashboard');
    } finally {
      setBusyManage(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <h2 className="text-base font-semibold mb-2">Site</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Enter the delivered.menu <code>site_id</code> for testing.
      </p>
      <div className="flex items-end gap-3 max-w-xl">
        <div className="flex-1">
          <Label htmlFor="siteId">Site ID</Label>
          <Input id="siteId" value={siteId} onChange={(e) => setSiteId(e.target.value)} placeholder="UUID…" />
        </div>
        {!me?.stripeAccountId ? (
          <Button onClick={startOnboarding} disabled={!siteId || busyOnboard}>
            {busyOnboard ? 'Starting…' : 'Join & Connect payouts'}
          </Button>
        ) : (
          <Button variant="outline" onClick={managePayouts} disabled={busyManage}>
            {busyManage ? 'Opening…' : 'Manage payouts'}
          </Button>
        )}
      </div>
      {!!me?.sites?.length && (
        <p className="text-xs text-muted-foreground mt-2">
          Linked sites: {me.sites.map((s) => `${s.site_id.slice(0, 8)}… (${s.status})`).join(', ')}
        </p>
      )}
    </div>
  );
}
