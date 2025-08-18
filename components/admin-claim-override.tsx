// components/admin/tools/AdminClaimOverride.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { postJSON } from '@/components/admin/tools/http';

export function AdminClaimOverride({ domain }: { domain: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const markUnclaimed = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await postJSON('/api/admin/unclaim-site', { domain });
      // soft refresh data (no full reload)
      router.refresh();
    } catch (e: any) {
      alert(`Failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }, [busy, domain, router]);

  return (
    <button
      onClick={markUnclaimed}
      disabled={busy}
      className={`text-xs px-3 py-1 rounded text-white mt-2 transition
        ${busy ? 'bg-red-900/70 cursor-not-allowed' : 'bg-red-800 hover:bg-red-700'}`}
      title="Force this domain back to Unclaimed"
    >
      {busy ? 'Unclaiming…' : 'Force Unclaim'}
    </button>
  );
}
