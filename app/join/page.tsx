'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function JoinPage() {
  const [siteId, setSiteId] = useState(''); // set this via server prop or hardcode delivered.menu site_id for now
  const [busy, setBusy] = useState(false);

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Become a Chef on delivered.menu</h1>
      <p className="text-sm text-muted-foreground">Connect payouts and start listing meals.</p>
      <div className="space-y-2">
        <Label>Site ID</Label>
        <Input value={siteId} onChange={(e) => setSiteId(e.target.value)} placeholder="UUID for delivered.menu" />
      </div>
      <Button
        disabled={!siteId || busy}
        onClick={async () => {
          setBusy(true);
          const r = await fetch('/api/chef/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId })
          });
          setBusy(false);
          const data = await r.json();
          if (data?.url) window.location.href = data.url;
          else alert(data?.error || 'Failed');
        }}
      >
        {busy ? 'Starting…' : 'Start selling'}
      </Button>
    </div>
  );
}
